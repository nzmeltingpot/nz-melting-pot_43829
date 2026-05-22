import axios from "npm:axios@1.7.7";

const SECRETS_TABLE_ID = 82489;
const BREVO_EVENTS_URL = "https://api.brevo.com/v3/smtp/statistics/events";

async function getBrevoKey() {
  const systemKey = Deno.env.get("BREVO_API_KEY");
  if (systemKey) return systemKey;

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

/**
 * Fetch transactional email delivery events for a specific email address from Brevo.
 *
 * @param {{ email: string, days?: number }} params
 *   - email: recipient email to look up
 *   - days:  how many days back to search (default 90, max 90 on free Brevo plan)
 *
 * @returns {{ events: Array<{ date, event, subject, messageId, reason, ip, email }> }}
 */
export async function getEmailEvents({ email, days = 90 } = {}) {
  if (!email) throw new Error("'email' is required.");

  const apiKey = await getBrevoKey();
  if (!apiKey) {
    throw new Error("Brevo is not configured. Please set BREVO_API_KEY in Admin → API Keys.");
  }

  try {
    const response = await axios.get(BREVO_EVENTS_URL, {
      params: {
        email,
        days: Math.min(days, 90),
        limit: 100,
        sort: "desc"
      },
      headers: {
        "api-key": apiKey,
        "accept": "application/json"
      },
      timeout: 10000
    });

    const events = (response.data?.events || []).map((e) => ({
      date: e.date,
      event: e.event,
      subject: e.subject || "",
      messageId: e.messageId || "",
      reason: e.reason || "",
      ip: e.ip || "",
      email: e.email
    }));

    return { events };
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Unknown error";
    throw new Error(`Brevo events API error: ${msg}`);
  }
}
