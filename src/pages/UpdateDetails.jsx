import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import useScrollReveal from '../hooks/useScrollReveal';
import usePageMeta from '../hooks/usePageMeta';

const MEMBERS_TABLE_ID = 79993;

export default function UpdateDetails() {
  useScrollReveal();
  usePageMeta({
    title: 'Update Your Details — NZ Melting Pot',
    description: 'Update your name or email address in our newsletter list.',
    path: '/update-details'
  });

  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';

  const [status, setStatus] = useState('idle'); // idle | loading | saving | success | error | not-found
  const [errorMessage, setErrorMessage] = useState('');
  const [memberId, setMemberId] = useState(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Load member data on mount
  useEffect(() => {
    if (!emailFromUrl) {
      setStatus('error');
      setErrorMessage('No email address provided in the link.');
      return;
    }

    const loadMember = async () => {
      setStatus('loading');
      try {
        const { data, error } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, {
          PageNo: 1,
          PageSize: 1,
          OrderByField: 'ID',
          IsAsc: false,
          Filters: [{ name: 'email', op: 'Equal', value: emailFromUrl }]
        });

        if (error) throw new Error(error);

        if (!data?.List || data.List.length === 0) {
          setStatus('not-found');
          return;
        }

        const member = data.List[0];
        setMemberId(member.ID);
        setFullName(member.full_name || '');
        setNewEmail(member.email || emailFromUrl);
        setStatus('idle');
      } catch (err) {
        console.error('UpdateDetails load error:', err);
        setStatus('error');
        setErrorMessage('Could not load your details. Please try again later.');
      }
    };

    loadMember();
  }, [emailFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName.trim() && !newEmail.trim()) return;

    const trimmedEmail = newEmail.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setStatus('saving');
    setErrorMessage('');

    try {
      // If email is changing, make sure it doesn't already exist
      if (trimmedEmail !== emailFromUrl.toLowerCase()) {
        const { data: checkData, error: checkError } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, {
          PageNo: 1,
          PageSize: 1,
          OrderByField: 'ID',
          IsAsc: false,
          Filters: [{ name: 'email', op: 'Equal', value: trimmedEmail }]
        });

        if (checkError) throw new Error(checkError);

        if (checkData?.List && checkData.List.length > 0) {
          setStatus('error');
          setErrorMessage('That email address is already registered. Please use a different one.');
          return;
        }
      }

      const { error: updateError } = await window.ezsite.apis.tableUpdate(MEMBERS_TABLE_ID, {
        ID: memberId,
        full_name: fullName.trim(),
        email: trimmedEmail
      });

      if (updateError) throw new Error(updateError);

      setStatus('success');
    } catch (err) {
      console.error('UpdateDetails save error:', err);
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again later.');
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="container">
          <div className="page-hero__content reveal">
            <p className="text-accent">Newsletter</p>
            <h1>Update Your Details</h1>
            <p className="page-hero__subtitle">
              Keep your information up to date
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

            {/* Loading member data */}
            {status === 'loading' &&
              <div className="unsubscribe-loading">
                <div className="spinner"></div>
                <p>Loading your details...</p>
              </div>
            }

            {/* Form */}
            {status === 'idle' && memberId &&
              <>
                <div className="unsubscribe-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h2>Update Your Details</h2>
                <p className="unsubscribe-message">
                  Edit your name or email address below. We'll update your
                  newsletter subscription immediately.
                </p>
                <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>
                  <div style={{ marginBottom: '18px', textAlign: 'left' }}>
                    <label
                      htmlFor="ud-name"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4a3728', marginBottom: '6px' }}>
                      Full Name
                    </label>
                    <input
                      id="ud-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
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
                      htmlFor="ud-email"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4a3728', marginBottom: '6px' }}>
                      Email Address
                    </label>
                    <input
                      id="ud-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
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
                    Save Changes
                  </button>
                </form>
              </>
            }

            {/* Saving */}
            {status === 'saving' &&
              <div className="unsubscribe-loading">
                <div className="spinner"></div>
                <p>Saving your details...</p>
              </div>
            }

            {/* Success */}
            {status === 'success' &&
              <>
                <div className="unsubscribe-icon unsubscribe-icon--success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12l2.5 2.5L16 9" />
                  </svg>
                </div>
                <h2>Details Updated</h2>
                <p className="unsubscribe-message">
                  Your information has been updated successfully.
                  Future newsletters will use your new details.
                </p>
              </>
            }

            {/* Not found */}
            {status === 'not-found' &&
              <>
                <div className="unsubscribe-icon unsubscribe-icon--warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
                  </svg>
                </div>
                <h2>Email Not Found</h2>
                <p className="unsubscribe-message">
                  We couldn't find <strong>{emailFromUrl}</strong> in our mailing list.
                  The link may have expired or the email address may have already changed.
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
              </>
            }

          </div>
        </div>
      </section>
    </>
  );
}
