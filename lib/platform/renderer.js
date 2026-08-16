import * as THREE from 'three';

/**
 * Create a Three.js WebGLRenderer bound to the native GL context.
 * @param {object} surface  from createNativeWindow()
 * @param {number} [background=0x0b0f14]
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer(surface, background = 0x0b0f14) {
  const { canvas, gl, pixelWidth, pixelHeight } = surface;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    antialias: true,
    alpha: false,
  });
  renderer.setSize(pixelWidth, pixelHeight);
  renderer.setPixelRatio(1);
  renderer.setClearColor(background, 1);
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  return renderer;
}
