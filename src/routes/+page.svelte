<script>
  /**
   * @typedef {Object} Photo
   * @property {string} id - Cloudflare Images ID
   * @property {string} alt
   * @property {boolean} [primary]
   */

  /**
   * @typedef {Object} Contact
   * @property {string} label
   * @property {string} detail
   * @property {string} href
   * @property {string} icon
   * @property {string} color
   */

  const CF_HASH = '4bRSwPonOXfEIBVZiDXg0w';

  /**
   * Build a Cloudflare Images URL.
   * @param {string} id
   * @param {string} variant
   * @returns {string}
   */
  function img(id, variant) {
    return `https://imagedelivery.net/${CF_HASH}/${id}/${variant}`;
  }

  /** @type {Photo[]} */
  const photos = [
    { id: '6094109c-4045-4f7a-b1ce-21769d89ee00', alt: 'Garbanzo adorable de cerca dormido', primary: true },
    { id: '581c7919-2931-4422-c367-34dc24641100', alt: 'Garbanzo en con mamachita sofá' },
    { id: 'a49d77ec-9253-4503-c4aa-e904ad149c00', alt: 'Garbanzo dormiendo hacia la cámara en el sofá' },
    { id: 'd896cb53-03e1-4f9b-4686-b42f8d045000', alt: 'Garbanzo durmiendo en el sofá' },
    { id: 'dc6bdc22-529e-412e-e9c5-cc5580282700', alt: 'Garbanzo en el jardín' },
    { id: '225137e0-9cc6-4f6e-8527-d8af2523ee00', alt: 'Garbanzo olfateando el pasto' },
    { id: '055e9b2d-a1ee-430b-f206-321f15869400', alt: 'Garbanzo caminando' },
  ];

  /** @type {Contact[]} */
  const contacts = [
    {
      label: 'WhatsApp: Antonio',
      detail: '33 3355 5670',
      href: 'https://wa.me/523333555670',
      icon: '💬',
      color: '#128c7e',
    },
    {
      label: 'Llamada: Antonio',
      detail: '33 3355 5670',
      href: 'tel:+523333555670',
      icon: '📞',
      color: '#34b7f1',
    },
    {
      label: 'Email',
      detail: 'garbanzo@patraldo.com',
      href: 'mailto:garbanzo@patraldo.com',
      icon: '✉️',
      color: '#6c63ff',
    },
  ];

  /** @type {string | null} */
  let lightboxSrc = $state(null);

  // "Seguimos buscando hoy <día> <fecha> de <mes>" — computed client-side so the
  // page always shows the current date. SSR renders the static fallback below.
  /** @type {string} */
  let buscandoHoy = $state('Seguimos buscando');
  $effect(() => {
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    const hoy = new Date();
    buscandoHoy = `Seguimos buscando hoy ${dias[hoy.getDay()]} ${hoy.getDate()} de ${meses[hoy.getMonth()]}`;
  });

  /**
   * @param {string} src
   */
  function openLightbox(src) {
    lightboxSrc = src;
  }

  function closeLightbox() {
    lightboxSrc = null;
  }

  function sharePage() {
    if (navigator.share) {
      navigator.share({
        title: '⚠️ SE BUSCA: Garbanzo - Gato Perdido en Santa Tere',
        text: 'Ayúdennos a encontrar a Garbanzo. Perdido en Pedro Buzeta #277, Santa Tere. Recompensa.',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('¡Link copiado! Compártelo por WhatsApp o redes.');
    }
  }

  // Offer the QR PNG for download so people can repost it (Instagram, WhatsApp, email).
  async function downloadQr() {
    try {
      const res = await fetch('/qr-garbanzo.png');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'garbanzo-qr.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open('/qr-garbanzo.png', '_blank');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('¡Link copiado! Pégalo en WhatsApp, Instagram o correo.');
    } catch {
      window.prompt('Copia este link:', window.location.href);
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  function handleKeydown(e) {
    if (e.key === 'Escape') closeLightbox();
  }
</script>

<svelte:head>
  <title>⚠️ SE BUSCA: Garbanzo — Gato Perdido en Santa Tere</title>
  <meta name="description" content="Garbanzo, gato perdido en Santa Tere, Guadalajara. Blanco con gris, collar Rogz amarillo. SE OFRECE RECOMPENSA." />
  <meta property="og:title" content="⚠️ SE BUSCA: Garbanzo — Gato Perdido" />
  <meta property="og:description" content="Perdido en Pedro Buzeta #277, Santa Tere. Blanco con gris, collar Rogz amarillo. Recompensa." />
  <meta property="og:type" content="website" />
  <meta property="og:image" content={img(photos[0].id, 'cover')} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="⚠️ SE BUSCA: Garbanzo — Gato Perdido" />
  <meta name="twitter:description" content="Perdido en Santa Tere, GDL. Recompensa." />
  <meta name="twitter:image" content={img(photos[0].id, 'cover')} />
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="banner">
  Gato perdido · Santa Tere, GDL
</div>

<div class="container">
  <!-- HERO -->
  <section class="hero">
    <div class="buscando-hoy">{buscandoHoy}</div>
    <div class="lost-badge">🚨 Se Busca · Recompensa 🚨</div>
    <h1>GARBANZO</h1>
    <p class="subtitle">Gatito perdido en Santa Tere, Guadalajara</p>
    <img src={img(photos[0].id, 'cover')} alt={photos[0].alt} class="hero-img" />
  </section>

<!-- REPORT SIGHTING CTA -->
  <section class="card report-cta">
    <h2>📸 ¿Creés verlo?</h2>
    <p class="help-text">
      Si viste un gato gris y blanco por la zona, <strong>sube una foto</strong>.
      Nuestro sistema verifica automáticamente que coincida con Garbanzo.
    </p>
    <a href="/report" class="btn btn-report">
      📷 Reportar avistamiento
    </a>
  </section>

  <!-- REWARD -->
  <div class="reward">
    💰 SE OFRECE RECOMPENSA 💰
    <p class="reward-note">No se pide depósito previo — se entrega al tenerlo con nosotros</p>
  </div>

  <!-- DESCRIPTION -->
  <section class="card">
    <h2>🐱 Descripción</h2>
    <div class="detail-grid">
      <div class="detail">
        <div class="label">Color</div>
        <div class="value">Blanco con gris</div>
      </div>
      <div class="detail">
        <div class="label">Collar</div>
        <div class="value">Rogz amarillo-crema</div>
      </div>
      <div class="detail">
        <div class="label">Nombre</div>
        <div class="value">Garbanzo</div>
      </div>
    </div>
    <p class="description">
      Gatito <strong>blanco con gris</strong>, lleva collar <strong>Rogz color amarillo-crema</strong>. Ya tiene dos días fuera de casa.
      Probablemente esté asustado y escondido en algún rincón cercano buscando resguardo.
    </p>
  </section>

  <!-- LOCATION -->
  <section class="card">
    <h2>📍 Zona de Extravío</h2>
    <p class="address">
      Calle Pedro Buzeta #277<br />
      <span class="muted">Entre Garibaldi y Reforma · Cerca de Av. México</span><br />
      <span class="normal">Santa Tere, Guadalajara, Jalisco</span>
    </p>
    <div class="map-wrap">
      <iframe
        src="https://www.openstreetmap.org/export/embed.html?bbox=-103.3720%2C20.6785%2C-103.3670%2C20.6835&layer=mapnik&marker=20.6808609%2C-103.3695940"
        loading="lazy"
        title="Mapa de la zona donde se perdió Garbanzo"
      ></iframe>
    </div>
  </section>

  <!-- GALLERY -->
  <section class="card">
    <h2>📸 Más fotos</h2>
    <div class="gallery">
      {#each photos as photo (photo.id)}
        <button type="button" class="gallery-btn" onclick={() => openLightbox(img(photo.id, 'full'))} aria-label="Ver {photo.alt}">
          <img src={img(photo.id, 'gallery')} alt={photo.alt} loading="lazy" />
        </button>
      {/each}
    </div>
  </section>

  <!-- CONTACT -->
  <section class="card">
    <h2>📞 Contacto</h2>
    <p class="contact-note">
      Si lo ves, <strong>no lo persigas</strong>. Llámanos de inmediato.
    </p>
    <div class="contact-buttons">
      {#each contacts as c (c.href)}
        <a href={c.href} class="btn" style="background: {c.color}">
          <span class="btn-icon">{c.icon}</span>
          <span class="btn-text">{c.label}<br /><span class="btn-detail">{c.detail}</span></span>
        </a>
      {/each}
    </div>
  </section>
  
  <!-- HELP -->
  <section class="card help-card">
    <h2>🙏 Ayúdanos</h2>
    <p class="help-text">
      Si vives por la zona, te pedimos revises tu <strong>cochera, jardín, azotea</strong> o debajo de tus carros.
      Garbanzo lleva días asustado y probablemente busca resguardo del sol y la lluvia cerca de casa.
    </p>
    <button class="btn btn-share" onclick={sharePage}>
      📤 Compartir esta página
    </button>
  </section>

  <!-- SHARE QR -->
  <section class="card share-card">
    <h2>📲 Comparte este aviso</h2>
    <p class="help-text">
      Escanea el código o <strong>descárgalo</strong> y compártelo por Instagram, WhatsApp o correo.
      Apunta a <strong>garbanzo.patraldo.com</strong>.
    </p>
    <div class="share-qr">
      <img src="/qr-garbanzo.png" alt="Código QR de garbanzo.patraldo.com" width="200" height="200" class="qr-img" />
      <div class="share-qr-actions">
        <button class="btn btn-report" onclick={downloadQr}>⬇️ Descargar QR</button>
        <button class="btn btn-share" onclick={copyLink}>🔗 Copiar link</button>
      </div>
    </div>
  </section>

  <footer class="footer">
    <p>Gracias por ayudar a encontrar a Garbanzo 🐾</p>
    <p class="domain">garbanzo.patraldo.com</p>
  </footer>
</div>

<!-- LIGHTBOX -->
{#if lightboxSrc}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="lightbox"
    onclick={closeLightbox}
    role="button"
    tabindex="0"
    aria-label="Cerrar imagen"
    onkeydown={(/** @type {KeyboardEvent} */ e) => e.key === 'Escape' && closeLightbox()}
  >
    <img src={lightboxSrc} alt="Foto de Garbanzo" />
  </div>
{/if}

<style>
  :root {
    --alert: #e63946;
    --alert-dark: #c1121f;
    --bg: #fafafa;
    --text: #1a1a1a;
    --muted: #666;
  }

  .banner {
    background: var(--alert);
    color: white;
    text-align: center;
    padding: 12px 16px;
    font-weight: 800;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .container {
    max-width: 700px;
    margin: 0 auto;
    padding: 0 16px 60px;
  }

  .hero {
    text-align: center;
    padding: 24px 0 16px;
  }

  .buscando-hoy {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text);
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .hero h1 {
    font-size: 2.4rem;
    font-weight: 900;
    color: var(--alert-dark);
    line-height: 1.15;
  }

  .subtitle {
    color: var(--muted);
    font-size: 1.05rem;
    margin-bottom: 20px;
  }

  .hero-img {
    width: 100%;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    display: block;
  }

  .lost-badge {
    display: inline-block;
    background: var(--alert);
    color: white;
    padding: 6px 18px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.85rem;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .reward {
    text-align: center;
    background: linear-gradient(135deg, #ffd60a, #ffc300);
    color: #1a1a1a;
    padding: 16px;
    border-radius: 14px;
    font-weight: 800;
    font-size: 1.15rem;
    margin: 16px 0;
    box-shadow: 0 3px 14px rgba(255, 195, 0, 0.4);
  }

  .reward-note {
    font-size: 0.85rem;
    font-weight: 600;
    margin-top: 4px;
  }

  .card {
    background: white;
    border-radius: 14px;
    padding: 20px;
    margin: 16px 0;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .card h2 {
    font-size: 1.2rem;
    margin-bottom: 12px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .detail {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 10px;
  }

  .detail .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .detail .value {
    font-size: 0.95rem;
    font-weight: 600;
    margin-top: 2px;
  }

  .description {
    font-size: 1.02rem;
    color: #333;
    margin-top: 14px;
  }

  .description strong {
    color: var(--alert-dark);
  }

  .address {
    font-size: 1.05rem;
    font-weight: 600;
  }

  .muted {
    font-weight: 400;
    color: var(--muted);
  }

  .normal {
    font-weight: 400;
  }

  .map-wrap {
    border-radius: 12px;
    overflow: hidden;
    margin-top: 8px;
  }

  .map-wrap iframe {
    width: 100%;
    height: 250px;
    border: 0;
    display: block;
  }

  .gallery {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 8px;
  }

  .gallery-btn {
    border: none;
    padding: 0;
    cursor: pointer;
    background: none;
    border-radius: 10px;
    overflow: hidden;
    transition: transform 0.2s;
  }

  .gallery-btn:active {
    transform: scale(0.97);
  }

  .gallery-btn img {
    width: 100%;
    display: block;
  }

  .contact-note {
    margin-bottom: 4px;
    color: var(--muted);
  }

  .contact-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1rem;
    text-decoration: none;
    color: white;
    transition: transform 0.15s, box-shadow 0.15s;
    border: none;
    cursor: pointer;
    width: 100%;
    max-width: 100%;
    text-align: center;
  }

  .btn:active {
    transform: scale(0.97);
  }

  .btn-share {
    background: var(--alert-dark);
    margin-top: 12px;
  }

  .btn-report {
    background: #007bff;
    margin-top: 12px;
  }

  .report-cta {
    background: #e7f0ff;
    border: 2px solid #b3d1ff;
  }

  .btn-icon {
    font-size: 1.3rem;
    flex-shrink: 0;
  }

  .btn-text {
    min-width: 0;
    word-break: break-word;
  }

  .btn-detail {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .help-card {
    background: #fff3cd;
    border: 2px solid #ffc107;
  }

  .share-card {
    background: #e9fbff;
    border: 2px solid #7fd8eb;
  }

  .share-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-top: 12px;
  }

  .qr-img {
    width: 200px;
    height: 200px;
    image-rendering: pixelated;
    background: white;
    padding: 8px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .share-qr-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .help-text {
    font-size: 0.98rem;
  }

  .lightbox {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 200;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: zoom-out;
  }

  .lightbox img {
    max-width: 95%;
    max-height: 90vh;
    border-radius: 8px;
  }

  .footer {
    text-align: center;
    padding: 24px 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .domain {
    margin-top: 4px;
  }

  @media (min-width: 600px) {
    .hero h1 {
      font-size: 2.8rem;
    }
  }
</style>
