// src/lib/server/notify.js

const MAILGUN_API_BASE = 'https://api.mailgun.net/v3';

/**
 * Send an email notifying the admin of a new sighting submission.
 *
 * Expects env to provide:
 *   MAILGUN_API_KEY   - Mailgun private API key (string, or Secrets Store binding)
 *   MAILGUN_DOMAIN    - verified sending domain (e.g. "garbanzo.patraldo.com")
 *   ADMIN_EMAIL       - where sighting notifications should be sent
 *   MAILGUN_FROM      - optional, defaults to `Garbanzo <noreply@${MAILGUN_DOMAIN}>`
 *
 * Failures are logged but never thrown — upload flow should not break
 * just because notification fails.
 *
 * @param {Record<string, any>} env
 * @param {{
 *   id: string;
 *   imageUrl: string;
 *   aiVerdict: string;
 *   aiDescription: string;
 *   location: string|null;
 *   notes: string|null;
 *   reporterName: string|null;
 *   reporterContact: string|null;
 *   status: string;
 * }} sighting
 * @returns {Promise<boolean>} true if the email was sent successfully
 */
export async function notifyNewSighting(env, sighting) {
  // Resolve API key (supports Secrets Store binding or plain string)
  const apiKey = await resolveSecret(env.MAILGUN_API_KEY);
  const domain = env.MAILGUN_DOMAIN;
  const adminEmail = env.ADMIN_EMAIL;

  if (!apiKey || !domain || !adminEmail) {
    console.error('notifyNewSighting: missing MAILGUN_API_KEY, MAILGUN_DOMAIN, or ADMIN_EMAIL', {
      hasApiKey: !!apiKey,
      domain,
      adminEmail
    });
    return false;
  }

  const from = env.MAILGUN_FROM || `Garbanzo <noreply@${domain}>`;
  const subject =
    sighting.status === 'flagged'
      ? '🚩 Reporte marcado para revisión — Garbanzo'
      : '📸 Nuevo posible avistamiento de Garbanzo';

  const bodyLines = [
    `Veredicto IA: ${sighting.aiVerdict}`,
    `Descripción IA: ${sighting.aiDescription || '(sin descripción)'}`,
    `Ubicación reportada: ${sighting.location || '(no proporcionada)'}`,
    `Notas: ${sighting.notes || '(ninguna)'}`,
    `Reportado por: ${sighting.reporterName || '(anónimo)'}${
      sighting.reporterContact ? ` (${sighting.reporterContact})` : ''
    }`,
    `Estado: ${sighting.status}`,
    '',
    `Foto: ${sighting.imageUrl}`,
    '',
    `ID del reporte: ${sighting.id}`
  ];
  const textBody = bodyLines.join('\n');

  const htmlBody = `
    <p><strong>Veredicto IA:</strong> ${escapeHtml(sighting.aiVerdict)}</p>
    <p><strong>Descripción IA:</strong> ${escapeHtml(sighting.aiDescription || '(sin descripción)')}</p>
    <p><strong>Ubicación reportada:</strong> ${escapeHtml(sighting.location || '(no proporcionada)')}</p>
    <p><strong>Notas:</strong> ${escapeHtml(sighting.notes || '(ninguna)')}</p>
    <p><strong>Reportado por:</strong> ${escapeHtml(sighting.reporterName || '(anónimo)')}${
      sighting.reporterContact ? ` (${escapeHtml(sighting.reporterContact)})` : ''
    }</p>
    <p><strong>Estado:</strong> ${escapeHtml(sighting.status)}</p>
    <p><strong>Foto:</strong> <a href="${escapeHtml(sighting.imageUrl)}">${escapeHtml(
    sighting.imageUrl
  )}</a></p>
    <p><img src="${escapeHtml(sighting.imageUrl)}" alt="Foto del reporte" style="max-width: 400px; height: auto;" /></p>
    <p><strong>ID del reporte:</strong> ${escapeHtml(sighting.id)}</p>
  `;

  // Pre-flight log so you can verify env wiring and payload
  console.log('notifyNewSighting: about to send Mailgun email', {
    from,
    to: adminEmail,
    subject,
    imageUrl: sighting.imageUrl,
    id: sighting.id,
    domain
  });

  try {
    const form = new URLSearchParams();
    form.set('from', from);
    form.set('to', adminEmail);
    form.set('subject', subject);
    form.set('text', textBody);
    form.set('html', htmlBody);

    const resp = await fetch(`${MAILGUN_API_BASE}/${domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form
    });

    const responseText = await resp.text().catch(() => '');

    console.log('notifyNewSighting: Mailgun response', {
      status: resp.status,
      bodyPreview: responseText.slice(0, 500)
    });

    if (!resp.ok) {
      console.error(
        'Mailgun send failed',
        resp.status,
        responseText.slice(0, 200)
      );
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

/**
 * Minimal HTML escaping for interpolated content.
 * @param {string|null} value
 * @returns {string}
 */
function escapeHtml(value) {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
