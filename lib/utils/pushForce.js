import * as THREE from 'three';

/**
 * Read a Vector3-like value as [x, y, z].
 * @param {unknown} value
 * @returns {[number, number, number]|null}
 */
function toXYZ(value) {
  if (value == null) return null;
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  }
  if (typeof value === 'object') {
    const o = /** @type {{ x?: number, y?: number, z?: number }} */ (value);
    if ('x' in o || 'y' in o || 'z' in o) {
      return [Number(o.x) || 0, Number(o.y) || 0, Number(o.z) || 0];
    }
  }
  return null;
}

/**
 * Transform a local-space push force into world space using an object's rotation.
 *
 * The object must provide `rotation` (Euler-like `{x,y,z}`) and/or `quaternion`.
 * `position` is accepted for a uniform object shape but is not required for the math.
 *
 * Local axes follow Three.js conventions:
 *   +X right · +Y up · -Z forward
 *
 * @param {{ position?: unknown, rotation?: { x: number, y: number, z: number }, quaternion?: { x: number, y: number, z: number, w: number } }} object
 * @param {number[]|{ x?: number, y?: number, z?: number }|null|undefined} localForce
 *   Push in the object's local space (e.g. `[0, 0, -6]` = forward at 6 units/s).
 * @returns {number[]|null}
 *   World-space push `[x, y, z]`, or `null` if force is missing / zero.
 *
 * @example
 *   // Local forward relative to cube.rotation → world pushForce
 *   cube.pushForce = pushForceFromRotation(cube.root, [0, 0, -MOVE_SPEED]);
 */
export function pushForceFromRotation(object, localForce) {
  const local = toXYZ(localForce);
  if (!local) return null;

  const [lx, ly, lz] = local;
  if (lx === 0 && ly === 0 && lz === 0) return null;

  if (!object || (object.rotation == null && object.quaternion == null)) {
    // No orientation — treat local as already world
    return [lx, ly, lz];
  }

  const v = new THREE.Vector3(lx, ly, lz);

  if (object.quaternion != null && object.quaternion.w != null) {
    const q = object.quaternion;
    v.applyQuaternion(
      q.isQuaternion ? q : new THREE.Quaternion(q.x, q.y, q.z, q.w),
    );
  } else if (object.rotation != null) {
    const r = object.rotation;
    const euler = r.isEuler
      ? r
      : new THREE.Euler(r.x ?? 0, r.y ?? 0, r.z ?? 0, r.order ?? 'XYZ');
    v.applyEuler(euler);
  }

  return [v.x, v.y, v.z];
}

/** @deprecated use pushForceFromRotation */
export const applyPushForce = pushForceFromRotation;
