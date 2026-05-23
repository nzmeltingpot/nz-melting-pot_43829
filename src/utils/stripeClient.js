/**
 * Stripe Checkout helper — calls the EzSite Deno backend via the framework bridge.
 * Uses window.ezsite.apis.run() — NOT fetch('/api/...') — as EzSite is not a
 * Vercel/Express server; all backend calls go through the function bridge.
 */

/**
 * Create a Stripe Checkout Session via our Deno backend.
 *
 * @param {Object} params
 * @param {number} params.amount             — NZD cents (integer, e.g. 3000)
 * @param {string} params.currency           — ISO code (e.g. "nzd")
 * @param {string} params.registration_code  — used as Stripe client_reference_id
 * @param {string} params.customer_email
 * @param {string} params.description
 * @param {string} params.success_url
 * @param {string} params.cancel_url
 * @returns {Promise<{ data?: { url: string, session_id: string }, error?: string }>}
 */
export async function createStripeCheckout(params) {
  try {
    const { data, error } = await window.ezsite.apis.run({
      path: 'payment/createStripeCheckout',
      methodName: 'createStripeCheckout',
      param: [params]
    });

    if (error) {
      return { error: String(error) };
    }
    if (!data?.url) {
      return { error: 'Backend did not return a Stripe Checkout URL.' };
    }
    return { data };
  } catch (err) {
    return { error: err?.message || 'Network error contacting Stripe backend.' };
  }
}