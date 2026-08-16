/**
 * Cube example driven by the engine core (declarative JSON config).
 *
 * Run: npm run cube
 */
import { engine } from '../lib/engine.js';

engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · cube (engine)',
    width: 800,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    // Main camera lives on window — not in elements[]
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
      // rad/s — engine applies × delta each frame
      rotationSpeed: [0.5, 0.75, 0],
    },
  ],
});
