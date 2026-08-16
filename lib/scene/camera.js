import * as THREE from 'three';
import { vec3 } from '../utils/math.js';

/**
 * Create the main perspective camera from window.camera config.
 * Camera is a window property, not a scene object.
 *
 * @param {object} [camCfg={}]
 * @param {number} aspect
 * @returns {THREE.PerspectiveCamera}
 */
export function createCamera(camCfg = {}, aspect = 1) {
  const camera = new THREE.PerspectiveCamera(
    camCfg.fov ?? 50,
    aspect,
    camCfg.near ?? 0.1,
    camCfg.far ?? 100,
  );

  const [cx, cy, cz] = vec3(camCfg.position, [0, 0, 5]);
  camera.position.set(cx, cy, cz);

  const [lx, ly, lz] = vec3(camCfg.lookAt, [0, 0, 0]);
  camera.lookAt(lx, ly, lz);

  return camera;
}
