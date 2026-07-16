/**
 * /tracking — visitor analytics dashboard, gated by Cloudflare Access.
 *
 * Defense in depth:
 *   1. (edge) Cloudflare Access gates /tracking* to the owner's email.
 *   2. (app)  This load verifies the Cf-Access-Jwt-Assertion before running any
 *             query and default-denies otherwise.
 *
 * Returns aggregate stats computed in D1; no per-row export.
 */

import { verifyAccessJwt } from '$lib/server/access.js';

/** @typedef {{ label: string, count: number }} Bucket */

/**
 * @param {any} db  D1 binding
 * @param {string} sql
 * @param {...any} binds
 * @returns {Promise<any[]>} rows (empty on error)
 */
async function all(db, sql, ...binds) {
  try {
    const { results } = await db.prepare(sql).bind(...binds).all();
    return results || [];
  } catch (err) {
    console.error('tracking query failed:', err);
    return [];
  }
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ platform, request }) {
  // The CF adapter throws when env bindings are accessed on a prerenderable
  // route; resolve each binding defensively.
  /** @type {string} */
  let team = '';
  /** @type {string} */
  let aud = '';
  /** @type {boolean} */
  let debug = false;
  /** @type {any} */
  let db = null;
  try {
    team = platform?.env?.CF_ACCESS_TEAM || '';
    aud = platform?.env?.CF_ACCESS_AUD || '';
    debug = !!platform?.env?.CF_ACCESS_DEBUG;
    db = platform?.env?.DB || null;
  } catch {
    // Prerenderable route or platform unavailable.
  }

  // --- Authorization (default deny) ---
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const user = await verifyAccessJwt(assertion, { team, aud, debug });
  if (!user) {
    return { authorized: false };
  }

  if (!db) {
    return { authorized: true, email: user.email, dbError: true, stats: null };
  }

  // --- Aggregates ---
  const [
    totalRow,
    last7Rows,
    topPathsRows,
    topReferrersRows,
    topCitiesRows,
    deviceRows,
    reportsRows,
  ] = await Promise.all([
    // Totals + unique IPs (all time, and last 7 / 30 days)
    all(
      db,
      `SELECT
         COUNT(*) AS views,
         COUNT(DISTINCT ip_hash) AS uniques,
         SUM(CASE WHEN created_at >= datetime('now','-7 days')  THEN 1 ELSE 0 END) AS views_7d,
         SUM(CASE WHEN created_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS views_30d
       FROM page_views`,
    ),
    // Daily series, last 14 days (oldest first for plotting)
    all(
      db,
      `SELECT date(created_at) AS day, COUNT(*) AS views, COUNT(DISTINCT ip_hash) AS uniques
       FROM page_views
       WHERE created_at >= datetime('now','-14 days')
       GROUP BY day ORDER BY day ASC`,
    ),
    // Top paths
    all(
      db,
      `SELECT path AS label, COUNT(*) AS count
       FROM page_views GROUP BY path ORDER BY count DESC LIMIT 10`,
    ),
    // Top referrers (host only, grouped)
    all(
      db,
      `SELECT
         CASE
           WHEN referrer IS NULL OR referrer = '' THEN '(direct)'
           ELSE substr(referrer, instr(referrer,'://')+3)
         END AS label,
         COUNT(*) AS count
       FROM page_views
       GROUP BY label ORDER BY count DESC LIMIT 10`,
    ),
    // Top cities
    all(
      db,
      `SELECT COALESCE(city||', '||country, country, '(unknown)') AS label, COUNT(*) AS count
       FROM page_views GROUP BY label ORDER BY count DESC LIMIT 10`,
    ),
    // Devices
    all(
      db,
      `SELECT COALESCE(device,'(unknown)') AS label, COUNT(*) AS count
       FROM page_views GROUP BY device ORDER BY count DESC`,
    ),
    // Reports submitted (from the sightings table) + report-page views
    all(
      db,
      `SELECT
         (SELECT COUNT(*) FROM sightings) AS reports_total,
         (SELECT COUNT(*) FROM sightings WHERE created_at >= datetime('now','-7 days')) AS reports_7d,
         (SELECT COUNT(*) FROM page_views WHERE path = '/report') AS report_views`,
    ),
  ]);

  const totals = totalRow[0] || { views: 0, uniques: 0, views_7d: 0, views_30d: 0 };
  const reports = reportsRows[0] || { reports_total: 0, reports_7d: 0, report_views: 0 };

  return {
    authorized: true,
    email: user.email,
    dbError: false,
    stats: {
      totals,
      series: last7Rows,
      topPaths: /** @type {Bucket[]} */ (topPathsRows),
      topReferrers: /** @type {Bucket[]} */ (topReferrersRows),
      topCities: /** @type {Bucket[]} */ (topCitiesRows),
      devices: /** @type {Bucket[]} */ (deviceRows),
      reports,
      generatedAt: new Date().toISOString(),
    },
  };
}
