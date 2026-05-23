import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import { buildBuyerConfirmationEmail, buildAdminBookingNotificationEmail } from '../utils/paymentEmails';

const BOOKINGS_TABLE_ID = 82471; // audience_bookings table on Ezsite
const ADMIN_EMAIL = 'thenzmp@gmail.com';

/**
 * /booking-success
 *
 * After a successful Stripe Checkout for audience tickets, the user lands here with:
 *   ?ref=AUD26-001234&session_id=cs_xxx
 *
 * Reads the stashed booking from sessionStorage and:
 *   1. Saves the booking to Ezsite (if BOOKINGS_TABLE_ID is set)
 *   2. Sends the buyer their tickets by email
 *   3. Sends an admin notification to NZMP
 *   4. Renders a thank-you UI with the booking ref
 */
export default function BookingSuccess() {
  usePageMeta({
    title: 'Tickets Confirmed — NZ Melting Pot',
    description: 'Your audience tickets for the Musical Talent Showcase 2026 are confirmed.',
    path: '/booking-success'
  });

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'partial' | 'orphan'
  const [bookingRef, setBookingRef] = useState('');
  const [ticketCount, setTicketCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const urlRef = params.get('ref') || '';
      const sessionId = params.get('session_id') || '';

      let pending = null;
      try {
        const raw = sessionStorage.getItem('pendingBooking');
        if (raw) pending = JSON.parse(raw);
      } catch {
        pending = null;
      }

      if (!pending) {
        setStatus('orphan');
        return;
      }

      const effectiveRef = pending.ref || urlRef;
      setBookingRef(effectiveRef);
      const { bookingData, attendeeNamesArr } = pending;
      setTicketCount(bookingData.ticket_count);
      setTotalAmount(bookingData.total_amount);

      const localWarnings = [];

      // 1. Save to Ezsite DB (if the table has been created)
      if (BOOKINGS_TABLE_ID > 0) {
        try {
          const { error } = await window.ezsite.apis.tableCreate(BOOKINGS_TABLE_ID, {
            ...bookingData,
            payment_session_id: sessionId,
            status: 'paid',
            payment_completed_at: new Date().toISOString()
          });
          if (error) {
            console.error('Booking DB save failed:', error);
            localWarnings.push('Your tickets are confirmed but we could not save the booking record. Our team will reconcile manually.');
          }
        } catch (err) {
          console.error('Booking DB save exception:', err);
          localWarnings.push('Your tickets are confirmed but we could not save the booking record. Our team will reconcile manually.');
        }
      } else {
        // Table not yet provisioned on Ezsite — admin email will still go out so we don't lose data.
        console.warn('BOOKINGS_TABLE_ID is not set — DB save skipped. Admin email will carry the booking details.');
      }

      // 2. Send buyer their tickets
      try {
        const { subject, html, text } = buildBuyerConfirmationEmail({ bookingData, attendeeNamesArr });
        console.log('📧 Buyer email — subject:', subject, '— html length:', html.length, '— to:', bookingData.buyer_email);
        const result = await window.ezsite.apis.sendEmail({
          from: 'Musical Talent Showcase <noreply@nzmeltingpot.com>',
          to: [bookingData.buyer_email],
          subject,
          html,
          text
        });
        console.log('📧 Buyer email — result:', JSON.stringify(result));
        if (result?.error) {
          localWarnings.push(`Couldn't send your ticket email: ${result.error}. Please save your booking reference below.`);
        }
      } catch (err) {
        console.error('Buyer email exception:', err);
        localWarnings.push(`Couldn't send your ticket email: ${err.message}. Please save your booking reference below.`);
      }

      // 3. Send admin notification
      try {
        const { subject, html } = buildAdminBookingNotificationEmail({ bookingData, attendeeNamesArr, sessionId });
        console.log('📧 Admin booking email — subject:', subject, '— to:', ADMIN_EMAIL);
        const adminResult = await window.ezsite.apis.sendEmail({
          from: 'NZ Melting Pot Bookings <noreply@nzmeltingpot.com>',
          to: [ADMIN_EMAIL],
          subject,
          html
        });
        console.log('📧 Admin booking email — result:', JSON.stringify(adminResult));
        if (adminResult?.error) {
          console.error('Admin booking email error:', adminResult.error);
        }
      } catch (err) {
        console.error('Admin booking email exception:', err);
      }

      // 4. Clear stash
      try {sessionStorage.removeItem('pendingBooking');} catch {}

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
              <h1 style={headingStyle}>Confirming your booking…</h1>
              <p style={{ textAlign: 'center', color: '#6b7280' }}>This usually takes just a moment. Please don't close this page.</p>
            </>
          }

          {status === 'orphan' &&
          <>
              <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: 16 }}>✅</div>
              <h1 style={headingStyle}>Payment Received</h1>
              <p style={{ textAlign: 'center', lineHeight: 1.6, color: '#374151' }}>
                Thank you — your payment has been processed. If you've returned to this page later or from a different
                device, your booking is still recorded. If you don't receive your ticket email within
                a few minutes, please <Link to="/contact" style={linkStyle}>contact us</Link>.
              </p>
            </>
          }

          {(status === 'success' || status === 'partial') &&
          <>
              <div style={{ fontSize: '3.5rem', textAlign: 'center', marginBottom: 16 }}>🎟️</div>
              <h1 style={headingStyle}>Tickets Confirmed!</h1>
              <p style={{ textAlign: 'center', color: '#374151', fontSize: '1.05rem', lineHeight: 1.6 }}>
                Your payment was successful and your tickets are reserved.
              </p>

              <div style={refBoxStyle}>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>
                  Booking Reference
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 'bold', color: '#7B1E2D', letterSpacing: '2px' }}>
                  {bookingRef}
                </div>
                <div style={{ marginTop: 12, fontSize: '0.95rem', color: '#374151' }}>
                  {ticketCount} ticket{ticketCount === 1 ? '' : 's'} · <strong>${totalAmount} NZD</strong>
                </div>
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
                  <li>Your tickets have been emailed to you (please check spam if you don't see them).</li>
                  <li>Save the email — your tickets are inside.</li>
                  <li>Bring printed tickets or show them on your phone at the door.</li>
                </ul>
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

const refBoxStyle = {
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