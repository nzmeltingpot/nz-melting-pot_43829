/**
 * HonourPassesTab — Admin panel tab for issuing complimentary gate passes.
 * Self-contained component so Admin.jsx stays small enough to paste in Ezsite.
 */
import { useState, useEffect, useCallback } from 'react';
import { buildHonourPassesEmail } from '../utils/paymentEmails';

const SUBMISSIONS_TABLE_ID = 78687;

const ROLES = ['Judge', 'Caterer', 'Sound Crew', 'Committee Member', 'Guest Artist', 'Other'];

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const s = String(dateStr);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const nz = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (nz) return `${nz[1]}/${nz[2]}/${nz[3]}`;
  return s;
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
        to: email.trim().toLowerCase(),
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
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1E1915' }}>Recently Issued Passes</h3>
          <button onClick={loadPasses} style={{ background: 'none', border: 'none', color: '#7B1E2D', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
            Refresh ↺
          </button>
        </div>
        {loading ?
          <p style={{ color: '#666', fontSize: '0.85rem' }}>Loading…</p> :
          passes.length === 0 ?
          <p style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>No honour passes issued yet.</p> :
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Code', 'Name', 'Role', 'Email', 'Issued'].map((h) => (
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
