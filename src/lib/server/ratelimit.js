/**
 * KV-based rate limiting for upload endpoints.
 * Limits per IP: max 3 uploads per hour, 10 per day.
 */

const HOUR_LIMIT = 15;
const DAY_LIMIT = 50;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Check if an IP hash is rate limited.
 * @param {string} ipHash
 * @param {any} kv - KV namespace binding
 * @returns {Promise<{ allowed: boolean, reason?: string, hourCount: number, dayCount: number }>}
 */
export async function checkRateLimit(ipHash, kv) {
  const hourKey = `rl:${ipHash}:h`;
  const dayKey = `rl:${ipHash}:d`;

  const [hourStr, dayStr] = await Promise.all([
    kv.get(hourKey),
    kv.get(dayKey),
  ]);

  const hourCount = hourStr ? parseInt(hourStr, 10) : 0;
  const dayCount = dayStr ? parseInt(dayStr, 10) : 0;

  if (dayCount >= DAY_LIMIT) {
    return { allowed: false, reason: `Límite diario alcanzado (${DAY_LIMIT} envíos por día)`, hourCount, dayCount };
  }

  if (hourCount >= HOUR_LIMIT) {
    return { allowed: false, reason: `Límite horario alcanzado (${HOUR_LIMIT} envíos por hora)`, hourCount, dayCount };
  }

  return { allowed: true, hourCount, dayCount };
}

/**
 * Increment rate limit counters after a successful or attempted upload.
 * @param {string} ipHash
 * @param {any} kv - KV namespace binding
 */
export async function incrementRateLimit(ipHash, kv) {
  const hourKey = `rl:${ipHash}:h`;
  const dayKey = `rl:${ipHash}:d`;

  const [hourStr, dayStr] = await Promise.all([
    kv.get(hourKey),
    kv.get(dayKey),
  ]);

  const hourCount = hourStr ? parseInt(hourStr, 10) + 1 : 1;
  const dayCount = dayStr ? parseInt(dayStr, 10) + 1 : 1;

  await Promise.all([
    kv.put(hourKey, String(hourCount), { expirationTtl: HOUR_MS / 1000 }),
    kv.put(dayKey, String(dayCount), { expirationTtl: DAY_MS / 1000 }),
  ]);
}
