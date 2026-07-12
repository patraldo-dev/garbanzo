<script>
  /**
   * Admin dashboard — view community sighting submissions.
   * Protected by ADMIN_TOKEN (passed via URL ?token=xxx).
   */

  /** @type {{ authorized: boolean, sightings: any[], dbError?: boolean, error?: string }} */
  let { authorized, sightings, dbError, error } = $props();

  let filter = $state('all'); // all | pending | reviewed | rejected | flagged
  let selected = $state(null);

  const filtered = $derived(
    filter === 'all'
      ? sightings
      : sightings.filter((s) => s.status === filter)
  );

  const stats = $derived({
    total: sightings.length,
    pending: sightings.filter((s) => s.status === 'pending').length,
    flagged: sightings.filter((s) => s.status === 'flagged').length,
    rejected: sightings.filter((s) => s.status === 'rejected').length,
    reviewed: sightings.filter((s) => s.status === 'reviewed').length,
  });

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'Z');
    return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  }

  function verdictColor(verdict) {
    return verdict === 'pass' ? '#28a745' : verdict === 'reject' ? '#dc3545' : '#ffc107';
  }

  async function updateStatus(id, status) {
    try {
      const resp = await fetch(`/api/sighting/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, token: new URLSearchParams(window.location.search).get('token') }),
      });
      if (resp.ok) {
        // Update local state
        const sighting = sightings.find((s) => s.id === id);
        if (sighting) sighting.status = status;
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  }
</script>

<svelte:head>
  <title>Admin — Garbanzo Sightings</title>
</svelte:head>

{#if !authorized}
  <div class="unauth">
    <h1>🚫 No autorizado</h1>
    <p>Necesitas el token de administrador para ver esta página.</p>
  </div>
{:else}
  <div class="admin-container">
    <h1>📋 Avistamientos de Garbanzo</h1>

    <!-- Stats -->
    <div class="stats">
      <div class="stat">
        <span class="stat-num">{stats.total}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat pending">
        <span class="stat-num">{stats.pending}</span>
        <span class="stat-label">Pendientes</span>
      </div>
      <div class="stat flagged">
        <span class="stat-num">{stats.flagged}</span>
        <span class="stat-label">Marcados</span>
      </div>
      <div class="stat rejected">
        <span class="stat-num">{stats.rejected}</span>
        <span class="stat-label">Rechazados</span>
      </div>
    </div>

    {#if dbError}
      <div class="error-banner">
        ⚠️ Error conectando a la base de datos. {error || ''}
      </div>
    {/if}

    <!-- Filter tabs -->
    <div class="filters">
      {#each [['all', 'Todos'], ['pending', 'Pendientes'], ['flagged', 'Marcados'], ['reviewed', 'Revisados'], ['rejected', 'Rechazados']] as [key, label]}
        <button
          class="filter-btn"
          class:active={filter === key}
          onclick={() => { filter = key; }}
        >
          {label}
        </button>
      {/each}
    </div>

    <!-- Sightings list -->
    {#if filtered.length === 0}
      <p class="empty">No hay reportes en esta categoría.</p>
    {:else}
      <div class="sightings-grid">
        {#each filtered as s (s.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="sighting-card" class:selected={selected === s.id} onclick={() => { selected = selected === s.id ? null : s.id; }}>
            <div class="card-thumb">
              <img src={s.thumb} alt="Avistamiento" loading="lazy" />
              <span class="verdict-badge" style="background: {verdictColor(s.ai_verdict)}">
                {s.ai_verdict}
              </span>
            </div>
            <div class="card-body">
              <div class="card-date">{formatDate(s.created_at)}</div>
              {#if s.location}
                <div class="card-location">📍 {s.location}</div>
              {/if}
              {#if s.reporter_name}
                <div class="card-reporter">👤 {s.reporter_name}</div>
              {/if}
              {#if s.reporter_contact}
                <div class="card-contact">📞 {s.reporter_contact}</div>
              {/if}
              <div class="card-ai">{s.ai_description}</div>
              <div class="card-confidence">
                Confianza AI: {Math.round((s.ai_confidence || 0) * 100)}%
              </div>
              {#if s.notes}
                <div class="card-notes">{s.notes}</div>
              {/if}
              {#if selected === s.id}
                <div class="card-actions">
                  <a href={s.full} target="_blank" rel="noopener" class="action-btn view">🔍 Ver foto completa</a>
                  {#if s.reporter_contact}
                    <a href={`https://wa.me/${s.reporter_contact.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener" class="action-btn wa">💬 WhatsApp</a>
                  {/if}
                  <div class="status-buttons">
                    <button onclick={(e) => { e.stopPropagation(); updateStatus(s.id, 'reviewed'); }}>✅ Revisado</button>
                    <button onclick={(e) => { e.stopPropagation(); updateStatus(s.id, 'archived'); }}>📁 Archivar</button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .unauth {
    text-align: center;
    padding: 60px 20px;
  }

  .admin-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px 16px 60px;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 20px;
  }

  .stats {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .stat {
    background: #f5f5f5;
    padding: 12px 20px;
    border-radius: 10px;
    text-align: center;
    min-width: 80px;
  }

  .stat-num {
    display: block;
    font-size: 1.5rem;
    font-weight: 800;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #666;
    text-transform: uppercase;
  }

  .stat.pending { background: #fff3cd; }
  .stat.flagged { background: #ffe0e0; }
  .stat.rejected { background: #f8d7da; }

  .filters {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.15s;
  }

  .filter-btn.active {
    background: #e63946;
    color: white;
    border-color: #e63946;
  }

  .sightings-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  @media (min-width: 600px) {
    .sightings-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .sighting-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    transition: box-shadow 0.15s;
  }

  .sighting-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }

  .card-thumb {
    position: relative;
    aspect-ratio: 4 / 3;
    overflow: hidden;
  }

  .card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .verdict-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    color: white;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .card-body {
    padding: 12px;
  }

  .card-date {
    font-size: 0.8rem;
    color: #999;
    margin-bottom: 4px;
  }

  .card-location,
  .card-reporter,
  .card-contact {
    font-size: 0.85rem;
    margin-bottom: 2px;
  }

  .card-ai {
    font-size: 0.82rem;
    color: #555;
    margin-top: 6px;
    font-style: italic;
  }

  .card-confidence {
    font-size: 0.75rem;
    color: #999;
    margin-top: 2px;
  }

  .card-notes {
    font-size: 0.85rem;
    margin-top: 6px;
    padding: 8px;
    background: #f9f9f9;
    border-radius: 6px;
  }

  .card-actions {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .action-btn {
    display: block;
    text-align: center;
    padding: 8px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .action-btn.view {
    background: #007bff;
    color: white;
  }

  .action-btn.wa {
    background: #25d366;
    color: white;
  }

  .status-buttons {
    display: flex;
    gap: 6px;
  }

  .status-buttons button {
    flex: 1;
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .error-banner {
    background: #f8d7da;
    color: #721c24;
    padding: 12px;
    border-radius: 10px;
    margin-bottom: 16px;
  }

  .empty {
    text-align: center;
    color: #999;
    padding: 40px;
  }
</style>
