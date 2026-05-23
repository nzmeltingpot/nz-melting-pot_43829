/**
 * Payment-flow email builders.
 * Used by the /payment-success page after a successful Stripe payment.
 */

const SITE_URL = 'https://www.nzmeltingpot.com';
const LOGO_URL = `${SITE_URL}/images/branding/logo-300x300.png`;
const EVENT_DATE = 'Saturday, 18 July 2026';
const EVENT_VENUE = 'Blockhouse Bay Community Centre, 524 Blockhouse Bay Road, Blockhouse Bay, Auckland 0600';

/** Minimal HTML escape — protects against template injection from user-supplied fields. */
function escapeHtml(s) {
  return String(s ?? '').
  replace(/&/g, '&amp;').
  replace(/</g, '&lt;').
  replace(/>/g, '&gt;').
  replace(/"/g, '&quot;').
  replace(/'/g, '&#39;');
}

/** Capitalise first letter (e.g. "trio" → "Trio") */
function capitalise(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert YYYY-MM-DD (ISO) to DD/MM/YYYY (NZ display format). */
function formatNZ(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return isoDate || '';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate;
}

/**
 * Convert a YYYY-MM-DD [HH:MM[:SS]] timestamp to DD/MM/YYYY HH:MM (NZ display format).
 * Also handles the ambiguous dd/mm/yyyy strings by returning them as-is.
 */
function formatNZDateTime(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  // YYYY-MM-DD with optional time component
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[\s,T]+(\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]} NZT`;
  // Already in dd/mm/yyyy format — return as-is
  const nz = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (nz) return dateStr;
  return formatNZ(dateStr);
}

/**
 * Generate a fake-but-realistic-looking QR code as an inline HTML table grid.
 * Purely decorative — not scannable. Deterministically derived from codeStr so each
 * ticket gets a consistent (but visually unique) pattern.
 * Returns a table element that can be embedded inside a <td>.
 */
function generateFakeQRCode(codeStr, darkColor) {
  const barColor = darkColor || '#1a1a1a';
  const size = 21; // 21×21 grid (matches standard QR visual size)
  const cellPx = 5; // px per module

  // Derive a deterministic seed from codeStr
  let hash = 0x811c9dc5;
  for (let i = 0; i < codeStr.length; i++) {
    hash ^= codeStr.charCodeAt(i);
    hash = hash * 0x01000193 >>> 0;
  }

  // Build the grid
  const grid = [];
  for (let r = 0; r < size; r++) {
    grid[r] = [];
    for (let c = 0; c < size; c++) {
      // Top-left finder pattern (rows 0-6, cols 0-6)
      if (r <= 6 && c <= 6) {
        if (r === 0 || r === 6 || c === 0 || c === 6) grid[r][c] = 1;else
        if (r === 1 || r === 5 || c === 1 || c === 5) grid[r][c] = 0;else
        grid[r][c] = 1;
      }
      // Top-right finder pattern (rows 0-6, cols 14-20)
      else if (r <= 6 && c >= 14) {
        const lc = c - 14;
        if (r === 0 || r === 6 || lc === 0 || lc === 6) grid[r][c] = 1;else
        if (r === 1 || r === 5 || lc === 1 || lc === 5) grid[r][c] = 0;else
        grid[r][c] = 1;
      }
      // Bottom-left finder pattern (rows 14-20, cols 0-6)
      else if (r >= 14 && c <= 6) {
        const lr = r - 14;
        if (lr === 0 || lr === 6 || c === 0 || c === 6) grid[r][c] = 1;else
        if (lr === 1 || lr === 5 || c === 1 || c === 5) grid[r][c] = 0;else
        grid[r][c] = 1;
      }
      // Data area — deterministic pseudo-random from hash + position
      else {
        const seed = ((hash ^ r * 0x9e3779b9 ^ c * 0x6c62272e) >>> 0) * 2654435761 >>> 0;
        grid[r][c] = seed % 2;
      }
    }
  }

  const totalPx = size * cellPx; // 105px

  const rows = grid.map((row) => {
    const cells = row.map((dark) =>
    `<td style="padding:0;width:${cellPx}px;height:${cellPx}px;background:${dark ? barColor : '#fff'};font-size:0;line-height:0;"> </td>`
    ).join('');
    return `<tr style="height:${cellPx}px;">${cells}</tr>`;
  }).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;border-collapse:collapse;width:${totalPx}px;height:${totalPx}px;border:2px solid ${barColor};padding:4px;background:#fff;">${rows}</table>`;
}

/**
 * Build a single ticket as inline HTML.
 * Email-client safe: uses tables + inline styles (no flex/grid).
 */
function buildSingleTicket({ participantName, code, category, performanceType, songTitle, ticketNumber, totalTickets }) {
  const categoryLabel = capitalise(category || '');
  const perfLabel = capitalise(performanceType || '');

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;margin:18px auto;border-collapse:separate;background:#FFFCF8;border:2px dashed #c9a227;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#7B1E2D 0%,#A83832 100%);padding:14px 22px;color:#fff;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td style="vertical-align:middle;width:46px;">
              <img src="${LOGO_URL}" alt="NZ Melting Pot" width="40" height="40" style="display:block;border-radius:50%;border:2px solid #fff;background:#fff;" />
            </td>
            <td style="vertical-align:middle;padding-left:10px;">
              <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;opacity:0.85;">NZ Melting Pot</div>
              <div style="font-size:16px;font-weight:bold;font-family:'Georgia',serif;">Musical Talent Showcase 2026</div>
            </td>
            <td style="vertical-align:middle;text-align:right;color:#ffd700;font-size:11px;font-weight:bold;letter-spacing:1.5px;">
              TICKET ${ticketNumber}/${totalTickets}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Participant + Code (main body) -->
    <tr>
      <td style="padding:24px 22px 14px 22px;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Participant</div>
        <div style="font-size:22px;font-weight:bold;color:#1E1915;font-family:'Georgia',serif;letter-spacing:0.5px;">
          ${escapeHtml(participantName)}
        </div>
      </td>
    </tr>

    <!-- Perforation strip -->
    <tr>
      <td style="padding:0 22px;">
        <div style="border-top:2px dashed #d4c4a8;height:1px;line-height:1px;">&nbsp;</div>
      </td>
    </tr>

    <!-- Code highlight + QR code -->
    <tr>
      <td style="padding:14px 22px 14px 22px;background:#FBF5ED;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td style="vertical-align:middle;width:121px;text-align:center;">
              ${generateFakeQRCode(code, '#7B1E2D')}
              <div style="font-size:7px;color:#9ca3af;letter-spacing:2px;font-family:'Courier New',monospace;margin-top:4px;">${escapeHtml(code)}</div>
            </td>
            <td style="vertical-align:middle;padding-left:16px;text-align:left;">
              <div style="font-size:10px;color:#7B1E2D;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600;">Registration Code</div>
              <div style="font-size:24px;font-weight:bold;color:#7B1E2D;letter-spacing:4px;font-family:'Courier New',monospace;line-height:1.2;">${escapeHtml(code)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Event details -->
    <tr>
      <td style="padding:18px 22px 22px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:13px;color:#374151;">
          <tr>
            <td style="padding:4px 0;width:90px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Category</td>
            <td style="padding:4px 0;color:#1f2937;font-weight:600;">${escapeHtml(categoryLabel)} — ${escapeHtml(perfLabel)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Performing</td>
            <td style="padding:4px 0;color:#1f2937;font-style:italic;">${escapeHtml(songTitle)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Date</td>
            <td style="padding:4px 0;color:#1f2937;">${EVENT_DATE}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Venue</td>
            <td style="padding:4px 0;color:#1f2937;">${EVENT_VENUE}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer note -->
    <tr>
      <td style="background:#1E1915;padding:10px 22px;color:#9ca3af;font-size:10px;text-align:center;letter-spacing:1.5px;">
        PLEASE BRING THIS TICKET (PRINT OR ON YOUR PHONE) ON SHOW DAY
      </td>
    </tr>
  </table>
  `;
}

/**
 * Build the tickets block for an email — one ticket per participant.
 */
export function buildTicketsHtml({ formData, code }) {
  const participants = [
  formData.participant_name,
  formData.participant_2_name,
  formData.participant_3_name,
  formData.participant_4_name].
  filter((name) => name && name.trim() !== '');

  const totalTickets = participants.length;
  return participants.map((name, i) =>
  buildSingleTicket({
    participantName: name,
    code,
    category: formData.category,
    performanceType: formData.performance_type,
    songTitle: formData.song_title,
    ticketNumber: i + 1,
    totalTickets
  })
  ).join('\n');
}

/**
 * Build the participant confirmation email (sent after successful payment).
 * Returns { subject, html } — caller passes to window.ezsite.apis.sendEmail.
 *
 * @param {Object} params
 * @param {string} params.recipientName  Lead participant name
 * @param {string} params.code           Registration code (e.g. TSC26001)
 * @param {number} params.amountPaid     Amount paid in NZD whole dollars
 * @param {Object} params.siteSettings   settings object loaded from settings table
 */
export function buildParticipantConfirmationEmail({ recipientName, code, amountPaid, siteSettings, formData }) {
  const subject = `Registration Confirmed — Musical Talent Showcase 2026 (${code})`;

  const ticketsHtml = formData ? buildTicketsHtml({ formData, code }) : '';
  const ticketCount = formData ? [
  formData.participant_name,
  formData.participant_2_name,
  formData.participant_3_name,
  formData.participant_4_name].
  filter((n) => n && n.trim()).length : 0;

  // Sign-off line is editable via Admin > Content tab; falls back to default.
  const closing = siteSettings && siteSettings.email_closing || 'Warm regards,\nThe NZ Melting Pot Team';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #2d3748; background:#fafaf7;">

      <p style="font-size:15px;">Dear ${escapeHtml(recipientName)},</p>

      <p style="background:#dcfce7;border-left:4px solid #16a34a;padding:14px 18px;border-radius:6px;font-weight:600;color:#166534;font-size:15px;margin:18px 0;">
        ✅ Payment received — your registration is confirmed!
      </p>

      <p style="font-size:14px;line-height:1.65;">
        Thank you for registering for the <strong>Musical Talent Showcase 2026</strong>.
        Your spot is now reserved — we are thrilled to have you and look forward to your performance on stage.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin:18px 0;font-size:14px;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;color:#6b7280;">Registration Code</td>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;text-align:right;font-weight:bold;color:#7B1E2D;letter-spacing:1px;">${escapeHtml(code)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;color:#6b7280;">${ticketCount > 1 ? 'Participants' : 'Participant'}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;text-align:right;color:#1f2937;">${ticketCount}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Amount Paid</td>
          <td style="padding:12px 16px;text-align:right;font-weight:bold;color:#16a34a;">$${amountPaid} NZD</td>
        </tr>
      </table>

      ${ticketsHtml ? `
        <h3 style="font-family:Georgia,serif;color:#7B1E2D;text-align:center;margin:32px 0 6px 0;font-size:22px;">
          🎫 Your ${ticketCount === 1 ? 'Ticket' : `${ticketCount} Tickets`}
        </h3>
        <p style="text-align:center;color:#6b7280;font-size:13px;margin:0 0 8px 0;">
          ${ticketCount === 1 ?
  'Please bring this ticket on show day (printed or on your phone).' :
  `One ticket per participant. Please bring all ${ticketCount} on show day.`}
        </p>
        ${ticketsHtml}
      ` : ''}

      <h3 style="font-family:Georgia,serif;color:#7B1E2D;margin:32px 0 8px 0;font-size:18px;">
        What happens next
      </h3>
      <ul style="font-size:14px;line-height:1.7;color:#374151;padding-left:20px;margin:0 0 16px 0;">
        <li>We will be in touch closer to the event with <strong>rehearsal details</strong> and show-day logistics.</li>
        <li>Please <strong>save this email</strong> — your tickets and registration code are inside.</li>
        <li>If you need to update any details (e.g. a change of song or participant), reply to this email or visit the
          <a href="${SITE_URL}/contact" style="color:#7B1E2D;font-weight:600;">Contact</a> page on our website.</li>
      </ul>

      <!-- Audience tickets invitation -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:24px 0;">
        <tr>
          <td style="background:linear-gradient(135deg,#FBF5ED 0%,#F5EDDF 100%);border:1.5px solid #c9a227;border-radius:12px;padding:22px 24px;text-align:center;">
            <div style="font-size:28px;line-height:1;margin-bottom:6px;">🎟️</div>
            <p style="margin:0 0 6px 0;font-weight:700;color:#1E1915;font-size:15px;font-family:Georgia,serif;">
              Bringing family or friends along to cheer you on?
            </p>
            <p style="margin:0 0 14px 0;font-size:13px;color:#4b5563;line-height:1.55;">
              Audience tickets are <strong>$10 NZD each</strong> — book up to 10 in one go.
            </p>
            <a href="${SITE_URL}/book-tickets"
               style="display:inline-block;padding:11px 24px;background:#1E1915;color:#c9a227;text-decoration:none;border-radius:25px;font-weight:600;font-size:14px;letter-spacing:0.3px;border:1.5px solid #c9a227;">
              Book Audience Tickets &rarr;
            </a>
          </td>
        </tr>
      </table>

      <p style="background:#fff7ed;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;color:#9a3412;font-size:13px;line-height:1.6;margin:18px 0;">
        <strong>Refund policy:</strong> Last-minute withdrawals are not eligible for a refund of the entry fee. Please see our
        <a href="${SITE_URL}/terms" style="color:#9a3412;font-weight:600;">Terms &amp; Conditions</a> for details.
      </p>

      <p style="font-size:14px;margin-top:28px;line-height:1.6;white-space:pre-line;">${escapeHtml(closing)}</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 14px 0;" />
      <p style="font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
        Musical Talent Showcase 2026 · NZ Melting Pot<br/>
        ${EVENT_DATE} · ${EVENT_VENUE}<br/>
        <a href="${SITE_URL}" style="color:#9ca3af;">www.nzmeltingpot.com</a>
      </p>
    </div>
  `;

  const participantLines = formData ?
  [formData.participant_name, formData.participant_2_name, formData.participant_3_name, formData.participant_4_name].
  filter((n) => n && n.trim()).
  map((n, i) => `  ${i + 1}. ${n}`).
  join('\n') :
  `  1. ${recipientName}`;

  const text = [
  `Registration Confirmed — Musical Talent Showcase 2026 (${code})`,
  ``,
  `Dear ${recipientName},`,
  ``,
  `Payment received — your registration is confirmed!`,
  ``,
  `Registration Code: ${code}`,
  `Participant(s):`,
  participantLines,
  `Amount Paid:     $${amountPaid} NZD`,
  ``,
  `Event:  Musical Talent Showcase 2026`,
  `Date:   ${EVENT_DATE}`,
  `Venue:  ${EVENT_VENUE}`,
  ``,
  `WHAT HAPPENS NEXT`,
  `- We will be in touch closer to the event with rehearsal details and show-day logistics.`,
  `- Please save this email — your registration code is ${code}.`,
  `- To update any details, reply to this email or visit ${SITE_URL}/contact`,
  ``,
  closing,
  ``,
  `---`,
  `Musical Talent Showcase 2026 · NZ Melting Pot`,
  `${EVENT_DATE} · Blockhouse Bay Community Centre`,
  SITE_URL].
  join('\n');

  return { subject, html, text };
}

/**
 * Build the admin notification email (sent after each successful payment).
 * Plain HTML — internal-only, no fancy styling needed.
 */
export function buildAdminNotificationEmail({ formData, code, amountPaid, sessionId }) {
  const subject = `New paid registration — ${code}`;

  const rows = [
  ['Registration Code', code],
  ['Status', '✅ PAID'],
  ['Amount Paid', `$${amountPaid} NZD`],
  ['Rate', formData.rate_type === 'early_bird' ? `Early Bird ($${formData.rate_per_participant}/participant)` : `Standard ($${formData.rate_per_participant}/participant)`],
  ['Stripe Session', sessionId || '—'],
  ['Submitted At', formatNZDateTime(formData.submission_timestamp) || '—'],
  ['Leader Name', formData.participant_name],
  ['Date of Birth', formatNZ(formData.date_of_birth)],
  ['Email', formData.email],
  ['Phone', formData.phone],
  ['Category', formData.category],
  ['Performance Type', formData.performance_type],
  ['Song / Piece', formData.song_title],
  ['Number of Performers', formData.num_performers],
  ['Participant 2', formData.participant_2_name || '—'],
  ['Participant 3', formData.participant_3_name || '—'],
  ['Participant 4', formData.participant_4_name || '—'],
  ['Heard About', formData.heard_about]];


  const tableRows = rows.map(([k, v]) =>
  `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:180px;">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1f2937;">${escapeHtml(String(v))}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
      <h2 style="color:#7B1E2D;margin:0 0 8px 0;">🎉 New Paid Registration</h2>
      <p style="color:#6b7280;margin:0 0 20px 0;font-size:14px;">A participant has just completed payment for the Talent Showcase 2026.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${tableRows}
      </table>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">Sent automatically by the NZ Melting Pot registration system.</p>
    </div>
  `;

  return { subject, html };
}

/* ============================================================================
   Audience-ticket email builders (used by /booking-success)
   ========================================================================== */

/**
 * Build a single audience admit-one ticket as inline HTML.
 * Distinct from performer tickets — uses gold/black palette and an "ADMIT ONE" badge.
 */
function buildSingleAudienceTicket({ attendeeName, bookingRef, ticketNumber, totalTickets, buyerName }) {
  const displayName = attendeeName && attendeeName.trim() || buyerName;

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;margin:18px auto;border-collapse:separate;background:#FFFCF8;border:2px dashed #c9a227;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#1E1915 0%,#3D342E 100%);padding:14px 22px;color:#fff;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td style="vertical-align:middle;width:46px;">
              <img src="${LOGO_URL}" alt="NZ Melting Pot" width="40" height="40" style="display:block;border-radius:50%;border:2px solid #c9a227;background:#fff;" />
            </td>
            <td style="vertical-align:middle;padding-left:10px;">
              <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#c9a227;">Audience Ticket</div>
              <div style="font-size:16px;font-weight:bold;font-family:'Georgia',serif;">Musical Talent Showcase 2026</div>
            </td>
            <td style="vertical-align:middle;text-align:right;color:#c9a227;font-size:11px;font-weight:bold;letter-spacing:1.5px;">
              ${ticketNumber}/${totalTickets}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ADMIT ONE big banner -->
    <tr>
      <td style="background:#c9a227;color:#1E1915;text-align:center;padding:8px 0;font-weight:bold;letter-spacing:6px;font-size:13px;">
        🎟️ ADMIT ONE 🎟️
      </td>
    </tr>

    <!-- Attendee name -->
    <tr>
      <td style="padding:24px 22px 14px 22px;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Attendee</div>
        <div style="font-size:22px;font-weight:bold;color:#1E1915;font-family:'Georgia',serif;letter-spacing:0.5px;">
          ${escapeHtml(displayName)}
        </div>
      </td>
    </tr>

    <!-- Perforation -->
    <tr>
      <td style="padding:0 22px;">
        <div style="border-top:2px dashed #d4c4a8;height:1px;line-height:1px;">&nbsp;</div>
      </td>
    </tr>

    <!-- Booking ref + QR code -->
    <tr>
      <td style="padding:14px 22px 14px 22px;background:#FBF5ED;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td style="vertical-align:middle;width:121px;text-align:center;">
              ${generateFakeQRCode(bookingRef, '#1E1915')}
              <div style="font-size:7px;color:#9ca3af;letter-spacing:2px;font-family:'Courier New',monospace;margin-top:4px;">${escapeHtml(bookingRef)}</div>
            </td>
            <td style="vertical-align:middle;padding-left:16px;text-align:left;">
              <div style="font-size:10px;color:#c9a227;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600;">Booking Reference</div>
              <div style="font-size:22px;font-weight:bold;color:#1E1915;letter-spacing:4px;font-family:'Courier New',monospace;line-height:1.2;">${escapeHtml(bookingRef)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Event details -->
    <tr>
      <td style="padding:18px 22px 22px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:13px;color:#374151;">
          <tr>
            <td style="padding:4px 0;width:90px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Date</td>
            <td style="padding:4px 0;color:#1f2937;font-weight:600;">${EVENT_DATE}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Venue</td>
            <td style="padding:4px 0;color:#1f2937;">${EVENT_VENUE}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Booked by</td>
            <td style="padding:4px 0;color:#1f2937;">${escapeHtml(buyerName)}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer note -->
    <tr>
      <td style="background:#1E1915;padding:10px 22px;color:#c9a227;font-size:10px;text-align:center;letter-spacing:1.5px;">
        PLEASE BRING THIS TICKET (PRINT OR ON YOUR PHONE) TO THE EVENT
      </td>
    </tr>
  </table>
  `;
}

/**
 * Build the audience tickets HTML block — one ticket per ticket purchased.
 */
export function buildAudienceTicketsHtml({ bookingData, attendeeNamesArr }) {
  const total = bookingData.ticket_count;
  return Array.from({ length: total }, (_, i) =>
  buildSingleAudienceTicket({
    attendeeName: attendeeNamesArr[i] || '',
    bookingRef: bookingData.booking_ref,
    ticketNumber: i + 1,
    totalTickets: total,
    buyerName: bookingData.buyer_name
  })
  ).join('\n');
}

/**
 * Build the buyer confirmation email after a successful audience-ticket booking.
 */
export function buildBuyerConfirmationEmail({ bookingData, attendeeNamesArr }) {
  const subject = `Tickets Confirmed — Musical Talent Showcase 2026 (${bookingData.booking_ref})`;
  const ticketsHtml = buildAudienceTicketsHtml({ bookingData, attendeeNamesArr });
  const ticketCount = bookingData.ticket_count;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #2d3748; background:#fafaf7;">
      <p style="font-size:15px;">Dear ${escapeHtml(bookingData.buyer_name)},</p>

      <p style="background:#dcfce7;border-left:4px solid #16a34a;padding:14px 18px;border-radius:6px;font-weight:600;color:#166534;font-size:15px;margin:18px 0;">
        ✅ Payment received — your ${ticketCount === 1 ? 'ticket is' : 'tickets are'} confirmed!
      </p>

      <p style="font-size:14px;line-height:1.65;">
        Thank you for booking ${ticketCount === 1 ? 'a ticket' : `${ticketCount} tickets`} for the
        <strong>Musical Talent Showcase 2026</strong>. We can't wait to see you there.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin:18px 0;font-size:14px;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;color:#6b7280;">Booking Reference</td>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;text-align:right;font-weight:bold;color:#7B1E2D;letter-spacing:1px;">${escapeHtml(bookingData.booking_ref)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;color:#6b7280;">Tickets</td>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f1ec;text-align:right;color:#1f2937;">${ticketCount}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#6b7280;">Total Paid</td>
          <td style="padding:12px 16px;text-align:right;font-weight:bold;color:#16a34a;">$${bookingData.total_amount} NZD</td>
        </tr>
      </table>

      <h3 style="font-family:Georgia,serif;color:#7B1E2D;text-align:center;margin:32px 0 6px 0;font-size:22px;">
        🎟️ Your ${ticketCount === 1 ? 'Ticket' : `${ticketCount} Tickets`}
      </h3>
      <p style="text-align:center;color:#6b7280;font-size:13px;margin:0 0 8px 0;">
        ${ticketCount === 1 ?
  'Please bring this ticket on the day (printed or on your phone).' :
  `Please bring all ${ticketCount} tickets on the day.`}
      </p>
      ${ticketsHtml}

      <h3 style="font-family:Georgia,serif;color:#7B1E2D;margin:32px 0 8px 0;font-size:18px;">
        What to expect
      </h3>
      <ul style="font-size:14px;line-height:1.7;color:#374151;padding-left:20px;margin:0 0 16px 0;">
        <li>Doors open at the time announced closer to the event.</li>
        <li>A live show with vocalists, instrumentalists, duos and groups, judged by a community panel.</li>
        <li>Family-friendly. All ages welcome.</li>
      </ul>

      <p style="font-size:14px;margin-top:28px;line-height:1.6;">Warm regards,<br/>The NZ Melting Pot Team</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 14px 0;" />
      <p style="font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
        Musical Talent Showcase 2026 · NZ Melting Pot<br/>
        ${EVENT_DATE} · ${EVENT_VENUE}<br/>
        <a href="${SITE_URL}" style="color:#9ca3af;">www.nzmeltingpot.com</a>
      </p>
    </div>
  `;

  const attendeeList = attendeeNamesArr.
  map((n, i) => `  ${i + 1}. ${n && n.trim() ? n : bookingData.buyer_name}`).
  join('\n');

  const text = [
  `Tickets Confirmed — Musical Talent Showcase 2026 (${bookingData.booking_ref})`,
  ``,
  `Dear ${bookingData.buyer_name},`,
  ``,
  `Payment received — your ${ticketCount === 1 ? 'ticket is' : 'tickets are'} confirmed!`,
  ``,
  `Booking Reference: ${bookingData.booking_ref}`,
  `Tickets:           ${ticketCount}`,
  `Total Paid:        $${bookingData.total_amount} NZD`,
  ``,
  `Attendee(s):`,
  attendeeList,
  ``,
  `Event:  Musical Talent Showcase 2026`,
  `Date:   ${EVENT_DATE}`,
  `Venue:  ${EVENT_VENUE}`,
  ``,
  `Please bring your ticket(s) on the day (printed or on your phone).`,
  ``,
  `Warm regards,`,
  `The NZ Melting Pot Team`,
  ``,
  `---`,
  `Musical Talent Showcase 2026 · NZ Melting Pot`,
  SITE_URL].
  join('\n');

  return { subject, html, text };
}

/**
 * Build the admin notification email when audience tickets are sold.
 */
export function buildAdminBookingNotificationEmail({ bookingData, attendeeNamesArr, sessionId }) {
  const subject = `New ticket booking — ${bookingData.booking_ref} (${bookingData.ticket_count} ticket${bookingData.ticket_count === 1 ? '' : 's'})`;

  const rows = [
  ['Booking Reference', bookingData.booking_ref],
  ['Status', '✅ PAID'],
  ['Total Paid', `$${bookingData.total_amount} NZD`],
  ['Tickets', bookingData.ticket_count],
  ['Buyer Name', bookingData.buyer_name],
  ['Buyer Email', bookingData.buyer_email],
  ['Buyer Phone', bookingData.buyer_phone || '—'],
  ['Stripe Session', sessionId || '—'],
  ['Booked At', bookingData.booking_timestamp || '—']];


  attendeeNamesArr.forEach((name, idx) => {
    rows.push([`Attendee ${idx + 1}`, name || `(uses buyer's name)`]);
  });

  const tableRows = rows.map(([k, v]) =>
  `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:180px;">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1f2937;">${escapeHtml(String(v))}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
      <h2 style="color:#7B1E2D;margin:0 0 8px 0;">🎟️ New Audience Ticket Booking</h2>
      <p style="color:#6b7280;margin:0 0 20px 0;font-size:14px;">${bookingData.ticket_count} ticket${bookingData.ticket_count === 1 ? '' : 's'} sold for the Talent Showcase 2026.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${tableRows}
      </table>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">Sent automatically by the NZ Melting Pot booking system.</p>
    </div>
  `;

  return { subject, html };
}