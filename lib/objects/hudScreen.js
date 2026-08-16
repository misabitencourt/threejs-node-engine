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
