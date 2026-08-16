/**
 * OpenGL cube via Three.js on Node.js (no browser / no frontend).
 *
 * Stack:
 *   @kmamal/sdl     → native window
 *   @kmamal/gl      → WebGL1 context bound to that window (OpenGL)
 *   three (r162)    → scene graph + WebGLRenderer (WebGL1-compatible)
 *
 * Note: @kmamal/gl is WebGL1-only; three ≥ r163 assumes WebGL2 APIs
 * (e.g. texImage3D), so we pin three@0.162.x for a pure Node/OpenGL path.
 */
import sdl from '@kmamal/sdl';
import createContext from '@kmamal/gl';
import * as THREE from 'three';

const WIDTH = 800;
const HEIGHT = 600;

// Native OpenGL window (replaces PNG dump)
const window = sdl.video.createWindow({
  title: 'threejs-node-engine · cube',
  width: WIDTH,
  height: HEIGHT,
  resizable: false,
  opengl: true,
});

const { pixelWidth, pixelHeight, native } = window;
const gl = createContext(pixelWidth, pixelHeight, {
  window: native,
  antialias: true,
  depth: true,
  stencil: false,
  alpha: false,
});

if (!gl) {
  console.error('Failed to create WebGL context for window.');
  process.exit(1);
}

// Minimal canvas stub so WebGLRenderer can bind the context
const canvas = {
  width: pixelWidth,
  height: pixelHeight,
  style: {},
  addEventListener() {},
  removeEventListener() {},
  getContext(type) {
    if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
      return gl;
    }
    return null;
  },
};

// --- Three.js scene (same API as browser) ---
const renderer = new THREE.WebGLRenderer({
  canvas,
  context: gl,
  antialias: true,
  alpha: false,
});
renderer.setSize(pixelWidth, pixelHeight);
renderer.setPixelRatio(1);
renderer.setClearColor(0x0b0f14, 1);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, pixelWidth / pixelHeight, 0.1, 100);
camera.position.set(2.4, 1.8, 2.8);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(4, 6, 3);
scene.add(key);

const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
fill.position.set(-3, 1, -2);
scene.add(fill);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({
  color: 0x4f8cff,
  metalness: 0.25,
  roughness: 0.4,
});
const cube = new THREE.Mesh(geometry, material);
cube.rotation.set(0.45, 0.7, 0.15);
scene.add(cube);

const edges = new THREE.LineSegments(
  new THREE.EdgesGeometry(geometry),
  new THREE.LineBasicMaterial({ color: 0xc8dcff }),
);
cube.add(edges);

// 60 FPS loop with delta (seconds) available for frame-independent motion
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;
const clock = new THREE.Clock();

let running = true;
let frameTimer = null;

window.on('close', () => {
  running = false;
  if (frameTimer !== null) clearTimeout(frameTimer);
});

function frame() {
  if (!running || window.destroyed) return;

  const tickStart = performance.now();
  const delta = clock.getDelta(); // seconds since last frame

  // rad/s × delta → smooth 60fps (and any real rate)
  cube.rotation.x += 0.5 * delta;
  cube.rotation.y += 0.75 * delta;

  renderer.render(scene, camera);
  gl.swap();

  const spent = performance.now() - tickStart;
  frameTimer = setTimeout(frame, Math.max(0, FRAME_MS - spent));
}

console.log(
  `OpenGL window ${pixelWidth}x${pixelHeight} @ ${TARGET_FPS}fps — close the window to exit.`,
);
frame();
