/**
 * Geometry texture demo — brick image with different imageFill modes.
 *
 * Run: npm run texture
 */
import { engine } from '../lib/engine.js';

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · texture (brick)',
    width: 900,
    height: 600,
    resizable: false,
    background: 0x1a1410,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [4.2, 2.4, 5.2],
      lookAt: [0, 0.5, 0],
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.55 },
    {
      type: 'directional',
      color: 0xfff2e0,
      intensity: 1.2,
      position: [5, 8, 4],
    },
    {
      type: 'directional',
      color: 0x88aaff,
      intensity: 0.3,
      position: [-4, 2, -3],
    },
  ],

  elements: [
    // Stretched / fill brick on a cube
    {
      type: 'geometry',
      geometry: 'box',
      width: 1.4,
      height: 1.4,
      depth: 1.4,
      material: {
        type: 'standard',
        metalness: 0.05,
        roughness: 0.85,
      },
      texture: {
        image: 'assets/brick.jpeg',
        imageFill: 'fill',
      },
      position: [-1.6, 0.7, 0],
      rotation: [0, 0.4, 0],
      rotationSpeed: [0, 0.35, 0],
    },
    // Tiled brick (repeat UVs)
    {
      type: 'geometry',
      geometry: 'box',
      width: 1.4,
      height: 1.4,
      depth: 1.4,
      material: {
        type: 'standard',
        metalness: 0.05,
        roughness: 0.85,
      },
      texture: {
        image: 'assets/brick.jpeg',
        imageFill: 'tile',
        repeat: [2, 2],
      },
      position: [1.6, 0.7, 0],
      rotation: [0, -0.4, 0],
      rotationSpeed: [0, 0.35, 0],
    },
    // Ground: tiled bricks + raw color tint
    {
      type: 'geometry',
      geometry: 'plane',
      width: 12,
      height: 12,
      material: {
        type: 'standard',
        metalness: 0.02,
        roughness: 0.95,
        side: 'double',
      },
      texture: {
        color: 0xdddddd,
        image: 'assets/brick.jpeg',
        imageFill: 'tile',
        repeat: [6, 6],
      },
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },
  ],
});
