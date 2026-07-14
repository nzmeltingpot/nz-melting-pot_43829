/**
 * HonourPassesTab — Admin panel tab for issuing complimentary gate passes.
 * Fully self-contained — email builder is inlined so this file needs no imports
 * from paymentEmails.js (avoids Ezsite paste-truncation issues).
 */
import { useState, useEffect, useCallback } from 'react';

/* ── Inline email builder ─────────────────────────────────────────── */

const SITE_URL   = 'https://www.nzmeltingpot.com';
const LOGO_URL   = `${SITE_URL}/images/branding/logo-300x300.png`;
const EVENT_DATE = 'Saturday, 18 July 2026';
const EVENT_VENUE = 'Blockhouse Bay Community Centre, 524 Blockhouse Bay Road, Blockhouse Bay, Auckland 0600';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildHonourPassHtml({ name, code, role, passNumber, totalPasses }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${SITE_URL}/check-in?code=${code}`)}&format=png&margin=4`;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="width:100%;max-width:520px;margin:18px auto;border-collapse:collapse;background:#F2FAF7;border:2px dashed #c9a227;font-family:Arial,Helvetica,sans-serif;">
  <!-- Header -->
  <tr>
    <td style="background:#0B5E4F;padding:14px 22px;color:#fff;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="46" style="vertical-align:middle;">
            <img src="${LOGO_URL}" alt="NZ Melting Pot" width="40" height="40" style="display:block;border-radius:50%;border:2px solid #c9a227;background:#fff;" />
          </td>
          <td style="vertical-align:middle;padding-left:10px;">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#c9a227;">NZ Melting Pot</div>
            <div style="font-size:16px;font-weight:bold;font-family:Georgia,serif;color:#fff;">Musical Talent Showcase 2026</div>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <span style="background:#c9a227;color:#1E1915;font-size:10px;font-weight:bold;letter-spacing:1.5px;padding:4px 8px;">HONOUR PASS${totalPasses > 1 ? ` ${passNumber}/${totalPasses}` : ''}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- COMPLIMENTARY banner -->
  <tr>
    <td style="background:#c9a227;color:#1E1915;text-align:center;padding:8px 0;font-weight:bold;letter-spacing:5px;font-size:12px;">
      &#11088; COMPLIMENTARY ENTRY &#11088;
    </td>
  </tr>
  <!-- Guest name -->
  <tr>
    <td style="padding:22px 22px 14px 22px;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Guest</div>
      <div style="font-size:24px;font-weight:bold;color:#1E1915;font-family:Georgia,serif;">${esc(name)}</div>
    </td>
  </tr>
  <!-- Dashed perforation -->
  <tr>
    <td style="padding:0 22px;">
      <div style="border-top:2px dashed #d4c4a8;font-size:1px;line-height:1px;">&nbsp;</div>
    </td>
  </tr>
  <!-- QR + Role -->
  <tr>
    <td style="padding:16px 22px;background:#FBF5ED;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="130" style="vertical-align:middle;text-align:center;">
            <img src="${qrUrl}" alt="QR" width="120" height="120" style="display:block;border:2px solid #e5e7eb;background:#fff;margin:0 auto;" />
            <div style="font-size:9px;color:#9ca3af;letter-spacing:2px;font-family:'Courier New',monospace;margin-top:5px;">${esc(code)}</div>
          </td>
          <td style="vertical-align:middle;padding-left:18px;">
            <div style="font-size:10px;color:#0B5E4F;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px;">Role</div>
            <div style="font-size:22px;font-weight:bold;color:#1E1915;font-family:'Courier New',monospace;letter-spacing:2px;">${esc(role)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:8px;font-style:italic;">Complimentary &middot; No charge</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Event details -->
  <tr>
    <td style="padding:16px 22px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:13px;">
        <tr>
          <td width="80" style="padding:4px 0;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Date</td>
          <td style="padding:4px 0;color:#1f2937;font-weight:600;">${EVENT_DATE}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Venue</td>
          <td style="padding:4px 0;color:#1f2937;">${EVENT_VENUE}</td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Fine print -->
  <tr>
    <td style="padding:10px 22px 12px 22px;text-align:center;background:#E8F5F0;border-top:1px solid #b2d8ce;">
      <p style="margin:0;font-size:11px;color:#0B5E4F;font-style:italic;font-weight:700;line-height:1.6;">
        &#9888;&#65039; Please carry this pass to the gate &mdash; it must be scanned for entry.
      </p>
    </td>
  </tr>
  <!-- Footer bar -->
  <tr>
    <td style="background:#0B5E4F;padding:10px 22px;color:#c9a227;font-size:10px;text-align:center;letter-spacing:1.5px;">
      COMPLIMENTARY PASS &middot; NOT FOR RESALE
    </td>
  </tr>
</table>`;
}

function buildHonourPassesEmail({ recipientName, role, codes }) {
  const count = codes.length;
  const passesHtml = codes.map((code, i) =>
    buildHonourPassHtml({ name: recipientName, code, role, passNumber: i + 1, totalPasses: count })
  ).join('\n');

  const subject = `Your Honour Pass — Musical Talent Showcase 2026`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;background:#f9fafb;color:#1f2937;">

  <p style="font-size:15px;margin:0 0 16px 0;">Dear ${esc(recipientName)},</p>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
    <tr>
      <td style="background:#E8F5F0;border-left:4px solid #0B5E4F;padding:14px 18px;">
        <p style="margin:0;font-weight:700;color:#0B5E4F;font-size:15px;">
          &#11088; Your complimentary ${count === 1 ? 'pass has' : `${count} passes have`} been issued for the Musical Talent Showcase 2026!
        </p>
      </td>
    </tr>
  </table>

  <p style="font-size:14px;line-height:1.7;margin:0 0 14px 0;">
    On behalf of the NZ Melting Pot committee, we extend our warmest thanks for your valued contribution to this event.
    It is an honour to have you with us, and we look forward to welcoming you on the day.
  </p>

  <p style="font-size:14px;line-height:1.7;margin:0 0 24px 0;">
    Your ${count === 1 ? 'complimentary pass is' : `${count} complimentary passes are`} below.
    Please ${count === 1 ? 'present it' : 'distribute and present the relevant pass'} at the gate &mdash;
    each pass has a unique QR code that will be scanned for entry.
  </p>

  <h2 style="font-family:Georgia,serif;color:#0B5E4F;text-align:center;font-size:20px;margin:0 0 6px 0;">
    &#127915; Your ${count === 1 ? 'Honour Pass' : `${count} Honour Passes`}
  </h2>
  <p style="text-align:center;color:#6b7280;font-size:13px;margin:0 0 8px 0;">
    ${count === 1 ? 'Please carry this pass to the gate on show day.' : 'One pass per person — please distribute accordingly.'}
  </p>

  ${passesHtml}

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;">
    <tr>
      <td style="background:#E8F5F0;border:1.5px solid #a3d9c8;padding:20px 24px;text-align:center;">
        <p style="margin:0 0 6px 0;font-weight:700;color:#0B5E4F;font-size:15px;font-family:Georgia,serif;">&#128197; Event Details</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
          <strong>${EVENT_DATE}</strong><br/>
          ${EVENT_VENUE}
        </p>
      </td>
    </tr>
  </table>

  <p style="font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    Warm regards,<br/>
    <strong>The NZ Melting Pot Committee</strong>
  </p>

  <p style="font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:16px;">
    Musical Talent Showcase 2026 &middot; NZ Melting Pot<br/>
    ${EVENT_DATE} &middot; Blockhouse Bay Community Centre<br/>
    <a href="${SITE_URL}" style="color:#9ca3af;">www.nzmeltingpot.com</a>
  </p>
</div>`;

  return { subject, html };
}

const SUBMISSIONS_TABLE_ID = 78687;

const ROLES = ['Judge', 'Caterer', 'Sound Crew', 'Committee Member', 'Guest Artist', 'Donor Supporter', 'Compere', 'Other'];

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const s = String(dateStr);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const nz = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (nz) return `${nz[1]}/${nz[2]}/${nz[3]}`;
  return s;
};

const fmtCheckinTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-NZ', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Pacific/Auckland'
    });
  } catch { return String(iso).slice(11, 16); }
};

export default function HonourPassesTab() {
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState('Judge');
  const [count, setCount]   = useState(1);
  const [issuing, setIssuing]       = useState(false);
  const [result, setResult]         = useState(null);
  const [passes, setPasses]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [exportingPasses, setExportingPasses] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadPasses = useCallback(async () => {
    if (!window.ezsite?.apis?.tablePage) return;
    setLoading(true);
    try {
      const { data } = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
        PageNo: 1, PageSize: 50,
        OrderByField: 'id', IsAsc: false,
        Filters: [{ Name: 'category', Op: 'Equal', Value: 'honour_pass' }]
      });
      setPasses(data?.List || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadPasses(); }, [loadPasses]);

  const exportPassesCSV = async () => {
    setExportingPasses(true);
    try {
      const { data, error } = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
        PageNo: 1, PageSize: 1000,
        OrderByField: 'id', IsAsc: false,
        Filters: [{ Name: 'category', Op: 'Equal', Value: 'honour_pass' }]
      });
      if (error || !data?.List?.length) {
        alert(error ? 'Failed to fetch passes.' : 'No honour passes found.');
        setExportingPasses(false);
        return;
      }
      const cols = [
        { h: 'Pass Code',   k: 'unique_code' },
        { h: 'Name',        k: 'participant_name' },
        { h: 'Role',        k: 'performance_type' },
        { h: 'Email',       k: 'email' },
        { h: 'Date Issued', k: 'submission_timestamp' },
        { h: 'Checked In',   k: 'checked_in' },
        { h: 'Checked In At', k: 'checked_in_at' },
      ];
      const esc = v => {
        if (v == null) return '';
        const s = String(v);
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const rows = [
        cols.map(c => esc(c.h)).join(','),
        ...data.List.map(r => cols.map(c => esc(r[c.k])).join(','))
      ].join('\n');
      const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' });
      const now = new Date();
      const ds = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `honour_passes_${ds}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) { alert('Export failed: ' + (err.message || 'Unknown error')); }
    setExportingPasses(false);
  };

  const handleDelete = async (id, code, name) => {
    if (!window.confirm(`Delete honour pass ${code} (${name})?\n\nThis cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await window.ezsite.apis.tableDelete(SUBMISSIONS_TABLE_ID, { ID: id });
      loadPasses();
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    }
    setDeletingId(null);
  };

  const handleIssue = async () => {
    if (!name.trim() || !email.trim()) {
      setResult({ ok: false, msg: 'Name and email are required.' });
      return;
    }
    setIssuing(true);
    setResult(null);
    try {
      // Find highest existing HON26 code to continue sequentially
      const { data: existing } = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
        PageNo: 1, PageSize: 200,
        Filters: [{ Name: 'unique_code', Op: 'StringContains', Value: 'HON26' }]
      });
      const nums = (existing?.List || [])
        .map((r) => r.unique_code)
        .filter((c) => /^HON26\d+$/.test(c))
        .map((c) => parseInt(c.replace('HON26', ''), 10))
        .filter((n) => !isNaN(n));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const codes = Array.from({ length: count }, (_, i) =>
        `HON26${String(nextNum + i).padStart(3, '0')}`
      );

      // Save each pass to submissions table (check-in works automatically)
      for (const code of codes) {
        await window.ezsite.apis.tableCreate(SUBMISSIONS_TABLE_ID, {
          unique_code: code,
          participant_name: name.trim(),
          category: 'honour_pass',
          performance_type: role,
          song_title: 'N/A',
          email: email.trim().toLowerCase(),
          phone: 'N/A',
          num_performers: 1,
          total_fee: 0,
          status: 'paid',
          submission_timestamp: new Date().toISOString(),
          year: 2026
        });
      }

      // Build and send email with all passes
      const { subject, html } = buildHonourPassesEmail({
        recipientName: name.trim(),
        role,
        codes
      });
      await window.ezsite.apis.sendEmail({
        from: 'NZ Melting Pot <noreply@nzmeltingpot.com>',
        to: [email.trim().toLowerCase()],
        subject,
        html
      });

      setResult({
        ok: true,
        msg: `✅ ${count} Honour Pass${count > 1 ? 'es' : ''} issued and emailed to ${email.trim()}. Code${codes.length > 1 ? 's' : ''}: ${codes.join(', ')}`
      });
      setName(''); setEmail(''); setRole('Judge'); setCount(1);
      loadPasses();
    } catch (err) {
      setResult({ ok: false, msg: '❌ Failed: ' + (err.message || 'Unknown error') });
    }
    setIssuing(false);
  };

  const inp = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #E6DDD3',
    borderRadius: 8, fontSize: '0.95rem', color: '#1E1915',
    background: '#FFFCF8', outline: 'none', boxSizing: 'border-box'
  };
  const lbl = {
    display: 'block', fontSize: '0.85rem', fontWeight: 600,
    color: '#3D342E', marginBottom: 6
  };

  return (
    <div>
      {/* Header */}
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0B5E4F', marginBottom: 8, paddingBottom: 8, borderBottom: '2px solid #a3d9c8', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🎟️</span> Issue Honour Passes
      </div>
      <p style={{ color: '#555', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.6 }}>
        Issue complimentary gate passes for judges, crew and guests. Each pass gets a unique scannable QR code and is emailed instantly. Passes work at the gate check-in scanner automatically.
      </p>

      {/* Form */}
      <div style={{ background: '#F2FAF7', border: '1.5px solid #a3d9c8', borderRadius: 12, padding: '24px 24px 20px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: '1rem', fontWeight: 700, color: '#0B5E4F' }}>⭐ New Honour Pass</h3>

        {/* Name + Count */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 2 }}>
            <label style={lbl}>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Mitchell" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>No. of Passes</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}
              style={{ ...inp, cursor: 'pointer' }}>
              {Array.from({ length: 20 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Email Address</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. sarah@example.com" style={inp} />
          <p style={{ margin: '5px 0 0 2px', fontSize: '0.78rem', color: '#6b7280', fontStyle: 'italic' }}>
            All passes in this batch are sent to this address in one email.
          </p>
        </div>

        {/* Role */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            style={{ ...inp, cursor: 'pointer' }}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>

        {/* Result banner */}
        {result &&
          <div style={{
            padding: '12px 16px', marginBottom: 16, borderRadius: 8,
            background: result.ok ? '#dcfce7' : '#fef2f2',
            border: `1px solid ${result.ok ? '#86efac' : '#fecaca'}`,
            color: result.ok ? '#166534' : '#991b1b',
            fontSize: '0.88rem', lineHeight: 1.6
          }}>
            {result.msg}
          </div>
        }

        <button
          onClick={handleIssue}
          disabled={issuing || !name.trim() || !email.trim()}
          style={{
            padding: '11px 24px',
            background: issuing || !name.trim() || !email.trim() ? '#9ca3af' : '#0B5E4F',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: '0.95rem', fontWeight: 700,
            cursor: issuing || !name.trim() || !email.trim() ? 'not-allowed' : 'pointer'
          }}>
          {issuing ? 'Issuing…' : `Issue Pass${count > 1 ? 'es' : ''} & Send Email →`}
        </button>
      </div>

      {/* Recently issued passes */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1E1915' }}>Issued Passes</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={loadPasses} style={{ background: 'none', border: 'none', color: '#7B1E2D', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
              Refresh ↺
            </button>
            <button
              onClick={exportPassesCSV}
              disabled={exportingPasses}
              style={{ background: '#c9a227', color: '#1E1915', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: exportingPasses ? 'not-allowed' : 'pointer', opacity: exportingPasses ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              ⬇ {exportingPasses ? 'Exporting…' : 'Download CSV'}
            </button>
          </div>
        </div>
        {loading ?
          <p style={{ color: '#666', fontSize: '0.85rem' }}>Loading…</p> :
          passes.length === 0 ?
          <p style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>No honour passes issued yet.</p> :
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Code', 'Name', 'Role', 'Email', 'Issued', 'Scanned', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 10px', borderBottom: '2px solid #E6DDD3', fontWeight: 700, color: '#3D342E', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {passes.map((p) => (
                  <tr key={p.id || p.ID}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#0B5E4F', fontWeight: 700 }}>{p.unique_code}</span>
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', color: '#1E1915' }}>{p.participant_name || '—'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, background: '#E8F5F0', color: '#0B5E4F' }}>
                        {p.performance_type || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', color: '#1E1915' }}>{p.email || '—'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', color: '#1E1915' }}>{formatDate(p.submission_timestamp || p.CreatedAt)}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6' }}>
                      {p.checked_in
                        ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✅ {fmtCheckinTime(p.checked_in_at)}</span>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(p.ID || p.id, p.unique_code, p.participant_name)}
                        disabled={deletingId === (p.ID || p.id)}
                        title="Delete pass"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '1rem', padding: '2px 6px', borderRadius: 4, lineHeight: 1 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                        onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}>
                        {deletingId === (p.ID || p.id) ? '…' : '🗑'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}
