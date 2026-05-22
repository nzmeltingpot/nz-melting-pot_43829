import axios from "npm:axios@1.7.7";

const SECRETS_TABLE_ID = 82489;
const BREVO_CONTACT_URL = "https://api.brevo.com/v3/contacts";
const BREVO_EVENTS_URL  = "https://api.brevo.com/v3/smtp/statistics/events";
const DELAY_MS = 120;

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check whether each email address is blocked/blacklisted in Brevo,
 * and fetch their most recent transactional events.
 *
 * @param {{ emails: string[], days?: number }} params
 * @returns {{
 *   summary: { total, blocked, active, errors, noEvents },
 *   contacts: Array<{ email, emailBlacklisted, lastEvent, lastEventDate, reason }>
 * }}
 */
export async function checkContactBlocklist({ emails = [], days = 30 } = {}) {
  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error("'emails' must be a non-empty array.");
  }

  const apiKey = await getBrevoKey();
  if (!apiKey) {
    throw new Error("Brevo is not configured. Please set BREVO_API_KEY.");
  }

  const results = [];
  let blocked = 0;
  let active = 0;
  let errors = 0;
  let noEvents = 0;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const entry = { email, emailBlacklisted: null, lastEvent: null, lastEventDate: null, reason: null };

    // 1. Check contact blacklist status
    try {
      const resp = await axios.get(`${BREVO_CONTACT_URL}/${encodeURIComponent(email)}`, {
        headers: { "api-key": apiKey, "accept": "application/json" },
        timeout: 8000
      });
      entry.emailBlacklisted = resp.data?.emailBlacklisted === true;
      if (entry.emailBlacklisted) blocked++;
      else active++;
    } catch (err) {
      if (err?.response?.status === 404) {
        // Contact doesn't exist in Brevo at all — treated as active (never contacted)
        entry.emailBlacklisted = false;
        entry.reason = "Not in Brevo contacts";
        active++;
      } else {
        entry.reason = `Contact lookup error: ${err?.response?.data?.message || err.message}`;
        errors++;
      }
    }

    // 2. Fetch most recent transactional event for this email
    try {
      const evResp = await axios.get(BREVO_EVENTS_URL, {
        params: { email, days: Math.min(days, 90), limit: 1, sort: "desc" },
        headers: { "api-key": apiKey, "accept": "application/json" },
        timeout: 8000
      });
      const ev = evResp.data?.events?.[0];
      if (ev) {
        entry.lastEvent = ev.event;
        entry.lastEventDate = ev.date;
        if (!entry.reason && ev.reason) entry.reason = ev.reason;
      } else {
        noEvents++;
      }
    } catch {
      // events lookup failure is non-fatal
    }

    results.push(entry);

    if (i < emails.length - 1) await delay(DELAY_MS);
  }

  return {
    summary: {
      total:    emails.length,
      blocked,
      active,
      errors,
      noEvents
    },
    contacts: results
  };
}
