/**
 * 2D screen-space scale helpers (Cartesian pixel size).
 *
 * Targets camera-fixed HUD elements such as `2dimagesprite` that expose
 * `.size` as `[widthPx, heightPx]` (not Three.js Object3D.scale).
 *
 * Composition companion to `scale3d` / `scaleBy` in scale.js.
 */

/**
 * @param {unknown} value
 * @returns {[number, number]|null}
 */
function toSizeXY(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [value, value];
  }
  if (Array.isArray(value) && value.length >= 1) {
    if (value.length === 1) {
      const s = Number(value[0]) || 0;
      return [s, s];
    }
    return [Number(value[0]) || 0, Number(value[1]) || 0];
  }
  if (typeof value === 'object') {
    const o = /** @type {{ x?: number, y?: number, w?: number, h?: number, width?: number, height?: number }} */ (
      value
    );
    if (o.w != null || o.h != null || o.width != null || o.height != null) {
      return [
        Number(o.w ?? o.width ?? 0) || 0,
        Number(o.h ?? o.height ?? 0) || 0,
      ];
    }
    if (o.x != null || o.y != null) {
      return [Number(o.x) || 0, Number(o.y) || 0];
    }
  }
  return null;
}

/**
 * @param {unknown} object
 * @returns {boolean}
 */
function hasSizeApi(object) {
  if (object == null || typeof object !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (object);
  return 'size' in o;
}

/**
 * Read current on-screen size in pixels: `[w, h]`.
 * @param {unknown} object  e.g. 2dimagesprite runtime element
 * @returns {[number, number]|null}
 */
export function getScale2d(object) {
  if (!hasSizeApi(object)) return null;
  const o = /** @type {{ size: unknown }} */ (object);
  return toSizeXY(o.size);
}

/**
 * Set absolute on-screen size in pixels.
 *
 * ```js
 * scale2d(sprite, 96)           // square-ish: width 96 (height from setter rules)
 * scale2d(sprite, [96, 68])     // exact w×h px
 * scale2d(sprite, { w: 96, h: 68 })
 * ```
 *
 * @param {unknown} object
 * @param {number|number[]|{ x?: number, y?: number, w?: number, h?: number }} size
 * @returns {[number, number]|null}
 */
export function scale2d(object, size) {
  if (!hasSizeApi(object)) return null;
  const xy = toSizeXY(size);
  if (!xy) return null;

  const o = /** @type {{ size: unknown }} */ (object);
  o.size = [xy[0], xy[1]];
  return getScale2d(object);
}

/**
 * Multiply current pixel size by a factor (uniform or per-axis).
 *
 * ```js
 * scaleBy2d(sprite, 1.1)             // 10% larger on screen
 * scaleBy2d(sprite, 0.9)             // 10% smaller
 * scaleBy2d(sprite, [1.2, 1])        // stretch width only
 * scaleBy2d(sprite, 1.1, { min: 24, max: 400 })
 * ```
 *
 * @param {unknown} object
 * @param {number|number[]|{ x?: number, y?: number }} factor
 * @param {{ min?: number, max?: number }} [opts]  clamp each axis (px)
 * @returns {[number, number]|null}
 */
export function scaleBy2d(object, factor, opts = {}) {
  const cur = getScale2d(object);
  const f = toSizeXY(factor);
  if (!cur || !f) return null;

  let w = cur[0] * f[0];
  let h = cur[1] * f[1];

  if (opts.min != null) {
    w = Math.max(opts.min, w);
    h = Math.max(opts.min, h);
  }
  if (opts.max != null) {
    w = Math.min(opts.max, w);
    h = Math.min(opts.max, h);
  }

  return scale2d(object, [w, h]);
}

export default scale2d;
