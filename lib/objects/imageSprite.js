import * as THREE from 'three';
import { applyTransform } from '../graphics/transform.js';
import {
  loadSpriteSheet,
  normalizeCrop,
  applyCropUVs,
  frameCrop,
} from './spriteSheet.js';

/**
 * @typedef {import('./spriteSheet.js').CropRect} CropRect
 */

/**
 * Normalize pushForce config: undefined/null → null, else [x,y,z].
 * @param {unknown} value
 * @returns {number[]|null}
 */
function parsePushForce(value) {
  if (value == null) return null;
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  }
  if (typeof value === 'object') {
    const o = /** @type {{ x?: number, y?: number, z?: number }} */ (value);
    if (o.x != null || o.y != null || o.z != null) {
      return [Number(o.x) || 0, Number(o.y) || 0, Number(o.z) || 0];
    }
  }
  return null;
}

/**
 * Resolve plane size from def.size / width / height and crop aspect.
 * @param {object} def
 * @param {CropRect} crop
 * @returns {[number, number]}
 */
function resolvePlaneSize(def, crop) {
  const aspect = crop.w / crop.h;

  if (Array.isArray(def.size) && def.size.length >= 2) {
    return [Number(def.size[0]) || 1, Number(def.size[1]) || 1];
  }
  if (typeof def.size === 'number') {
    const w = def.size;
    return [w, w / aspect];
  }
  if (def.width != null || def.height != null) {
    const w = def.width != null ? Number(def.width) : Number(def.height) * aspect;
    const h = def.height != null ? Number(def.height) : w / aspect;
    return [w, h];
  }
  // Default: 1 unit wide, height from sprite aspect
  return [1, 1 / aspect];
}

/**
 * Build a transparent PNG plane sprite (`type: '3dimagesprite'`).
 *
 * Config:
 * ```js
 * {
 *   type: '3dimagesprite',
 *   image: 'assets/char.png',       // required — PNG with alpha
 *   size: [1, 0.7] | 1,             // plane width/height in world units
 *   position: [x,y,z],
 *   rotation: [x,y,z],
 *   pushForce: [x,y,z] | null,
 *   crop: { x, y, w, h },           // pixel crop on the sheet (animation)
 *   visible: true,
 * }
 * ```
 *
 * Runtime: `.crop = {x,y,w,h}`, `.pushForce`, `.visible`, `.setFrame(index, frameW, frameH, row?)`
 *
 * @param {object} def
 * @returns {Promise<import('./geometry.js').RuntimeObject & { crop: CropRect, setCrop: Function, setFrame: Function }>}
 */
export async function createImageSpriteObject(def) {
  if (!def.image) {
    throw new Error('3dimagesprite requires `image` (path to PNG)');
  }

  const { texture, width: imgW, height: imgH } = await loadSpriteSheet(
    def.image,
    '3dimagesprite',
  );
  let crop = normalizeCrop(def.crop, imgW, imgH);
  applyCropUVs(texture, crop, imgW, imgH);

  const [planeW, planeH] = resolvePlaneSize(def, crop);
  const geometry = new THREE.PlaneGeometry(planeW, planeH);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    depthWrite: true,
    color: 0xffffff,
  });

  const mesh = new THREE.Mesh(geometry, material);
  applyTransform(mesh, def);
  mesh.visible = def.visible !== false;

  /** @type {number[]|null} */
  let force = parsePushForce(def.pushForce);

  function setCrop(nextCrop) {
    crop = normalizeCrop(nextCrop, imgW, imgH);
    applyCropUVs(texture, crop, imgW, imgH);
    def.crop = { ...crop };
  }

  /**
   * Select a frame in a horizontal strip (or grid with row).
   * @param {number} index  frame index (0-based)
   * @param {number} frameW
   * @param {number} frameH
   * @param {number} [row=0]
   */
  function setFrame(index, frameW, frameH, row = 0) {
    setCrop(frameCrop(index, frameW, frameH, row));
  }

  return {
    root: mesh,
    def,
    get visible() {
      return mesh.visible;
    },
    set visible(value) {
      mesh.visible = !!value;
    },
    get pushForce() {
      return force;
    },
    set pushForce(value) {
      force = parsePushForce(value);
    },
    get crop() {
      return { ...crop };
    },
    set crop(value) {
      setCrop(value);
    },
    setCrop,
    setFrame,
    /** Full sheet pixel size */
    sheetSize: { width: imgW, height: imgH },
    update: (delta) => {
      if (force) {
        mesh.position.x += force[0] * delta;
        mesh.position.y += force[1] * delta;
        mesh.position.z += force[2] * delta;
      }
    },
  };
}
