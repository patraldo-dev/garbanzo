/**
 * Server hook: background visitor analytics.
 *
 * Logs public HTML page views to the `page_views` D1 table. Insertion runs via
 * `platform.context.waitUntil` so it never adds latency to the response. There
 * is no client beacon — collection is entirely server-side, so ad-blockers and
 * privacy browsers can't hide traffic. This matters for a lost-cat page whose
 * reach we want to measure as it's shared around.
 *
 * Excluded from logging:
 *   - non-GET / non-HTML requests (API calls, assets, fetch)
 *   - /api, /admin, /tracking (keep the owner's own activity out of the data)
 */

import { generateId, hashIp } from '$lib/server/config.js';

/** Paths we never log. */
const EXCLUDED_PREFIXES = ['/api/', '/admin', '/tracking'];

/** File extensions that are obviously static assets (skip early). */
const STATIC_EXT = /\.(?:js|css|woff2?|ttf|png|jpe?g|webp|gif|svg|ico|avif|map|json|txt|xml|webmanifest|wasm)$/i;

/**
 * Coarse device classification from a User-Agent.
 * @param {string} ua
 * @returns {'mobile' | 'tablet' | 'desktop'}
 */
function classifyDevice(ua) {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Coarse browser family from a User-Agent.
 * @param {string} ua
 * @returns {string}
 */
function classifyBrowser(ua) {
  if (/edg/i.test(ua)) return 'Edge';
  if (/opr|opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

/**
 * Whether a request should be tracked.
 * @param {string} method
 * @param {string} path
 * @param {string} accept
 * @returns {boolean}
 */
function shouldTrack(method, path, accept) {
  if (method !== 'GET') return false;
  if (STATIC_EXT.test(path)) return false;
  if (!accept.includes('text/html')) return false;
  if (EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p))) {
    return false;
  }
  return true;
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const req = event.request;
  const platform = event.platform;

  // The Cloudflare adapter throws (not returns undefined) when env bindings
  // are accessed in a prerenderable route, so resolve everything defensively.
  // `waitUntil` must be bound to its `context` — calling it unbound throws
  // "Illegal invocation" on the Workers runtime.
  /** @type {any} */
  let db = null;
  /** @type {((p: any) => void) | undefined} */
  let waitUntil;
  try {
    if (platform?.env?.DB && platform?.context?.waitUntil) {
      db = platform.env.DB;
      waitUntil = platform.context.waitUntil.bind(platform.context);
    }
  } catch {
    // Prerenderable route or platform unavailable — nothing to log.
  }

  const path = event.url.pathname;
  const accept = req.headers.get('accept') || '';

  if (db && waitUntil && shouldTrack(req.method, path, accept)) {
    const cf = /** @type {any} */ (event.request).cf || {};
    const ua = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || '';

    // Hash the visitor IP for unique counts only. The raw IP is never stored.
    let ipHash = null;
    try {
      const ip = req.headers.get('cf-connecting-ip') || event.getClientAddress();
      if (ip) ipHash = hashIp(ip);
    } catch {
      // getClientAddress may be unavailable; unique counts just degrade.
    }

    const id = generateId();
    const insert = db
      .prepare(
        `INSERT INTO page_views (id, path, referrer, country, city, asn_org, device, browser, ip_hash, ua)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        path,
        referrer || null,
        cf.country || null,
        cf.city || null,
        cf.asOrganization || null,
        classifyDevice(ua),
        classifyBrowser(ua),
        ipHash,
        ua.slice(0, 300) || null,
      )
      .run()
      .catch((err) => console.error('page_views insert failed:', err));

    waitUntil(insert);
  }

  return resolve(event);
}
