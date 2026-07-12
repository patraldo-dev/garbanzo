/**
 * PATCH /api/sighting/[id] — Update sighting status (admin only).
 */

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, platform }) {
  const env = platform?.env || {};
  const adminToken = env.ADMIN_TOKEN || '';
  const body = await request.json();
  const token = body.token || '';

  if (!adminToken || token !== adminToken) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { status } = body;
  const validStatuses = ['pending', 'reviewed', 'archived', 'rejected', 'flagged'];

  if (!validStatuses.includes(status)) {
    return json({ error: 'Invalid status' }, 400);
  }

  try {
    await env.DB.prepare(
      'UPDATE sightings SET status = ? WHERE id = ?'
    ).bind(status, params.id).run();

    return json({ success: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
