import * as THREE from 'three';
import { vec3 } from '../utils/math.js';

/**
 * Create a Three.js light from a JSON light definition.
 * @param {object} def
 * @returns {THREE.Light}
 */
export function createLight(def) {
  const color = def.color ?? 0xffffff;
  const intensity = def.intensity ?? 1;

  switch (def.type) {
    case 'directional': {
      const light = new THREE.DirectionalLight(color, intensity);
      const [x, y, z] = vec3(def.position, [5, 5, 5]);
      light.position.set(x, y, z);
      return light;
    }
    case 'hemisphere': {
      return new THREE.HemisphereLight(
        def.skyColor ?? color,
        def.groundColor ?? 0x444444,
        intensity,
      );
    }
    case 'ambient':
    default:
      return new THREE.AmbientLight(color, intensity);
  }
}

/**
 * Add configured lights to a scene (or defaults if none provided).
 * @param {THREE.Scene} scene
 * @param {object[] | undefined} lightDefs
 */
export function addLightsToScene(scene, lightDefs) {
  const lights = Array.isArray(lightDefs) ? lightDefs : [];

  if (lights.length === 0) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(4, 6, 3);
    scene.add(key);
    return;
  }

  for (const lightDef of lights) {
    scene.add(createLight(lightDef));
  }
}
