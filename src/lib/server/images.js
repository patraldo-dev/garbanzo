/**
 * Cloudflare Images upload helpers.
 * Uses CLOUDFLARE_API_TOKEN from Secrets Store.
 */

import { IMAGES_API } from './config.js';

/**
 * Upload an image to Cloudflare Images via direct upload.
 * @param {ArrayBuffer} imageData - Raw image bytes
 * @param {string} filename - Original filename
 * @param {{ env: Record<string, any> }} ctx
 * @returns {Promise<{ success: boolean, id?: string, url?: string, error?: string }>}
 */
export async function uploadToCloudflareImages(imageData, filename, ctx) {
  /** @type {string | null} */
  let token;
  try {
    const raw = ctx.env.CLOUDFLARE_API_TOKEN;
    token = typeof raw === 'string' ? raw : (await raw?.get?.()) ?? null;
  } catch {
    token = null;
  }
  if (!token) {
    return { success: false, error: 'Server not configured: CLOUDFLARE_API_TOKEN missing' };
  }

  const formData = new FormData();
  formData.append('file', new Blob([imageData]), filename);

  try {
    const resp = await fetch(`${IMAGES_API}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await resp.json();

    if (!data.success) {
      return { success: false, error: data.errors?.[0]?.message || 'Upload failed' };
    }

    return {
      success: true,
      id: data.result.id,
      url: data.result.variants?.[0] || '',
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Delete an image from Cloudflare Images.
 * @param {string} imageId
 * @param {{ env: Record<string, any> }} ctx
 * @returns {Promise<boolean>}
 */
export async function deleteFromCloudflareImages(imageId, ctx) {
  /** @type {string | null} */
  let token;
  try {
    const raw = ctx.env.CLOUDFLARE_API_TOKEN;
    token = typeof raw === 'string' ? raw : (await raw?.get?.()) ?? null;
  } catch {
    token = null;
  }
  if (!token) return false;

  try {
    const resp = await fetch(`${IMAGES_API}/${imageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await resp.json();
    return data.success;
  } catch {
    return false;
  }
}
