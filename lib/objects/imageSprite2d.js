import * as THREE from 'three';
import { vec2 } from '../utils/math.js';
import {
  loadSpriteSheet,
  normalizeCrop,
  applyCropUVs,
  frameCrop,
} from './spriteSheet.js';
import {
  screenPixelsToCameraLocal,
  applyScreenPixelScale,
  bindHudSprite,
  DEFAULT_Z_INDEX,
} from './hudScreen.js';

/**
 * Resolve on-screen display size in pixels from def + crop.
 * @param {object} def
 * @param {{ w: number, h: number }} crop
 * @returns {[number, number]}
 */
function resolveDisplaySizePx(def, crop) {
  const aspect = crop.w / Math.max(1, crop.h);
  const pixelScale = Number(def.pixelScale ?? def.scale ?? 1) || 1;

  if (Array.isArray(def.size) && def.size.length >= 2) {
    return [Number(def.size[0]) || crop.w, Number(def.size[1]) || crop.h];
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
  // Default: native crop pixels × pixelScale (integer-ish pixel art)
  return [crop.w * pixelScale, crop.h * pixelScale];
}

/**
 * Build camera-fixed 2D image sprite (`type: '2dimagesprite'`).
 *
 * Composition of shared sprite-sheet + HUD screen helpers (not inheritance).
 * Same screen model as `2dtext`: Cartesian pixels, top-left origin, y down.
 * No 3D transform, no pushForce.
 *
 * ```js
 * {
 *   type: '2dimagesprite',
 *   image: 'assets/char.png',
 *   position: [100, 200],     // screen px (top-left origin, y down)
 *   size: [72, 51],           // optional on-screen size in px
 *   // or pixelScale: 3       // scale native crop pixels
 *   crop: { x, y, w, h },
 *   anchor: [0, 1],           // sprite pivot (default top-left)
 *   depth: -1,
 *   zIndex: 1,                // HUD stack (higher = in front); default 1
 *   opacity: 1,               // 0..1 material alpha; default 1
 *   visible: true,
 * }
 * ```
 *
 * Runtime: `.position` (2D px), `.zIndex`, `.opacity`, `.visible`, `.crop` / `.setCrop`, `.setFrame`
 *
 * @param {object} def
 * @param {{ camera?: THREE.PerspectiveCamera, width?: number, height?: number }} [ctx]
 */
export async function createImageSprite2DObject(def, ctx = {}) {
  if (!def.image) {
    throw new Error('2dimagesprite requires `image` (path to PNG)');
  }

  const { texture, width: imgW, height: imgH } = await loadSpriteSheet(
    def.image,
    '2dimagesprite',
  );
  let crop = normalizeCrop(def.crop, imgW, imgH);
  applyCropUVs(texture, crop, imgW, imgH);

  const depth = def.depth != null ? Number(def.depth) : -1;
  const [anchorX, anchorY] = vec2(def.anchor, [0, 1]);

  /** @type {[number, number]} screen pixels */
  let pos2d = vec2(def.position, [0, 0]);
  let [displayW, displayH] = resolveDisplaySizePx(def, crop);
  let screenW = ctx.width ?? 800;
  let screenH = ctx.height ?? 600;
  /** @type {THREE.PerspectiveCamera|null} */
  let attachedCamera = ctx.camera ?? null;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.center.set(anchorX, anchorY);
  sprite.visible = def.visible !== false;
  sprite.frustumCulled = false;

  function layout() {
    if (!attachedCamera) return;
    const [lx, ly, lz] = screenPixelsToCameraLocal(
      attachedCamera,
      pos2d[0],
      pos2d[1],
      screenW,
      screenH,
      depth,
    );
    sprite.position.set(lx, ly, lz);
    applyScreenPixelScale(sprite, attachedCamera, displayW, displayH, screenH, depth);
  }

  function setCrop(nextCrop) {
    crop = normalizeCrop(nextCrop, imgW, imgH);
    applyCropUVs(texture, crop, imgW, imgH);
    def.crop = { ...crop };
    // Keep display size unless user fixed size/width/height
    if (def.size == null && def.width == null && def.height == null) {
      [displayW, displayH] = resolveDisplaySizePx(def, crop);
    }
    layout();
  }

  /**
   * @param {number} index
   * @param {number} frameW
   * @param {number} frameH
   * @param {number} [row=0]
   */
  function setFrame(index, frameW, frameH, row = 0) {
    setCrop(frameCrop(index, frameW, frameH, row));
  }

  function setPosition2d(value) {
    pos2d = vec2(value, pos2d);
    def.position = [pos2d[0], pos2d[1]];
    layout();
  }

  /**
   * Set on-screen size in pixels: `[w, h]`, number (width), or `{x/w, y/h}`.
   * @param {unknown} value
   */
  function setSize(value) {
    if (Array.isArray(value) && value.length >= 2) {
      displayW = Number(value[0]) || displayW;
      displayH = Number(value[1]) || displayH;
      def.size = [displayW, displayH];
    } else if (typeof value === 'number') {
      const aspect = crop.w / Math.max(1, crop.h);
      displayW = value;
      displayH = value / aspect;
      def.size = [displayW, displayH];
    }
    layout();
  }

  layout();

  return bindHudSprite({
    root: sprite,
    def,
    mount: 'camera',
    /**
     * @param {THREE.PerspectiveCamera} camera
     * @param {{ width?: number, height?: number }} [size]
     */
    onAttach(camera, size = {}) {
      attachedCamera = camera;
      if (size.width != null) screenW = size.width;
      if (size.height != null) screenH = size.height;
      layout();
    },
    get position() {
      return [pos2d[0], pos2d[1]];
    },
    set position(value) {
      setPosition2d(value);
    },
    get size() {
      return [displayW, displayH];
    },
    set size(value) {
      setSize(value);
    },
    get visible() {
      return sprite.visible;
    },
    set visible(value) {
      sprite.visible = !!value;
    },
    get crop() {
      return { ...crop };
    },
    set crop(value) {
      setCrop(value);
    },
    setCrop,
    setFrame,
    sheetSize: { width: imgW, height: imgH },
    update: () => {
      if (attachedCamera) layout();
    },
  }, sprite, DEFAULT_Z_INDEX['2dimagesprite']);
}
