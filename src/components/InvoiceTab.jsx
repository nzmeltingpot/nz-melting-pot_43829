/**
 * InvoiceTab — Admin panel tab for issuing contribution/sponsorship invoices.
 * Stores records in table 78687 with category='invoice'.
 * Invoice numbers increment from NZMP-DS-001.
 */
import { useState, useEffect, useCallback } from 'react';

const SITE_URL   = 'https://www.nzmeltingpot.com';
const LOGO_URL   = `${SITE_URL}/images/branding/logo-300x300.png`;
const TABLE_ID   = 78687;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtNZD(amount) {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 }).format(Number(amount) || 0);
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(isoStr).slice(0, 10); }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildInvoiceEmail({ name, businessName, businessAddress, invoiceNumber, amount, date }) {
  const subject = `Invoice ${invoiceNumber} — NZ Melting Pot`;
  const displayDate = (() => {
    try {
      const [y,m,day] = date.split('-');
      return new Date(Number(y), Number(m)-1, Number(day))
        .toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return date; }
  })();

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;padding:24px 16px;background:#f9fafb;color:#1f2937;">

  <!-- Header -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0B5E4F;border-radius:10px 10px 0 0;">
    <tr>
      <td style="padding:20px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="52" style="vertical-align:middle;">
              <img src="${LOGO_URL}" alt="NZ Melting Pot" width="44" height="44" style="display:block;border-radius:50%;border:2px solid #c9a227;background:#fff;" />
            </td>
            <td style="vertical-align:middle;padding-left:12px;">
              <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a227;">NZ Melting Pot</div>
              <div style="font-size:17px;font-weight:bold;font-family:Georgia,serif;color:#fff;">Musical Talent Showcase 2026</div>
            </td>
            <td style="vertical-align:middle;text-align:right;">
              <div style="background:#c9a227;color:#1E1915;font-size:11px;font-weight:bold;letter-spacing:1.5px;padding:5px 14px;display:inline-block;border-radius:3px;">INVOICE</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Invoice body -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff;border:1px solid #e5e7eb;border-top:none;">
    <!-- Invoice meta -->
    <tr>
      <td style="padding:22px 28px 16px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Invoice Number</div>
              <div style="font-size:19px;font-family:'Courier New',monospace;font-weight:bold;color:#0B5E4F;">${esc(invoiceNumber)}</div>
            </td>
            <td style="vertical-align:top;text-align:right;">
              <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Invoice Date</div>
              <div style="font-size:14px;color:#1f2937;font-weight:600;">${esc(displayDate)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="padding:0 28px;"><div style="border-top:1px solid #f3f4f6;"></div></td></tr>

    <!-- Bill To -->
    <tr>
      <td style="padding:18px 28px;">
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Bill To</div>
        <div style="font-size:15px;font-weight:700;color:#1f2937;">${esc(name)}</div>
        <div style="font-size:14px;color:#374151;margin-top:3px;">${esc(businessName)}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:3px;white-space:pre-line;line-height:1.6;">${esc(businessAddress)}</div>
      </td>
    </tr>
    <tr><td style="padding:0 28px;"><div style="border-top:1px solid #f3f4f6;"></div></td></tr>

    <!-- Line items -->
    <tr>
      <td style="padding:18px 28px 0 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="text-align:left;padding:10px 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">Description</th>
              <th style="text-align:right;padding:10px 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;">Amount (NZD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:14px;font-size:14px;color:#1f2937;border-bottom:1px solid #f3f4f6;line-height:1.5;">
                Contribution &amp; Support<br/>
                <span style="font-size:12px;color:#6b7280;">Musical Talent Showcase 2026 — NZ Melting Pot</span>
              </td>
              <td style="padding:14px;font-size:15px;font-weight:700;color:#1f2937;text-align:right;border-bottom:1px solid #f3f4f6;">${esc(fmtNZD(amount))}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Total -->
    <tr>
      <td style="padding:16px 28px 24px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td></td>
            <td width="240" style="background:#0B5E4F;padding:14px 20px;border-radius:8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-size:12px;color:#a3d9c8;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;" colspan="2">Total Due</td>
                </tr>
                <tr>
                  <td style="font-size:22px;font-weight:bold;color:#fff;">${esc(fmtNZD(amount))}</td>
                  <td style="text-align:right;font-size:11px;color:#a3d9c8;">NZD</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Thank you section -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#E8F5F0;border:1.5px solid #a3d9c8;border-top:none;border-radius:0 0 10px 10px;margin-bottom:28px;">
    <tr>
      <td style="padding:26px 28px;">
        <p style="margin:0 0 14px 0;font-size:16px;font-weight:700;color:#0B5E4F;font-family:Georgia,serif;">
          &#10024; Thank You for Your Generous Support
        </p>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.75;color:#374151;">
          Dear ${esc(name)},
        </p>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.75;color:#374151;">
          On behalf of the NZ Melting Pot committee, we extend our deepest gratitude for your generous contribution and support of the <strong>Musical Talent Showcase 2026</strong>. Your backing truly makes a difference to the many talented performers and community members who are part of this celebration of music.
        </p>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.75;color:#374151;">
          It is the kindness and generosity of supporters like you and <strong>${esc(businessName)}</strong> that makes events like this possible, and we are deeply honoured to have you with us. We hope you and your guests will join us on the night to enjoy the performances and the warm community spirit of Auckland.
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.75;color:#374151;">
          Thank you once again — your support is truly appreciated.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
          Warm regards,<br/>
          <strong>The NZ Melting Pot Committee</strong>
        </p>
      </td>
    </tr>
  </table>

  <!-- Event box -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
    <tr>
      <td style="background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;padding:18px 24px;text-align:center;">
        <p style="margin:0 0 6px 0;font-weight:700;color:#0B5E4F;font-size:14px;font-family:Georgia,serif;">&#128197; Event Details</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.7;">
          <strong>Saturday, 18 July 2026</strong><br/>
          Blockhouse Bay Community Centre<br/>
          524 Blockhouse Bay Road, Blockhouse Bay, Auckland 0600
        </p>
      </td>
    </tr>
  </table>

  <p style="font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:16px;">
    Musical Talent Showcase 2026 &middot; NZ Melting Pot<br/>
    <a href="${SITE_URL}" style="color:#9ca3af;">www.nzmeltingpot.com</a>
  </p>
</div>`;

  return { subject, html };
}

const inp = {
  width: '100%', padding: '10px 14px', border: '1.5px solid #E6DDD3',
  borderRadius: 8, fontSize: '0.95rem', color: '#1E1915',
  background: '#FFFCF8', outline: 'none', boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: '0.85rem', fontWeight: 600,
  color: '#3D342E', marginBottom: 6,
};

export default function InvoiceTab() {
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [date, setDate]               = useState(todayISO());
  const [amount, setAmount]           = useState('');

  const [issuing, setIssuing]   = useState(false);
  const [result, setResult]     = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!window.ezsite?.apis?.tablePage) return;
    setLoading(true);
    try {
      const { data } = await window.ezsite.apis.tablePage(TABLE_ID, {
        PageNo: 1, PageSize: 100,
        OrderByField: 'id', IsAsc: false,
        Filters: [{ Name: 'category', Op: 'Equal', Value: 'invoice' }],
      });
      setInvoices(data?.List || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const handleIssue = async () => {
    if (!name.trim() || !email.trim() || !businessName.trim() || !amount) {
      setResult({ ok: false, msg: 'Name, email, business name and amount are required.' });
      return;
    }
    setIssuing(true);
    setResult(null);
    try {
      // Find next invoice number
      const { data: existing } = await window.ezsite.apis.tablePage(TABLE_ID, {
        PageNo: 1, PageSize: 500,
        Filters: [{ Name: 'category', Op: 'Equal', Value: 'invoice' }],
      });
      const nums = (existing?.List || [])
        .map(r => r.unique_code)
        .filter(c => /^NZMP-DS-\d+$/.test(c))
        .map(c => parseInt(c.replace('NZMP-DS-', ''), 10))
        .filter(n => !isNaN(n));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const invoiceNumber = `NZMP-DS-${String(nextNum).padStart(3, '0')}`;

      // Store record
      await window.ezsite.apis.tableCreate(TABLE_ID, {
        unique_code: invoiceNumber,
        participant_name: name.trim(),
        email: email.trim().toLowerCase(),
        performance_type: businessName.trim(),
        song_title: businessAddress.trim() || 'N/A',
        total_fee: parseFloat(amount),
        category: 'invoice',
        phone: 'N/A',
        num_performers: 1,
        status: 'issued',
        submission_timestamp: new Date(`${date}T12:00:00`).toISOString(),
        year: 2026,
      });

      // Send email
      const { subject, html } = buildInvoiceEmail({
        name: name.trim(),
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        invoiceNumber,
        amount: parseFloat(amount),
        date,
      });
      await window.ezsite.apis.sendEmail({
        from: 'NZ Melting Pot <noreply@nzmeltingpot.com>',
        to: [email.trim().toLowerCase()],
        subject,
        html,
      });

      setResult({ ok: true, msg: `✅ Invoice ${invoiceNumber} issued and emailed to ${email.trim()}.` });
      setName(''); setEmail(''); setBusinessName(''); setBusinessAddress('');
      setDate(todayISO()); setAmount('');
      loadInvoices();
    } catch (err) {
      setResult({ ok: false, msg: '❌ Failed: ' + (err.message || 'Unknown error') });
    }
    setIssuing(false);
  };

  const canSubmit = name.trim() && email.trim() && businessName.trim() && amount;

  return (
    <div>
      {/* Header */}
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0B5E4F', marginBottom: 8, paddingBottom: 8, borderBottom: '2px solid #a3d9c8', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🧾</span> Issue Invoices
      </div>
      <p style={{ color: '#555', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.6 }}>
        Issue a contribution or sponsorship invoice and send a thank-you email to the supporter. Each invoice is numbered sequentially starting at NZMP-DS-001.
      </p>

      {/* Form */}
      <div style={{ background: '#F2FAF7', border: '1.5px solid #a3d9c8', borderRadius: 12, padding: '24px 24px 20px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: '1rem', fontWeight: 700, color: '#0B5E4F' }}>📄 New Invoice</h3>

        {/* Name + Email */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Contact Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="e.g. jane@company.co.nz" style={inp} />
          </div>
        </div>

        {/* Business Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Business Name</label>
          <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
            placeholder="e.g. Auckland Catering Co." style={inp} />
        </div>

        {/* Business Address */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Business Address</label>
          <textarea value={businessAddress} onChange={e => setBusinessAddress(e.target.value)}
            placeholder="e.g. 12 Commerce Street, Auckland 1010" rows={2}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Date + Amount */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Invoice Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Amount (NZD)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 500.00" min="0" step="0.01"
              style={inp} />
          </div>
        </div>

        {/* Result */}
        {result &&
          <div style={{
            padding: '12px 16px', marginBottom: 16, borderRadius: 8,
            background: result.ok ? '#dcfce7' : '#fef2f2',
            border: `1px solid ${result.ok ? '#86efac' : '#fecaca'}`,
            color: result.ok ? '#166534' : '#991b1b',
            fontSize: '0.88rem', lineHeight: 1.6,
          }}>
            {result.msg}
          </div>
        }

        <button
          onClick={handleIssue}
          disabled={issuing || !canSubmit}
          style={{
            padding: '11px 24px',
            background: issuing || !canSubmit ? '#9ca3af' : '#0B5E4F',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: '0.95rem', fontWeight: 700,
            cursor: issuing || !canSubmit ? 'not-allowed' : 'pointer',
          }}>
          {issuing ? 'Issuing…' : 'Issue Invoice & Send Email →'}
        </button>
      </div>

      {/* Issued invoices table */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1E1915' }}>Issued Invoices</h3>
          <button onClick={loadInvoices} style={{ background: 'none', border: 'none', color: '#7B1E2D', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
            Refresh ↺
          </button>
        </div>
        {loading ?
          <p style={{ color: '#666', fontSize: '0.85rem' }}>Loading…</p> :
          invoices.length === 0 ?
          <p style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>No invoices issued yet.</p> :
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Invoice #', 'Date', 'Name', 'Business', 'Amount', 'Email'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #E6DDD3', fontWeight: 700, color: '#3D342E', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id || inv.ID}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#0B5E4F', fontWeight: 700 }}>{inv.unique_code}</span>
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {fmtDate(inv.submission_timestamp)}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', color: '#1E1915' }}>{inv.participant_name || '—'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', color: '#1E1915' }}>{inv.performance_type || '—'}</td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', fontWeight: 700, color: '#0B5E4F' }}>
                      {fmtNZD(inv.total_fee)}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #f3ede6', color: '#1E1915' }}>{inv.email || '—'}</td>
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
