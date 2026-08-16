/**
 * 3D object scale helpers.
 *
 * Works with:
 *   - THREE.Object3D (`.scale` Vector3)
 *   - Runtime elements with `.root.scale`
 *   - Plain `{ scale: { x, y, z } }` objects
 */

/**
 * @param {unknown} value
 * @returns {[number, number, number]|null}
 */
function toScaleXYZ(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [value, value, value];
  }
  if (Array.isArray(value) && value.length >= 1) {
    if (value.length === 1) {
      const s = Number(value[0]) || 0;
      return [s, s, s];
    }
    if (value.length === 2) {
      return [Number(value[0]) || 0, Number(value[1]) || 0, 1];
    }
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
 * Resolve the mutable scale target on an object / runtime element.
 * @param {unknown} object
 * @returns {{ x: number, y: number, z: number }|null}
 */
function resolveScaleTarget(object) {
  if (object == null || typeof object !== 'object') return null;
  const o = /** @type {Record<string, any>} */ (object);

  // Runtime element: prefer mesh root
  if (o.root?.scale != null) return o.root.scale;
  if (o.scale != null && typeof o.scale === 'object') return o.scale;
  return null;
}

/**
 * Read current scale as `[x, y, z]`.
 * @param {unknown} object
 * @returns {[number, number, number]|null}
 */
export function getScale(object) {
  const s = resolveScaleTarget(object);
  if (!s) return null;
  return [Number(s.x) || 0, Number(s.y) || 0, Number(s.z) || 0];
}

/**
 * Set absolute scale on a 3D object.
 *
 * ```js
 * scale3d(mesh, 2)           // uniform 2,2,2
 * scale3d(mesh, [2, 1, 0.5])
 * scale3d(mesh, { x: 2, y: 2, z: 2 })
 * scale3d(element, 1.5)      // runtime element with .root
 * ```
 *
 * @param {unknown} object  Object3D, runtime element, or `{ scale }`
 * @param {number|number[]|{ x?: number, y?: number, z?: number }} scale
 * @returns {[number, number, number]|null} applied scale, or null if object invalid
 */
export function scale3d(object, scale) {
  const target = resolveScaleTarget(object);
  const xyz = toScaleXYZ(scale);
  if (!target || !xyz) return null;

  target.x = xyz[0];
  target.y = xyz[1];
  target.z = xyz[2];
  return [target.x, target.y, target.z];
}

/**
 * Multiply current scale by a factor (uniform number or per-axis vector).
 *
 * ```js
 * scaleBy(mesh, 1.1)          // 10% larger
 * scaleBy(mesh, 0.9)          // 10% smaller
 * scaleBy(mesh, [1.2, 1, 1])  // stretch X only
 * ```
 *
 * @param {unknown} object
 * @param {number|number[]|{ x?: number, y?: number, z?: number }} factor
 * @param {{ min?: number, max?: number }} [opts]  optional uniform clamps per axis
 * @returns {[number, number, number]|null}
 */
export function scaleBy(object, factor, opts = {}) {
  const target = resolveScaleTarget(object);
  const f = toScaleXYZ(factor);
  if (!target || !f) return null;

  let x = target.x * f[0];
  let y = target.y * f[1];
  let z = target.z * f[2];

  if (opts.min != null) {
    const m = opts.min;
    x = Math.max(m, x);
    y = Math.max(m, y);
    z = Math.max(m, z);
  }
  if (opts.max != null) {
    const m = opts.max;
    x = Math.min(m, x);
    y = Math.min(m, y);
    z = Math.min(m, z);
  }

  target.x = x;
  target.y = y;
  target.z = z;
  return [x, y, z];
}

export default scale3d;
