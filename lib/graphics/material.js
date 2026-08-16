import * as THREE from 'three';
import { createShaderMaterial } from './shader.js';

/**
 * Merge `def.shader` onto a material def (`type: 'shader'`).
 * `shader` on a 3D element wins over `material.type`.
 * @param {object} [def={}]
 * @returns {object|undefined}
 */
export function resolveMaterialDef(def = {}) {
  const material = def.material && typeof def.material === 'object' ? def.material : undefined;
  const shader = def.shader && typeof def.shader === 'object' ? def.shader : undefined;
  if (shader) {
    return { ...(material ?? {}), ...shader, type: 'shader' };
  }
  return material;
}

/**
 * Create a Three.js material from a JSON material definition.
 * @param {object} [def={}]
 * @returns {THREE.Material}
 */
export function createMaterial(def = {}) {
  const type = def.type ?? 'standard';
  const color = def.color ?? 0xffffff;
  const common = {
    color,
    wireframe: !!def.wireframe,
    transparent: !!def.transparent || (def.opacity != null && def.opacity < 1),
    opacity: def.opacity ?? 1,
    side: def.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
  };

  switch (type) {
    case 'shader':
    case 'shadermaterial':
    case 'glsl':
      return createShaderMaterial(def);
    case 'basic':
      return new THREE.MeshBasicMaterial(common);
    case 'phong':
      return new THREE.MeshPhongMaterial({
        ...common,
        shininess: def.shininess ?? 30,
      });
    case 'standard':
    default:
      return new THREE.MeshStandardMaterial({
        ...common,
        metalness: def.metalness ?? 0.2,
        roughness: def.roughness ?? 0.5,
      });
  }
}
