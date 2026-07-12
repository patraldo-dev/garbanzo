/**
 * Admin view server — loads sightings from D1.
 * Protected by ADMIN_TOKEN query param or Authorization header.
 */

import { imgUrl } from '$lib/server/config.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url, env, request }) {
  // Auth check: ?token=XXX or Authorization: Bearer XXX
  const token = url.searchParams.get('token') || '';
  const authHeader = request.headers.get('Authorization') || '';
  const bearerToken = authHeader.replace('Bearer ', '');

  const adminToken = env.ADMIN_TOKEN || '';

  if (!adminToken || (token !== adminToken && bearerToken !== adminToken)) {
    return { authorized: false, sightings: [] };
  }

  if (!env.DB) {
    return { authorized: true, sightings: [], dbError: true };
  }

  try {
    const { results } = await env.DB.prepare(
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
