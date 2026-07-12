/**
 * Admin view server — loads sightings from D1.
 * Protected by ADMIN_TOKEN query param.
 */

import { imgUrl } from '$lib/server/config.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url, platform }) {
  const token = url.searchParams.get('token') || '';
  const env = platform?.env || {};
  const adminToken = env.ADMIN_TOKEN || '';

  // Debug: remove after testing
  console.log('Admin auth check:', {
    hasPlatform: !!platform,
    hasEnv: !!platform?.env,
    tokenProvided: token.slice(0, 8) + '...',
    hasAdminToken: !!adminToken,
    match: token === adminToken,
  });

  if (!adminToken || token !== adminToken) {
    return { authorized: false, sightings: [] };
  }

  const db = env.DB;
  if (!db) {
    return { authorized: true, sightings: [], dbError: true };
  }

  try {
    const { results } = await db.prepare(
      `SELECT * FROM sightings ORDER BY created_at DESC LIMIT 100`
    ).all();

    const sightings = (results || []).map((s) => ({
      ...s,
      thumb: imgUrl(s.image_id, 'gallery'),
      full: imgUrl(s.image_id, 'full'),
    }));

    return { authorized: true, sightings, dbError: false };
  } catch (err) {
    return { authorized: true, sightings: [], dbError: true, error: String(err) };
  }
}
