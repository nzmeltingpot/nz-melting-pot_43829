import axios from "npm:axios@1.7.7";

const SECRETS_TABLE_ID = 82489;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DELAY_MS = 220;

async function getBrevoKey() {
  // 1. Try system env var
  const systemKey = Deno.env.get("BREVO_API_KEY");
  if (systemKey) return systemKey;

  // 2. Try database (app_secrets table)
  try {
    const { data, error } = await easysite.table.page(SECRETS_TABLE_ID, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: "secret_key", op: "Equal", value: "BREVO_API_KEY" }]
    });
    if (!error && data?.List?.length > 0) {
      const val = data.List[0].secret_value;
      if (val) return val;
    }
  } catch {
    // fall through
  }

  return null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send individualised bulk emails via Brevo transactional API.
 *
 * @param {object} params
 * @param {{ email: string, name?: string }} params.from       - Verified sender (must be verified in Brevo)
 * @param {{ email: string, name?: string }} [params.replyTo]  - Optional reply-to address
 * @param {string} params.subject                              - Default subject (used when recipient has no subject)
 * @param {Array<{ email: string, name?: string, html: string, text?: string, subject?: string }>} params.recipients
 *
 * @returns {{ sent: number, failed: number, failures: Array<{ email: string, error: string }> }}
 */
export async function sendBulkEmail(params) {
  const { from, replyTo, subject: defaultSubject, recipients } = params || {};

  // --- Validation ---
  if (!from?.email) {
    throw new Error("'from.email' is required.");
  }
  if (!defaultSubject) {
    throw new Error("'subject' is required.");
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("'recipients' must be a non-empty array.");
  }

  const apiKey = await getBrevoKey();
  if (!apiKey) {
    throw new Error(
      "Brevo is not configured. Please set BREVO_API_KEY in Admin → Env Vars."
    );
  }

  const sent = [];
  const failures = [];
  const startTime = Date.now();

  console.log(`[sendBulkEmail] Starting send to ${recipients.length} recipient(s)`);

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    if (!recipient?.email) {
      failures.push({ email: "(missing)", error: "Recipient email is missing." });
      continue;
    }

    console.log(`[sendBulkEmail] [${i + 1}/${recipients.length}] Sending to: ${recipient.email}`);

    // Build Brevo payload
    const payload = {
      sender: { email: from.email, name: from.name || from.email },
      to: [{ email: recipient.email, name: recipient.name || recipient.email }],
      subject: recipient.subject || defaultSubject,
      htmlContent: recipient.html
    };

    if (recipient.text) {
      payload.textContent = recipient.text;
    }

    if (replyTo?.email) {
      payload.replyTo = { email: replyTo.email, name: replyTo.name || replyTo.email };
    }

    try {
      await axios.post(BREVO_API_URL, payload, {
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          "accept": "application/json"
        },
        timeout: 15000
      });
      sent.push(recipient.email);
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unknown error";
      failures.push({ email: recipient.email, error: errMsg });
    }

    // Rate-limit delay between sends (skip after the last recipient)
    if (i < recipients.length - 1) {
      await delay(DELAY_MS);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[sendBulkEmail] Done — sent: ${sent.length}, failed: ${failures.length}, durationMs: ${durationMs}`);

  return {
    sent: sent.length,
    failed: failures.length,
    failures,
    durationMs
  };
}
