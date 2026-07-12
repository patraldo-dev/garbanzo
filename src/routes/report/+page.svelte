<script>
  /**
   * Community sighting report form.
   * Accepts a photo upload + optional contact info.
   * AI filters for grey/white tiger-stripe cats only.
   */

  let photo = $state(null);
  let photoPreview = $state(null);
  let name = $state('');
  let contact = $state('');
  let location = $state('');
  let notes = $state('');
  let submitting = $state(false);
  let result = $state(null); // { success, message } | null

  // Turnstile site key — set via env or use testing key
  const TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; // Testing key (always passes)

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      result = { success: false, message: 'La foto es demasiado grande (máximo 10MB)' };
      return;
    }

    photo = file;
    photoPreview = URL.createObjectURL(file);
    result = null;
  }

  async function submitReport() {
    if (!photo) {
      result = { success: false, message: 'Por favor sube una foto' };
      return;
    }

    submitting = true;
    result = null;

    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('name', name);
      formData.append('contact', contact);
      formData.append('location', location);
      formData.append('notes', notes);

      // Turnstile token (testing mode auto-resolves)
      const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value || '';
      formData.append('cf-turnstile-response', turnstileResponse);

      const resp = await fetch('/api/report', {
        method: 'POST',
        body: formData,
      });

      const data = await resp.json();

      if (data.success) {
        result = { success: true, message: data.message };
        // Reset form
        photo = null;
        photoPreview = null;
        name = contact = location = notes = '';
      } else if (data.rejected) {
        result = { success: false, message: data.message, rejected: true };
      } else {
        result = { success: false, message: data.error || 'Error al enviar. Intenta de nuevo.' };
      }
    } catch (err) {
      result = { success: false, message: `Error: ${String(err)}` };
    } finally {
      submitting = false;
    }
  }

  // Load Turnstile script
  $effect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
</script>

<svelte:head>
  <title>Reporta un avistamiento — Garbanzo</title>
  <meta name="description" content="¿Viste a Garbanzo? Sube una foto y cuéntanos dónde." />
</svelte:head>

<div class="back-link">
  <a href="/">← Volver a la página principal</a>
</div>

<div class="report-container">
  <h1>📸 Reporta un avistamiento</h1>
  <p class="intro">
    ¿Crees que viste a Garbanzo? Sube una foto y nos ayudará confirmar.
    Solo se aceptan fotos de <strong>gatos grises y blancos atigrados</strong> —
    el sistema filtra automáticamente otros animales u objetos.
  </p>

  {#if result?.success}
    <div class="alert alert-success">
      ✅ {result.message}
      <p class="alert-sub">Puedes cerrar esta página o <button type="button" class="link-btn" onclick={() => { result = null; }}>enviar otro reporte</button>.
    </p> 
    </div>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); submitReport(); }} class="report-form">
      <!-- Photo upload -->
      <div class="field">
        <label for="photo">Foto del gato visto *</label>
        <div class="upload-area" class:has-preview={!!photoPreview}>
          {#if photoPreview}
            <img src={photoPreview} alt="Vista previa" class="preview-img" />
            <button type="button" class="change-photo" onclick={() => { photo = null; photoPreview = null; }}>
              Cambiar foto
            </button>
          {:else}
            <label for="photo" class="upload-label">
              <span class="upload-icon">📷</span>
              <span>Toca para subir una foto</span>
              <span class="upload-hint">JPG, PNG, o WebP · máximo 10MB</span>
            </label>
          {/if}
        </div>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onchange={handleFile}
          class="file-input"
          required
        />
      </div>

      {#if result?.rejected}
        <div class="alert alert-rejected">
          🚫 {result.message}
        </div>
      {/if}

      <!-- Optional info -->
      <div class="field">
        <label for="name">Tu nombre (opcional)</label>
        <input id="name" type="text" bind:value={name} maxlength="100" placeholder="Cómo te llamas" />
      </div>

      <div class="field">
        <label for="contact">Contacto (opcional)</label>
        <input id="contact" type="text" bind:value={contact} maxlength="100" placeholder="WhatsApp o email para darte las gracias" />
      </div>

      <div class="field">
        <label for="location">¿Dónde lo viste? (opcional)</label>
        <input id="location" type="text" bind:value={location} maxlength="200" placeholder="Cerca de..., entre... y..." />
      </div>

      <div class="field">
        <label for="notes">Notas (opcional)</label>
        <textarea id="notes" bind:value={notes} maxlength="1000" rows="3" placeholder="Algo más que quieras contarnos"></textarea>
      </div>

      <!-- Turnstile -->
      <div class="turnstile-wrap" data-sitekey={TURNSTILE_SITE_KEY}>
        <div class="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY}></div>
      </div>

      <button type="submit" disabled={submitting || !photo} class="submit-btn">
        {submitting ? 'Enviando...' : '📤 Enviar reporte'}
      </button>

      {#if result && !result.success && !result.rejected}
        <div class="alert alert-error">
          ❌ {result.message}
        </div>
      {/if}
    </form>
  {/if}

  <div class="trust-note">
    <h3>🔒 Protección contra abuso</h3>
    <ul>
      <li>Tu foto se analiza con IA para verificar que sea un gato gris y blanco atigrado.</li>
      <li>Se aplica un límite de envíos por dispositivo para prevenir spam.</li>
      <li>Los reportes con señales de extorsión o fraude se marcan para revisión manual.</li>
      <li>No pedimos dinero ni depósitos. La recompensa se entrega en persona al tener a Garbanzo.</li>
    </ul>
  </div>
</div>

<style>
  .back-link {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }

  .back-link a {
    color: #666;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .report-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 16px 60px;
  }

  h1 {
    font-size: 1.6rem;
    color: #1a1a1a;
    margin-bottom: 8px;
  }

  .intro {
    color: #555;
    font-size: 0.95rem;
    margin-bottom: 24px;
    line-height: 1.5;
  }

  .report-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #333;
  }

  .field input[type="text"],
  .field textarea {
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
  }

  .field input:focus,
  .field textarea:focus {
    outline: none;
    border-color: #e63946;
    box-shadow: 0 0 0 3px rgba(230, 57, 70, 0.1);
  }

  .file-input {
    display: none;
  }

  .upload-area {
    border: 2px dashed #ccc;
    border-radius: 14px;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    background: #fafafa;
  }

  .upload-area.has-preview {
    border-style: solid;
    padding: 0;
  }

  .upload-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 40px 20px;
    text-align: center;
    color: #666;
  }

  .upload-icon {
    font-size: 2.5rem;
  }

  .upload-hint {
    font-size: 0.8rem;
    color: #999;
  }

  .preview-img {
    width: 100%;
    max-height: 400px;
    object-fit: contain;
    border-radius: 12px;
  }

  .change-photo {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .turnstile-wrap {
    min-height: 65px;
  }

  .submit-btn {
    background: #e63946;
    color: white;
    border: none;
    padding: 14px;
    border-radius: 12px;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s;
  }

  .submit-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .submit-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .alert {
    padding: 16px;
    border-radius: 12px;
    font-weight: 600;
    line-height: 1.4;
  }

  .alert-success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .alert-error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .alert-rejected {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
  }

.link-btn {
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
}

  .alert-sub {
    margin-top: 8px;
    font-weight: 400;
    font-size: 0.9rem;
  }

  .alert-sub a {
    color: inherit;
    text-decoration: underline;
  }

  .trust-note {
    margin-top: 32px;
    padding: 20px;
    background: #f0f4ff;
    border-radius: 14px;
    border: 1px solid #d0deff;
  }

  .trust-note h3 {
    font-size: 1rem;
    margin-bottom: 10px;
  }

  .trust-note ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trust-note li {
    font-size: 0.88rem;
    color: #444;
    padding-left: 16px;
    position: relative;
    line-height: 1.4;
  }

  .trust-note li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: #28a745;
    font-weight: 700;
  }
</style>
