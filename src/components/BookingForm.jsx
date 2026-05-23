import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createStripeCheckout } from '../utils/stripeClient';

/* ============================================================================
   Audience Ticket Booking Form
   For people buying tickets to ATTEND the Musical Talent Showcase 2026.
   Minimal fields — just buyer details + ticket count (1–10).
   ========================================================================== */

const COOLDOWN_MS = 30_000;
const SETTINGS_TABLE_ID = 79250;

/**
 * Audience-bookings table on Ezsite (created by Ezsite team).
 */
const BOOKINGS_TABLE_ID = 82471;

const PRICING = {
  TICKET_PRICE: 10, // NZD per audience ticket
  TICKETS_ON_SALE_UNTIL: '2026-07-18' // Last day tickets can be bought (event day)
};

const DEV_MOCK_STRIPE = false;
const DEV_USE_STRIPE_PAYMENT_LINK = import.meta.env.DEV;
const DEV_STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_eVq8wR4vAe0W6dybscfAc00';

const MAX_TICKETS = 10;

const AUCKLAND_TIMEZONE = 'Pacific/Auckland';

function getAucklandTimestamp() {
  return new Date().toLocaleString('en-NZ', {
    timeZone: AUCKLAND_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
}

function getAucklandDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AUCKLAND_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function formatNZ(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return isoDate;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate;
}

function isClosedForBookings() {
  return getAucklandDateString() > PRICING.TICKETS_ON_SALE_UNTIL;
}

/**
 * Generate a unique sequential booking reference: AUD26001, AUD26002, etc.
 * Falls back to AUD26001 if Ezsite's booking table isn't ready yet.
 */
async function generateBookingRef() {
  if (!BOOKINGS_TABLE_ID) {
    // Bookings table not yet created on Ezsite. Use timestamp-based fallback.
    return `AUD26-${Date.now().toString().slice(-6)}`;
  }
  try {
    const { data } = await window.ezsite.apis.tablePage(BOOKINGS_TABLE_ID, {
      PageNo: 1, PageSize: 1, OrderByField: 'id', IsAsc: false
    });
    if (data?.List?.length) {
      const last = data.List[0].booking_ref || '';
      const m = last.match(/AUD26(\d+)/);
      const next = m ? parseInt(m[1], 10) + 1 : 1;
      return `AUD26${String(next).padStart(3, '0')}`;
    }
  } catch (e) {
    console.error('Booking ref generation:', e);
  }
  return 'AUD26001';
}

export default function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [ticketCount, setTicketCount] = useState(1);
  const [attendeeNames, setAttendeeNames] = useState({}); // { 1: 'Name', 2: 'Name', ... }

  const lastSubmitRef = useRef(0);

  const totalAmount = useMemo(() => ticketCount * PRICING.TICKET_PRICE, [ticketCount]);
  const closed = isClosedForBookings();

  const isFormComplete = useMemo(() => {
    return (
      buyerName.trim() !== '' &&
      buyerEmail.trim() !== '' &&
      ticketCount >= 1 &&
      ticketCount <= MAX_TICKETS);

  }, [buyerName, buyerEmail, ticketCount]);

  const handleAttendeeNameChange = useCallback((idx, value) => {
    setAttendeeNames((prev) => ({ ...prev, [idx]: value }));
  }, []);

  // Trim attendee names array to ticketCount whenever count changes
  useEffect(() => {
    setAttendeeNames((prev) => {
      const next = {};
      for (let i = 1; i <= ticketCount; i++) {
        if (prev[i]) next[i] = prev[i];
      }
      return next;
    });
  }, [ticketCount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (closed) {
      setErrorMessage('Ticket sales have closed for this event.');
      return;
    }

    const honeypot = e.target.elements['website_url'];
    if (honeypot && honeypot.value) return;

    const now = Date.now();
    if (now - lastSubmitRef.current < COOLDOWN_MS) {
      setErrorMessage('Please wait 30 seconds between submissions.');
      return;
    }

    if (!isFormComplete) {
      setErrorMessage('Please fill in name, email and choose a ticket quantity (1–10).');
      return;
    }

    setIsSubmitting(true);

    try {
      const bookingRef = await generateBookingRef();

      // Collect attendee names (those provided)
      const attendeeNamesArr = [];
      for (let i = 1; i <= ticketCount; i++) {
        const n = (attendeeNames[i] || '').trim();
        attendeeNamesArr.push(n || '');
      }

      const bookingData = {
        booking_ref: bookingRef,
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        buyer_phone: buyerPhone.trim(),
        ticket_count: ticketCount,
        ticket_price: PRICING.TICKET_PRICE,
        total_amount: totalAmount,
        attendee_names: JSON.stringify(attendeeNamesArr),
        booking_timestamp: getAucklandTimestamp(),
        year: '2026'
      };

      // Stash for /booking-success
      sessionStorage.setItem('pendingBooking', JSON.stringify({
        ref: bookingRef,
        bookingData,
        attendeeNamesArr,
        timestamp: now
      }));

      lastSubmitRef.current = now;

      // DEV MOCK
      if (DEV_MOCK_STRIPE) {
        const fakeSessionId = 'cs_test_mock_' + Date.now();
        window.location.href = `/booking-success?ref=${encodeURIComponent(bookingRef)}&session_id=${fakeSessionId}`;
        return;
      }

      // DEV PAYMENT LINK
      if (DEV_USE_STRIPE_PAYMENT_LINK && DEV_STRIPE_PAYMENT_LINK) {
        const url = new URL(DEV_STRIPE_PAYMENT_LINK);
        url.searchParams.set('client_reference_id', bookingRef);
        url.searchParams.set('prefilled_email', buyerEmail.trim());
        window.location.href = url.toString();
        return;
      }

      // PRODUCTION — call our Vercel backend
      const origin = window.location.origin;
      const description = `Talent Showcase 2026 — ${ticketCount} audience ticket${ticketCount === 1 ? '' : 's'}`;
      const { data, error } = await createStripeCheckout({
        amount: totalAmount * 100,
        currency: 'nzd',
        registration_code: bookingRef,
        customer_email: buyerEmail.trim(),
        description,
        success_url: `${origin}/booking-success?ref=${encodeURIComponent(bookingRef)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment-cancelled?ref=${encodeURIComponent(bookingRef)}`
      });

      if (error || !data?.url) {
        throw new Error(error || 'Could not start payment. Please try again.');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error('Booking submission failed:', err);
      setErrorMessage(err.message || 'Failed to start payment. Please try again.');
      setIsSubmitting(false);
    }
  };

  /* ---------------------- Closed-state UI ---------------------- */
  if (closed) {
    return (
      <div className="form-card">
        <div className="form-thankyou visible" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Ticket Sales Are Closed</h3>
          <p style={{ fontSize: '1rem', lineHeight: '1.6', maxWidth: 520, margin: '12px auto' }}>
            Thank you for your interest. Tickets for the 2026 Musical Talent Showcase
            are no longer available online (sales closed {formatNZ(PRICING.TICKETS_ON_SALE_UNTIL)}).
          </p>
          <p style={{ fontSize: '0.95rem', marginTop: 18 }}>
            For any queries, please <a href="/contact" style={{ color: '#ffd700', fontWeight: 600 }}>contact us</a>.
          </p>
        </div>
      </div>);

  }

  /* ---------------------- Booking form ---------------------- */
  return (
    <div className="form-card">
      {/* Pricing banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(255, 165, 0, 0.12))',
        border: '1.5px solid rgba(255, 200, 50, 0.55)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 22,
        textAlign: 'center',
        color: '#fff'
      }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.3px' }}>
          🎟️ Audience Tickets — ${PRICING.TICKET_PRICE} NZD per ticket
        </p>
        <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
          Up to {MAX_TICKETS} tickets per booking · Sales close {formatNZ(PRICING.TICKETS_ON_SALE_UNTIL)}
        </p>
      </div>

      <form className="registration-form" name="booking" onSubmit={handleSubmit} noValidate>
        {/* Honeypot */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
          <label htmlFor="bk-website">Website</label>
          <input type="text" id="bk-website" name="website_url" tabIndex={-1} autoComplete="off" />
        </div>

        {errorMessage &&
        <div className="form-error" role="alert" style={{
          padding: '12px 16px',
          marginBottom: '20px',
          backgroundColor: 'rgba(254, 226, 226, 0.95)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px'
        }}>
            {errorMessage}
          </div>
        }

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="bk-name">Your Name *</label>
            <input
              type="text"
              id="bk-name"
              name="buyer_name"
              required
              placeholder="Full name"
              maxLength={100}
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="bk-email">Email *</label>
            <input
              type="email"
              id="bk-email"
              name="buyer_email"
              required
              placeholder="you@example.com"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="bk-phone">Phone (optional)</label>
            <input
              type="tel"
              id="bk-phone"
              name="buyer_phone"
              placeholder="e.g. 021 123 4567"
              maxLength={20}
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="bk-tickets">Number of Tickets *</label>
            <select
              id="bk-tickets"
              name="ticket_count"
              required
              value={ticketCount}
              onChange={(e) => setTicketCount(parseInt(e.target.value, 10))}
              style={{ color: '#ffffff' }}>
              {Array.from({ length: MAX_TICKETS }, (_, i) => i + 1).map((n) =>
              <option key={n} value={n} style={{ color: '#333' }}>
                  {n} {n === 1 ? 'ticket' : 'tickets'} — ${n * PRICING.TICKET_PRICE} NZD
                </option>
              )}
            </select>
          </div>

          {/* Optional attendee names — appears once they pick > 1 */}
          {ticketCount > 1 &&
          <div className="form-group form-group--full" style={{
            animation: 'fadeInSlide 0.4s ease-out forwards',
            opacity: 0
          }}>
              <style>{`
                @keyframes fadeInSlide {
                  from { opacity: 0; transform: translateY(-10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <label>Attendee Names (optional — for personalised tickets)</label>
              <div style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              padding: 14
            }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)' }}>
                  If you'd like each ticket personalised, enter the attendee's name. Leave blank to use your name on every ticket.
                </p>
                {Array.from({ length: ticketCount }, (_, i) => i + 1).map((n) =>
              <input
                key={n}
                type="text"
                placeholder={`Ticket ${n} — attendee name`}
                maxLength={100}
                value={attendeeNames[n] || ''}
                onChange={(e) => handleAttendeeNameChange(n, e.target.value)}
                style={{
                  width: '100%',
                  marginBottom: 8,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }} />
              )}
              </div>
            </div>
          }

          {/* Total summary */}
          {isFormComplete &&
          <div
            className="form-group form-group--full"
            style={{
              animation: 'fadeInSlide 0.4s ease-out forwards',
              opacity: 0
            }}>
              <label>Booking Summary</label>
              <div style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#2d3748',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  <strong>Total: ${totalAmount} NZD</strong> ({ticketCount} × ${PRICING.TICKET_PRICE})
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.55 }}>
                  When you click <strong>Pay & Book</strong>, you'll be taken to our secure Stripe payment page
                  to complete your booking with a credit/debit card, Apple Pay or Google Pay. Your tickets will
                  be emailed to you straight after payment.
                </p>
              </div>
            </div>
          }
        </div>

        <div className="form__submit">
          <p style={{
            fontSize: '0.85rem',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '16px',
            textAlign: 'center',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
          }}>
            By booking you agree to all terms and conditions, which you can see{' '}
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
            `Pay & Book — $${totalAmount} NZD` :
            'Pay & Book'}
          </button>
        </div>
      </form>
    </div>);

}