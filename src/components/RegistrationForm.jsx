import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createStripeCheckout } from '../utils/stripeClient';

/* Rate limit: one submission per 30 seconds */
const COOLDOWN_MS = 30_000;
const TABLE_ID = 78687;
const SETTINGS_TABLE_ID = 79250;

/**
 * Pricing & date configuration — single source of truth.
 * All dates are interpreted in NZ (Pacific/Auckland) timezone.
 * "Inclusive" means the date itself is the LAST valid day at that rate.
 */
const PRICING = {
  RATE: 10, // NZD per participant (flat rate)
  REGISTRATION_CLOSE: '2026-07-01' // Last day to register (inclusive)
};

/**
 * DEV_MOCK_STRIPE — when true, skips Stripe entirely and jumps straight to
 * /payment-success with a fake session_id. Useful for verifying the post-
 * payment flow without a real Stripe call.
 */
const DEV_MOCK_STRIPE = false;

/**
 * DEV_USE_STRIPE_PAYMENT_LINK — temporary local-test mode. Redirects to a
 * fixed Stripe Payment Link (test mode) so we can verify the full Stripe
 * flow before Ezsite has built the createStripeCheckout backend function.
 *
 * The Payment Link has a fixed amount, so the form total won't match — but
 * the rest of the flow (real Stripe page, test card, redirect, emails, DB)
 * is exercised end-to-end.
 *
 * REMOVE this block (and its branch in handleSubmit) before going to production.
 */
const DEV_USE_STRIPE_PAYMENT_LINK = import.meta.env.DEV;
const DEV_STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_eVq8wR4vAe0W6dybscfAc00';

/**
 * Determine current pricing based on NZ date.
 * Returns: { rate, type: 'flat', closed: boolean, daysToClose? }
 */
function getCurrentPricing() {
  return { rate: PRICING.RATE, type: 'flat', closed: false };
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
function daysBetween(a, b) {
  const aDate = new Date(a + 'T00:00:00');
  const bDate = new Date(b + 'T00:00:00');
  return Math.round((bDate - aDate) / 86400000);
}

/** Convert YYYY-MM-DD (ISO) to DD/MM/YYYY (NZ display format). */
function formatNZ(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return isoDate;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate;
}

/* Default content used as fallback if DB fetch fails. These are also the
   defaults the Admin > Content tab can override. */
const DEFAULT_SETTINGS = {
  thankyou_heading: 'Registration Confirmed!',
  thankyou_message: "Your payment has been received and your spot is now reserved. We are thrilled to have you on board.",
  thankyou_important_text: 'A confirmation email with your tickets has been sent — please check your inbox',
  thankyou_instructions: "Save your registration code — you will need it on show day for check-in.\n\nWe will be in touch closer to the event with rehearsal details and show-day logistics.\n\nIf you need to update any registration details, please get in touch via our website's Contact page.",
  thankyou_closing: 'We look forward to seeing you on stage. Best of luck! 🎶',
  email_from: 'Musical Talent Showcase <noreply@nzmeltingpot.com>',
  email_subject_template: 'Registration Confirmed — Your Code: {code}',
  email_body: "Thank you for registering for our Musical Talent Showcase! Your payment has been received and your spot is confirmed.\n\nYour tickets and registration code are below — please keep this email safe.",
  email_important_text: 'Please bring your ticket(s) on show day (printed or on your phone)',
  email_instructions: "We will be in touch closer to the event with rehearsal details and show-day logistics.\n\nLast-minute withdrawals are not eligible for a refund of the entry fee. See our Terms & Conditions for full details.\n\nShould you have any questions, feel free to reach out via the Contact page on our website.",
  email_closing: 'Warm regards,\nThe NZ Melting Pot Team'
};

const CATEGORY_PARTICIPANTS = {
  individual: 1,
  duet: 2,
  trio: 3,
  quartet: 4
};

const AUCKLAND_TIMEZONE = 'Pacific/Auckland';

/**
 * Get the current date/time formatted in Auckland timezone.
 * Uses en-CA locale to produce unambiguous YYYY-MM-DD HH:MM:SS format,
 * avoiding the dd/mm/yyyy ↔ mm/dd/yyyy ambiguity of the en-NZ locale.
 */
function getAucklandTimestamp() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: AUCKLAND_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  // en-CA produces "YYYY-MM-DD, HH:MM:SS" — normalise to "YYYY-MM-DD HH:MM:SS"
  return fmt.format(now).replace(',', '');
}

/**
 * Get today's date in Auckland timezone (YYYY-MM-DD format)
 */
function getAucklandDateString() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AUCKLAND_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return parts; // Returns YYYY-MM-DD format
}

/**
 * Generate a unique sequential registration code.
 * Format: TSC26001, TSC26002, TSC26003, etc.
 */
async function generateSequentialCode() {
  try {
    // Fetch existing submissions to find the highest code number
    const { data, error } = await window.ezsite.apis.tablePage(TABLE_ID, {
      PageNo: 1,
      PageSize: 1000,
      OrderByField: 'id',
      IsAsc: false
    });

    if (error || !data?.List) {
      // Fallback to first code if unable to fetch
      return 'TSC26001';
    }

    // Find the highest existing code number
    let maxNumber = 0;
    data.List.forEach((row) => {
      if (row.unique_code) {
        const match = row.unique_code.match(/^TSC26(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    });

    // Next sequential number
    const nextNumber = maxNumber + 1;
    // Pad to 3 digits minimum (001, 002, ..., 999, 1000, etc.)
    const paddedNumber = nextNumber.toString().padStart(3, '0');
    return `TSC26${paddedNumber}`;
  } catch {
    return 'TSC26001';
  }
}

export default function RegistrationForm({ idPrefix = 'form' }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [category, setCategory] = useState('');
  const lastSubmitRef = useRef(0);
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SETTINGS);

  /* Fetch editable content from site_settings table */
  const loadSiteSettings = useCallback(async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(SETTINGS_TABLE_ID, {
        PageNo: 1, PageSize: 50, OrderByField: 'id', IsAsc: true
      });
      if (!error && data?.List) {
        const merged = { ...DEFAULT_SETTINGS };
        data.List.forEach((row) => {
          if (row.setting_key && row.setting_value !== undefined) {
            merged[row.setting_key] = row.setting_value;
          }
        });
        setSiteSettings(merged);
      }
    } catch {/* fallback to defaults */}
  }, []);

  useEffect(() => {loadSiteSettings();}, [loadSiteSettings]);

  // Controlled state for all required fields
  const [leaderName, setLeaderName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [participant2Name, setParticipant2Name] = useState('');
  const [participant3Name, setParticipant3Name] = useState('');
  const [participant4Name, setParticipant4Name] = useState('');
  const [heardAbout, setHeardAbout] = useState('');
  const [performanceType, setPerformanceType] = useState('');

  const numParticipants = useMemo(() => {
    return CATEGORY_PARTICIPANTS[category] || 0;
  }, [category]);

  // Compute current pricing on every render so it stays accurate even if the page is left open across midnight
  const pricing = useMemo(() => getCurrentPricing(), []);

  const totalFee = useMemo(() => {
    return numParticipants * pricing.rate;
  }, [numParticipants, pricing.rate]);

  // Check if all required fields are filled
  const isFormComplete = useMemo(() => {
    const baseFieldsFilled =
    leaderName.trim() !== '' &&
    dateOfBirth !== '' &&
    email.trim() !== '' &&
    phone.trim() !== '' &&
    category !== '' &&
    songTitle.trim() !== '' &&
    heardAbout !== '' &&
    performanceType !== '';

    // Check conditional participant names based on category
    const participantNamesFilled =
    (numParticipants < 2 || participant2Name.trim() !== '') && (
    numParticipants < 3 || participant3Name.trim() !== '') && (
    numParticipants < 4 || participant4Name.trim() !== '');

    return baseFieldsFilled && participantNamesFilled;
  }, [leaderName, dateOfBirth, email, phone, category, songTitle, heardAbout, performanceType, numParticipants, participant2Name, participant3Name, participant4Name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;

    /* --- Closed-state guard (defense in depth — closed UI replaces form already) --- */
    if (pricing.closed) {
      setErrorMessage('Registrations are closed. Please contact us if you need assistance.');
      return;
    }

    /* --- Honeypot check: bots fill hidden fields, humans don't --- */
    const honeypot = form.elements['website_url'];
    if (honeypot && honeypot.value) return;

    /* --- Rate limiting --- */
    const now = Date.now();
    if (now - lastSubmitRef.current < COOLDOWN_MS) {
      setErrorMessage('Please wait 30 seconds between submissions.');
      return;
    }

    /* --- Validation --- */
    const required = form.querySelectorAll('[required]');
    let valid = true;
    required.forEach((field) => {
      if (!field.value.trim()) {
        valid = false;
        field.style.borderColor = '#7B1E2D';
        const handler = () => {
          field.style.borderColor = '';
          field.removeEventListener('input', handler);
        };
        field.addEventListener('input', handler);
      }
    });
    if (!valid) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // 1. Generate unique registration code
      const code = await generateSequentialCode();

      // 2. Build form payload (will be saved to DB after payment)
      const formData = {
        participant_name: form.elements['participant_name'].value.trim(),
        date_of_birth: form.elements['date_of_birth'].value,
        email: form.elements['email'].value.trim(),
        phone: form.elements['phone'].value.trim(),
        category: category,
        performance_type: performanceType,
        participant_2_name: numParticipants >= 2 ? form.elements['participant_2_name']?.value.trim() || '' : '',
        participant_3_name: numParticipants >= 3 ? form.elements['participant_3_name']?.value.trim() || '' : '',
        participant_4_name: numParticipants >= 4 ? form.elements['participant_4_name']?.value.trim() || '' : '',
        num_performers: numParticipants,
        total_fee: totalFee,
        rate_type: 'flat',
        rate_per_participant: pricing.rate,
        song_title: form.elements['song_title'].value.trim(),
        year: form.elements['year'].value,
        heard_about: form.elements['heard_about'].value,
        submission_timestamp: getAucklandTimestamp(),
        unique_code: code
      };

      // 3. Stash payload + code in sessionStorage so /payment-success can retrieve it
      sessionStorage.setItem('pendingRegistration', JSON.stringify({
        code,
        formData,
        siteSettings,
        timestamp: now
      }));

      lastSubmitRef.current = now;

      // 4. DEV MOCK: skip Stripe and go straight to /payment-success
      if (DEV_MOCK_STRIPE) {
        const fakeSessionId = 'cs_test_mock_' + Date.now();
        window.location.href = `/payment-success?code=${encodeURIComponent(code)}&session_id=${fakeSessionId}`;
        return;
      }

      // 4b. DEV PAYMENT LINK: redirect to a fixed Stripe Payment Link (test mode)
      // Lets us verify the real Stripe flow before Ezsite ships the backend function.
      if (DEV_USE_STRIPE_PAYMENT_LINK && DEV_STRIPE_PAYMENT_LINK) {
        const url = new URL(DEV_STRIPE_PAYMENT_LINK);
        url.searchParams.set('client_reference_id', code);
        url.searchParams.set('prefilled_email', formData.email);
        window.location.href = url.toString();
        return;
      }

      // 5. Production: ask our Vercel backend to create a Stripe Checkout Session
      const origin = window.location.origin;
      const description = `Talent Showcase 2026 — ${category.charAt(0).toUpperCase() + category.slice(1)} (${numParticipants} × $${pricing.rate})`;

      const { data: stripeData, error: stripeError } = await createStripeCheckout({
        amount: totalFee * 100, // Stripe expects cents
        currency: 'nzd',
        registration_code: code,
        customer_email: formData.email,
        description,
        success_url: `${origin}/payment-success?code=${encodeURIComponent(code)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment-cancelled?code=${encodeURIComponent(code)}`
      });

      if (stripeError || !stripeData?.url) {
        throw new Error(stripeError || 'Could not start payment. Please try again.');
      }

      // 6. Redirect to Stripe's hosted Checkout
      window.location.href = stripeData.url;

    } catch (err) {
      console.error('❌ Payment initiation failed:', err);
      setErrorMessage(err.message || 'Failed to start payment. Please try again.');
      setIsSubmitting(false);
    }
  };

  /* --- Closed-state UI: replaces the form after registration close date --- */
  if (pricing.closed) {
    return (
      <div className="form-card">
        <div className="form-thankyou visible" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Registrations Are Now Closed</h3>
          <p style={{ fontSize: '1rem', lineHeight: '1.6', maxWidth: 520, margin: '12px auto' }}>
            Thank you for your interest in the Musical Talent Showcase 2026. The registration window
            has now closed (final day was {formatNZ(PRICING.REGISTRATION_CLOSE)}).
          </p>
          <p style={{ fontSize: '0.95rem', marginTop: 18 }}>
            For any queries, please <a href="/contact" style={{ color: '#ffd700', fontWeight: 600 }}>contact us</a>.
          </p>
        </div>
      </div>);

  }

  return (
    <div className="form-card">
      {/* Pricing banner */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.10)',
        border: '1.5px solid rgba(255, 255, 255, 0.20)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 22,
        textAlign: 'center',
        color: '#fff'
      }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.3px' }}>
          $10 per participant
        </p>
        <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
          Register now to secure your spot
        </p>
      </div>

      <form className="registration-form" name="registration" onSubmit={handleSubmit} noValidate>
        {/* Honeypot — hidden from humans, bots auto-fill it */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
          <label htmlFor={`${idPrefix}-website`}>Website</label>
          <input type="text" id={`${idPrefix}-website`} name="website_url" tabIndex={-1} autoComplete="off" />
        </div>

        {errorMessage &&
        <div className="form-error" role="alert" style={{
          padding: '12px 16px',
          marginBottom: '20px',
          backgroundColor: 'rgba(254, 226, 226, 0.95)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}>
            {errorMessage}
          </div>
        }

        <div className="form-grid">
          {/* Leader Name */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-name`}>Leader Name *</label>
            <input
              type="text"
              id={`${idPrefix}-name`}
              name="participant_name"
              required
              placeholder="Lead participant name"
              maxLength={100}
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)} />

          </div>

          {/* Date of Birth */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-dob`}>Date of Birth (Leader) *</label>
            <input
              type="date"
              id={`${idPrefix}-dob`}
              name="date_of_birth"
              required
              max={getAucklandDateString()}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)} />

          </div>

          {/* Contact Email */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-email`}>Contact Email *</label>
            <input
              type="email"
              id={`${idPrefix}-email`}
              name="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)} />

          </div>

          {/* Contact Phone */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-phone`}>Contact Phone *</label>
            <input
              type="tel"
              id={`${idPrefix}-phone`}
              name="phone"
              required
              placeholder="e.g. 021 123 4567"
              maxLength={20}
              pattern="[\d\s\+\-\(\)]{6,20}"
              title="Enter a valid phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)} />

          </div>

          {/* Category */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-category`}>Category *</label>
            <select
              id={`${idPrefix}-category`}
              name="category"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ color: '#ffffff' }}>

              <option value="" disabled style={{ color: '#333' }}>Select a category</option>
              <option value="individual" style={{ color: '#333' }}>Individual</option>
              <option value="duet" style={{ color: '#333' }}>Duet</option>
              <option value="trio" style={{ color: '#333' }}>Trio</option>
              <option value="quartet" style={{ color: '#333' }}>Quartet</option>
            </select>
          </div>

          {/* Song Title */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-song`} className="">Name of Song / Piece *</label>
            <input
              type="text"
              id={`${idPrefix}-song`}
              name="song_title"
              required
              placeholder="What will you perform?"
              maxLength={200}
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)} />

          </div>

          {/* Performance Type - Vocal or Instrumental */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-performance-type`} className="">Vocal  or Instrumental *</label>
            <select
              id={`${idPrefix}-performance-type`}
              name="performance_type"
              required
              value={performanceType}
              onChange={(e) => setPerformanceType(e.target.value)}
              style={{ color: '#ffffff' }}>

              <option value="" disabled style={{ color: '#333' }}>Select performance type</option>
              <option value="vocal" style={{ color: '#333' }}>Vocal</option>
              <option value="instrumental" style={{ color: '#333' }}>Instrumental</option>
            </select>
          </div>

          {/* Conditional Participant Names */}
          {numParticipants >= 2 &&
          <div className="form-group">
              <label htmlFor={`${idPrefix}-participant2`}>Participant 2 Name *</label>
              <input
              type="text"
              id={`${idPrefix}-participant2`}
              name="participant_2_name"
              required
              placeholder="Second participant name"
              maxLength={100}
              value={participant2Name}
              onChange={(e) => setParticipant2Name(e.target.value)} />

            </div>
          }

          {numParticipants >= 3 &&
          <div className="form-group">
              <label htmlFor={`${idPrefix}-participant3`}>Participant 3 Name *</label>
              <input
              type="text"
              id={`${idPrefix}-participant3`}
              name="participant_3_name"
              required
              placeholder="Third participant name"
              maxLength={100}
              value={participant3Name}
              onChange={(e) => setParticipant3Name(e.target.value)} />

            </div>
          }

          {numParticipants >= 4 &&
          <div className="form-group">
              <label htmlFor={`${idPrefix}-participant4`}>Participant 4 Name *</label>
              <input
              type="text"
              id={`${idPrefix}-participant4`}
              name="participant_4_name"
              required
              placeholder="Fourth participant name"
              maxLength={100}
              value={participant4Name}
              onChange={(e) => setParticipant4Name(e.target.value)} />

            </div>
          }

          {/* Number of Participants (read-only) */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-numparticipants`}>Number of Participants</label>
            <input
              type="text"
              id={`${idPrefix}-numparticipants`}
              name="num_performers_display"
              value={numParticipants || '—'}
              readOnly
              className="readonly-field" />

          </div>

          {/* Total Fee (read-only) */}
          <div className="form-group">
            <label htmlFor={`${idPrefix}-totalfee`}>Total Fee Payable</label>
            <input
              type="text"
              id={`${idPrefix}-totalfee`}
              name="total_fee_display"
              value={numParticipants ? `$${totalFee}` : '—'}
              readOnly
              className="readonly-field" />

          </div>

          {/* Payment Information Notice - Only visible when form is complete */}
          {isFormComplete &&
          <div
            className="form-group form-group--full"
            style={{
              animation: 'fadeInSlide 0.4s ease-out forwards',
              opacity: 0
            }}>
              <style>{`
                @keyframes fadeInSlide {
                  from {
                    opacity: 0;
                    transform: translateY(-10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>
              <label>Payment Information</label>
            <div
              className="payment-notice"
              style={{
                padding: '14px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                lineHeight: '1.55',
                color: '#2d3748',
                fontStyle: 'normal',
                letterSpacing: '0.01em',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 0 rgba(255, 255, 255, 0.5)'
              }}>

              <p style={{ margin: '0 0 10px 0' }}>
                <strong>Total payable: ${totalFee} NZD</strong> ({numParticipants} × ${pricing.rate}/participant)
              </p>
              <p style={{ margin: 0 }}>
                When you click <strong>Pay & Register</strong>, you will be taken to our secure Stripe payment page
                to complete your registration with a credit/debit card, Apple Pay or Google Pay. Your registration is
                confirmed only after a successful payment, and you will receive a confirmation email straight after.
              </p>
              </div>
            </div>
          }

          {/* Year (hidden) */}
          <input type="hidden" name="year" value="2026" />

          {/* How did you hear about this event */}
          <div className="form-group form-group--full">
            <label htmlFor={`${idPrefix}-heard`}>How did you hear about this event? *</label>
            <select
              id={`${idPrefix}-heard`}
              name="heard_about"
              required
              value={heardAbout}
              onChange={(e) => setHeardAbout(e.target.value)}
              style={{ color: '#ffffff' }}>
              <option value="" disabled style={{ color: '#333' }}>Select an option</option>
              <option value="phone_call" style={{ color: '#333' }}>Received phone call from committee member</option>
              <option value="email" style={{ color: '#333' }}>Received email</option>
              <option value="website" style={{ color: '#333' }}>Saw it on the website</option>
            </select>
          </div>

        </div>

        <div className="form__submit">
          <p style={{
            fontSize: '0.85rem',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '16px',
            textAlign: 'center',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
          }}>
            By submitting this form you are agreeing to all terms and conditions, which you can see{' '}
            <a href="/terms" style={{ color: '#ffffff', textDecoration: 'underline', fontWeight: '600' }}>here</a>.
          </p>
          <button
            type="submit"
            className="btn btn--primary btn--large"
            disabled={isSubmitting}
            style={{
              opacity: isSubmitting ? 0.6 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}>

            {isSubmitting ?
            'Redirecting to payment…' :
            isFormComplete ?
            `Pay & Register — $${totalFee} NZD` :
            'Pay & Register'}
          </button>
        </div>
      </form>
    </div>);

}