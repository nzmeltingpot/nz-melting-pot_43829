import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import { buildParticipantConfirmationEmail, buildAdminNotificationEmail } from '../utils/paymentEmails';

const TABLE_ID = 78687;
const ADMIN_EMAIL = 'thenzmp@gmail.com'; // Change here if a different admin recipient is preferred

/**
 * /payment-success
 *
 * After a successful Stripe Checkout, the user lands here with:
 *   ?code=TSC26001&session_id=cs_xxx
 *
 * The page reads the form payload from sessionStorage (stashed by the form
 * before the Stripe redirect) and:
 *   1. Saves the registration to the Ezsite database (status: 'paid')
 *   2. Sends a confirmation email to the participant
 *   3. Sends a notification email to the NZMP admin
 *   4. Shows a thank-you UI with the registration code
 *
 * If sessionStorage is missing (e.g. user opened link from email later),
 * we still show a success message but skip the DB write and send a manual
 * recovery message.
 */
export default function PaymentSuccess() {
  usePageMeta({
    title: 'Registration Confirmed — NZ Melting Pot',
    description: 'Your registration for the Musical Talent Showcase 2026 is confirmed.',
    path: '/payment-success'
  });

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'partial' | 'orphan'
  const [code, setCode] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [siteSettings, setSiteSettings] = useState({});
  const ranRef = useRef(false); // guard against double-run from React StrictMode

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code') || '';
      const sessionId = params.get('session_id') || '';

      // ⚡ Local-test workaround: if the user paid via the booking flow, the
      // Stripe Payment Link redirects them here too (since the Payment Link
      // has a fixed success URL). Detect that case and forward to /booking-success.
      try {
        const pendingBookingRaw = sessionStorage.getItem('pendingBooking');
        const pendingRegRaw = sessionStorage.getItem('pendingRegistration');
        if (pendingBookingRaw && !pendingRegRaw) {
          const pendingBooking = JSON.parse(pendingBookingRaw);
          const ref = pendingBooking?.ref || '';
          const redirectUrl = `/booking-success?ref=${encodeURIComponent(ref)}&session_id=${encodeURIComponent(sessionId)}`;
          window.location.replace(redirectUrl);
          return;
        }
      } catch (e) {
        console.error('Booking-redirect check failed:', e);
      }

      // Pull the stashed form data
      let pending = null;
      try {
        const raw = sessionStorage.getItem('pendingRegistration');
        if (raw) pending = JSON.parse(raw);
      } catch {
        pending = null;
      }

      // No pending data at all → the user landed here in a fresh tab. Cannot complete.
      if (!pending) {
        setStatus('orphan');
        return;
      }

      // If URL code mismatches, trust the stashed code (this happens with
      // Stripe Payment Links that have a static redirect URL — the real
      // createStripeCheckout backend will pass the correct code).
      const effectiveCode = pending.code || urlCode;
      setCode(effectiveCode);

      const { formData, siteSettings: stashedSettings } = pending;
      // Stash the recipient email address so the UI can display it
      setSiteSettings({ ...(stashedSettings || {}), _sentToEmail: formData.email });
      setAmountPaid(formData.total_fee);

      const localWarnings = [];

      // 1. Save to Ezsite DB
      try {
        const { error: dbError } = await window.ezsite.apis.tableCreate(TABLE_ID, {
          ...formData,
          payment_session_id: sessionId,
          status: 'paid',
          payment_completed_at: new Date().toISOString()
        });
        if (dbError) {
          console.error('DB save failed:', dbError);
          localWarnings.push('We received your payment but could not save your registration record. Our team has been notified.');
        }
      } catch (err) {
        console.error('DB save exception:', err);
        localWarnings.push('We received your payment but could not save your registration record. Our team has been notified.');
      }

      // 2. Send participant confirmation email (includes one ticket per participant)
      try {
        const { subject, html, text } = buildParticipantConfirmationEmail({
          recipientName: formData.participant_name,
          code: effectiveCode,
          amountPaid: formData.total_fee,
          siteSettings: stashedSettings || {},
          formData
        });
        console.log('📧 Participant email — subject:', subject, '— html length:', html.length);
        const result = await window.ezsite.apis.sendEmail({
          from: 'Musical Talent Showcase <noreply@nzmeltingpot.com>',
          to: [formData.email],
          subject,
          html,
          text
        });
        console.log('📧 Participant email — result:', JSON.stringify(result));
        if (result?.error) {
          localWarnings.push(`Couldn't send your confirmation email: ${result.error}. Please save your registration code below.`);
        }
      } catch (err) {
        console.error('Participant email exception:', err);
        localWarnings.push(`Couldn't send your confirmation email: ${err.message}. Please save your registration code below.`);
      }

      // 3. Send admin notification email
      try {
        const { subject, html } = buildAdminNotificationEmail({
          formData,
          code: effectiveCode,
          amountPaid: formData.total_fee,
          sessionId
        });
        console.log('📧 Admin email — subject:', subject, '— to:', ADMIN_EMAIL);
        const adminResult = await window.ezsite.apis.sendEmail({
          from: 'NZ Melting Pot Registrations <noreply@nzmeltingpot.com>',
          to: [ADMIN_EMAIL],
          subject,
          html
        });
        console.log('📧 Admin email — result:', JSON.stringify(adminResult));
        if (adminResult?.error) {
          console.error('Admin email error:', adminResult.error);
        }
      } catch (err) {
        // Admin email failure shouldn't block the user flow — just log
        console.error('Admin email exception:', err);
      }

      // 4. Clear the stash
      try {
        sessionStorage.removeItem('pendingRegistration');
      } catch {}

      setWarnings(localWarnings);
      setStatus(localWarnings.length > 0 ? 'partial' : 'success');
    })();
  }, []);

  return (
    <section className="page-hero" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
      <div className="container" style={{ maxWidth: 640, width: '100%' }}>
        <div style={cardStyle}>

          {status === 'processing' &&
          <>
              <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: 16 }}>⏳</div>
              <h1 style={headingStyle}>Confirming your payment…</h1>
              <p style={{ textAlign: 'center', color: '#6b7280' }}>This usually takes just a moment. Please don't close this page.</p>
            </>
          }

          {status === 'orphan' &&
          <>
              <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: 16 }}>✅</div>
              <h1 style={headingStyle}>Payment Received</h1>
              <p style={{ textAlign: 'center', lineHeight: 1.6, color: '#374151' }}>
                Thank you — your payment has been processed. If you've returned to this page later or from a different
                device, your registration is still recorded. If you don't receive your confirmation email within
                a few minutes, please <Link to="/contact" style={linkStyle}>contact us</Link> and quote any reference you have.
              </p>
            </>
          }

          {(status === 'success' || status === 'partial') &&
          <>
              <div style={{ fontSize: '3.5rem', textAlign: 'center', marginBottom: 16 }}>🎉</div>
              <h1 style={headingStyle}>Registration Confirmed!</h1>
              <p style={{ textAlign: 'center', color: '#374151', fontSize: '1.05rem', lineHeight: 1.6 }}>
                Your payment was successful and your spot is reserved.
              </p>

              {/* Registration code box */}
              <div style={codeBoxStyle}>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>
                  Registration Code
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#7B1E2D', letterSpacing: '3px' }}>
                  {code}
                </div>
                {amountPaid > 0 &&
              <div style={{ fontSize: '0.9rem', color: '#4b5563', marginTop: 10 }}>
                    Amount paid: <strong>${amountPaid} NZD</strong>
                  </div>
              }
              </div>

              {warnings.length > 0 &&
            <div style={warnBoxStyle}>
                  {warnings.map((w, i) =>
              <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0 0', fontSize: '0.9rem' }}>⚠️ {w}</p>
              )}
                </div>
            }

              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 20px', margin: '20px 0', fontSize: '0.92rem', lineHeight: 1.65, color: '#374151' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#111827' }}>What happens next?</p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>
                    A confirmation email with your ticket(s) has been sent to <strong>{siteSettings?._sentToEmail || 'your email address'}</strong>.
                    {' '}If you don't see it within a few minutes, please check your <strong>Spam</strong>, <strong>Junk</strong>, and <strong>Promotions</strong> folders.
                  </li>
                  <li>Save your registration code — you'll need it for show-day check-in.</li>
                  <li>We'll be in touch closer to the event with rehearsal details.</li>
                </ul>
              </div>

              {/* Audience tickets invitation */}
              <div style={inviteBoxStyle}>
                <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🎟️</div>
                <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#1E1915', fontSize: '0.98rem' }}>
                  Bringing family or friends along to cheer you on?
                </p>
                <p style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.6 }}>
                  Audience tickets are $10 NZD each — book up to 10 in one go.
                </p>
                <Link to="/book-tickets" style={inviteBtnStyle}>Book Audience Tickets →</Link>
              </div>

              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Link to="/" style={btnStyle}>Return to Home</Link>
              </div>
            </>
          }

        </div>
      </div>
    </section>);

}

const cardStyle = {
  background: '#fff',
  borderRadius: 16,
  padding: '40px 36px',
  boxShadow: '0 6px 30px rgba(30, 25, 21, 0.10)',
  border: '1px solid #f3ede6'
};

const headingStyle = {
  fontFamily: "'Cormorant', Georgia, serif",
  fontSize: '2rem',
  fontWeight: 700,
  color: '#1E1915',
  textAlign: 'center',
  margin: '0 0 14px 0'
};

const codeBoxStyle = {
  background: 'linear-gradient(135deg, #FBF5ED 0%, #F5EDDF 100%)',
  border: '2px dashed #c9a227',
  borderRadius: 12,
  padding: '24px 28px',
  margin: '24px auto',
  maxWidth: 380,
  textAlign: 'center'
};

const warnBoxStyle = {
  background: '#fef3c7',
  border: '1px solid #fbbf24',
  borderRadius: 8,
  padding: '12px 16px',
  margin: '16px 0',
  color: '#92400e'
};

const btnStyle = {
  display: 'inline-block',
  padding: '12px 28px',
  background: 'linear-gradient(135deg, #7B1E2D, #A83832)',
  color: '#fff',
  textDecoration: 'none',
  borderRadius: 25,
  fontWeight: 600,
  fontSize: '0.95rem',
  letterSpacing: '0.3px'
};

const linkStyle = {
  color: '#7B1E2D',
  fontWeight: 600
};

const inviteBoxStyle = {
  background: 'linear-gradient(135deg, #FBF5ED 0%, #F5EDDF 100%)',
  border: '1.5px solid #c9a227',
  borderRadius: 12,
  padding: '20px 22px',
  margin: '24px 0 0 0',
  textAlign: 'center'
};

const inviteBtnStyle = {
  display: 'inline-block',
  padding: '10px 22px',
  background: '#1E1915',
  color: '#c9a227',
  textDecoration: 'none',
  borderRadius: 25,
  fontWeight: 600,
  fontSize: '0.9rem',
  letterSpacing: '0.3px',
  border: '1.5px solid #c9a227'
};