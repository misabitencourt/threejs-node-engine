/**
 * Small math helpers for JSON-friendly vectors.
 */

/**
 * @param {unknown} arr
 * @param {number[]} [fallback=[0,0]]
 * @returns {[number, number]}
 */
export function vec2(arr, fallback = [0, 0]) {
  if (Array.isArray(arr) && arr.length >= 2) {
    return [Number(arr[0]) || 0, Number(arr[1]) || 0];
  }
  if (arr && typeof arr === 'object') {
    const o = /** @type {{ x?: number, y?: number }} */ (arr);
    if (o.x != null || o.y != null) {
      return [Number(o.x) || 0, Number(o.y) || 0];
    }
  }
  return /** @type {[number, number]} */ ([fallback[0], fallback[1]]);
}

/**
 * @param {unknown} arr
 * @param {number[]} [fallback=[0,0,0]]
 * @returns {[number, number, number]}
 */
export function vec3(arr, fallback = [0, 0, 0]) {
  if (!Array.isArray(arr) || arr.length < 3) {
    return /** @type {[number, number, number]} */ ([fallback[0], fallback[1], fallback[2]]);
  }
  return [arr[0], arr[1], arr[2]];
}
