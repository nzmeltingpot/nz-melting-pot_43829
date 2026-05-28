/**
 * Email Templates Utility
 * Reusable HTML email templates for newsletters and communications
 */

const SITE_URL = 'https://www.nzmeltingpot.com';
const LOGO_URL = `${SITE_URL}/images/branding/logo-300x300.png`;

/* Brand palette — used consistently across all NZMP emails */
const COLOR_MAROON = '#7B1E2D';
const COLOR_EMBER = '#A83832';
const COLOR_GOLD = '#c9a227';
const COLOR_CREAM = '#FBF5ED';
const COLOR_DARK = '#1E1915';
const COLOR_BODY = '#2d3748';
const COLOR_MUTED = '#6b7280';

/**
 * Reusable JR Finance sponsor footer block.
 * Whole card is a single link that opens the NZMP Talent Showcase page,
 * scrolling directly to the sponsor banner there. From there, recipients
 * can click through to JR Finance themselves.
 */
function buildSponsorBlock() {
  const sponsorBannerUrl = `${SITE_URL}/musical-talent-showcase#sponsor`;

  return `
    <!-- Sponsor section (compact ~80% size, whole card links back to NZMP sponsor banner) -->
    <tr>
      <td style="padding: 16px 40px 4px;">
        <p style="margin: 0; text-align: center; font-size: 9px; color: ${COLOR_MUTED}; letter-spacing: 1.6px; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif;">
          Proudly Supported By
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 4px 40px 16px;">
        <a href="${sponsorBannerUrl}" target="_blank" rel="noopener noreferrer" style="display:block; text-decoration:none; color:inherit;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:80%; margin:0 auto; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-family: Arial, Helvetica, sans-serif;">
            <tr>
              <!-- JR Finance brand -->
              <td style="padding:10px 13px; vertical-align:middle; width:96px; border-right:1px solid #e2e8f0; text-align:center;">
                <div style="font-family:'Georgia', serif; font-size:16px; font-weight:bold; color:#3b6db8; letter-spacing:0.8px; line-height:1;">JR</div>
                <div style="font-family:'Georgia', serif; font-size:8px; color:#3b6db8; letter-spacing:1.6px; margin-top:2px;">FINANCE</div>
                <div style="font-size:7px; color:#6b86b3; letter-spacing:0.8px; margin-top:3px; text-transform:lowercase;">create wealth</div>
              </td>
              <!-- Contact details (plain text, not separately clickable — the whole card is the link) -->
              <td style="padding:10px 13px; vertical-align:middle; font-size:9px; color:#374151; line-height:1.5;">
                <div style="font-weight:bold; font-size:10px; color:#1f2937; letter-spacing:0.25px;">JOHNRAE TANNEN</div>
                <div style="color:#6b86b3; font-size:8px; margin-bottom:5px;">Financial Advisor</div>
                <div style="color:#374151;">+64 27-283-1946 &nbsp;·&nbsp; johnrae@jrfinance.co.nz</div>
                <div style="color:#374151;">www.jrfinance.co.nz</div>
                <div style="color:#6b7280; font-size:8px; margin-top:2px;">1A/268 Manukau Road, Epsom, Auckland 1023</div>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>`;
}

/**
 * Generate Newsletter Email HTML — branded for NZ Melting Pot.
 * @param {Object} params - Template parameters
 * @param {string} params.fullName - Recipient's full name
 * @param {string} params.newsletterContent - Main newsletter content (HTML supported)
 * @param {string} params.unsubscribeLink - Unsubscribe URL
 * @param {string} [params.updateDetailsLink] - Update details URL
 * @param {string} [params.subscribeLink] - Subscribe a friend URL
 * @param {string} [params.newsletterName] - Newsletter name (default: 'NZ Melting Pot Newsletter')
 * @param {string} [params.siteName] - Site name (default: 'NZ Melting Pot')
 * @param {string} [params.accentColor] - Primary accent color (default: brand maroon)
 * @returns {Object} { subject, html, text }
 */
export function generateNewsletterEmail({
  fullName,
  newsletterContent,
  unsubscribeLink,
  updateDetailsLink,
  subscribeLink,
  newsletterName = 'NZ Melting Pot Newsletter',
  siteName = 'NZ Melting Pot',
  accentColor = COLOR_MAROON
}) {
  const subject = `${siteName} — Latest Update`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLOR_CREAM}; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" style="width: 100%; max-width: 640px; border-collapse: collapse; background-color: #ffffff; border-radius: 14px; box-shadow: 0 6px 24px rgba(30, 25, 21, 0.10); overflow: hidden;">

          <!-- Branded header with logo -->
          <tr>
            <td style="padding: 0; background: linear-gradient(135deg, ${COLOR_MAROON} 0%, ${COLOR_EMBER} 100%);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                  <td align="center" style="padding: 30px 30px 26px;">
                    <img src="${LOGO_URL}" alt="NZ Melting Pot" width="80" height="80" style="display:block; border-radius:50%; border:3px solid ${COLOR_GOLD}; background:#fff;" />
                    <h1 style="margin: 14px 0 4px; font-family: 'Georgia', serif; font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">
                      ${siteName}
                    </h1>
                    <p style="margin: 0; font-size: 11px; color: ${COLOR_GOLD}; letter-spacing: 3px; text-transform: uppercase;">
                      Auckland · New Zealand
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold accent bar -->
          <tr><td style="height: 4px; background: ${COLOR_GOLD}; line-height: 4px;">&nbsp;</td></tr>

          <!-- Newsletter title -->
          <tr>
            <td style="padding: 30px 40px 4px;">
              <p style="margin: 0; font-size: 11px; color: ${COLOR_GOLD}; letter-spacing: 2.5px; text-transform: uppercase; font-weight: bold;">
                ${newsletterName}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 14px 40px 10px;">
              <p style="margin: 0; font-size: 17px; color: ${COLOR_DARK}; line-height: 1.6; font-family: 'Georgia', serif;">
                Dear ${fullName},
              </p>
            </td>
          </tr>

          <!-- Newsletter Content -->
          <tr>
            <td style="padding: 6px 40px 30px;">
              <div style="font-size: 15px; color: ${COLOR_BODY}; line-height: 1.75;">
                ${newsletterContent}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px dashed #d4c4a8; height: 1px; line-height: 1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- Friendly footer message -->
          <tr>
            <td style="padding: 24px 40px 14px;">
              <p style="margin: 0; font-size: 13px; color: ${COLOR_MUTED}; line-height: 1.7; font-style: italic;">
                You're receiving this because you're part of our community at <strong style="color: ${COLOR_MAROON}; font-style: normal;">${siteName}</strong> — and we love having you here.
              </p>
            </td>
          </tr>

          <!-- Member actions: unsubscribe / update details / subscribe a friend -->
          <tr>
            <td style="padding: 4px 40px 26px;">
              <p style="margin: 0; font-size: 12px; color: ${COLOR_MUTED}; line-height: 2.0;">
                If you'd prefer not to hear from us, you can
                <a href="${unsubscribeLink}" style="color: ${COLOR_MAROON}; text-decoration: underline;">unsubscribe here</a>
                — no hard feelings, you're always welcome back.${updateDetailsLink ? `
                <br/>Need to update your name or email address?
                <a href="${updateDetailsLink}" style="color: ${COLOR_MAROON}; text-decoration: underline;">Update your details here</a>.` : ''}${subscribeLink ? `
                <br/>Know someone who'd love our community?
                <a href="${subscribeLink}" style="color: ${COLOR_MAROON}; text-decoration: underline;">Subscribe a friend</a>.` : ''}
              </p>
            </td>
          </tr>

          ${buildSponsorBlock()}

          <!-- Bottom bar -->
          <tr>
            <td style="padding: 18px 40px; background-color: ${COLOR_DARK}; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; color: ${COLOR_GOLD}; font-family: 'Georgia', serif; letter-spacing: 1px;">
                ${siteName}
              </p>
              <p style="margin: 0 0 6px; font-size: 11px; color: #9ca3af;">
                <a href="${SITE_URL}" style="color: #9ca3af; text-decoration: none;">www.nzmeltingpot.com</a>
                ·
                <a href="${SITE_URL}/contact" style="color: #9ca3af; text-decoration: none;">Contact</a>
              </p>
              <p style="margin: 0 0 6px; font-size: 10px; color: #6b7280;">
                © ${new Date().getFullYear()} ${siteName}. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 10px; color: #ffffff;">
                Website by <a href="https://websmarthq.com/" style="color: #ffffff; font-weight: 600; text-decoration: underline;">Web Smart HQ</a>
                <span style="font-style: italic;"> — Smart sites &amp; smart SEO that get your business found.</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Plain text version for email clients that don't support HTML
  const text = `
${siteName.toUpperCase()} — ${newsletterName}

Dear ${fullName},

${stripHtml(newsletterContent)}

---

You're receiving this because you're part of our community at ${siteName} — and we love having you here.

If you'd prefer not to hear from us, you can unsubscribe here: ${unsubscribeLink}${updateDetailsLink ? `\nNeed to update your name or email? Update your details here: ${updateDetailsLink}` : ''}${subscribeLink ? `\nKnow someone who'd love our community? Subscribe a friend: ${subscribeLink}` : ''}

— Proudly supported by —
JR FINANCE  ·  create wealth
JOHNRAE TANNEN, Financial Advisor
+64 27-283-1946  ·  johnrae@jrfinance.co.nz
www.jrfinance.co.nz
1A/268 Manukau Road, Epsom, Auckland 1023, New Zealand

---

${siteName}  ·  www.nzmeltingpot.com
© ${new Date().getFullYear()} ${siteName}. All rights reserved.
Website by Web Smart HQ — Smart sites & smart SEO that get your business found. https://websmarthq.com
  `.trim();

  return { subject, html, text };
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html) {
  return html.
  replace(/<br\s*\/?>/gi, '\n').
  replace(/<\/p>/gi, '\n\n').
  replace(/<[^>]+>/g, '').
  replace(/&nbsp;/g, ' ').
  replace(/&amp;/g, '&').
  replace(/&lt;/g, '<').
  replace(/&gt;/g, '>').
  replace(/&quot;/g, '"').
  replace(/\n{3,}/g, '\n\n').
  trim();
}

/**
 * Generate unsubscribe URL with email parameter
 * @param {string} email - Recipient email address
 * @param {string} [baseUrl] - Base URL (default: auto-detect from window.location)
 * @returns {string} Full unsubscribe URL
 */
export function generateUnsubscribeLink(email, baseUrl) {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://nzmeltingpot.com');
  return `${base}/unsubscribe?email=${encodeURIComponent(email)}`;
}

/**
 * Generate update-details URL with email parameter
 * @param {string} email - Recipient email address
 * @param {string} [baseUrl] - Base URL (default: auto-detect from window.location)
 * @returns {string} Full update-details URL
 */
export function generateUpdateDetailsLink(email, baseUrl) {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://nzmeltingpot.com');
  return `${base}/update-details?email=${encodeURIComponent(email)}`;
}

/**
 * Generate subscribe URL (no email parameter — used as a referral / sign-up link)
 * @param {string} [baseUrl] - Base URL (default: auto-detect from window.location)
 * @returns {string} Full subscribe URL
 */
export function generateSubscribeLink(baseUrl) {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://nzmeltingpot.com');
  return `${base}/subscribe`;
}

/**
 * Generate Unsubscribe Confirmation Email HTML
 * Fixed template (no AI generation) for confirming newsletter unsubscription
 * @param {Object} params - Template parameters
 * @param {string} params.fullName - Recipient's full name
 * @param {string} [params.resubscribeLink] - Re-subscribe URL
 * @param {string} [params.siteName] - Site name (default: 'NZ Melting Pot')
 * @param {string} [params.accentColor] - Primary accent color (default: '#c9a227')
 * @returns {Object} { subject, html, text }
 */
export function generateUnsubscribeConfirmationEmail({
  fullName,
  resubscribeLink,
  siteName = 'NZ Melting Pot',
  accentColor = '#c9a227'
}) {
  const subject = "You've been unsubscribed";
  const displayName = fullName || 'there';
  const subscribeUrl = resubscribeLink || (typeof window !== 'undefined' ? window.location.origin : 'https://nzmeltingpot.com');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Georgia', 'Times New Roman', serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 3px solid ${accentColor};">
              <h1 style="margin: 0; font-size: 24px; font-weight: normal; color: #1a1a1a; letter-spacing: 1px;">
                ${subject}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 35px 40px;">
              <p style="margin: 0 0 20px; font-size: 18px; color: #333; line-height: 1.6;">
                Hi ${displayName},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #444; line-height: 1.8;">
                You have been successfully removed from our mailing list.
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #444; line-height: 1.8;">
                We're sorry to see you go!
              </p>
              <p style="margin: 0 0 25px; font-size: 16px; color: #444; line-height: 1.8;">
                If this was a mistake, you can re-subscribe here:
              </p>
              <p style="margin: 0 0 30px; text-align: center;">
                <a href="${subscribeUrl}" style="display: inline-block; padding: 12px 28px; background-color: ${accentColor}; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px;">
                  Re-subscribe
                </a>
              </p>
              <p style="margin: 30px 0 0; font-size: 16px; color: #666; line-height: 1.6;">
                Regards,<br/>
                <strong style="color: #444;">${siteName}</strong>
              </p>
            </td>
          </tr>

          <!-- Bottom Bar -->
          <tr>
            <td style="padding: 20px 40px; background-color: #fafafa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                © ${new Date().getFullYear()} ${siteName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Plain text version
  const text = `
${subject}

Hi ${displayName},

You have been successfully removed from our mailing list.

We're sorry to see you go!

If this was a mistake, you can re-subscribe here: ${subscribeUrl}

Regards,
${siteName}

© ${new Date().getFullYear()} ${siteName}. All rights reserved.
  `.trim();

  return { subject, html, text };
}

/**
 * Send Unsubscribe Confirmation Email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.fullName - Recipient's full name
 * @param {string} [params.resubscribeLink] - Re-subscribe URL
 * @param {string} [params.from] - Sender (default provided)
 * @param {string} [params.siteName] - Site name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendUnsubscribeConfirmationEmail({
  to,
  fullName,
  resubscribeLink,
  from = 'NZ Melting Pot <noreply@nzmeltingpot.org.nz>',
  siteName
}) {
  const { subject, html, text } = generateUnsubscribeConfirmationEmail({
    fullName,
    resubscribeLink,
    siteName
  });

  try {
    const result = await window.ezsite.apis.sendEmail({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    });

    if (result?.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send Newsletter Email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.fullName - Recipient's full name
 * @param {string} params.newsletterContent - Main newsletter content (HTML)
 * @param {string} [params.unsubscribeLink] - Unsubscribe URL (auto-generated if not provided)
 * @param {string} [params.updateDetailsLink] - Update details URL (auto-generated if not provided)
 * @param {string} [params.subscribeLink] - Subscribe a friend URL
 * @param {string} [params.from] - Sender (default provided)
 * @param {string} [params.newsletterName] - Newsletter name
 * @param {string} [params.siteName] - Site name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendNewsletterEmail({
  to,
  fullName,
  newsletterContent,
  unsubscribeLink,
  updateDetailsLink,
  subscribeLink,
  from = 'Musical Talent Showcase <noreply@nzmeltingpot.com>',
  newsletterName,
  siteName
}) {
  // Auto-generate links if not provided
  const recipientEmail = Array.isArray(to) ? to[0] : to;
  const finalUnsubscribeLink = unsubscribeLink || generateUnsubscribeLink(recipientEmail);
  const finalUpdateDetailsLink = updateDetailsLink || generateUpdateDetailsLink(recipientEmail);
  const finalSubscribeLink = subscribeLink || generateSubscribeLink();

  const { subject, html, text } = generateNewsletterEmail({
    fullName,
    newsletterContent,
    unsubscribeLink: finalUnsubscribeLink,
    updateDetailsLink: finalUpdateDetailsLink,
    subscribeLink: finalSubscribeLink,
    newsletterName,
    siteName
  });

  try {
    const result = await window.ezsite.apis.sendEmail({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    });

    if (result?.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}