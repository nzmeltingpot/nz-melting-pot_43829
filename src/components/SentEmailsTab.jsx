/**
 * SentEmailsTab — Admin panel tab showing a history of bulk emails sent
 * to Members and Participants, with the full message body and a
 * per-recipient delivery record, plus one-click Resend.
 */
import { useState, useEffect, useCallback } from 'react';
import { generateUnsubscribeLink, generateUpdateDetailsLink, generateSubscribeLink, generateNewsletterEmail } from '../utils/emailTemplates';
import { sendBulkEmail } from '../utils/brevoClient';

const CAMPAIGN_LOG_TABLE_ID = 82960;
const SETTINGS_TABLE_ID = 79250;

/** Parse a stored "from" string like "NZ Melting Pot <noreply@nzmeltingpot.com>" */
function parseFromAddress(value) {
  const fallback = { email: 'noreply@nzmeltingpot.com', name: 'NZ Melting Pot' };
  if (!value || typeof value !== 'string') return fallback;
  const m = value.match(/^\s*"?([^"<]+?)"?\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  if (value.includes('@')) return { email: value.trim() };
  return fallback;
}

function parseRecipients(json) {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-NZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Pacific/Auckland'
    });
  } catch { return String(iso); }
};

const statusStyle = (status) => {
  const map = {
    completed: { bg: '#dcfce7', color: '#166534' },
    partial:   { bg: '#fef3c7', color: '#92400e' },
    failed:    { bg: '#fef2f2', color: '#991b1b' },
    sending:   { bg: '#e0f2fe', color: '#075985' }
  };
  return map[status] || { bg: '#f3f4f6', color: '#4b5563' };
};

export default function SentEmailsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [resendResult, setResendResult] = useState(null);

  const loadCampaigns = useCallback(async () => {
    if (!window.ezsite?.apis?.tablePage) return;
    setLoading(true);
    try {
      const { data } = await window.ezsite.apis.tablePage(CAMPAIGN_LOG_TABLE_ID, {
        PageNo: 1, PageSize: 100,
        OrderByField: 'id', IsAsc: false
      });
      setCampaigns(data?.List || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleResend = async (campaign, onlyFailed) => {
    const id = campaign.ID || campaign.id;
    const all = parseRecipients(campaign.recipients_json);
    const targets = onlyFailed ? all.filter((r) => r.status === 'failed') : all;

    if (targets.length === 0) {
      setResendResult({ id, ok: false, msg: onlyFailed ? 'No failed recipients to resend to.' : 'No recipients found for this campaign.' });
      return;
    }

    setResendingId(id);
    setResendResult(null);
    try {
      // Load current "from" address the same way the original send did
      const { data: settingsData } = await window.ezsite.apis.tablePage(SETTINGS_TABLE_ID, {
        PageNo: 1, PageSize: 1,
        Filters: [{ Name: 'setting_key', Op: 'Equal', Value: 'email_from' }]
      });
      const fromAddress = settingsData?.List?.[0]?.setting_value || 'NZ Melting Pot <noreply@nzmeltingpot.com>';
      const fromObj = parseFromAddress(fromAddress);
      const replyToObj = { email: 'info@nzmeltingpot.com', name: 'NZ Melting Pot' };
      const subscribeLink = generateSubscribeLink();
      const bodyTemplate = campaign.body_text || '';

      const brevoRecipients = targets.map((r) => {
        const unsubscribeLink = generateUnsubscribeLink(r.email);
        const updateDetailsLink = generateUpdateDetailsLink(r.email);
        const personalizedBody = bodyTemplate
          .replace(/\{name\}/gi, r.name || 'Member')
          .replace(/\{email\}/gi, r.email);
        const { html, text } = generateNewsletterEmail({
          fullName: r.name || 'Member',
          newsletterContent: /<[a-z][\s\S]*>/i.test(personalizedBody)
            ? personalizedBody
            : personalizedBody.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((b) => `<p>${b.replace(/\n/g, '<br>')}</p>`).join(''),
          unsubscribeLink, updateDetailsLink, subscribeLink,
          newsletterName: 'NZ Melting Pot', siteName: 'NZ Melting Pot'
        });
        return { email: r.email, name: r.name || undefined, html, text };
      });

      const resendSubject = `[Resend] ${campaign.subject || ''}`;
      const resendSentAt = new Date().toISOString();
      const { error: createErr } = await window.ezsite.apis.tableCreate(CAMPAIGN_LOG_TABLE_ID, {
        subject: resendSubject,
        recipient_count: brevoRecipients.length,
        sent_count: 0,
        failed_count: 0,
        status: 'sending',
        error_summary: '',
        sent_at: resendSentAt,
        body_text: bodyTemplate
      });
      if (createErr) throw new Error(typeof createErr === 'string' ? createErr : 'Failed to create campaign log.');
      // tableCreate's response doesn't reliably return the new row's ID —
      // look it up instead (same fix as Admin.jsx executeSend).
      const { data: lookup } = await window.ezsite.apis.tablePage(CAMPAIGN_LOG_TABLE_ID, {
        PageNo: 1, PageSize: 1, OrderByField: 'id', IsAsc: false
      });
      const newId = lookup?.List?.[0]?.ID || lookup?.List?.[0]?.id || null;

      const result = await sendBulkEmail({
        from: fromObj,
        replyTo: replyToObj,
        subject: resendSubject,
        recipients: brevoRecipients
      });

      if (newId) {
        const recipientsRecord = brevoRecipients.map((r) => {
          const fail = result.failures?.find((f) => f.email.toLowerCase() === r.email.toLowerCase());
          return { name: r.name || '', email: r.email, status: fail ? 'failed' : 'sent', error: fail?.error || null };
        });
        // Full record on update — partial-field updates have been observed to
        // silently fail on this table (see Admin.jsx executeSend for detail).
        const { error: updateErr } = await window.ezsite.apis.tableUpdate(CAMPAIGN_LOG_TABLE_ID, {
          ID: newId,
          subject: resendSubject,
          recipient_count: brevoRecipients.length,
          sent_count: result.sent,
          failed_count: result.failed,
          status: result.failed === 0 ? 'completed' : result.sent === 0 ? 'failed' : 'partial',
          error_summary: result.failures?.slice(0, 5).map((f) => `${f.email}: ${f.error}`).join('; ') || '',
          sent_at: resendSentAt,
          body_text: bodyTemplate,
          recipients_json: JSON.stringify(recipientsRecord)
        });
        if (updateErr) console.warn('[SentEmailsTab] Failed to update resend campaign log:', updateErr);
      }

      setResendResult({
        id,
        ok: result.sent > 0,
        msg: `Resent to ${result.sent} of ${brevoRecipients.length}${result.failed ? `, ${result.failed} failed` : ''}.`
      });
      loadCampaigns();
    } catch (err) {
      setResendResult({ id, ok: false, msg: 'Resend failed: ' + (err.message || 'Unknown error') });
    }
    setResendingId(null);
  };

  return (
    <div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0B5E4F', marginBottom: 8, paddingBottom: 8, borderBottom: '2px solid #a3d9c8', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>📧</span> Sent Emails
      </div>
      <p style={{ color: '#555', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.6 }}>
        History of bulk emails sent to Members and Participants. Click a row to view the full message and per-recipient delivery status. Resend re-sends the same message as a new, separate campaign.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={loadCampaigns} style={{ background: 'none', border: 'none', color: '#7B1E2D', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
          Refresh ↺
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#666', fontSize: '0.85rem' }}>Loading…</p>
      ) : campaigns.length === 0 ? (
        <p style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>No emails sent yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campaigns.map((c) => {
            const id = c.ID || c.id;
            const isOpen = expandedId === id;
            const st = statusStyle(c.status);
            const recipientsRecord = isOpen ? parseRecipients(c.recipients_json) : [];
            const failedCount = c.failed_count || 0;
            const busy = resendingId === id;

            return (
              <div key={id} style={{ border: '1.5px solid #E6DDD3', borderRadius: 10, overflow: 'hidden', background: '#FFFCF8' }}>
                <div
                  onClick={() => setExpandedId(isOpen ? null : id)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', minWidth: 20 }}>{isOpen ? '▾' : '▸'}</span>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, color: '#1E1915', fontSize: '0.95rem' }}>{c.subject || '(no subject)'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>{formatDateTime(c.sent_at)}</div>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: '#374151' }}>{c.recipient_count || 0} recipients</span>
                  <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>✓ {c.sent_count || 0}</span>
                  {failedCount > 0 && <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>✕ {failedCount}</span>}
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color, textTransform: 'capitalize' }}>
                    {c.status || 'unknown'}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid #E6DDD3' }}>
                    {/* Message body */}
                    <div style={{ marginTop: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0B5E4F', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                        Message Sent
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #E6DDD3', borderRadius: 8, padding: '12px 14px', fontSize: '0.85rem', color: '#1E1915', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 240, overflowY: 'auto' }}>
                        {c.body_text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No message body was stored for this send (sent before this feature was added).</span>}
                      </div>
                    </div>

                    {/* Recipients */}
                    {recipientsRecord.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0B5E4F', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                          Recipients ({recipientsRecord.length})
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E6DDD3', borderRadius: 8 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <tbody>
                              {recipientsRecord.map((r, i) => (
                                <tr key={i} style={{ borderBottom: i < recipientsRecord.length - 1 ? '1px solid #f3ede6' : 'none' }}>
                                  <td style={{ padding: '7px 12px', color: '#1E1915' }}>{r.name || '—'}</td>
                                  <td style={{ padding: '7px 12px', color: '#374151' }}>{r.email}</td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                                    {r.status === 'sent' ? (
                                      <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Sent</span>
                                    ) : (
                                      <span style={{ color: '#dc2626', fontWeight: 600 }} title={r.error || ''}>✕ Failed</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Resend controls */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleResend(c, false)}
                        disabled={busy || recipientsRecord.length === 0}
                        style={{
                          padding: '8px 16px', background: busy ? '#9ca3af' : '#0B5E4F', color: '#fff',
                          border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
                          cursor: busy || recipientsRecord.length === 0 ? 'not-allowed' : 'pointer'
                        }}>
                        {busy ? 'Resending…' : `Resend to All (${recipientsRecord.length})`}
                      </button>
                      {failedCount > 0 && (
                        <button
                          onClick={() => handleResend(c, true)}
                          disabled={busy}
                          style={{
                            padding: '8px 16px', background: busy ? '#9ca3af' : '#c9a227', color: '#1E1915',
                            border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
                            cursor: busy ? 'not-allowed' : 'pointer'
                          }}>
                          {busy ? 'Resending…' : `Resend to Failed Only (${failedCount})`}
                        </button>
                      )}
                      {resendResult && resendResult.id === id && (
                        <span style={{ fontSize: '0.82rem', color: resendResult.ok ? '#166534' : '#991b1b', fontWeight: 600 }}>
                          {resendResult.msg}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
