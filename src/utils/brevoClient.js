/**
 * Brevo bulk-email helper.
 *
 * Calls Ezsite's Deno backend function `email/sendBulkEmail`, which uses
 * the Brevo transactional API under the hood. Reserve this for newsletter
 * blasts and other bulk sends.
 *
 * For one-off transactional emails (form submissions, payment confirmations,
 * contact form replies) keep using window.ezsite.apis.sendEmail (Resend).
 *
 * Backend signature (Ezsite Deno function):
 *   path:       'email/sendBulkEmail'
 *   methodName: 'sendBulkEmail'
 *   param:      [{ from, replyTo, subject, recipients }]
 *
 *   Reads BREVO_API_KEY from Deno.env, calls Brevo per-recipient,
 *   returns { sent, failed, failures, durationMs }.
 *
 * Batching: recipients are split into chunks of BATCH_SIZE so that each
 * backend invocation finishes well within the platform's request timeout.
 * With 220 ms per-email delay in the Deno function, a batch of 30 takes
 * at most ~15 s — safe for typical 30-60 s server-side timeouts.
 */

const BATCH_SIZE = 30;

/**
 * Send the same email (with per-recipient personalisation) to many people via Brevo.
 *
 * @param {Object} params
 * @param {Object} params.from         — { email, name? }   (must be verified in Brevo)
 * @param {Object} [params.replyTo]    — { email, name? }
 * @param {string} params.subject      — default subject (per-recipient subject overrides)
 * @param {Array<{email:string,name?:string,html:string,text?:string,subject?:string}>} params.recipients
 * @param {(progress:{sent:number,failed:number,total:number,batch:number,batches:number})=>void} [params.onProgress]
 *
 * @returns {Promise<{ sent: number, failed: number, failures: Array<{email,error}>, durationMs?: number, error?: string }>}
 */
export async function sendBulkEmail(params) {
  if (!params?.recipients?.length) {
    return { sent: 0, failed: 0, failures: [], error: 'No recipients provided.' };
  }

  if (!window?.ezsite?.apis?.run) {
    return {
      sent: 0,
      failed: params.recipients.length,
      failures: params.recipients.map((r) => ({ email: r.email, error: 'Ezsite API not available' })),
      error: 'window.ezsite.apis.run is not available — backend integration missing.'
    };
  }

  const { recipients, onProgress, ...rest } = params;

  // Split into batches to avoid backend timeout on large lists.
  const batches = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    batches.push(recipients.slice(i, i + BATCH_SIZE));
  }

  let totalSent = 0;
  let totalFailed = 0;
  const allFailures = [];
  let totalDurationMs = 0;
  let firstError = null;

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batchRecipients = batches[bIdx];

    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'email/sendBulkEmail',
        methodName: 'sendBulkEmail',
        param: [{ ...rest, recipients: batchRecipients }]
      });

      if (error) {
        const msg = typeof error === 'string' ? error : error.message || JSON.stringify(error);
        if (!firstError) firstError = msg;
        totalFailed += batchRecipients.length;
        allFailures.push(...batchRecipients.map((r) => ({ email: r.email, error: msg })));
      } else {
        totalSent += data?.sent || 0;
        totalFailed += data?.failed || 0;
        allFailures.push(...(data?.failures || []));
        totalDurationMs += data?.durationMs || 0;
      }
    } catch (err) {
      const msg = err?.message || 'Network error contacting Ezsite bulk-email backend.';
      if (!firstError) firstError = msg;
      totalFailed += batchRecipients.length;
      allFailures.push(...batchRecipients.map((r) => ({ email: r.email, error: msg })));
    }

    // Report progress after each batch
    if (typeof onProgress === 'function') {
      onProgress({
        sent: totalSent,
        failed: totalFailed,
        total: recipients.length,
        batch: bIdx + 1,
        batches: batches.length
      });
    }
  }

  const result = {
    sent: totalSent,
    failed: totalFailed,
    failures: allFailures,
    durationMs: totalDurationMs
  };

  // Surface a top-level error string only when nothing was sent at all
  if (totalSent === 0 && firstError) {
    result.error = firstError;
  }

  return result;
}