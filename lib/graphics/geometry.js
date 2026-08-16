import * as THREE from 'three';

/**
 * Create a Three.js BufferGeometry from a JSON geometry definition.
 * @param {object} def
 * @returns {THREE.BufferGeometry}
 */
export function createGeometry(def) {
  const g = def.geometry ?? 'box';

  switch (g) {
    case 'box':
      return new THREE.BoxGeometry(
        def.width ?? 1,
        def.height ?? 1,
        def.depth ?? 1,
        def.widthSegments ?? 1,
        def.heightSegments ?? 1,
        def.depthSegments ?? 1,
      );
    case 'sphere':
      return new THREE.SphereGeometry(
        def.radius ?? 0.5,
        def.widthSegments ?? 32,
        def.heightSegments ?? 16,
      );
    case 'plane':
      return new THREE.PlaneGeometry(
        def.width ?? 1,
        def.height ?? 1,
        def.widthSegments ?? 1,
        def.heightSegments ?? 1,
      );
    case 'cylinder':
      return new THREE.CylinderGeometry(
        def.radiusTop ?? def.radius ?? 0.5,
        def.radiusBottom ?? def.radius ?? 0.5,
        def.height ?? 1,
        def.radialSegments ?? 16,
      );
    case 'cone':
      return new THREE.ConeGeometry(def.radius ?? 0.5, def.height ?? 1, def.radialSegments ?? 16);
    default:
      throw new Error(`Unknown geometry: "${g}"`);
  }
}
