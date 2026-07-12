/**
 * AI-powered image validation for Garbanzo sightings.
 * Uses Workers AI vision model to verify the photo contains a grey/white tiger-stripe cat.
 *
 * Two-step process:
 * 1. Workers AI vision model describes and evaluates the photo
 * 2. Keyword matching checks for Garbanzo's specific appearance
 *
 * ── Reward-related additions ──
 * matchGarbanzo()      — heuristic markings-based match score (NOT biometric-grade)
 * checkDuplicateUpload() — flags byte-identical re-uploads of reference/prior photos
 *
 * IMPORTANT LIMITATIONS (read before wiring this to a payout):
 * - Workers AI does not currently expose a general image-embedding/CLIP-style model,
 *   so matchGarbanzo() is NOT true visual similarity search. It asks the vision LLM
 *   to describe markings in text, then compares that text to a reference description.
 *   This is a soft signal for triage, not proof the cat in the photo is Garbanzo.
 * - checkDuplicateUpload() only catches EXACT byte-identical files (someone re-submitting
 *   a file you or a prior submitter already used). A cropped, resized, or re-compressed
 *   copy of the same photo will NOT be caught — that would require real perceptual
 *   hashing (pixel access), which isn't implemented here.
 * - Neither of these should ever auto-trigger a reward payout. Use them to prioritize
 *   your manual review queue and to set contributor-facing expectations in copy.
 */

/** Keywords that indicate a match for Garbanzo's appearance. */
const MATCH_KEYWORDS = [
  'grey', 'gray', 'gris',
  'white', 'blanco', 'blanca',
  'tabby', 'tiger', 'stripe',
  'atigrado', 'atigrada', 'rayado', 'rayada',
  'cat', 'gato', 'gata',
  'kitten', 'gatito', 'gatita',
];

/**
 * Red flag keywords in notes that suggest extortion/scam.
 * Split into two tiers: DIRECT (unambiguous — ransom, overt payment demand) and
 * INDIRECT (the more common real-world pattern — a "reasonable"-sounding fee
 * framed as boarding/gas/shipping/vet costs, requested before any physical
 * handoff). INDIRECT hits alone are weaker evidence — a genuine finder might
 * mention "vet" or "gas" innocently — so they're scored, not auto-flagged on
 * a single hit. See scanForExtortion() below.
 */
const EXTORTION_KEYWORDS_DIRECT = [
  'million', 'millón', 'milion',
  'ransom', 'rescate',
  'bitcoin', 'crypto', 'cripto',
  'western union',
  'we have your cat', 'tenemos tu gato', 'tenemos a tu gato',
  'give us', 'danos', 'da nos',
  'reward first', 'recompensa primero',
  'pay first', 'paga primero', 'pay before', 'antes de pagar',
  'gift card', 'itunes card', 'google play card', 'tarjeta de regalo',
];

const EXTORTION_KEYWORDS_INDIRECT = [
  'deposit', 'depósito',
  'transfer', 'transferencia',
  'paypal', 'venmo', 'zelle', 'cashapp', 'cash app',
  'send money', 'envía dinero', 'enviar dinero',
  'pay me', 'págame', 'paga',
  'boarding fee', 'cuota de pensión',
  'gas money', 'dinero de gasolina', 'para gasolina',
  'shipping fee', 'costo de envío',
  'vet bill', 'cuenta del veterinario', 'gasto veterinario',
  'release fee', 'cuota de liberación',
  'finder\u2019s fee', 'finders fee', 'comisión por encontrar',
  'upfront', 'por adelantado',
  'before i give', 'antes de darte', 'antes de entregar',
  'urgent', 'urgente', 'today only', 'solo hoy',
  'someone else wants', 'alguien más quiere',
];

/**
 * Reference description of Garbanzo's distinctive markings, used by matchGarbanzo().
 * Fill this in with specific, non-obvious details — asymmetric markings, a notch,
 * an unusual tail kink, etc. The more specific and less guessable, the more useful
 * this is as a filter against someone describing a generic grey/white tabby.
 * Keep at least one detail here that you deliberately do NOT show in public photos —
 * that detail becomes your best fraud check (see scanForExtortion notes below).
 */
const GARBANZO_MARKINGS_REFERENCE = `
  Grey and white tabby. [Fill in: specific face pattern, e.g. "M" marking clarity,
  ear notch or scar, tail tip color/kink, white sock pattern on paws, belly color,
  any asymmetry between left/right side.]
`.trim();

/**
 * Validate an image using Workers AI vision model.
 * @param {ArrayBuffer} imageData - Raw image bytes
 * @param {any} ai - Workers AI binding
 * @returns {Promise<{ verdict: 'pass'|'reject'|'unsure', description: string, confidence: number, isCat: boolean, colorMatch: boolean }>}
 */
export async function validateCatImage(imageData, ai) {
  const prompt = `You are a cat identification expert. Look at this image and answer:
1. CAT_DETECTED: Is there a cat visible in this image? Answer YES or NO.
2. PRIMARY_COLORS: What are the primary colors of the cat? (e.g., grey, white, orange, black, brown)
3. COAT_PATTERN: Describe the coat pattern (e.g., tabby, tiger stripe, solid, calico, tuxedo)
4. DESCRIPTION: One sentence describing the cat's appearance.
5. MATCH_SCORE: How closely does this cat match a grey-and-white tiger-stripe tabby? Score 0-100.
Format your answer as valid JSON:
{"cat_detected": true/false, "primary_colors": ["..."], "coat_pattern": "...", "description": "...", "match_score": 0}`;
  try {
    const base64 = arrayBufferToBase64(imageData);
    const imageDataUri = `data:image/jpeg;base64,${base64}`;
    const response = await ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUri } },
          ],
        },
      ],
      max_tokens: 300,
    });
    const text = response.response || '';
    const parsed = parseAIResponse(text);
    const isCat = parsed.cat_detected === true;
    const colorMatch = checkColorMatch(parsed);
    const matchScore = typeof parsed.match_score === 'number'
      ? parsed.match_score / 100
      : 0;
    let verdict;
    let confidence;
    if (!isCat) {
      verdict = 'reject';
      confidence = 0.9;
    } else if (matchScore >= 0.5 || colorMatch) {
      verdict = 'pass';
      confidence = Math.max(matchScore, colorMatch ? 0.7 : 0);
    } else if (matchScore >= 0.25) {
      verdict = 'unsure';
      confidence = matchScore;
    } else {
      verdict = 'reject';
      confidence = 1 - matchScore;
    }
    return {
      verdict,
      description: parsed.description || text.slice(0, 200),
      confidence: Math.round(confidence * 100) / 100,
      isCat,
      colorMatch,
      matchScore,
      coatPattern: parsed.coat_pattern || '',
      primaryColors: parsed.primary_colors || [],
    };
  } catch (err) {
    console.error('AI validation error:', err);
    return {
      verdict: 'unsure',
      description: `AI validation failed: ${String(err).slice(0, 100)}`,
      confidence: 0,
      isCat: false,
      colorMatch: false,
    };
  }
}

/**
 * Heuristic markings-based match score against Garbanzo's reference profile.
 * NOT a biometric/embedding match — see file header limitations.
 * Use this as a triage signal only (e.g. sort review queue, set contributor
 * expectations in UI copy). Never auto-approve a reward from this alone.
 * @param {ArrayBuffer} imageData
 * @param {any} ai - Workers AI binding
 * @returns {Promise<{ score: number, markingsDescription: string, notes: string }>}
 */
export async function matchGarbanzo(imageData, ai) {
  const prompt = `You are comparing a submitted cat photo against a reference profile.
REFERENCE PROFILE:
${GARBANZO_MARKINGS_REFERENCE}

Look closely at the submitted image and describe:
1. MARKINGS: Specific, distinctive markings visible (face pattern, ear notches/scars,
   tail tip color or kink, paw/sock pattern, any asymmetry). Be as specific as possible.
2. MATCH_NOTES: How well do these markings align with the reference profile above?
   Note specific matches AND specific mismatches.
3. MARKINGS_SCORE: 0-100 score for how closely the visible markings match the reference.
   Score conservatively — only score high if specific, distinctive details align, not
   just general color/pattern (grey-and-white tabby is common and should not alone
   produce a high score).
Respond as JSON:
{"markings": "...", "match_notes": "...", "markings_score": 0}`;
  try {
    const base64 = arrayBufferToBase64(imageData);
    const imageDataUri = `data:image/jpeg;base64,${base64}`;
    const response = await ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUri } },
          ],
        },
      ],
      max_tokens: 300,
    });
    const text = response.response || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let parsed = {};
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    const score = typeof parsed.markings_score === 'number'
      ? Math.max(0, Math.min(100, parsed.markings_score))
      : 0;
    return {
      score: Math.round(score) / 100,
      markingsDescription: parsed.markings || text.slice(0, 200),
      notes: parsed.match_notes || '',
    };
  } catch (err) {
    console.error('matchGarbanzo error:', err);
    return { score: 0, markingsDescription: '', notes: `Match check failed: ${String(err).slice(0, 100)}` };
  }
}

/**
 * Detect exact byte-identical re-uploads (e.g. someone resubmitting a reference
 * photo you posted publicly, or a previous submitter's exact file, to farm a
 * high match score). Does NOT catch cropped/edited/re-compressed copies.
 * @param {ArrayBuffer} imageData
 * @param {string[]} knownHashes - hex SHA-256 hashes to check against
 *   (your reference photos + optionally recent submission hashes from D1)
 * @returns {Promise<{ isDuplicate: boolean, hash: string }>}
 */
export async function checkDuplicateUpload(imageData, knownHashes) {
  const hash = await sha256Hex(imageData);
  return { isDuplicate: knownHashes.includes(hash), hash };
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check extortion/scam patterns in free-text notes.
 * NOTE: this is a keyword scan, not fraud detection. It catches unsophisticated
 * or lazily-worded attempts. It will miss anything paraphrased, in a language
 * outside these lists, or moved off-platform to a call/DM after first contact.
 * Treat 'flagged: true' as "route to manual review," never as a block —
 * legitimate messages can trip INDIRECT terms innocently (e.g. "I paid for gas
 * driving around looking, no reimbursement needed, just wanted to say hi").
 * @param {string} text
 * @returns {{ flagged: boolean, severity: 'none'|'low'|'high', directFlags: string[], indirectFlags: string[] }}
 */
export function scanForExtortion(text) {
  if (!text) return { flagged: false, severity: 'none', directFlags: [], indirectFlags: [] };
  const lower = text.toLowerCase();
  const directFlags = EXTORTION_KEYWORDS_DIRECT.filter((k) => lower.includes(k));
  const indirectFlags = EXTORTION_KEYWORDS_INDIRECT.filter((k) => lower.includes(k));
  // A single indirect hit is weak evidence (could be innocent). Two or more
  // indirect hits, or any direct hit, is worth a human looking at it.
  let severity = 'none';
  if (directFlags.length > 0) severity = 'high';
  else if (indirectFlags.length >= 2) severity = 'high';
  else if (indirectFlags.length === 1) severity = 'low';
  return {
    flagged: severity !== 'none',
    severity,
    directFlags,
    indirectFlags,
  };
}

/**
 * Check if AI-detected colors match Garbanzo's profile.
 * @param {{ primary_colors?: string[], coat_pattern?: string }} parsed
 * @returns {boolean}
 */
function checkColorMatch(parsed) {
  const colors = (parsed.primary_colors || []).map((c) => c.toLowerCase());
  const pattern = (parsed.coat_pattern || '').toLowerCase();
  const hasGrey = colors.some((c) => c.includes('grey') || c.includes('gray') || c.includes('gris'));
  const hasWhite = colors.some((c) => c.includes('white') || c.includes('blanco') || c.includes('blanca'));
  const hasTabby = pattern.includes('tabby') || pattern.includes('tiger') || pattern.includes('stripe')
    || pattern.includes('atigrado') || pattern.includes('atigrada')
    || pattern.includes('rayado') || pattern.includes('rayada');
  return (hasGrey || hasWhite) && hasTabby;
}

/**
 * Parse the AI vision model response into structured data.
 * Tries JSON extraction first, falls back to keyword heuristics.
 * @param {string} text
 * @returns {{ cat_detected?: boolean, primary_colors?: string[], coat_pattern?: string, description?: string, match_score?: number }}
 */
function parseAIResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Fall through to heuristic parsing
    }
  }
  const lower = text.toLowerCase();
  const hasCat = lower.includes('cat_detected') && lower.includes('true')
    || lower.includes('yes') && lower.includes('cat');
  return {
    cat_detected: hasCat,
    description: text.slice(0, 200),
    match_score: hasCat ? 30 : 0,
  };
}

/**
 * Convert ArrayBuffer to base64 string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
