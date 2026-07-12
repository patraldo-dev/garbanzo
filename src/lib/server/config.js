/**
 * Shared configuration for Garbanzo site.
 */

export const CF_ACCOUNT_ID = '477082f5c9678c608889bd8f03f7b807';
export const CF_IMAGES_HASH = '4bRSwPonOXfEIBVZiDXg0w';

/** Cloudflare Images API base. */
export const IMAGES_API = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;

/**
 * Build a Cloudflare Images delivery URL.
 * @param {string} id - Image ID
 * @param {string} variant - Variant name (cover, gallery, full, etc.)
 * @returns {string}
 */
export function imgUrl(id, variant = 'full') {
  return `https://imagedelivery.net/${CF_IMAGES_HASH}/${id}/${variant}`;
}

/**
 * Generate a short random ID.
 * @returns {string}
 */
export function generateId() {
  return crypto.randomUUID();
}

/**
 * Hash an IP address for privacy-preserving rate limiting.
 * @param {string} ip
 * @returns {string}
 */
export function hashIp(ip) {
  // Simple hash — not cryptographic, but sufficient for rate-limit keys
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `ip_${Math.abs(hash).toString(36)}`;
}
