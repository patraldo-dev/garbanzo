/**
 * Cloudflare Access JWT verification (defense-in-depth).
 *
 * The edge (Cloudflare Access / Zero Trust) is the real gate: when an Access
 * application is configured for a path, requests without a valid session are
 * intercepted before they reach the Worker. This module is a second line of
 * defense — it cryptographically validates the `Cf-Access-Jwt-Assertion` so the
 * `/tracking` data stays safe even if Access is ever misconfigured or a preview
 * deploy isn't covered by the policy.
 *
 * Verification follows Cloudflare's documented flow:
 *   1. Decode the (unsigned) JWT header to find the `kid`.
 *   2. Fetch the team's public cert: https://<team>.cloudflareaccess.com/cdn-cgi/access/certs
 *   3. Verify the RS256 signature + iss + aud + exp using Web Crypto.
 */

/**
 * @typedef {Object} AccessUser
 * @property {string} email
 */

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function base64UrlToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const std = b64.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(std);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * @param {string} json
 * @returns {any}
 */
function safeJson(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Parse a compact JWT into its three base64url parts. Does not verify.
 * @param {string} jwt
 * @returns {{ header: any, payload: any, signature: Uint8Array, signingInput: Uint8Array } | null}
 */
function parseJwt(jwt) {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const headerBytes = base64UrlToBytes(parts[0]);
  const payloadBytes = base64UrlToBytes(parts[1]);
  const signature = base64UrlToBytes(parts[2]);

  // signing input = header + '.' + payload, as UTF-8 bytes
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

  const header = safeJson(new TextDecoder().decode(headerBytes));
  const payload = safeJson(new TextDecoder().decode(payloadBytes));
  if (!header || !payload) return null;

  return { header, payload, signature, signingInput };
}

/**
 * In-memory cache of the team's JWKS (the public cert payload).
 * Worker isolates are ephemeral, so this is at most a per-isolate cache.
 * @type {{ [team: string]: { keys: any[], fetchedAt: number } | Promise<any> }}
 */
const certCache = {};

/**
 * Fetch and cache Cloudflare Access public keys for a team.
 * @param {string} team
 * @returns {Promise<any[]>} array of JWK-like key objects from the certs endpoint
 */
async function getTeamKeys(team) {
  const now = Date.now();
  const cached = certCache[team];
  // Reuse a cached result for up to 1 hour.
  if (cached && !('then' in cached) && now - cached.fetchedAt < 3_600_000) {
    return cached.keys;
  }
  // Deduplicate concurrent fetches.
  if (cached && 'then' in cached) return cached;

  const fetchP = (async () => {
    const res = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error(`certs endpoint ${res.status}`);
    const data = await res.json();
    const keys = Array.isArray(data?.public_certs) ? data.public_certs : [];
    certCache[team] = { keys, fetchedAt: now };
    return keys;
  })();
  certCache[team] = fetchP;
  return fetchP;
}

/**
 * Verify a Cloudflare Access JWT assertion.
 *
 * @param {string} assertion  raw `Cf-Access-Jwt-Assertion` value
 * @param {{ team: string, aud: string, debug?: boolean }} cfg  CF_ACCESS_TEAM + CF_ACCESS_AUD (+ optional debug)
 * @returns {Promise<AccessUser | null>}  the authenticated user, or null on any failure
 */
export async function verifyAccessJwt(assertion, cfg) {
  const debug = !!cfg?.debug;
  /** @param {string} reason @param {Record<string, any>} [extra] */
  const fail = (reason, extra) => {
    if (debug) console.warn('[access] reject:', reason, extra ?? '');
    return null;
  };

  if (!assertion || !cfg?.team || !cfg?.aud) {
    return fail('missing input', { hasAssertion: !!assertion, hasTeam: !!cfg?.team, hasAud: !!cfg?.aud });
  }

  const parsed = parseJwt(assertion);
  if (!parsed) return fail('malformed jwt');
  const { header, payload, signature, signingInput } = parsed;

  if (header.alg !== 'RS256') return fail('unexpected alg', { alg: header.alg });

  // Standard claim checks.
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return fail('token expired', { exp: payload.exp, now });
  }
  const expectedIss = `https://${cfg.team}.cloudflareaccess.com`;
  if (payload.iss !== expectedIss) {
    return fail('iss mismatch', { expected: expectedIss, got: payload.iss });
  }
  // aud may be a string or an array.
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(cfg.aud)) {
    return fail('aud mismatch', { expected: cfg.aud, got: payload.aud });
  }

  // Find the matching public key by kid.
  let keys;
  try {
    keys = await getTeamKeys(cfg.team);
  } catch (err) {
    return fail('certs fetch failed', { error: String(err) });
  }
  const match = keys.find((k) => (header.kid && k.kid === header.kid) || !header.kid);
  if (!match) {
    return fail('no matching key for kid', { kid: header.kid, keyCount: keys.length });
  }

  // Prefer a JWK; fall back to a DER-encoded cert (SPKI).
  /** @type {CryptoKey} */
  let cryptoKey;
  try {
    if (match.jwk) {
      cryptoKey = await crypto.subtle.importKey(
        'jwk',
        match.jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
    } else if (match.cert) {
      // The certs endpoint returns the public key as base64-encoded DER (SPKI).
      const bin = atob(match.cert);
      const der = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
      cryptoKey = await crypto.subtle.importKey(
        'spki',
        der,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
    } else {
      return fail('key entry has no jwk or cert');
    }
  } catch (err) {
    return fail('key import failed', { error: String(err) });
  }

  // Verify the RS256 signature over (header.payload).
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    signingInput,
  );
  if (!ok) return fail('signature invalid');

  const email = payload.email;
  if (typeof email !== 'string' || !email) return fail('no email claim');

  if (debug) console.warn('[access] accept:', { email, iss: payload.iss });
  return { email };
}
