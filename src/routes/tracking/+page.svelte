<script>
  /**
   * @typedef {{ label: string, count: number }} Bucket
   * @typedef {{ day: string, views: number, uniques: number }} DayPoint
   * @typedef {{ views: number, uniques: number, views_7d: number, views_30d: number }} Totals
   * @typedef {{ reports_total: number, reports_7d: number, report_views: number }} Reports
   * @typedef {{ totals: Totals, series: DayPoint[], topPaths: Bucket[], topReferrers: Bucket[], topCities: Bucket[], devices: Bucket[], reports: Reports, generatedAt: string }} Stats
   */

  /** @type {{ data: { authorized: boolean, email?: string, dbError?: boolean, stats?: Stats | null } }} */
  let { data } = $props();

  // Refresh data without a full reload.
  function refresh() {
    fetch(window.location.href, { headers: { accept: 'application/json' } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) data = d; })
      .catch(() => {});
  }

  /**
   * @param {number} n
   * @returns {string}
   */
  function fmt(n) {
    return Number(n || 0).toLocaleString('en-US');
  }

  /**
   * @param {string} iso  date('YYYY-MM-DD')
   * @returns {string}
   */
  function shortDay(iso) {
    const [, m, d] = iso.split('-');
    return `${Number(m)}/${Number(d)}`;
  }

  /** @param {Bucket[]} buckets */
  function maxCount(buckets) {
    return Math.max(1, ...buckets.map((b) => b.count));
  }

  /** @param {DayPoint[]} series */
  function maxViews(series) {
    return Math.max(1, ...series.map((p) => p.views));
  }
</script>

<svelte:head>
  <title>Seguimiento · Garbanzo</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if !data.authorized}
  <!-- UNAUTHORIZED -->
  <div class="gate">
    <div class="gate-card">
      <div class="lock">🔒</div>
      <h1>Acceso restringido</h1>
      <p>
        Esta página está protegida por Cloudflare Access. Inicia sesión con una
        cuenta autorizada para ver las estadísticas de visitantes.
      </p>
      <a class="btn" href="/tracking">Reintentar</a>
      <p class="hint">Si llegaste aquí sin una pantalla de login, la política de Access no cubre esta ruta.</p>
    </div>
  </div>
{:else if data.dbError || !data.stats}
  <!-- DB UNAVAILABLE -->
  <div class="gate">
    <div class="gate-card">
      <h1>Base de datos no disponible</h1>
      <p>No se pudo conectar a D1. Intenta de nuevo en un momento.</p>
    </div>
  </div>
{:else}
  <!-- DASHBOARD -->
  {@const s = data.stats}
  {@const barMax = maxCount([...s.topPaths, ...s.topReferrers, ...s.topCities, ...s.devices])}
  <div class="dash">
    <header class="dash-head">
      <div>
        <h1>Seguimiento de visitantes</h1>
        <p class="sub">garbanzo.patraldo.com · sesión: {data.email}</p>
      </div>
      <button class="refresh" onclick={refresh}>↻ Actualizar</button>
    </header>

    <!-- TOP-LINE STATS -->
    <section class="stats">
      <div class="stat">
        <div class="stat-num">{fmt(s.totals.views)}</div>
        <div class="stat-label">Visitas totales</div>
      </div>
      <div class="stat">
        <div class="stat-num">{fmt(s.totals.uniques)}</div>
        <div class="stat-label">Visitantes únicos</div>
      </div>
      <div class="stat">
        <div class="stat-num">{fmt(s.totals.views_7d)}</div>
        <div class="stat-label">Últimos 7 días</div>
      </div>
      <div class="stat">
        <div class="stat-num">{fmt(s.totals.views_30d)}</div>
        <div class="stat-label">Últimos 30 días</div>
      </div>
    </section>

    <!-- REPORT FUNNEL -->
    <section class="card">
      <h2>📣 Reportes de avistamiento</h2>
      <div class="funnel">
        <div class="funnel-row">
          <span class="funnel-label">Visitas a /report</span>
          <span class="funnel-val">{fmt(s.reports.report_views)}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">Reportes enviados (total)</span>
          <span class="funnel-val">{fmt(s.reports.reports_total)}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">Reportes últimos 7 días</span>
          <span class="funnel-val">{fmt(s.reports.reports_7d)}</span>
        </div>
      </div>
    </section>

    <!-- DAILY SERIES -->
    <section class="card">
      <h2>📈 Visitas por día (14 días)</h2>
      {#if s.series.length === 0}
        <p class="empty">Sin datos aún.</p>
      {:else}
        {@const vmax = maxViews(s.series)}
        <div class="chart">
          {#each s.series as pt (pt.day)}
            <div class="bar-col" title="{shortDay(pt.day)}: {fmt(pt.views)} visitas">
              <div class="bar" style="height: {(pt.views / vmax) * 100}%"></div>
              <div class="bar-label">{shortDay(pt.day)}</div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <div class="grid2">
      <!-- TOP PATHS -->
      <section class="card">
        <h2>📄 Páginas más vistas</h2>
        {#if s.topPaths.length === 0}
          <p class="empty">Sin datos.</p>
        {:else}
          <ul class="bars">
            {#each s.topPaths as b (b.label)}
              <li>
                <span class="b-label">{b.label}</span>
                <span class="b-track"><span class="b-fill" style="width: {(b.count / barMax) * 100}%"></span></span>
                <span class="b-val">{fmt(b.count)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- TOP REFERRERS -->
      <section class="card">
        <h2>🔗 Fuentes de tráfico</h2>
        {#if s.topReferrers.length === 0}
          <p class="empty">Sin datos.</p>
        {:else}
          <ul class="bars">
            {#each s.topReferrers as b (b.label)}
              <li>
                <span class="b-label">{b.label}</span>
                <span class="b-track"><span class="b-fill" style="width: {(b.count / barMax) * 100}%"></span></span>
                <span class="b-val">{fmt(b.count)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- TOP CITIES -->
      <section class="card">
        <h2>📍 Ciudades</h2>
        {#if s.topCities.length === 0}
          <p class="empty">Sin datos.</p>
        {:else}
          <ul class="bars">
            {#each s.topCities as b (b.label)}
              <li>
                <span class="b-label">{b.label}</span>
                <span class="b-track"><span class="b-fill" style="width: {(b.count / barMax) * 100}%"></span></span>
                <span class="b-val">{fmt(b.count)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- DEVICES -->
      <section class="card">
        <h2>🖥️ Dispositivos</h2>
        {#if s.devices.length === 0}
          <p class="empty">Sin datos.</p>
        {:else}
          <ul class="bars">
            {#each s.devices as b (b.label)}
              <li>
                <span class="b-label">{b.label}</span>
                <span class="b-track"><span class="b-fill" style="width: {(b.count / barMax) * 100}%"></span></span>
                <span class="b-val">{fmt(b.count)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>

    <footer class="foot">
      Generado {new Date(s.generatedAt).toLocaleString()}. Recolección del lado del servidor · sin cookies ni terceros.
    </footer>
  </div>
{/if}

<style>
  :global(body) {
    background: #f4f5f7;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
  }

  /* ---- Gate ---- */
  .gate {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .gate-card {
    background: white;
    border-radius: 16px;
    padding: 40px 32px;
    max-width: 420px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
  .lock { font-size: 3rem; }
  .gate-card h1 { margin: 12px 0 8px; font-size: 1.4rem; }
  .gate-card p { color: #555; margin: 0 0 20px; line-height: 1.5; }
  .gate-card .btn {
    display: inline-block;
    background: #e63946;
    color: white;
    padding: 12px 24px;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 700;
  }
  .hint { font-size: 0.78rem; color: #999; margin-top: 16px !important; }

  /* ---- Dashboard ---- */
  .dash {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 16px 60px;
  }
  .dash-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }
  .dash-head h1 { margin: 0; font-size: 1.5rem; }
  .sub { margin: 4px 0 0; color: #888; font-size: 0.85rem; }
  .refresh {
    background: white;
    border: 1px solid #ddd;
    border-radius: 10px;
    padding: 8px 14px;
    font-weight: 600;
    cursor: pointer;
    color: #333;
    white-space: nowrap;
  }
  .refresh:hover { background: #f0f0f0; }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .stat {
    background: white;
    border-radius: 12px;
    padding: 14px;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  }
  .stat-num { font-size: 1.7rem; font-weight: 800; color: #c1121f; line-height: 1.1; }
  .stat-label { font-size: 0.72rem; text-transform: uppercase; color: #888; letter-spacing: 0.4px; margin-top: 4px; }

  .card {
    background: white;
    border-radius: 14px;
    padding: 18px;
    margin: 12px 0;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
  }
  .card h2 { font-size: 1.05rem; margin: 0 0 12px; }

  /* Funnel */
  .funnel { display: flex; flex-direction: column; gap: 8px; }
  .funnel-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f7f8fa;
    padding: 10px 12px;
    border-radius: 8px;
  }
  .funnel-label { font-size: 0.9rem; color: #444; }
  .funnel-val { font-weight: 800; color: #1a1a1a; }

  /* Chart */
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 140px;
    padding-top: 8px;
  }
  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
    min-width: 0;
  }
  .bar {
    width: 70%;
    background: linear-gradient(180deg, #e63946, #c1121f);
    border-radius: 4px 4px 0 0;
    min-height: 2px;
    transition: height 0.3s;
  }
  .bar-label { font-size: 0.6rem; color: #999; margin-top: 4px; }

  /* Bar lists */
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  ul.bars { list-style: none; margin: 0; padding: 0; }
  ul.bars li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(40px, 2fr) auto;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 0.85rem;
  }
  .b-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #444;
  }
  .b-track { background: #eef0f3; border-radius: 999px; height: 8px; overflow: hidden; }
  .b-fill { display: block; height: 100%; background: #e63946; border-radius: 999px; }
  .b-val { font-weight: 700; color: #1a1a1a; }

  .empty { color: #999; margin: 0; }

  .foot { text-align: center; color: #aaa; font-size: 0.75rem; margin-top: 24px; }

  @media (max-width: 640px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
    .grid2 { grid-template-columns: 1fr; }
  }
</style>
