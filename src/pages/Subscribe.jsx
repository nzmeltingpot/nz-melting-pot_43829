import { useState } from 'react';
import useScrollReveal from '../hooks/useScrollReveal';
import usePageMeta from '../hooks/usePageMeta';

const MEMBERS_TABLE_ID = 79993;
const GROUP_B = 'B';

export default function Subscribe() {
  useScrollReveal();
  usePageMeta({
    title: 'Subscribe — NZ Melting Pot',
    description: 'Subscribe to the NZ Melting Pot newsletter.',
    path: '/subscribe'
  });

  const [status, setStatus] = useState('idle'); // idle | loading | success | already-subscribed | resubscribed | error
  const [errorMessage, setErrorMessage] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (!trimmedEmail || !trimmedName) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      // Check if this email already exists in the members table
      const { data, error: fetchError } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, {
        PageNo: 1,
        PageSize: 1,
        OrderByField: 'ID',
        IsAsc: false,
        Filters: [{ name: 'email', op: 'Equal', value: trimmedEmail }]
      });

      if (fetchError) throw new Error(fetchError);

      if (data?.List && data.List.length > 0) {
        const existing = data.List[0];

        if (existing.status === 'active') {
          // Already an active subscriber
          setStatus('already-subscribed');
          return;
        }

        // Was unsubscribed — reactivate them
        const today = new Date().toISOString().split('T')[0];
        const { error: updateError } = await window.ezsite.apis.tableUpdate(MEMBERS_TABLE_ID, {
          ID: existing.ID,
          full_name: trimmedName,
          status: 'active',
          unsubscribed_date: ''
        });

        if (updateError) throw new Error(updateError);
        setStatus('resubscribed');
        return;
      }

      // New subscriber — create with Group B
      const today = new Date().toISOString().split('T')[0];
      const { error: createError } = await window.ezsite.apis.tableCreate(MEMBERS_TABLE_ID, {
        full_name: trimmedName,
        email: trimmedEmail,
        status: 'active',
        group: GROUP_B,
        joined_date: today
      });

      if (createError) throw new Error(createError);

      setStatus('success');
    } catch (err) {
      console.error('Subscribe error:', err);
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again later.');
    }
  };

  const isIdle = status === 'idle';

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="container">
          <div className="page-hero__content reveal">
            <p className="text-accent">Community</p>
            <h1>Join Our Newsletter</h1>
            <p className="page-hero__subtitle">
              Stay connected with NZ Melting Pot
            </p>
          </div>
        </div>
        <div className="divider divider--bottom">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" fill="var(--color-cream)">
            <path d="M0,20 C480,60 960,10 1440,40 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* Content */}
      <section className="unsubscribe-section">
        <div className="container">
          <div className="unsubscribe-card reveal">

            {/* Subscription form */}
            {isIdle &&
              <>
                <div className="unsubscribe-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <h2>Subscribe to Our Newsletter</h2>
                <p className="unsubscribe-message">
                  Get updates about our events, performances, and community news
                  delivered straight to your inbox.
                </p>
                <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>
                  <div style={{ marginBottom: '18px', textAlign: 'left' }}>
                    <label
                      htmlFor="sub-name"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4a3728', marginBottom: '6px' }}>
                      Full Name
                    </label>
                    <input
                      id="sub-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #d4c4a8',
                        borderRadius: '6px',
                        fontSize: '15px',
                        color: '#1E1915',
                        background: '#fff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                    <label
                      htmlFor="sub-email"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4a3728', marginBottom: '6px' }}>
                      Email Address
                    </label>
                    <input
                      id="sub-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #d4c4a8',
                        borderRadius: '6px',
                        fontSize: '15px',
                        color: '#1E1915',
                        background: '#fff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
                    Subscribe
                  </button>
                </form>
                <p className="unsubscribe-note" style={{ marginTop: '20px' }}>
                  You can unsubscribe at any time — no spam, ever.
                </p>
              </>
            }

            {/* Loading */}
            {status === 'loading' &&
              <div className="unsubscribe-loading">
                <div className="spinner"></div>
                <p>Subscribing you now...</p>
              </div>
            }

            {/* Success — new subscriber */}
            {status === 'success' &&
              <>
                <div className="unsubscribe-icon unsubscribe-icon--success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12l2.5 2.5L16 9" />
                  </svg>
                </div>
                <h2>Welcome to the Community!</h2>
                <p className="unsubscribe-message">
                  You're now subscribed to the NZ Melting Pot newsletter.
                  We'll keep you updated on events, performances, and community news.
                </p>
                <p className="unsubscribe-note">
                  We're so glad to have you with us!
                </p>
              </>
            }

            {/* Resubscribed — was previously unsubscribed */}
            {status === 'resubscribed' &&
              <>
                <div className="unsubscribe-icon unsubscribe-icon--success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12l2.5 2.5L16 9" />
                  </svg>
                </div>
                <h2>Welcome Back!</h2>
                <p className="unsubscribe-message">
                  Great to have you back! Your subscription has been reactivated
                  and you'll start receiving our newsletters again.
                </p>
              </>
            }

            {/* Already subscribed */}
            {status === 'already-subscribed' &&
              <>
                <div className="unsubscribe-icon unsubscribe-icon--info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <circle cx="12" cy="8" r="0.5" fill="currentColor" />
                  </svg>
                </div>
                <h2>Already Subscribed</h2>
                <p className="unsubscribe-message">
                  Good news — <strong>{email.trim().toLowerCase()}</strong> is already
                  subscribed to our newsletter. You won't miss a thing!
                </p>
              </>
            }

            {/* Error */}
            {status === 'error' &&
              <>
                <div className="unsubscribe-icon unsubscribe-icon--error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h2>Something Went Wrong</h2>
                <p className="unsubscribe-message">{errorMessage}</p>
                <button
                  className="btn btn--primary btn--lg"
                  onClick={() => setStatus('idle')}
                  style={{ marginTop: '8px' }}>
                  Try Again
                </button>
              </>
            }

          </div>
        </div>
      </section>
    </>
  );
}
