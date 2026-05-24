/**
 * /check-in — Hands-free gate check-in for the Musical Talent Showcase 2026.
 *
 * USAGE AT THE GATE:
 *   Open https://www.nzmeltingpot.com/check-in on your phone.
 *   Enter the gate PIN once (stored for the browser session).
 *   Point the camera at a participant's ticket QR code.
 *
 *   ✅ Valid, first scan  → green flash + pleasant DING  → auto-resets in 2s
 *   ⚠️ Already checked in → amber flash + low BUZZ      → auto-resets in 3s
 *   ❌ Code not found     → red flash + error BUZZ       → auto-resets in 3s
 *
 *   Manual code entry is available as a fallback (tap the keyboard icon).
 *
 * AUDIO:
 *   Uses Web Audio API — no audio files needed, works offline.
 *   The PIN entry button press unlocks the AudioContext (required by browsers).
 *
 * QR FORMAT:
 *   QR codes on tickets encode the URL:
 *     https://www.nzmeltingpot.com/check-in?code=TSC26001
 *   The scanner also accepts plain code strings ("TSC26001") as fallback.
 *
 * CHECK-IN STORAGE:
 *   Writes to localStorage immediately (works offline, instant feedback).
 *   Also attempts tableUpdate to the live DB in the background.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import usePageMeta from '../hooks/usePageMeta';

/* ── Configuration ───────────────────────────────────────────────────── */
const GATE_PIN        = '2026';               // Change each event
const TABLE_ID        = 78687;                // Ezsite submissions table
const PIN_KEY         = 'checkin_auth';       // sessionStorage
const LOG_KEY         = 'tsc26_checkins';     // localStorage check-in log
const SCAN_COOLDOWN   = 2000;                 // ms between two scans of the same code
const SUCCESS_HOLD    = 2200;                 // ms to show success before next scan
const FAIL_HOLD       = 3000;                 // ms to show fail before next scan

/* ── Helpers ─────────────────────────────────────────────────────────── */
function capitalise(s) {
  return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
}

function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); }
  catch { return {}; }
}
function saveLog(code, name) {
  try {
    const log = loadLog();
    log[code] = { name, at: new Date().toISOString() };
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {}
}
function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-NZ', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Pacific/Auckland'
    });
  } catch { return iso.slice(11, 16); }
}

/** Extract code from a raw QR string — handles URL or plain code. */
function extractCode(raw) {
  const s = (raw || '').trim();
  try {
    const url = new URL(s);
    const c = url.searchParams.get('code');
    if (c) return c.trim().toUpperCase();
  } catch {}
  return s.toUpperCase();
}

/* ── Audio ───────────────────────────────────────────────────────────── */
/** Create or resume a shared AudioContext, seeded by a user gesture. */
function getAudioCtx(ctxRef) {
  if (!ctxRef.current) {
    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctxRef.current.state === 'suspended') {
    ctxRef.current.resume();
  }
  return ctxRef.current;
}

/** Two ascending tones — pleasant checkout-style success beep. */
function playSuccess(ctxRef) {
  try {
    const ctx = getAudioCtx(ctxRef);
    const t = ctx.currentTime;
    [[880, t, t + 0.14], [1318, t + 0.18, t + 0.36]].forEach(([freq, start, end]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.28, start);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    });
  } catch (e) { console.warn('Audio error', e); }
}

/** Two descending tones — low buzz for denied / duplicate. */
function playFail(ctxRef) {
  try {
    const ctx = getAudioCtx(ctxRef);
    const t = ctx.currentTime;
    [[330, t, t + 0.22], [220, t + 0.26, t + 0.52]].forEach(([freq, start, end]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    });
  } catch (e) { console.warn('Audio error', e); }
}

/* ── Main Component ──────────────────────────────────────────────────── */
export default function CheckIn() {
  usePageMeta({
    title: 'Gate Check-In — NZ Melting Pot',
    description: 'Volunteer gate check-in for the Musical Talent Showcase 2026.',
    path: '/check-in'
  });

  /* PIN gate */
  const [pinInput, setPinInput]   = useState('');
  const [pinError, setPinError]   = useState('');
  const [pinOk, setPinOk]         = useState(false);

  /* Camera scanning */
  const [camReady, setCamReady]   = useState(false);
  const [camError, setCamError]   = useState('');
  const [scanning]                = useState(true);    // camera always on when PIN passed

  /* Result state: 'idle' | 'processing' | 'ok' | 'duplicate' | 'notfound' | 'error' */
  const [scanState, setScanState] = useState('idle');
  const [scanInfo, setScanInfo]   = useState(null);   // { code, name, category, song, time }

  /* Manual entry */
  const [manualCode, setManualCode] = useState('');
  const [manualBusy, setManualBusy] = useState('');

  /* Counter */
  const [count, setCount]         = useState(0);

  /* Refs */
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const audioCtxRef  = useRef(null);
  const lastCodeRef  = useRef('');
  const lastScanRef  = useRef(0);
  const detectorRef  = useRef(null);   // BarcodeDetector instance
  const manualRef    = useRef(null);

  /* Refresh counter */
  const refreshCount = useCallback(() => {
    setCount(Object.keys(loadLog()).length);
  }, []);

  /* ── PIN submit ─────────────────────────────────────────────────── */
  function handlePinSubmit(e) {
    e.preventDefault();
    if (pinInput.trim() === GATE_PIN) {
      // Create AudioContext NOW (user gesture) to unlock audio on iOS/Android
      try {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch {}
      sessionStorage.setItem(PIN_KEY, GATE_PIN);
      setPinOk(true);
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Check with the event coordinator.');
      setPinInput('');
    }
  }

  /* Restore session PIN on mount */
  useEffect(() => {
    if (sessionStorage.getItem(PIN_KEY) === GATE_PIN) {
      setPinOk(true);
    }
    refreshCount();
  }, [refreshCount]);

  /* Create BarcodeDetector once on mount — built into Chrome & Safari, no library needed */
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detectorRef.current = null;
      }
    }
  }, []);

  /* ── Start camera ───────────────────────────────────────────────── */
  const startCamera = useCallback(async () => {
    setCamError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Camera not available in this browser. Use manual entry below.');
      setScanning(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCamReady(true);
      }
    } catch (err) {
      setCamError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and reload.'
          : 'Could not access camera. Use manual entry below.'
      );
      setScanning(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }, []);

  /* Start camera when PIN passes and scanning mode is on */
  useEffect(() => {
    if (pinOk && scanning) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [pinOk, scanning, startCamera, stopCamera]);

  /* Focus manual input when switching to manual mode */
  useEffect(() => {
    if (!scanning && pinOk) {
      setTimeout(() => manualRef.current?.focus(), 100);
    }
  }, [scanning, pinOk]);

  /* ── Core: process a scanned / entered code ─────────────────────── */
  const processCode = useCallback(async (rawCode, fromCamera = false) => {
    const code = extractCode(rawCode);
    if (!code || code.length < 3) return;

    // Cooldown — ignore the same code if just scanned
    const now = Date.now();
    if (fromCamera && code === lastCodeRef.current && now - lastScanRef.current < SCAN_COOLDOWN) return;
    lastCodeRef.current = code;
    lastScanRef.current = now;

    setScanState('processing');
    setScanInfo(null);

    try {
      const { data, error } = await window.ezsite.apis.tablePage(TABLE_ID, {
        PageNo: 1, PageSize: 5,
        Filters: [{ Name: 'unique_code', Op: 'Equal', Value: code }]
      });

      if (error || !data?.List?.length) {
        setScanState('notfound');
        setScanInfo({ code });
        playFail(audioCtxRef);
        setTimeout(() => { setScanState('idle'); setScanInfo(null); lastCodeRef.current = ''; }, FAIL_HOLD);
        return;
      }

      const rec = data.List[0];
      const name = rec.participant_name || code;

      // Check if already in
      const log = loadLog();
      const localEntry = log[code];
      const dbIn = rec.checked_in === true || rec.checked_in === 'true' || rec.checked_in === 1;

      if (localEntry || dbIn) {
        const at = localEntry?.at || rec.checked_in_at || null;
        setScanState('duplicate');
        setScanInfo({ code, name, category: rec.category, song: rec.song_title, time: at });
        playFail(audioCtxRef);
        setTimeout(() => { setScanState('idle'); setScanInfo(null); lastCodeRef.current = ''; }, FAIL_HOLD);
        return;
      }

      // Mark as checked in
      saveLog(code, name);
      try {
        await window.ezsite.apis.tableUpdate(TABLE_ID, {
          ID: rec.ID || rec.id,
          checked_in: true,
          checked_in_at: new Date().toISOString()
        });
      } catch {}

      setScanState('ok');
      setScanInfo({
        code,
        name,
        others: [rec.participant_2_name, rec.participant_3_name, rec.participant_4_name].filter(Boolean),
        category: rec.category,
        perf: rec.performance_type,
        song: rec.song_title
      });
      playSuccess(audioCtxRef);
      refreshCount();
      setTimeout(() => { setScanState('idle'); setScanInfo(null); lastCodeRef.current = ''; }, SUCCESS_HOLD);

    } catch (err) {
      setScanState('error');
      setScanInfo({ code, msg: err.message });
      playFail(audioCtxRef);
      setTimeout(() => { setScanState('idle'); setScanInfo(null); lastCodeRef.current = ''; }, FAIL_HOLD);
    }
  }, [refreshCount]);

  /* ── Scan loop — uses built-in BarcodeDetector (no library needed) ── */
  useEffect(() => {
    if (!camReady || !scanning) return;

    // If BarcodeDetector isn't available, show manual entry instead
    if (!detectorRef.current) {
      setCamError('QR scanning not supported in this browser — use manual entry below.');
      setScanning(false);
      return;
    }

    let active = true;

    const tick = async () => {
      if (!active) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || scanState === 'processing') {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      try {
        const codes = await detectorRef.current.detect(video);
        if (codes.length > 0 && active) {
          processCode(codes[0].rawValue, true);
        }
      } catch {
        // detection errors are normal (blurry frame etc.) — just continue
      }
      if (active) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [camReady, scanning, scanState, processCode]);

  /* ── Manual submit ──────────────────────────────────────────────── */
  async function handleManualSubmit(e) {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setManualBusy(code);
    await processCode(code, false);
    setManualCode('');
    setManualBusy('');
  }

  /* ── Background colour for overlay ─────────────────────────────── */
  const overlayBg = {
    idle:        'transparent',
    processing:  'rgba(59,130,246,0.18)',
    ok:          'rgba(22,163,74,0.55)',
    duplicate:   'rgba(234,179,8,0.55)',
    notfound:    'rgba(220,38,38,0.55)',
    error:       'rgba(220,38,38,0.55)',
  }[scanState] || 'transparent';

  /* ── PIN screen ─────────────────────────────────────────────────── */
  if (!pinOk) {
    return (
      <div style={fullPageStyle}>
        <div style={pinCardStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎟️</div>
          <h1 style={pinHeadingStyle}>Gate Check-In</h1>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: 22, textAlign: 'center', lineHeight: 1.5 }}>
            Musical Talent Showcase 2026<br />Enter the gate PIN to begin
          </p>
          <form onSubmit={handlePinSubmit} style={{ width: '100%' }}>
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
              <p style={{ color: '#dc2626', fontSize: '0.83rem', margin: '6px 0 12px', textAlign: 'center' }}>
                {pinError}
              </p>
            )}
            <button type="submit" style={pinBtnStyle}>Enter →</button>
          </form>
          <p style={{ marginTop: 18, fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>
            Ask your event coordinator for the PIN.
          </p>
        </div>
      </div>
    );
  }

  /* ── Main scanner screen ────────────────────────────────────────── */
  return (
    <div style={fullPageStyle}>
      <div style={mainCardStyle}>

        {/* ── Top bar ── */}
        <div style={topBarStyle}>
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>🎟️ Gate Check-In</span>
          <button
            onClick={() => { sessionStorage.removeItem(PIN_KEY); setPinOk(false); stopCamera(); }}
            style={{ ...toggleBtnStyle, marginLeft: 'auto' }}
            title="Lock screen"
          >
            🔒
          </button>
        </div>

        {/* ── Camera viewfinder ── */}
        <div style={viewfinderWrap}>
          <video ref={videoRef} style={videoStyle} playsInline muted autoPlay />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Result overlay */}
          {scanState !== 'idle' && (
            <div style={{ ...overlayStyle, background: overlayBg }}>
              {scanState === 'processing' && <div style={overlayText}>⏳</div>}
              {scanState === 'ok' && scanInfo && (
                <>
                  <div style={{ fontSize: '3rem', lineHeight: 1 }}>✅</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 6 }}>{scanInfo.name}</div>
                  {scanInfo.others?.length > 0 && (
                    <div style={{ fontSize: '0.9rem', marginTop: 2, opacity: 0.9 }}>+ {scanInfo.others.join(', ')}</div>
                  )}
                  <div style={{ fontSize: '0.85rem', marginTop: 8, opacity: 0.9 }}>
                    {capitalise(scanInfo.category)} — {scanInfo.song}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 4, letterSpacing: '2px', fontFamily: 'monospace' }}>
                    {scanInfo.code}
                  </div>
                </>
              )}
              {scanState === 'duplicate' && scanInfo && (
                <>
                  <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>⚠️</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: 6 }}>Already Checked In</div>
                  <div style={{ fontSize: '1rem', marginTop: 4 }}>{scanInfo.name}</div>
                  {scanInfo.time && <div style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.85 }}>at {fmtTime(scanInfo.time)}</div>}
                </>
              )}
              {(scanState === 'notfound' || scanState === 'error') && scanInfo && (
                <>
                  <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>❌</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 6 }}>
                    {scanState === 'notfound' ? 'Code Not Found' : 'Lookup Error'}
                  </div>
                  <div style={{ fontSize: '0.9rem', marginTop: 4, fontFamily: 'monospace', letterSpacing: '2px' }}>{scanInfo.code}</div>
                </>
              )}
            </div>
          )}

          {/* Aim guide */}
          {scanState === 'idle' && camReady && (
            <div style={aimGuideStyle}>
              <div style={aimCorners} />
              <p style={aimLabel}>Point at QR code</p>
            </div>
          )}

          {/* Camera loading */}
          {!camReady && !camError && (
            <div style={camLoadStyle}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Starting camera…</div>
            </div>
          )}

          {/* Camera error */}
          {camError && (
            <div style={camLoadStyle}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: '0.85rem', color: '#f87171', textAlign: 'center', maxWidth: 260 }}>{camError}</div>
            </div>
          )}
        </div>

        {/* ── Manual entry — always visible ── */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Or type code manually
          </div>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
            <input
              ref={manualRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="TSC26001"
              maxLength={12}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={codeInputStyle}
            />
            <button type="submit" disabled={!manualCode.trim() || !!manualBusy} style={goBtn}>
              {manualBusy ? '…' : '→'}
            </button>
          </form>

          {/* Inline result for manual entry */}
          {scanState !== 'idle' && scanInfo && (
            <div style={{
              ...inlineResult,
              background: scanState === 'ok' ? '#dcfce7' : scanState === 'duplicate' ? '#fef3c7' : '#fef2f2',
              borderColor: scanState === 'ok' ? '#86efac' : scanState === 'duplicate' ? '#fbbf24' : '#fca5a5',
              color: scanState === 'ok' ? '#166534' : scanState === 'duplicate' ? '#92400e' : '#dc2626',
            }}>
              {scanState === 'ok' && (
                <>
                  <div style={{ fontSize: '1.5rem' }}>✅</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{scanInfo.name}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: 2 }}>{capitalise(scanInfo.category)} — {scanInfo.song}</div>
                    <div style={{ fontSize: '0.8rem', marginTop: 2, fontFamily: 'monospace', letterSpacing: '2px' }}>
                      {scanInfo.code} · Checked in ✓
                    </div>
                  </div>
                </>
              )}
              {scanState === 'duplicate' && (
                <>
                  <div style={{ fontSize: '1.5rem' }}>⚠️</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Already Checked In</div>
                    <div style={{ fontSize: '0.88rem' }}>{scanInfo.name}</div>
                    {scanInfo.time && <div style={{ fontSize: '0.8rem' }}>at {fmtTime(scanInfo.time)}</div>}
                  </div>
                </>
              )}
              {(scanState === 'notfound' || scanState === 'error') && (
                <>
                  <div style={{ fontSize: '1.5rem' }}>❌</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {scanState === 'notfound' ? 'Code not found' : 'Lookup error'}
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      {scanState === 'notfound'
                        ? `"${scanInfo.code}" — check spelling or contact admin`
                        : (scanInfo.msg || 'Please try again')}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom bar ── */}
        <div style={bottomBar}>
          <span style={{ color: count > 0 ? '#16a34a' : '#6b7280', fontWeight: count > 0 ? 600 : 400 }}>
            {count > 0 ? `${count} checked in today` : 'No check-ins yet'}
          </span>
          <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>
            {camReady ? 'Camera active' : 'Manual mode'}
          </span>
        </div>

      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const fullPageStyle = {
  minHeight: '100vh',
  background: '#0f0f0f',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '0',
};

const mainCardStyle = {
  width: '100%',
  maxWidth: 480,
  minHeight: '100vh',
  background: '#1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'visible',
};

const pinCardStyle = {
  background: '#fff',
  borderRadius: 18,
  boxShadow: '0 6px 30px rgba(0,0,0,0.25)',
  width: '100%',
  maxWidth: 340,
  padding: '36px 28px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  margin: 'auto',
};

const pinHeadingStyle = {
  fontFamily: "'Cormorant', Georgia, serif",
  fontSize: '1.8rem',
  fontWeight: 700,
  color: '#1E1915',
  margin: '0 0 4px',
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
  marginBottom: 10,
  boxSizing: 'border-box',
};

const pinBtnStyle = {
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
};

const topBarStyle = {
  background: '#7B1E2D',
  color: '#fff',
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
};

const toggleBtnStyle = {
  background: 'rgba(255,255,255,0.18)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: '1.2rem',
  padding: '5px 9px',
  cursor: 'pointer',
  lineHeight: 1,
};

const viewfinderWrap = {
  position: 'relative',
  background: '#000',
  overflow: 'hidden',
  height: 280,
  flexShrink: 0,
};

const videoStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  textAlign: 'center',
  padding: '20px',
  transition: 'background 0.2s',
};

const overlayText = {
  fontSize: '2.5rem',
};

const aimGuideStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

// CSS-drawn corner brackets via box-shadow
const aimCorners = {
  width: 180,
  height: 180,
  border: '3px solid transparent',
  boxShadow:
    '-18px -18px 0 0 rgba(255,255,255,0.85), ' +
    '18px -18px 0 0 rgba(255,255,255,0.85), ' +
    '-18px 18px 0 0 rgba(255,255,255,0.85), ' +
    '18px 18px 0 0 rgba(255,255,255,0.85)',
  borderRadius: 6,
};

const aimLabel = {
  color: 'rgba(255,255,255,0.7)',
  fontSize: '0.85rem',
  marginTop: 14,
  letterSpacing: '1px',
};

const camLoadStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#111',
  color: '#9ca3af',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#d1d5db',
  marginBottom: 6,
};

const codeInputStyle = {
  flex: 1,
  fontSize: '1.4rem',
  letterSpacing: '3px',
  textTransform: 'uppercase',
  padding: '12px 14px',
  border: '2px solid #374151',
  borderRadius: 10,
  outline: 'none',
  fontFamily: 'monospace',
  minWidth: 0,
  background: '#111',
  color: '#f9fafb',
};

const goBtn = {
  padding: '12px 18px',
  background: 'linear-gradient(135deg, #7B1E2D, #A83832)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: '1.4rem',
  cursor: 'pointer',
  fontWeight: 700,
};

const inlineResult = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  marginTop: 16,
  padding: '14px 16px',
  borderRadius: 12,
  border: '1.5px solid',
  lineHeight: 1.4,
};

const bottomBar = {
  padding: '10px 16px',
  display: 'flex',
  alignItems: 'center',
  fontSize: '0.8rem',
  color: '#6b7280',
  background: '#111',
  borderTop: '1px solid #222',
  flexShrink: 0,
};
