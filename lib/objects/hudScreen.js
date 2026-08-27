import * as THREE from 'three';

/**
 * Shared screen-space HUD math for camera-fixed 2D elements.
 * Cartesian screen: origin top-left, x right, y down, units = pixels.
 * Engine maps to Three.js camera-local space (composition helper, not a base class).
 */

/**
 * Map screen pixel coords (origin top-left, y down) to camera-local space.
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} px  pixels from left edge
 * @param {number} py  pixels from top edge
 * @param {number} screenW
 * @param {number} screenH
 * @param {number} depth  negative = in front of camera
 * @returns {[number, number, number]}
 */
export function screenPixelsToCameraLocal(camera, px, py, screenW, screenH, depth) {
  const w = Math.max(1, screenW);
  const h = Math.max(1, screenH);
  // NDC: left=-1, right=1, top=1, bottom=-1
  const ndcX = (px / w) * 2 - 1;
  const ndcY = 1 - (py / h) * 2;

  const d = Math.abs(depth);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const viewH = 2 * Math.tan(vFov / 2) * d;
  const viewW = viewH * camera.aspect;
  return [(ndcX * viewW) / 2, (ndcY * viewH) / 2, depth];
}

/**
 * Scale a Sprite so `displayW`×`displayH` screen pixels match on-screen size.
 *
 * @param {THREE.Sprite} sprite
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} displayW  on-screen width in px
 * @param {number} displayH  on-screen height in px
 * @param {number} screenH
 * @param {number} depth
 */
export function applyScreenPixelScale(sprite, camera, displayW, displayH, screenH, depth) {
  const d = Math.abs(depth);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const viewH = 2 * Math.tan(vFov / 2) * d;
  const worldH = (displayH / Math.max(1, screenH)) * viewH;
  const worldW = worldH * (displayW / Math.max(1, displayH));
  sprite.scale.set(worldW, worldH, 1);
}

/**
 * HUD sprites paint after world meshes (`renderOrder` 0).
 * Final order is `HUD_RENDER_ORDER_BASE + zIndex` (higher zIndex = in front).
 */
export const HUD_RENDER_ORDER_BASE = 1000;

/**
 * Default stacking when `zIndex` is omitted. Higher draws in front.
 * Matches the previous hardcoded renderOrder (bitmap behind sprite behind text).
 */
export const DEFAULT_Z_INDEX = {
  '2dbitmap': 0,
  '2dimagesprite': 1,
  '2dtext': 2,
};

/**
 * Parse `zIndex` from a 2D element def.
 * @param {object} [def]
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function resolveZIndex(def, fallback = 0) {
  if (def == null || def.zIndex == null || def.zIndex === '') return fallback;
  const n = Number(def.zIndex);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Three.js `renderOrder` for a HUD sprite.
 * @param {number} zIndex
 * @returns {number}
 */
export function hudRenderOrder(zIndex) {
  return HUD_RENDER_ORDER_BASE + (Number(zIndex) || 0);
}

/**
 * Bind `zIndex` on a HUD runtime entry (getter/setter updates `renderOrder`).
 * @param {object} entry
 * @param {THREE.Object3D} object
 * @param {number} fallback
 * @returns {object} entry
 */
export function bindZIndex(entry, object, fallback) {
  const def = entry.def ?? {};
  let zIndex = resolveZIndex(def, fallback);
  object.renderOrder = hudRenderOrder(zIndex);
  Object.defineProperty(entry, 'zIndex', {
    configurable: true,
    enumerable: true,
    get() {
      return zIndex;
    },
    set(value) {
      const n = Number(value);
      zIndex = Number.isFinite(n) ? n : 0;
      def.zIndex = zIndex;
      object.renderOrder = hudRenderOrder(zIndex);
    },
  });
  return entry;
}

/**
 * Clamp opacity to 0..1.
 * @param {unknown} value
 * @param {number} [fallback=1]
 * @returns {number}
 */
export function clampOpacity(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/**
 * Parse `opacity` from a 2D element def (0 = invisible, 1 = opaque).
 * @param {object} [def]
 * @param {number} [fallback=1]
 * @returns {number}
 */
export function resolveOpacity(def, fallback = 1) {
  if (def == null || def.opacity == null || def.opacity === '') return fallback;
  return clampOpacity(def.opacity, fallback);
}

/**
 * Bind `opacity` on a HUD runtime entry (getter/setter updates the material).
 * @param {object} entry
 * @param {THREE.Material} material
 * @param {number} [fallback=1]
 * @returns {object} entry
 */
export function bindOpacity(entry, material, fallback = 1) {
  const def = entry.def ?? {};
  let opacity = resolveOpacity(def, fallback);
  material.transparent = true;
  material.opacity = opacity;
  Object.defineProperty(entry, 'opacity', {
    configurable: true,
    enumerable: true,
    get() {
      return opacity;
    },
    set(value) {
      opacity = clampOpacity(value, 0);
      def.opacity = opacity;
      material.opacity = opacity;
      material.transparent = true;
      material.needsUpdate = true;
    },
  });
  return entry;
}

/**
 * Parse a boolean flag from a 2D element def (`mirrorX` / `mirrorY`).
 * @param {object} [def]
 * @param {string} key
 * @param {boolean} [fallback=false]
 * @returns {boolean}
 */
export function resolveBool(def, key, fallback = false) {
  if (def == null || def[key] == null || def[key] === '') return fallback;
  return Boolean(def[key]);
}

/**
 * THREE.Sprite ignores negative scale (`length()` of the model matrix), so
 * HUD mirror is a UV flip in the sprite shader — before the texture crop matrix,
 * so sprite-sheet frames stay intact.
 *
 * @param {THREE.SpriteMaterial} material
 * @returns {{ set: (mirrorX: boolean, mirrorY: boolean) => void }}
 */
export function attachHudMirrorUniforms(material) {
  const uMirrorX = { value: 0 };
  const uMirrorY = { value: 0 };

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uMirrorX = uMirrorX;
    shader.uniforms.uMirrorY = uMirrorY;
    if (!shader.vertexShader.includes('uMirrorX')) {
      shader.vertexShader =
        'uniform float uMirrorX;\nuniform float uMirrorY;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        vec2 hudUv = uv;
        hudUv.x = mix(hudUv.x, 1.0 - hudUv.x, uMirrorX);
        hudUv.y = mix(hudUv.y, 1.0 - hudUv.y, uMirrorY);
        #ifdef USE_MAP
          vMapUv = ( mapTransform * vec3( hudUv, 1.0 ) ).xy;
        #endif
        #if defined ( USE_UV ) || defined ( USE_ANISOTROPY )
          vUv = hudUv;
        #endif
        `,
      );
    }
  };
  material.customProgramCacheKey = () => 'hud-uv-mirror';
  material.needsUpdate = true;

  return {
    set(mirrorX, mirrorY) {
      uMirrorX.value = mirrorX ? 1 : 0;
      uMirrorY.value = mirrorY ? 1 : 0;
    },
  };
}

/**
 * Bind `mirrorX` / `mirrorY` on a HUD runtime entry.
 * @param {object} entry
 * @param {(mirrorX: boolean, mirrorY: boolean) => void} apply
 * @returns {object} entry
 */
export function bindMirror(entry, apply) {
  const def = entry.def ?? {};
  let mirrorX = resolveBool(def, 'mirrorX');
  let mirrorY = resolveBool(def, 'mirrorY');

  function sync() {
    apply(mirrorX, mirrorY);
  }

  Object.defineProperty(entry, 'mirrorX', {
    configurable: true,
    enumerable: true,
    get() {
      return mirrorX;
    },
    set(value) {
      mirrorX = !!value;
      def.mirrorX = mirrorX;
      sync();
    },
  });
  Object.defineProperty(entry, 'mirrorY', {
    configurable: true,
    enumerable: true,
    get() {
      return mirrorY;
    },
    set(value) {
      mirrorY = !!value;
      def.mirrorY = mirrorY;
      sync();
    },
  });
  sync();
  return entry;
}

/**
 * Bind shared HUD sprite fields (`zIndex`, `opacity`, `mirrorX`, `mirrorY`).
 * @param {object} entry
 * @param {THREE.Sprite} object
 * @param {number} zIndexFallback
 * @returns {object} entry
 */
export function bindHudSprite(entry, object, zIndexFallback) {
  bindZIndex(entry, object, zIndexFallback);
  bindOpacity(entry, object.material);
  const mirror = attachHudMirrorUniforms(object.material);
  bindMirror(entry, (mx, my) => mirror.set(mx, my));
  return entry;
}
