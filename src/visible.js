/**
 * Two boxes: hold F to show the second, release to hide it.
 *
 * Run: npm run visible
 */
import { engine } from '../lib/engine.js';

engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · visible (hold F)',
    width: 800,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [3.5, 2.2, 4],
      lookAt: [0, 0.5, 0],
    },

    gameloop({ controls, elements }) {
      // Second box: visible only while F is held
      if (elements[1]) {
        elements[1].visible = controls.keyboard.isDown('f');
      }
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xffffff,
      intensity: 1.15,
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
      type: 'geometry',
      geometry: 'box',
      width: 1,
      height: 1,
      depth: 1,
      visible: true,
      material: {
        type: 'standard',
        color: 0x4f8cff,
        metalness: 0.25,
        roughness: 0.4,
      },
      position: [-0.9, 0.5, 0],
      rotation: [0, 0.35, 0],
      edges: { color: 0xc8dcff },
    },
    {
      type: 'geometry',
      geometry: 'box',
      width: 1,
      height: 1,
      depth: 1,
      // starts hidden; window.gameloop sets visible while F is pressed
      visible: false,
      material: {
        type: 'standard',
        color: 0xff6b6b,
        metalness: 0.25,
        roughness: 0.4,
      },
      position: [0.9, 0.5, 0],
      rotation: [0, -0.35, 0],
      edges: { color: 0xffc9c9 },
    },
  ],
});
