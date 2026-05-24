/**
 * /ticket-preview — ticket design preview + check-in test tool.
 *
 * Opens on the LIVE site to:
 *   1. Show rendered sample tickets (participant + audience).
 *   2. Insert two TEST records into the DB so the QR codes are scannable
 *      at /check-in. Scan from this screen on a second device.
 *   3. Let you delete the test records when done.
 */
import { useEffect, useState } from 'react';
import { buildAudienceTicketsHtml, buildTicketsHtml } from '../utils/paymentEmails';

const SUBMISSIONS_TABLE_ID = 78687;

/* ── Test codes — change if you want fresh ones ── */
const TEST_PAX_CODE = 'TSC26TEST';
const TEST_AUD_CODE = 'AUD26TEST';

/* ── Sample data for ticket visuals ── */
const sampleFormData = {
  participant_name: 'Test Performer',
  participant_2_name: '',
  participant_3_name: '',
  participant_4_name: '',
  category: 'vocal',
  performance_type: 'individual',
  song_title: 'Test Song — Do Re Mi'
};

const sampleBookingData = {
  booking_ref: TEST_AUD_CODE,
  ticket_count: 1,
  total_amount: 10,
  buyer_name: 'Test Audience'
};

/* ── Rendered HTML ── */
const participantHtml = buildTicketsHtml({ formData: sampleFormData, code: TEST_PAX_CODE });
const audienceHtml    = buildAudienceTicketsHtml({
  bookingData: sampleBookingData,
  attendeeNamesArr: ['Test Audience']
});

export default function TicketPreview() {
  const [dbStatus, setDbStatus] = useState('idle'); // idle | inserting | ready | error
  const [deleteStatus, setDeleteStatus] = useState('');
  const [paxId, setPaxId]   = useState(null);
  const [audId, setAudId]   = useState(null);

  /* Insert test records on mount (live site only — window.ezsite may not exist on localhost) */
  useEffect(() => {
    (async () => {
      if (!window.ezsite?.apis?.tableCreate) {
        setDbStatus('local'); // running on localhost — DB not available
        return;
      }
      setDbStatus('inserting');
      try {
        // Delete any stale test records first (ignore errors)
        try {
          const { data } = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
            PageNo: 1, PageSize: 10,
            Filters: [{ Name: 'unique_code', Op: 'StringContains', Value: 'TEST' }]
          });
          for (const row of (data?.List || [])) {
            await window.ezsite.apis.tableDelete(SUBMISSIONS_TABLE_ID, { ID: row.ID || row.id });
          }
        } catch {}

        // Insert participant test record
        const paxRes = await window.ezsite.apis.tableCreate(SUBMISSIONS_TABLE_ID, {
          unique_code: TEST_PAX_CODE,
          participant_name: 'Test Performer',
          category: 'vocal',
          performance_type: 'individual',
          song_title: 'Test Song — Do Re Mi',
          email: 'test@nzmeltingpot.com',
          phone: '000',
          num_performers: 1,
          total_fee: 10,
          status: 'paid',
          submission_timestamp: new Date().toISOString(),
          year: 2026
        });
        if (paxRes.data?.id || paxRes.data?.ID) {
          setPaxId(paxRes.data.id || paxRes.data.ID);
        }

        // Insert audience test record (stored in same table for check-in lookup)
        const audRes = await window.ezsite.apis.tableCreate(SUBMISSIONS_TABLE_ID, {
          unique_code: TEST_AUD_CODE,
          participant_name: 'Test Audience',
          category: 'audience',
          performance_type: 'n/a',
          song_title: 'N/A',
          email: 'test@nzmeltingpot.com',
          phone: '000',
          num_performers: 1,
          total_fee: 10,
          status: 'paid',
          submission_timestamp: new Date().toISOString(),
          year: 2026
        });
        if (audRes.data?.id || audRes.data?.ID) {
          setAudId(audRes.data.id || audRes.data.ID);
        }

        setDbStatus('ready');
      } catch (err) {
        console.error('Test record insert failed:', err);
        setDbStatus('error');
      }
    })();
  }, []);

  /* Delete test records */
  async function handleDelete() {
    if (!window.ezsite?.apis) return;
    setDeleteStatus('Deleting…');
    try {
      const { data } = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
        PageNo: 1, PageSize: 20,
        Filters: [{ Name: 'unique_code', Op: 'StringContains', Value: 'TEST' }]
      });
      for (const row of (data?.List || [])) {
        await window.ezsite.apis.tableDelete(SUBMISSIONS_TABLE_ID, { ID: row.ID || row.id });
      }
      setDeleteStatus('✅ Test records deleted.');
      setPaxId(null); setAudId(null);
      setDbStatus('idle');
    } catch (err) {
      setDeleteStatus('❌ Delete failed: ' + err.message);
    }
  }

  return (
    <section style={{ background: '#f5f5f2', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <h1 style={{ fontFamily: "'Georgia', serif", fontSize: '1.8rem', color: '#1E1915', textAlign: 'center', marginBottom: 6 }}>
          Ticket Preview &amp; Check-In Test
        </h1>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginBottom: 24 }}>
          QR codes on these tickets are real and scannable at{' '}
          <a href="/check-in" style={{ color: '#7B1E2D', fontWeight: 600 }}>/check-in</a>.
        </p>

        {/* DB status banner */}
        {dbStatus === 'inserting' && (
          <div style={infoBanner('#dbeafe', '#2563eb')}>
            ⏳ Creating test records in database…
          </div>
        )}
        {dbStatus === 'ready' && (
          <div style={infoBanner('#dcfce7', '#16a34a')}>
            ✅ Test records inserted — scan the QR codes below at <strong>/check-in</strong> (PIN: 2026).
            <br />
            <span style={{ fontSize: '0.82rem' }}>
              Participant code: <code style={codeStyle}>{TEST_PAX_CODE}</code> &nbsp;
              Audience code: <code style={codeStyle}>{TEST_AUD_CODE}</code>
            </span>
          </div>
        )}
        {dbStatus === 'local' && (
          <div style={infoBanner('#fef3c7', '#d97706')}>
            ⚠️ Running on localhost — DB not available. Open this page on the <strong>live site</strong> to create scannable test records.
          </div>
        )}
        {dbStatus === 'error' && (
          <div style={infoBanner('#fee2e2', '#dc2626')}>
            ❌ Could not insert test records. Check the console for details.
          </div>
        )}

        {/* Delete button */}
        {(dbStatus === 'ready' || paxId || audId) && (
          <div style={{ textAlign: 'center', margin: '12px 0 28px' }}>
            <button onClick={handleDelete} style={deleteBtnStyle}>
              🗑 Delete test records when done
            </button>
            {deleteStatus && <p style={{ marginTop: 8, fontSize: '0.88rem', color: '#374151' }}>{deleteStatus}</p>}
          </div>
        )}

        {/* ── Participant Ticket ── */}
        <h2 style={sectionHeading}>🎫 Participant Ticket</h2>
        <p style={sectionNote}>
          Code: <code style={codeStyle}>{TEST_PAX_CODE}</code> — scan this QR at /check-in to test success ✅ then scan again to test duplicate ⚠️
        </p>
        <div dangerouslySetInnerHTML={{ __html: participantHtml }} />

        <div style={{ borderTop: '2px dashed #d4c4a8', margin: '40px 0 36px' }} />

        {/* ── Audience Ticket ── */}
        <h2 style={sectionHeading}>🎟️ Audience Ticket</h2>
        <p style={sectionNote}>
          Code: <code style={codeStyle}>{TEST_AUD_CODE}</code> — scan this QR at /check-in to test audience ticket flow
        </p>
        <div dangerouslySetInnerHTML={{ __html: audienceHtml }} />

        <div style={{ marginTop: 48, textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
          Test page only · Not linked in navigation
        </div>
      </div>
    </section>
  );
}

/* ── Helpers ── */
function infoBanner(bg, color) {
  return {
    background: bg, color, border: `1.5px solid ${color}`,
    borderRadius: 10, padding: '12px 16px', marginBottom: 16,
    fontSize: '0.88rem', lineHeight: 1.6
  };
}

const codeStyle = {
  background: '#e5e7eb', padding: '1px 6px', borderRadius: 4,
  fontFamily: 'monospace', fontSize: '0.85rem', color: '#1f2937'
};

const deleteBtnStyle = {
  padding: '9px 20px', background: '#dc2626', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: '0.88rem',
  fontWeight: 600, cursor: 'pointer'
};

const sectionHeading = {
  fontFamily: "'Georgia', serif", fontSize: '1.3rem',
  color: '#7B1E2D', marginBottom: 6
};

const sectionNote = {
  fontSize: '0.88rem', color: '#6b7280', marginBottom: 20, lineHeight: 1.6
};
