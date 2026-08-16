import * as THREE from 'three';
import { vec2 } from '../utils/math.js';
import { createBitmap } from '../utils/bitmap.js';
import { screenPixelsToCameraLocal, applyScreenPixelScale } from './hudScreen.js';

/**
 * Resolve on-screen display size in pixels.
 * @param {object} def
 * @param {number} bmpW
 * @param {number} bmpH
 * @returns {[number, number]}
 */
function resolveDisplaySizePx(def, bmpW, bmpH) {
  const aspect = bmpW / Math.max(1, bmpH);
  const pixelScale = Number(def.pixelScale ?? def.scale ?? 1) || 1;

  if (Array.isArray(def.size) && def.size.length >= 2) {
    return [Number(def.size[0]) || bmpW, Number(def.size[1]) || bmpH];
  }
  if (typeof def.size === 'number') {
    const w = def.size;
    return [w, w / aspect];
  }
  if (def.widthPx != null || def.heightPx != null) {
    const w =
      def.widthPx != null ? Number(def.widthPx) : Number(def.heightPx) * aspect;
    const h = def.heightPx != null ? Number(def.heightPx) : w / aspect;
    return [w, h];
  }
  return [bmpW * pixelScale, bmpH * pixelScale];
}

/**
 * Camera-fixed 2D bitmap (`type: '2dbitmap'`).
 *
 * Renders a pixel array in Cartesian screen space (origin top-left, y down).
 * Same HUD model as `2dtext` / `2dimagesprite`. No 3D transform, no pushForce.
 *
 * ```js
 * {
 *   type: '2dbitmap',
 *   width: 16, height: 16,     // bitmap pixels (not screen size)
 *   pixels: [0x40916c, ...],   // optional flat or 2D color array
 *   fill: 0x1b4332,            // clear color when pixels omitted
 *   position: [784, 16],       // screen px
 *   pixelScale: 8,             // or size: [w, h] in screen px
 *   visible: true,
 * }
 * ```
 *
 * Runtime: `.setPixel(x, y, color)`, `.setPixels(arr)`, `.fill(color)`,
 * `.pixels`, `.position`, `.size`, `.visible`, `.bitmap`
 *
 * @param {object} def
 * @param {{ camera?: THREE.PerspectiveCamera, width?: number, height?: number }} [ctx]
 */
export function createBitmap2DObject(def, ctx = {}) {
  const shared = def.bitmap && typeof def.bitmap === 'object' ? def.bitmap : null;
  const bitmap =
    shared && shared.data && typeof shared.width === 'number'
      ? shared
      : createBitmap({
          width: def.width ?? def.cols ?? shared?.width,
          height: def.height ?? def.rows ?? shared?.height,
          pixels: def.pixels,
          fill: def.fill ?? def.clear,
          bitmap: shared,
        });

  const bmpW = bitmap.width;
  const bmpH = bitmap.height;

  const texture = new THREE.DataTexture(bitmap.data, bmpW, bmpH, THREE.RGBAFormat);
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  const unsub = typeof bitmap.onChange === 'function'
    ? bitmap.onChange(() => {
        texture.needsUpdate = true;
      })
    : null;

  const depth = def.depth != null ? Number(def.depth) : -1;
  const [anchorX, anchorY] = vec2(def.anchor, [0, 1]);

  /** @type {[number, number]} */
  let pos2d = vec2(def.position, [0, 0]);
  let [displayW, displayH] = resolveDisplaySizePx(def, bmpW, bmpH);
  let screenW = ctx.width ?? 800;
  let screenH = ctx.height ?? 600;
  /** @type {THREE.PerspectiveCamera|null} */
  let attachedCamera = ctx.camera ?? null;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.center.set(anchorX, anchorY);
  sprite.renderOrder = 997;
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

  function setPosition2d(value) {
    pos2d = vec2(value, pos2d);
    def.position = [pos2d[0], pos2d[1]];
    layout();
  }

  /**
   * @param {unknown} value
   */
  function setSize(value) {
    if (Array.isArray(value) && value.length >= 2) {
      displayW = Number(value[0]) || displayW;
      displayH = Number(value[1]) || displayH;
      def.size = [displayW, displayH];
    } else if (typeof value === 'number') {
      const aspect = bmpW / Math.max(1, bmpH);
      displayW = value;
      displayH = value / aspect;
      def.size = [displayW, displayH];
    }
    layout();
  }

  layout();

  return {
    root: sprite,
    def,
    mount: 'camera',
    bitmap,
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
    get width() {
      return bmpW;
    },
    get height() {
      return bmpH;
    },
    setPixel: (x, y, color) => bitmap.setPixel(x, y, color),
    getPixel: (x, y) => bitmap.getPixel(x, y),
    getPixelRgba: (x, y) => bitmap.getPixelRgba(x, y),
    fill: (color) => bitmap.fill(color),
    setPixels: (pixels) => bitmap.setPixels(pixels),
    getPixels: () => bitmap.getPixels(),
    get pixels() {
      return bitmap.getPixels();
    },
    set pixels(value) {
      bitmap.setPixels(value);
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
    update: () => {
      if (attachedCamera) layout();
    },
    dispose: () => {
      unsub?.();
      texture.dispose();
      material.dispose();
    },
  };
}
