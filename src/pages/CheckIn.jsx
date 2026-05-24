/**
 * /check-in — Gate check-in page for the Musical Talent Showcase 2026.
 *
 * USAGE AT THE GATE:
 *   Volunteers open https://www.nzmeltingpot.com/check-in on their phone.
 *   They enter the event PIN once (stored in sessionStorage for the session).
 *   Then they can either:
 *     A) Scan a participant's QR code with the phone camera — the QR encodes
 *        the check-in URL (https://nzmeltingpot.com/check-in?code=TSC26001),
 *        so scanning opens the page automatically with the code pre-filled.
 *     B) Type the registration code manually in the search box.
 *
 * CHECK-IN STATE:
 *   Check-ins are stored in localStorage (device-side) so the page works even
 *   if the Ezsite API is slow. The page also attempts a tableUpdate to write
 *   checked_in:true to the live DB — but UI never blocks on that.
 *
 * ACCESS CONTROL:
 *   A simple session PIN (default: 2026). Change GATE_PIN below for each event.
 *   Volunteers are told the PIN on event day.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import usePageMeta from '../hooks/usePageMeta';

/* ── Configuration ───────────────────────────────────────────────────── */
const GATE_PIN = '2026';                  // Change this each event
const TABLE_ID = 78687;                   // Ezsite submissions table
const PIN_SESSION_KEY = 'checkin_auth';   // sessionStorage key for PIN
const CHECKINS_LOCAL_KEY = 'tsc26_checkins'; // localStorage key for check-in log

/* ── Helpers ─────────────────────────────────────────────────────────── */
function capitalise(s) {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

/** Load check-in log from localStorage. Returns a Map of code → {name, at} */
function loadLocalCheckins() {
  try {
    const raw = localStorage.getItem(CHECKINS_LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Save one check-in to localStorage. */
function saveLocalCheckin(code, name) {
  try {
    const log = loadLocalCheckins();
    log[code] = { name, at: new Date().toISOString() };
    localStorage.setItem(CHECKINS_LOCAL_KEY, JSON.stringify(log));
  } catch {
    // localStorage may be full or blocked — silent fail
  }
}

/** Format a NZ-friendly time string from an ISO timestamp */
function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-NZ', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Pacific/Auckland'
    });
  } catch {
    return iso.slice(11, 16);
  }
}

/* ── Main Component ──────────────────────────────────────────────────── */
export default function CheckIn() {
  usePageMeta({
    title: 'Gate Check-In — NZ Melting Pot',
    description: 'Volunteer gate check-in for the Musical Talent Showcase 2026.',
    path: '/check-in'
  });

  // PIN gate
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinOk, setPinOk] = useState(false);

  // Search / result
  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState(null);  // { record, alreadyIn, checkedInAt }
  const [searchErr, setSearchErr] = useState('');

  // Check-in action
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const inputRef = useRef(null);
  const ranRef = useRef(false);

  /* On mount: check session PIN and URL ?code= param */
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Restore PIN from session
    const stored = sessionStorage.getItem(PIN_SESSION_KEY);
    if (stored === GATE_PIN) {
      setPinOk(true);
    }

    // Pre-fill code from URL params (set when user scans QR with phone camera)
    const params = new URLSearchParams(window.location.search);
    const urlCode = (params.get('code') || '').trim().toUpperCase();
    if (urlCode) {
      setQuery(urlCode);
    }
  }, []);

  /* Auto-lookup when code arrives from URL (after PIN is verified) */
  useEffect(() => {
    if (pinOk && query && !result && !looking) {
      const params = new URLSearchParams(window.location.search);
      const urlCode = (params.get('code') || '').trim().toUpperCase();
      if (urlCode && urlCode === query) {
        doLookup(urlCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinOk]);

  /* Focus the input when PIN gate passes */
  useEffect(() => {
    if (pinOk) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [pinOk]);

  /* ── PIN submit ─────────────────────────────────────────────────── */
  function handlePinSubmit(e) {
    e.preventDefault();
    if (pinInput.trim() === GATE_PIN) {
      sessionStorage.setItem(PIN_SESSION_KEY, GATE_PIN);
      setPinOk(true);
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Please check with the event coordinator.');
      setPinInput('');
    }
  }

  /* ── DB lookup ──────────────────────────────────────────────────── */
  const doLookup = useCallback(async (code) => {
    const trimmed = (code || query).trim().toUpperCase();
    if (!trimmed) return;

    setLooking(true);
    setResult(null);
    setCheckedIn(false);
    setSearchErr('');

    try {
      const { data, error } = await window.ezsite.apis.tablePage(TABLE_ID, {
        PageNo: 1,
        PageSize: 5,
        Filters: [{ Name: 'unique_code', Op: 'Equal', Value: trimmed }]
      });

      if (error) {
        setSearchErr('Database error — please try again or check your connection.');
        setLooking(false);
        return;
      }

      const list = data?.List || [];
      if (list.length === 0) {
        setSearchErr(`No registration found for code "${trimmed}". Please check the code and try again.`);
        setLooking(false);
        return;
      }

      const record = list[0];

      // Check local check-in log first (fast, works offline)
      const localLog = loadLocalCheckins();
      const localEntry = localLog[trimmed];

      // Also check DB field if present
      const dbCheckedIn = record.checked_in === true || record.checked_in === 'true' || record.checked_in === 1;
      const alreadyIn = !!(localEntry || dbCheckedIn);
      const checkedInAt = localEntry?.at || record.checked_in_at || null;

      setResult({ record, alreadyIn, checkedInAt });
    } catch (err) {
      setSearchErr('Unexpected error: ' + (err.message || 'Please try again.'));
    }

    setLooking(false);
  }, [query]);

  /* ── Search submit ──────────────────────────────────────────────── */
  function handleSearch(e) {
    e.preventDefault();
    doLookup(query);
  }

  /* ── Mark checked in ────────────────────────────────────────────── */
  async function handleCheckIn() {
    if (!result?.record) return;
    setCheckingIn(true);

    const code = result.record.unique_code;
    const name = result.record.participant_name;
    const recordId = result.record.ID || result.record.id;

    // 1. Save to localStorage immediately (works offline, instant feedback)
    saveLocalCheckin(code, name);

    // 2. Try to update the DB record (best-effort, non-blocking for UX)
    try {
      await window.ezsite.apis.tableUpdate(TABLE_ID, {
        ID: recordId,
        checked_in: true,
        checked_in_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('DB check-in update failed (local check-in still recorded):', err);
    }

    setCheckedIn(true);
    setResult((prev) => ({ ...prev, alreadyIn: true, checkedInAt: new Date().toISOString() }));
    setCheckingIn(false);
  }

  /* ── Clear / scan next ──────────────────────────────────────────── */
  function handleReset() {
    setQuery('');
    setResult(null);
    setCheckedIn(false);
    setSearchErr('');
    // Remove code from URL without a navigation
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  /* ── PIN screen ─────────────────────────────────────────────────── */
  if (!pinOk) {
    return (
      <div style={fullPageStyle}>
        <div style={pinCardStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔐</div>
          <h1 style={pinHeadingStyle}>Gate Check-In</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 24, textAlign: 'center' }}>
            Musical Talent Showcase 2026<br />
            Enter the event PIN to continue
          </p>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              style={pinInputStyle}
              autoFocus
            />
            {pinError && (
              <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '8px 0 0 0', textAlign: 'center' }}>
                {pinError}
              </p>
            )}
            <button type="submit" style={bigBtnStyle}>
              Enter
            </button>
          </form>
          <p style={{ marginTop: 20, fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center' }}>
            Ask your event coordinator for the PIN.
          </p>
        </div>
      </div>
    );
  }

  /* ── Check-in screen ────────────────────────────────────────────── */
  const rec = result?.record;
  const performers = rec ? [
    rec.participant_name,
    rec.participant_2_name,
    rec.participant_3_name,
    rec.participant_4_name
  ].filter((n) => n && n.trim()) : [];

  return (
    <div style={fullPageStyle}>
      <div style={cardStyle}>

        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: '1.4rem' }}>🎟️</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.5px' }}>Gate Check-In</span>
          <button
            onClick={() => { setPinOk(false); sessionStorage.removeItem(PIN_SESSION_KEY); }}
            style={lockBtnStyle}
            title="Lock screen"
            aria-label="Lock screen"
          >
            🔒
          </button>
        </div>

        {/* Search form */}
        {!result && (
          <form onSubmit={handleSearch} style={{ padding: '20px 20px 0' }}>
            <label style={labelStyle}>
              Registration Code
              <p style={{ fontWeight: 400, fontSize: '0.78rem', color: '#6b7280', margin: '2px 0 8px 0' }}>
                Scan QR with phone camera, or type the code below
              </p>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                placeholder="e.g. TSC26001"
                maxLength={12}
                style={codeInputStyle}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" disabled={!query.trim() || looking} style={searchBtnStyle}>
                {looking ? '…' : '→'}
              </button>
            </div>
            {searchErr && (
              <div style={errBoxStyle}>
                <span style={{ fontSize: '1.2rem' }}>❌</span>
                <span>{searchErr}</span>
              </div>
            )}
          </form>
        )}

        {/* Loading */}
        {looking && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
            Looking up…
          </div>
        )}

        {/* Result card */}
        {result && !looking && (
          <div style={{ padding: '20px' }}>

            {/* Already checked-in banner */}
            {result.alreadyIn && !checkedIn && (
              <div style={alreadyBannerStyle}>
                <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>⚠️</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Already Checked In</div>
                {result.checkedInAt && (
                  <div style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.85 }}>
                    at {fmtTime(result.checkedInAt)}
                  </div>
                )}
              </div>
            )}

            {/* Just-checked-in banner */}
            {checkedIn && (
              <div style={successBannerStyle}>
                <div style={{ fontSize: '2rem', marginBottom: 4 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>Checked In!</div>
                <div style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.85 }}>
                  Welcome — enjoy the show 🎶
                </div>
              </div>
            )}

            {/* Participant details */}
            <div style={detailCardStyle}>
              <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 4 }}>
                Participant{performers.length > 1 ? 's' : ''}
              </div>
              {performers.map((name, i) => (
                <div key={i} style={{ fontSize: i === 0 ? '1.5rem' : '1rem', fontWeight: i === 0 ? 700 : 500, color: '#1E1915', lineHeight: 1.3 }}>
                  {name}
                </div>
              ))}

              <div style={detailDivider} />

              <div style={detailRow}>
                <span style={detailLabel}>Code</span>
                <span style={{ fontWeight: 700, color: '#7B1E2D', letterSpacing: '2px', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                  {rec.unique_code}
                </span>
              </div>
              <div style={detailRow}>
                <span style={detailLabel}>Category</span>
                <span>{capitalise(rec.category)} — {capitalise(rec.performance_type)}</span>
              </div>
              <div style={detailRow}>
                <span style={detailLabel}>Song</span>
                <span style={{ fontStyle: 'italic' }}>{rec.song_title || '—'}</span>
              </div>
              {rec.status && (
                <div style={detailRow}>
                  <span style={detailLabel}>Status</span>
                  <span style={{ color: rec.status === 'paid' ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>
                    {rec.status === 'paid' ? '✅ Paid' : rec.status}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {!result.alreadyIn && !checkedIn && (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  style={checkInBtnStyle}
                >
                  {checkingIn ? 'Marking…' : '✅  Mark as Checked In'}
                </button>
              )}
              <button onClick={handleReset} style={nextBtnStyle}>
                🔍  Scan Next Ticket
              </button>
            </div>
          </div>
        )}

        {/* Bottom hint */}
        {!result && !looking && (
          <p style={{ padding: '16px 20px', fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center', borderTop: '1px solid #f3ede6', margin: 0 }}>
            Participants scan their QR from the confirmation email.<br />
            The phone camera app opens this page automatically.
          </p>
        )}

        {/* Check-in count badge */}
        <CheckInCount />

      </div>
    </div>
  );
}

/* Small live counter showing how many check-ins this device has recorded */
function CheckInCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function refresh() {
      const log = loadLocalCheckins();
      setCount(Object.keys(log).length);
    }
    refresh();
    // Refresh whenever the page gains focus (another device may have added entries)
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  if (count === 0) return null;

  return (
    <div style={{ padding: '10px 20px', textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af', borderTop: '1px solid #f3ede6' }}>
      {count} check-in{count === 1 ? '' : 's'} recorded on this device today
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const fullPageStyle = {
  minHeight: '100vh',
  background: '#f5f0eb',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '20px 12px 40px',
};

const cardStyle = {
  background: '#fff',
  borderRadius: 18,
  boxShadow: '0 6px 30px rgba(30,25,21,0.12)',
  width: '100%',
  maxWidth: 440,
  overflow: 'hidden',
};

const pinCardStyle = {
  background: '#fff',
  borderRadius: 18,
  boxShadow: '0 6px 30px rgba(30,25,21,0.12)',
  width: '100%',
  maxWidth: 340,
  padding: '36px 28px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const pinHeadingStyle = {
  fontFamily: "'Cormorant', Georgia, serif",
  fontSize: '1.8rem',
  fontWeight: 700,
  color: '#1E1915',
  margin: '0 0 6px 0',
  textAlign: 'center',
};

const pinInputStyle = {
  display: 'block',
  width: '100%',
  fontSize: '2rem',
  textAlign: 'center',
  letterSpacing: '8px',
  padding: '12px 0',
  border: '2px solid #e5e7eb',
  borderRadius: 10,
  outline: 'none',
  marginBottom: 14,
  boxSizing: 'border-box',
};

const headerStyle = {
  background: 'linear-gradient(135deg, #7B1E2D, #A83832)',
  color: '#fff',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const lockBtnStyle = {
  marginLeft: 'auto',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.2rem',
  padding: 4,
  lineHeight: 1,
};

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

const codeInputStyle = {
  flex: 1,
  fontSize: '1.4rem',
  letterSpacing: '3px',
  textTransform: 'uppercase',
  padding: '12px 14px',
  border: '2px solid #e5e7eb',
  borderRadius: 10,
  outline: 'none',
  fontFamily: 'monospace',
  minWidth: 0,
};

const searchBtnStyle = {
  padding: '12px 18px',
  background: 'linear-gradient(135deg, #7B1E2D, #A83832)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: '1.4rem',
  cursor: 'pointer',
  fontWeight: 700,
};

const bigBtnStyle = {
  display: 'block',
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #7B1E2D, #A83832)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: '1.05rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 6,
};

const errBoxStyle = {
  background: '#fef2f2',
  border: '1.5px solid #fca5a5',
  borderRadius: 10,
  padding: '12px 14px',
  marginTop: 12,
  color: '#dc2626',
  fontSize: '0.88rem',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  lineHeight: 1.5,
};

const alreadyBannerStyle = {
  background: '#fef3c7',
  border: '1.5px solid #fbbf24',
  borderRadius: 12,
  padding: '14px',
  marginBottom: 14,
  textAlign: 'center',
  color: '#92400e',
};

const successBannerStyle = {
  background: '#dcfce7',
  border: '1.5px solid #86efac',
  borderRadius: 12,
  padding: '14px',
  marginBottom: 14,
  textAlign: 'center',
  color: '#166534',
};

const detailCardStyle = {
  background: '#FBF5ED',
  border: '1.5px solid #e5d9c8',
  borderRadius: 12,
  padding: '16px 18px',
};

const detailDivider = {
  borderTop: '1px dashed #d4c4a8',
  margin: '12px 0',
};

const detailRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 8,
  padding: '4px 0',
  fontSize: '0.9rem',
  color: '#1f2937',
};

const detailLabel = {
  color: '#9ca3af',
  textTransform: 'uppercase',
  fontSize: '0.72rem',
  letterSpacing: '1px',
  flexShrink: 0,
  paddingTop: 2,
};

const checkInBtnStyle = {
  display: 'block',
  width: '100%',
  padding: '16px',
  background: 'linear-gradient(135deg, #16a34a, #15803d)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  fontSize: '1.1rem',
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: '0.3px',
};

const nextBtnStyle = {
  display: 'block',
  width: '100%',
  padding: '13px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1.5px solid #e5e7eb',
  borderRadius: 12,
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};
