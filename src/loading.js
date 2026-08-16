/**
 * Loading screen: start with "Loading..." 2dtext, then after 5s show the cube scene.
 *
 * Run: npm run loading
 */
import { engine } from '../lib/engine.js';

const WIN_W = 800;
const WIN_H = 600;

/**
 * Simulated async load. Resolves after `ms` milliseconds.
 * @param {number} [ms]
 * @returns {Promise<void>}
 */
function loadScene(ms = 5000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Same cube as `src/cube.js` — added once loadScene() finishes. */
const CUBE = {
  type: 'geometry',
  geometry: 'box',
  width: 1,
  height: 1,
  depth: 1,
  material: {
    type: 'standard',
    color: 0x4f8cff,
    metalness: 0.25,
    roughness: 0.4,
  },
  position: [0, 0, 0],
  rotation: [0.45, 0.7, 0.15],
  edges: { color: 0xc8dcff },
  rotationSpeed: [0.5, 0.75, 0],
};

const app = await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · loading',
    width: WIN_W,
    height: WIN_H,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [2.4, 1.8, 2.8],
      lookAt: [0, 0, 0],
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.4 },
    {
      type: 'directional',
      color: 0xffffff,
      intensity: 1.2,
      position: [4, 6, 3],
    },
    {
      type: 'directional',
      color: 0x88aaff,
      intensity: 0.35,
      position: [-3, 1, -2],
    },
  ],

  elements: [
    {
      id: 'loading',
      type: '2dtext',
      text: 'Loading...',
      position: [WIN_W / 2, WIN_H / 2],
      anchor: [0.5, 0.5],
      fontSize: 48,
      color: '#e8eef7',
      padding: 12,
    },
  ],
});

await loadScene(5000);

const loading = app.elements.find((e) => e.def?.id === 'loading');
if (loading) loading.visible = false;

await app.addElement(CUBE);
console.log('Loading done → cube scene');
