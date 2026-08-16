import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as THREE from 'three';

/**
 * Texture definition on geometry elements.
 *
 * @typedef {object} TextureConfig
 * @property {number|string} [color]   raw / tint color (hex number or '#rrggbb')
 * @property {number|string} [raw]     alias for color
 * @property {string} [image]          path to image file (relative to cwd or absolute)
 * @property {'stretch'|'fill'|'fit'|'cover'|'tile'|'tiled'} [imageFill='stretch']
 * @property {number|[number, number]} [repeat]  UV repeat when imageFill is tile (default [2,2])
 * @property {boolean} [flipY=true]
 */

/**
 * Parse color from number or CSS-like string.
 * @param {unknown} value
 * @param {number} [fallback=0xffffff]
 * @returns {number}
 */
export function parseColor(value, fallback = 0xffffff) {
  if (value == null) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3) {
        const r = hex[0] + hex[0];
        const g = hex[1] + hex[1];
        const b = hex[2] + hex[2];
        return parseInt(r + g + b, 16);
      }
      if (hex.length === 6 || hex.length === 8) {
        return parseInt(hex.slice(0, 6), 16);
      }
    }
    if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
    if (/^[0-9a-f]+$/i.test(s) && (s.length === 6 || s.length === 3)) {
      return parseColor('#' + s, fallback);
    }
  }
  return fallback;
}

/**
 * Resolve image path relative to process cwd when not absolute.
 * @param {string} imagePath
 * @returns {string}
 */
export function resolveImagePath(imagePath) {
  if (path.isAbsolute(imagePath)) return imagePath;
  return path.resolve(process.cwd(), imagePath);
}

/**
 * Next power of two (WebGL1 needs POT textures for RepeatWrapping / tiling).
 * @param {number} n
 * @param {number} [max=1024]
 */
function nextPowerOfTwo(n, max = 1024) {
  let p = 1;
  while (p < n && p < max) p <<= 1;
  return Math.min(p, max);
}

/**
 * Decode an image file into a Three.js DataTexture (Node / no DOM).
 * Images are resized to power-of-two by default for WebGL1 tile/repeat support.
 * Pass `{ powerOfTwo: false }` to keep native resolution (backgrounds, no tiling).
 * @param {string} imagePath
 * @param {object} [opts]
 * @param {boolean} [opts.flipY=true]
 * @param {boolean} [opts.powerOfTwo=true]
 * @returns {Promise<THREE.DataTexture>}
 */
export async function loadImageTexture(imagePath, opts = {}) {
  const full = resolveImagePath(imagePath);
  if (!fs.existsSync(full)) {
    throw new Error(`Texture image not found: ${full}`);
  }

  const buffer = fs.readFileSync(full);
  const img = await loadImage(buffer);
  const sourceWidth = img.width;
  const sourceHeight = img.height;

  // Scale to POT so imageFill: 'tile' works under WebGL1 (@kmamal/gl)
  const powerOfTwo = opts.powerOfTwo !== false;
  const width = powerOfTwo ? nextPowerOfTwo(sourceWidth) : sourceWidth;
  const height = powerOfTwo ? nextPowerOfTwo(sourceHeight) : sourceHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const texture = new THREE.DataTexture(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width,
    height,
    THREE.RGBAFormat,
  );
  texture.flipY = opts.flipY !== false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  texture.userData.sourceWidth = sourceWidth;
  texture.userData.sourceHeight = sourceHeight;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Apply imageFill mode to a texture (wrap + repeat).
 * @param {THREE.Texture} texture
 * @param {TextureConfig} cfg
 */
export function applyImageFill(texture, cfg) {
  const mode = String(cfg.imageFill ?? 'stretch').toLowerCase();
  const isTile = mode === 'tile' || mode === 'tiled' || mode === 'repeat';

  if (isTile) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    let ru = 2;
    let rv = 2;
    if (Array.isArray(cfg.repeat) && cfg.repeat.length >= 2) {
      ru = cfg.repeat[0];
      rv = cfg.repeat[1];
    } else if (typeof cfg.repeat === 'number') {
      ru = cfg.repeat;
      rv = cfg.repeat;
    }
    texture.repeat.set(ru, rv);
  } else {
    // stretch | fill | fit | cover — single map across UVs
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);

    // cover/fit can offset slightly; with mesh UVs 0–1, stretch/fill are equivalent
    if (mode === 'fit') {
      // keep full image, clamp edges (no tiling bleed)
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    }
  }

  texture.needsUpdate = true;
}

/**
 * Build / apply a texture config onto a material.
 * Supports raw color only, image only, or both (color tints the map).
 *
 * @param {THREE.Material} material
 * @param {TextureConfig|null|undefined} cfg
 * @returns {Promise<THREE.Material>}
 */
export async function applyTexture(material, cfg) {
  if (!cfg || typeof cfg !== 'object') return material;

  const raw = cfg.color ?? cfg.raw;

  if (material.isShaderMaterial && material.uniforms) {
    if (raw != null && material.uniforms.uColor) {
      const hex = parseColor(raw, 0xffffff);
      const slot = material.uniforms.uColor.value;
      if (slot && slot.isColor) slot.set(hex);
      else material.uniforms.uColor.value = new THREE.Color(hex);
    }
    if (cfg.image) {
      const map = await loadImageTexture(cfg.image, { flipY: cfg.flipY });
      applyImageFill(map, cfg);
      if (!material.uniforms.uMap) material.uniforms.uMap = { value: map };
      else material.uniforms.uMap.value = map;
      if (!material.uniforms.map) material.uniforms.map = { value: map };
      else material.uniforms.map.value = map;
    }
    return material;
  }

  if (raw != null && 'color' in material) {
    material.color = new THREE.Color(parseColor(raw, 0xffffff));
  }

  if (cfg.image) {
    const map = await loadImageTexture(cfg.image, { flipY: cfg.flipY });
    applyImageFill(map, cfg);
    material.map = map;
    // Without an explicit color, keep white so the image shows true colors
    if (raw == null && 'color' in material) {
      material.color = new THREE.Color(0xffffff);
    }
    material.needsUpdate = true;
  }

  return material;
}
