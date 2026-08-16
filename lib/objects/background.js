import * as THREE from 'three';
import { loadImageTexture } from '../graphics/texture.js';

/**
 * Map a 2D background texture onto the viewport.
 * Uses offset/repeat — Three.js WebGLBackground applies them via uvTransform.
 *
 * @param {THREE.Texture} texture
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} viewW
 * @param {number} viewH
 * @param {string} [mode='cover']  cover | stretch | fill | fit | contain
 */
export function applyBackgroundFill(texture, imgW, imgH, viewW, viewH, mode = 'cover') {
  const fill = String(mode ?? 'cover').toLowerCase();
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const imgAspect = imgW / Math.max(1, imgH);
  const viewAspect = viewW / Math.max(1, viewH);

  if (fill === 'stretch' || fill === 'fill') {
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
  } else if (fill === 'fit' || fill === 'contain') {
    if (imgAspect > viewAspect) {
      const ry = imgAspect / viewAspect;
      texture.repeat.set(1, ry);
      texture.offset.set(0, (1 - ry) / 2);
    } else {
      const rx = viewAspect / imgAspect;
      texture.repeat.set(rx, 1);
      texture.offset.set((1 - rx) / 2, 0);
    }
  } else {
    // cover (default) — crop to fill the viewport
    if (imgAspect > viewAspect) {
      const rx = viewAspect / imgAspect;
      texture.repeat.set(rx, 1);
      texture.offset.set((1 - rx) / 2, 0);
    } else {
      const ry = imgAspect / viewAspect;
      texture.repeat.set(1, ry);
      texture.offset.set(0, (1 - ry) / 2);
    }
  }

  texture.needsUpdate = true;
}

/**
 * Load an image as a scene background texture (native resolution, linear filter).
 * @param {string} imagePath
 * @param {object} [opts]
 * @param {boolean} [opts.flipY=true]
 * @returns {Promise<THREE.DataTexture>}
 */
export async function loadBackgroundTexture(imagePath, opts = {}) {
  const texture = await loadImageTexture(imagePath, {
    flipY: opts.flipY !== false,
    powerOfTwo: false,
  });
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Assign a texture as `scene.background` (2D backdrop behind the world).
 * @param {THREE.Scene} scene
 * @param {THREE.Texture|null} texture
 * @param {number} [intensity]
 */
export function setSceneBackground(scene, texture, intensity) {
  if (!scene) return;
  scene.background = texture ?? null;
  if (intensity != null && Number.isFinite(Number(intensity))) {
    scene.backgroundIntensity = Number(intensity);
  }
}

/**
 * Engine element: scene background image (`type: 'background'`).
 *
 * Sets `scene.background` to a 2D texture (not a mesh). Hidden via
 * `visible: false` falls back to the window clear color.
 *
 * ```js
 * {
 *   type: 'background',
 *   image: 'assets/cloud.jpg',
 *   imageFill: 'cover',   // cover | stretch | fit
 *   intensity: 1,
 *   visible: true,
 * }
 * ```
 *
 * Also accepted on the window: `window.backgroundImage: 'assets/cloud.jpg'`
 * (or the same object shape without `type`).
 *
 * Runtime: `.setImage(path)`, `.image`, `.imageFill`, `.visible`, `.intensity`
 *
 * @param {object} def
 * @param {{ scene?: THREE.Scene, width?: number, height?: number }} [ctx]
 */
export async function createBackgroundObject(def, ctx = {}) {
  if (!def.image) {
    throw new Error('background requires `image` (path to a picture)');
  }

  let imagePath = String(def.image);
  let fillMode = def.imageFill ?? def.fill ?? 'cover';
  let intensity = def.intensity != null ? Number(def.intensity) : 1;
  let shown = def.visible !== false;
  let viewW = ctx.width ?? 800;
  let viewH = ctx.height ?? 600;
  /** @type {THREE.Scene|null} */
  let sceneRef = ctx.scene ?? null;

  let texture = await loadBackgroundTexture(imagePath, { flipY: def.flipY });
  let imgW = texture.userData.sourceWidth ?? texture.image?.width ?? 1;
  let imgH = texture.userData.sourceHeight ?? texture.image?.height ?? 1;

  const root = new THREE.Group();
  root.name = 'background';
  root.visible = shown;

  function layout() {
    applyBackgroundFill(texture, imgW, imgH, viewW, viewH, fillMode);
  }

  function apply() {
    if (!sceneRef) return;
    setSceneBackground(sceneRef, shown ? texture : null, intensity);
  }

  layout();
  apply();

  /**
   * @param {string} nextPath
   */
  async function setImage(nextPath) {
    if (!nextPath) {
      throw new Error('background.setImage(path): path required');
    }
    const next = await loadBackgroundTexture(nextPath, { flipY: def.flipY });
    const old = texture;
    texture = next;
    imagePath = String(nextPath);
    def.image = imagePath;
    imgW = texture.userData.sourceWidth ?? texture.image?.width ?? 1;
    imgH = texture.userData.sourceHeight ?? texture.image?.height ?? 1;
    layout();
    apply();
    old.dispose();
  }

  return {
    root,
    def,
    /** Applied to `scene.background` — not parented into the graph. */
    mount: 'background',
    /**
     * @param {THREE.Scene} scene
     * @param {{ width?: number, height?: number }} [size]
     */
    onAttach(scene, size = {}) {
      sceneRef = scene;
      if (size.width != null) viewW = size.width;
      if (size.height != null) viewH = size.height;
      layout();
      apply();
    },
    get image() {
      return imagePath;
    },
    set image(value) {
      void setImage(value);
    },
    setImage,
    get imageFill() {
      return fillMode;
    },
    set imageFill(value) {
      fillMode = value ?? 'cover';
      def.imageFill = fillMode;
      layout();
    },
    get intensity() {
      return intensity;
    },
    set intensity(value) {
      intensity = Number(value);
      def.intensity = intensity;
      apply();
    },
    get visible() {
      return shown;
    },
    set visible(value) {
      shown = !!value;
      root.visible = shown;
      apply();
    },
    update: () => {},
  };
}
