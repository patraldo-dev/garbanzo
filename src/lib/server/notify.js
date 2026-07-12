/**
 * Email notifications via Mailgun.
 * Reuses the same Mailgun account already configured for patrouch.ca auth.
 *
 * Expects these to be available on env (adjust names to match whatever you
 * used for the Better Auth / Mailgun setup — these are best-guess defaults):
 *   MAILGUN_API_KEY   - Mailgun private API key
 *   MAILGUN_DOMAIN     - your verified sending domain (e.g. "mg.patraldo.com")
 *   ADMIN_EMAIL        - where sighting notifications should be sent
 *   MAILGUN_FROM        - optional, defaults to `Garbanzo <noreply@${MAILGUN_DOMAIN}>`
 *
 * If your Mailgun account is on the EU region, change MAILGUN_API_BASE below
 * from api.mailgun.net to api.eu.mailgun.net.
 */
const MAILGUN_API_BASE = 'https://api.mailgun.net/v3';

/**
 * Send an email notifying the admin of a new sighting submission.
 * Failures here are logged but never thrown — a notification failure
 * should never break the upload flow for the person reporting a sighting.
 * @param {Record<string, any>} env
 * @param {{ id: string, imageUrl: string, aiVerdict: string, aiDescription: string,
 *           location: string|null, notes: string|null, reporterName: string|null,
 *           reporterContact: string|null, status: string }} sighting
 * @returns {Promise<boolean>} true if the email was sent successfully
 */
export async function notifyNewSighting(env, sighting) {
  const apiKey = await resolveSecret(env.MAILGUN_API_KEY);
  const domain = env.MAILGUN_DOMAIN;
  const adminEmail = env.ADMIN_EMAIL;
  if (!apiKey || !domain || !adminEmail) {
    console.error('notifyNewSighting: missing MAILGUN_API_KEY, MAILGUN_DOMAIN, or ADMIN_EMAIL');
    return false;
  }
  const from = env.MAILGUN_FROM || `Garbanzo <noreply@${domain}>`;
  const subject = sighting.status === 'flagged'
    ? `\u{1F6A9} Reporte marcado para revisi\u00f3n \u2014 Garbanzo`
    : `\u{1F4F8} Nuevo posible avistamiento de Garbanzo`;
  const body = [
    `Veredicto IA: ${sighting.aiVerdict}`,
    `Descripci\u00f3n IA: ${sighting.aiDescription || '(sin descripci\u00f3n)'}`,
    `Ubicaci\u00f3n reportada: ${sighting.location || '(no proporcionada)'}`,
    `Notas: ${sighting.notes || '(ninguna)'}`,
    `Reportado por: ${sighting.reporterName || '(an\u00f3nimo)'} ${sighting.reporterContact ? `(${sighting.reporterContact})` : ''}`,
    `Estado: ${sighting.status}`,
    ``,
    `Foto: ${sighting.imageUrl}`,
    ``,
    `ID del reporte: ${sighting.id}`,
  ].join('\n');
  try {
    const form = new URLSearchParams();
    form.set('from', from);
    form.set('to', adminEmail);
    form.set('subject', subject);
    form.set('text', body);
    const resp = await fetch(`${MAILGUN_API_BASE}/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${apiKey}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(`Mailgun send failed: ${resp.status} ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Mailgun send error:', err);
    return false;
  }
}

/**
 * Resolve a value that may be a plain string secret or a Secrets Store
 * binding object requiring .get(). Mirrors the pattern used in images.js.
 * @param {any} raw
 * @returns {Promise<string|null>}
 */
async function resolveSecret(raw) {
  try {
    return typeof raw === 'string' ? raw : (await raw?.get?.()) ?? null;
  } catch {
    return null;
  }
}
