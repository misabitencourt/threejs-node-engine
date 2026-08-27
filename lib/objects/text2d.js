import { createCanvas } from '@napi-rs/canvas';
import * as THREE from 'three';
import { vec2 } from '../utils/math.js';
import {
  screenPixelsToCameraLocal,
  applyScreenPixelScale,
  bindHudSprite,
  DEFAULT_Z_INDEX,
} from './hudScreen.js';

/**
 * Draw text onto a canvas and build a Three.js texture for a HUD sprite.
 * @param {string} str
 * @param {object} style
 * @param {number} style.fontSize
 * @param {string} style.color
 * @param {string} style.fontFamily
 * @param {number} style.padding
 * @param {string} [style.background]
 * @returns {{ texture: THREE.DataTexture, width: number, height: number }}
 */
function buildTextTexture(str, style) {
  const fontSize = style.fontSize;
  const padding = style.padding;
  const font = `bold ${fontSize}px ${style.fontFamily}`;

  // Measure with a temporary canvas
  const measure = createCanvas(1, 1);
  const mctx = measure.getContext('2d');
  mctx.font = font;
  const metrics = mctx.measureText(str || ' ');
  const textW = Math.ceil(Math.max(1, metrics.width));
  const textH = Math.ceil(fontSize * 1.25);
  const width = textW + padding * 2;
  const height = textH + padding * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (style.background) {
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.color;
  ctx.fillText(str || ' ', padding, height / 2);

  const { data } = ctx.getImageData(0, 0, width, height);
  const texture = new THREE.DataTexture(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width,
    height,
    THREE.RGBAFormat,
  );
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  return { texture, width, height };
}

/**
 * Build camera-fixed 2D HUD text (`type: '2dtext'`).
 *
 * Uses Three.js `Sprite` + canvas texture, parented to the main camera.
 * Position is a **2D screen vector in pixels** (Cartesian, top-left origin, y down).
 * No 3D transform, no pushForce.
 *
 * ```js
 * {
 *   type: '2dtext',
 *   text: 'Score: 0',
 *   position: [20, 16],    // screen pixels: x from left, y from top
 *   // or { x, y }
 *   fontSize: 42,          // canvas / approx on-screen px
 *   color: '#ffffff',
 *   fontFamily: 'sans-serif',
 *   padding: 8,
 *   background: null,      // optional CSS color under the glyphs
 *   anchor: [0, 1],        // sprite pivot: (0,1)=top-left … (1,0)=bottom-right
 *   depth: -1,             // camera-local Z (in front of lens)
 *   zIndex: 2,             // HUD stack (higher = in front); default 2
 *   opacity: 1,            // 0..1 material alpha; default 1
 *   mirrorX: false,        // flip horizontally (box stays put)
 *   mirrorY: false,        // flip vertically
 *   visible: true,
 * }
 * ```
 *
 * Runtime: `.setText(string)`, `.position` (2D px), `.zIndex`, `.opacity`, `.mirrorX`, `.mirrorY`, `.visible` — **no** pushForce / 3D vectors.
 *
 * @param {object} def
 * @param {{ camera?: THREE.PerspectiveCamera, width?: number, height?: number }} [ctx]
 */
export function createText2DObject(def, ctx = {}) {
  const content = def.text != null ? String(def.text) : '';
  const fontSize = Number(def.fontSize ?? def.size ?? 42) || 42;
  const color =
    typeof def.color === 'number'
      ? `#${def.color.toString(16).padStart(6, '0')}`
      : String(def.color ?? '#ffffff');
  const fontFamily = def.fontFamily ?? 'sans-serif';
  const padding = Number(def.padding ?? 8) || 0;
  const background = def.background != null ? String(def.background) : null;
  const depth = def.depth != null ? Number(def.depth) : -1;
  // Default pivot = top-left so `position` matches screen top-left placement
  const [anchorX, anchorY] = vec2(def.anchor, [0, 1]);

  /** @type {[number, number]} screen pixels (origin top-left, y down) */
  let pos2d = vec2(def.position, [0, 0]);
  let currentText = content;
  let screenW = ctx.width ?? 800;
  let screenH = ctx.height ?? 600;
  /** @type {THREE.PerspectiveCamera|null} */
  let attachedCamera = ctx.camera ?? null;

  const style = () => ({ fontSize, color, fontFamily, padding, background });

  let { texture, width: texW, height: texH } = buildTextTexture(currentText || ' ', style());
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
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
    applyScreenPixelScale(sprite, attachedCamera, texW, texH, screenH, depth);
  }

  function setText(next) {
    const str = next != null ? String(next) : '';
    if (str === currentText) return;
    currentText = str;
    def.text = currentText;

    const built = buildTextTexture(currentText || ' ', style());
    const old = material.map;
    material.map = built.texture;
    material.needsUpdate = true;
    if (old) old.dispose();
    texture = built.texture;
    texW = built.width;
    texH = built.height;
    layout();
  }

  function setPosition2d(value) {
    pos2d = vec2(value, pos2d);
    def.position = [pos2d[0], pos2d[1]];
    layout();
  }

  // Initial layout if camera was provided at create time
  layout();

  return bindHudSprite({
    root: sprite,
    def,
    /** Attach as child of the main camera (handled by engine create). */
    mount: 'camera',
    /**
     * Called when the engine parents this object to the camera.
     * @param {THREE.PerspectiveCamera} camera
     * @param {{ width?: number, height?: number }} [size]
     */
    onAttach(camera, size = {}) {
      attachedCamera = camera;
      if (size.width != null) screenW = size.width;
      if (size.height != null) screenH = size.height;
      layout();
    },
    get text() {
      return currentText;
    },
    set text(value) {
      setText(value);
    },
    setText,
    /**
     * 2D screen position in pixels: `[x, y]` or `{x,y}`.
     * Origin top-left, x right, y down (engine maps to camera space).
     */
    get position() {
      return [pos2d[0], pos2d[1]];
    },
    set position(value) {
      setPosition2d(value);
    },
    get visible() {
      return sprite.visible;
    },
    set visible(value) {
      sprite.visible = !!value;
    },
    update: () => {
      // Stays fixed on the camera via parenting — no push / 3D motion.
      // Re-layout if aspect may have changed (camera.aspect updated elsewhere).
      if (attachedCamera) layout();
    },
  }, sprite, DEFAULT_Z_INDEX['2dtext']);
}
