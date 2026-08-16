import { vec3 } from '../utils/math.js';

/**
 * Apply position / rotation / scale from a JSON object definition.
 * @param {import('three').Object3D} obj3d
 * @param {object} def
 */
export function applyTransform(obj3d, def) {
  const [px, py, pz] = vec3(def.position);
  const [rx, ry, rz] = vec3(def.rotation);
  const [sx, sy, sz] = vec3(def.scale, [1, 1, 1]);
  obj3d.position.set(px, py, pz);
  obj3d.rotation.set(rx, ry, rz);
  obj3d.scale.set(sx, sy, sz);
}
