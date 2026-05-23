import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';

/**
 * /payment-cancelled
 *
 * The user reached this page by clicking "back" or "cancel" on the Stripe
 * Checkout page. No payment was taken and no registration was saved (data is
 * still in sessionStorage in case they want to retry).
 */
export default function PaymentCancelled() {
  usePageMeta({
    title: 'Payment Cancelled — NZ Melting Pot',
    description: 'Your payment was cancelled and your registration was not completed.',
    path: '/payment-cancelled'
  });

  return (
    <section className="page-hero" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
      <div className="container" style={{ maxWidth: 560, width: '100%' }}>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '40px 36px',
          boxShadow: '0 6px 30px rgba(30, 25, 21, 0.10)',
          border: '1px solid #f3ede6',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
          <h1 style={{
            fontFamily: "'Cormorant', Georgia, serif",
            fontSize: '2rem',
            fontWeight: 700,
            color: '#1E1915',
            margin: '0 0 14px 0'
          }}>
            Payment Cancelled
          </h1>
          <p style={{ color: '#374151', fontSize: '1.02rem', lineHeight: 1.65, marginBottom: 24 }}>
            Your payment was not completed and your registration has <strong>not</strong> been recorded.
            Don't worry — no charges were made. You can try again anytime before the registration deadline.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 28 }}>
            <Link to="/musical-talent-showcase#registration-form" style={primaryBtn}>
              Try Again
            </Link>
            <Link to="/contact" style={secondaryBtn}>
              Need Help?
            </Link>
          </div>
        </div>
      </div>
    </section>);

}

const primaryBtn = {
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

const secondaryBtn = {
  display: 'inline-block',
  padding: '12px 28px',
  background: 'transparent',
  color: '#7B1E2D',
  textDecoration: 'none',
  border: '1.5px solid #7B1E2D',
  borderRadius: 25,
  fontWeight: 600,
  fontSize: '0.95rem',
  letterSpacing: '0.3px'
};