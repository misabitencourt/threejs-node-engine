/**
 * Cube (default look) + scale3d helper.
 *
 * Hold F — scale up
 * Hold Q — scale down
 *
 * Run: npm run scale
 */
import { engine } from '../lib/engine.js';
import { scaleBy } from '../lib/utils/scale.js';

const SCALE_SPEED = 1.35; // factor per second while key held (e^rate-ish via pow)
const SCALE_MIN = 0.25;
const SCALE_MAX = 4;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · scale (F up · Q down)',
    width: 800,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [2.4, 1.8, 2.8],
      lookAt: [0, 0, 0],
    },

    gameloop({ delta, elements, controls }) {
      const cube = elements[0];
      if (!cube) return;

      const { keyboard } = controls;

      // Continuous scale while held: factor = rate^delta ≈ 1 + rate*delta for small steps
      if (keyboard.isDown('f')) {
        const factor = Math.pow(SCALE_SPEED, delta);
        scaleBy(cube, factor, { min: SCALE_MIN, max: SCALE_MAX });
      }
      if (keyboard.isDown('q')) {
        const factor = Math.pow(1 / SCALE_SPEED, delta);
        scaleBy(cube, factor, { min: SCALE_MIN, max: SCALE_MAX });
      }
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
      rotationSpeed: [0.5, 0.75, 0],
    },
  ],
});
