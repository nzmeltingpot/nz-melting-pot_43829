// Reads and writes environment variables using the database (app_secrets table)
// Table ID 82489 stores key/value secret pairs

const ALLOWED_KEYS = ["STRIPE_SECRET_KEY", "BREVO_API_KEY", "RESEND_API_KEY", "SENDER_API_KEY"];
const SECRETS_TABLE_ID = 82489;

function maskValue(val) {
  if (!val) return null;
  if (val.length <= 8) return "***";
  return val.slice(0, 7) + "..." + val.slice(-4);
}

async function getDbSecret(key) {
  try {
    const { data, error } = await easysite.table.page(SECRETS_TABLE_ID, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: "secret_key", op: "Equal", value: key }]
    });
    if (error || !data?.List?.length) return null;
    return data.List[0].secret_value || null;
  } catch {
    return null;
  }
}

export async function getEnvStatus() {
  const result = {};
  for (const key of ALLOWED_KEYS) {
    const systemVal = Deno.env.get(key);
    const dbVal = await getDbSecret(key);
    const val = systemVal || dbVal;

    result[key] = {
      set: !!val,
      source: systemVal ? "system" : dbVal ? "database" : null,
      preview: val ? maskValue(val) : null
    };
  }
  return result;
}

export async function setEnvVar(key, value) {
  if (!ALLOWED_KEYS.includes(key)) {
    throw new Error(`Variable '${key}' cannot be modified via this API.`);
  }
  if (!value || !value.trim()) {
    throw new Error("Value cannot be empty.");
  }

  // Check if record already exists
  const { data, error: fetchError } = await easysite.table.page(SECRETS_TABLE_ID, {
    PageNo: 1,
    PageSize: 1,
    Filters: [{ name: "secret_key", op: "Equal", value: key }]
  });

  if (fetchError) throw new Error("Failed to read secrets table.");

  if (data?.List?.length > 0) {
    // Update existing record
    const { error } = await easysite.table.update(SECRETS_TABLE_ID, {
      ID: data.List[0].ID || data.List[0].id,
      secret_value: value.trim()
    });
    if (error) throw new Error("Failed to update secret: " + error);
  } else {
    // Insert new record
    const { error } = await easysite.table.create(SECRETS_TABLE_ID, {
      secret_key: key,
      secret_value: value.trim()
    });
    if (error) throw new Error("Failed to save secret: " + error);
  }

  return { success: true };
}
