import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as THREE from 'three';
import { resolveImagePath } from '../graphics/texture.js';

/**
 * Shared sprite-sheet helpers (composition for 3d + 2d image sprites).
 */

/**
 * @typedef {object} CropRect
 * @property {number} x  pixel left
 * @property {number} y  pixel top
 * @property {number} w  pixel width
 * @property {number} h  pixel height
 */

/**
 * @param {unknown} crop
 * @param {number} imgW
 * @param {number} imgH
 * @returns {CropRect}
 */
export function normalizeCrop(crop, imgW, imgH) {
  if (crop && typeof crop === 'object') {
    const c = /** @type {Record<string, number>} */ (crop);
    const w = Math.max(1, Number(c.w ?? c.width ?? imgW) || imgW);
    const h = Math.max(1, Number(c.h ?? c.height ?? imgH) || imgH);
    const x = Math.max(0, Number(c.x ?? 0) || 0);
    const y = Math.max(0, Number(c.y ?? 0) || 0);
    return { x, y, w, h };
  }
  return { x: 0, y: 0, w: imgW, h: imgH };
}

/**
 * Apply pixel crop to texture UV offset/repeat (sprite-sheet style).
 * @param {THREE.Texture} texture
 * @param {CropRect} crop
 * @param {number} imgW
 * @param {number} imgH
 */
export function applyCropUVs(texture, crop, imgW, imgH) {
  const ru = crop.w / imgW;
  const rv = crop.h / imgH;
  const ou = crop.x / imgW;
  // With flipY, V origin is bottom; convert top-left crop to Three offset
  const ov = 1 - (crop.y + crop.h) / imgH;

  texture.repeat.set(ru, rv);
  texture.offset.set(ou, ov);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
}

/**
 * Load full PNG (with alpha) as a DataTexture — native resolution, nearest filter.
 * @param {string} imagePath
 * @param {string} [label='imagesprite']
 * @returns {Promise<{ texture: THREE.DataTexture, width: number, height: number }>}
 */
export async function loadSpriteSheet(imagePath, label = 'imagesprite') {
  const full = resolveImagePath(imagePath);
  if (!fs.existsSync(full)) {
    throw new Error(`${label} image not found: ${full}`);
  }

  const buffer = fs.readFileSync(full);
  const img = await loadImage(buffer);
  const width = img.width;
  const height = img.height;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  const texture = new THREE.DataTexture(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width,
    height,
    THREE.RGBAFormat,
  );
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  return { texture, width, height };
}

/**
 * @param {CropRect} crop
 * @param {number} index
 * @param {number} frameW
 * @param {number} frameH
 * @param {number} [row=0]
 * @returns {CropRect}
 */
export function frameCrop(index, frameW, frameH, row = 0) {
  return {
    x: index * frameW,
    y: row * frameH,
    w: frameW,
    h: frameH,
  };
}
