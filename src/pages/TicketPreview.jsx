/**
 * /ticket-preview  — design review page (not linked in nav)
 *
 * Shows a rendered sample of both ticket types so you can review the design
 * before approving any changes.  Uses the exact same HTML-builder functions
 * that are called when real emails are sent.
 */
import { buildAudienceTicketsHtml, buildTicketsHtml } from '../utils/paymentEmails';

/* ── Sample data ── */
const sampleBookingData = {
  booking_ref: 'AUD26-001234',
  ticket_count: 2,
  total_amount: 20,
  buyer_name: 'Jane Smith'
};

const sampleAttendeeNames = ['Jane Smith', 'Tom Smith'];

const sampleFormData = {
  participant_name: 'Aroha Williams',
  participant_2_name: 'Tāne Williams',
  participant_3_name: '',
  participant_4_name: '',
  category: 'vocal',
  performance_type: 'duo',
  song_title: 'Pure Imagination'
};

const sampleCode = 'TSC26042';

/* ── Rendered HTML ── */
const audienceHtml = buildAudienceTicketsHtml({
  bookingData: sampleBookingData,
  attendeeNamesArr: sampleAttendeeNames
});

const participantHtml = buildTicketsHtml({
  formData: sampleFormData,
  code: sampleCode
});

export default function TicketPreview() {
  return (
    <section style={{ background: '#f5f5f2', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <h1 style={{
          fontFamily: "'Georgia', serif",
          fontSize: '1.8rem',
          color: '#1E1915',
          textAlign: 'center',
          marginBottom: 6
        }}>
          Ticket Design Preview
        </h1>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginBottom: 48 }}>
          These are rendered with sample data — exactly as they appear in real emails.
        </p>

        {/* ── Audience Tickets ── */}
        <h2 style={sectionHeading}>🎟️ Audience Tickets</h2>
        <p style={sectionNote}>
          Sent to audience members who book via <em>/book-tickets</em>. Gold &amp; dark palette, "ADMIT ONE" banner, QR code + booking reference.
        </p>
        <div dangerouslySetInnerHTML={{ __html: audienceHtml }} />

        <div style={{ borderTop: '2px dashed #d4c4a8', margin: '48px 0 40px' }} />

        {/* ── Participant / Performance Tickets ── */}
        <h2 style={sectionHeading}>🎫 Participant / Performance Tickets</h2>
        <p style={sectionNote}>
          Sent to performers who register via the talent showcase form. Red gradient header, participant name, registration code, QR code.
        </p>
        <div dangerouslySetInnerHTML={{ __html: participantHtml }} />

        <div style={{ marginTop: 56, textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
          Preview only · Not linked in navigation
        </div>
      </div>
    </section>);

}

const sectionHeading = {
  fontFamily: "'Georgia', serif",
  fontSize: '1.3rem',
  color: '#7B1E2D',
  marginBottom: 6
};

const sectionNote = {
  fontSize: '0.88rem',
  color: '#6b7280',
  marginBottom: 20,
  lineHeight: 1.6
};
