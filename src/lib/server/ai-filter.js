/**
 * AI-powered image validation for Garbanzo sightings.
 * Uses Workers AI vision model to verify the photo contains a grey/white tiger-stripe cat.
 *
 * Two-step process:
 * 1. Workers AI vision model describes and evaluates the photo
 * 2. Keyword matching checks for Garbanzo's specific appearance
 */

/** Keywords that indicate a match for Garbanzo's appearance. */
const MATCH_KEYWORDS = [
  'grey', 'gray', 'gris',
  'white', 'blanco',
  'tabby', 'tiger', 'stripe', 'atigrado', 'rayado',
  'cat', 'gato', 'kitten', 'gatito',
];

/** Red flag keywords in notes that suggest extortion/scam. */
const EXTORTION_KEYWORDS = [
  'million', 'millón', 'milion',
  'ransom', 'rescate',
  'bitcoin', 'crypto', 'cripto',
  'deposit', 'depósito',
  'transfer', 'transferencia',
  'western union',
  'paypal',
  'pay me', 'págame', 'paga',
  'send money', 'envía dinero', 'enviar dinero',
  'we have your cat', 'tenemos tu gato', 'tenemos a tu gato',
  'give us', 'danos', 'da nos',
  'reward first', 'recompensa primero',
];

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
    // Convert ArrayBuffer to base64 for the vision model
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

    // Parse the JSON from the model's response
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
 * Check extortion patterns in free-text notes.
 * @param {string} text
 * @returns {{ flagged: boolean, flags: string[] }}
 */
export function scanForExtortion(text) {
  if (!text) return { flagged: false, flags: [] };

  const lower = text.toLowerCase();
  const flags = [];

  for (const keyword of EXTORTION_KEYWORDS) {
    if (lower.includes(keyword)) {
      flags.push(keyword);
    }
  }

  return { flagged: flags.length > 0, flags };
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
  const hasWhite = colors.some((c) => c.includes('white') || c.includes('blanco'));
  const hasTabby = pattern.includes('tabby') || pattern.includes('tiger') || pattern.includes('stripe');

  // Garbanzo is grey & white tabby — at least one matching color + tabby pattern
  return (hasGrey || hasWhite) && hasTabby;
}

/**
 * Parse the AI vision model response into structured data.
 * Tries JSON extraction first, falls back to keyword heuristics.
 * @param {string} text
 * @returns {{ cat_detected?: boolean, primary_colors?: string[], coat_pattern?: string, description?: string, match_score?: number }}
 */
function parseAIResponse(text) {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Fall through to heuristic parsing
    }
  }

  // Heuristic fallback
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
