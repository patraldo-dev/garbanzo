/**
 * POST /api/report — Community sighting upload endpoint.
 *
 * Flow:
 * 1. Validate Turnstile token (bot protection)
 * 2. Check rate limit (KV)
 * 3. Validate file (type, size)
 * 4. Upload to Cloudflare Images
 * 5. AI validation (Workers AI vision: is this a grey/white tiger cat?)
 * 6. Scan notes for extortion patterns
 * 7. Store in D1
 * 8. Return verdict
 */

import { uploadToCloudflareImages } from '$lib/server/images.js';
import { validateCatImage, scanForExtortion } from '$lib/server/ai-filter.js';
import { checkRateLimit, incrementRateLimit } from '$lib/server/ratelimit.js';
import { generateId, hashIp, imgUrl } from '$lib/server/config.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, platform, getClientAddress }) {
  const env = platform?.env || {};

  let ipHash = 'unknown';
  try {
    ipHash = hashIp(getClientAddress());
  } catch {
    // getClientAddress may not be available in all contexts
  }

  // --- 1. Parse form data ---
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid form data' }, 400);
  }

  const file = formData.get('photo');
  const reporterName = formData.get('name')?.toString().trim().slice(0, 100) || null;
  const reporterContact = formData.get('contact')?.toString().trim().slice(0, 100) || null;
  const location = formData.get('location')?.toString().trim().slice(0, 200) || null;
  const notes = formData.get('notes')?.toString().trim().slice(0, 1000) || null;
  const turnstileToken = formData.get('cf-turnstile-response')?.toString() || '';

  // --- 2. Validate Turnstile ---
  if (env.TURNSTILE_SECRET) {
    const turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, request.headers.get('CF-Connecting-IP') || '');
    if (!turnstileOk) {
      return json({ error: 'Verificación de seguridad fallida. Intenta de nuevo.' }, 403);
    }
  }

  // --- 3. Rate limit check ---
  if (env.RATE_LIMIT) {
    const rl = await checkRateLimit(ipHash, env.RATE_LIMIT);
    if (!rl.allowed) {
      return json({ error: rl.reason || 'Demasiados intentos. Espera un momento.' }, 429);
    }
  }

  // --- 4. Validate file ---
  if (!file || !(file instanceof File)) {
    return json({ error: 'No se recibió ninguna foto' }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return json({ error: 'La foto es demasiado grande (máximo 10MB)' }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
    return json({ error: 'Formato no soportado. Usa JPG, PNG, o WebP.' }, 400);
  }

  // Count rate limit attempt
  if (env.RATE_LIMIT) {
    await incrementRateLimit(ipHash, env.RATE_LIMIT);
  }

  // --- 5. Read file data ---
  const imageData = await file.arrayBuffer();

  // --- 6. Upload to Cloudflare Images ---
  const upload = await uploadToCloudflareImages(imageData, file.name, { env });
  if (!upload.success) {
    return json({ error: `Error al subir la foto: ${upload.error}` }, 500);
  }

  // --- 7. AI validation ---
  let aiResult;
  if (env.AI) {
    aiResult = await validateCatImage(imageData, env.AI);
  } else {
    aiResult = {
      verdict: 'unsure',
      description: 'AI validation unavailable',
      confidence: 0,
      isCat: false,
      colorMatch: false,
    };
  }

  // --- 8. Extortion scan ---
  const extortionScan = scanForExtortion(notes);

  // --- 9. Determine final status ---
  let status = 'pending';
  let rejected = false;

  if (aiResult.verdict === 'reject') {
    status = 'rejected';
    rejected = true;
  } else if (extortionScan.flagged) {
    status = 'flagged';
  }

  // --- 10. Store in D1 ---
  const id = generateId();
  const imageUrl = imgUrl(upload.id, 'full');

  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO sightings (id, image_id, image_url, reporter_name, reporter_contact, location, notes, ai_verdict, ai_description, ai_confidence, ip_hash, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, upload.id, imageUrl,
        reporterName, reporterContact, location, notes,
        aiResult.verdict, aiResult.description, aiResult.confidence,
        ipHash, status
      ).run();
    } catch (dbErr) {
      console.error('D1 insert error:', dbErr);
    }
  }

  // --- 11. Response ---
  if (rejected) {
    return json({
      success: false,
      rejected: true,
      message: 'La foto no parece ser un gato gris y blanco atigrado. Si estás seguro/a de que es Garbanzo, contáctanos directamente por WhatsApp.',
      ai_verdict: aiResult.verdict,
    }, 200);
  }

  return json({
    success: true,
    id,
    message: extortionScan.flagged
      ? 'Gracias. Tu reporte fue recibido y será revisado manualmente.'
      : '¡Gracias por tu reporte! Lo revisaremos de inmediato.',
    ai_verdict: aiResult.verdict,
    ai_description: aiResult.description,
  }, 200);
}

/**
 * @param {string} token
 * @param {string} secret
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
async function verifyTurnstile(token, secret, ip) {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await resp.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * @param {any} data
 * @param {number} status
 * @returns {Response}
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
