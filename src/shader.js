/**
 * Many cubes, each with a self-illuminating ShaderMaterial (no scene lights).
 *
 * Default engine shader: unlit color + facing/rim + time pulse.
 *
 * Run: npm run shader
 */
import { engine } from '../lib/engine.js';

const SIZE = 0.72;
const GAP = 1.2;
const ROWS = 6;
const COLS = 8;

const COLORS = [
  0xff4d6d, 0xff8fab, 0xffc857, 0xffe066, 0x7ee787, 0x06d6a0, 0x56cfe1, 0x4cc9f0,
  0x4f8cff, 0x4361ee, 0x9b5de5, 0xc77dff, 0xf72585, 0xff6b35, 0x80ed99, 0x64dfdf,
];

/** @type {object[]} */
const cubes = [];

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const i = row * COLS + col;
    const x = (col - (COLS - 1) / 2) * GAP;
    const z = (row - (ROWS - 1) / 2) * GAP;
    const y = SIZE / 2 + Math.sin(i * 0.55) * 0.12;

    cubes.push({
      type: 'geometry',
      geometry: 'box',
      width: SIZE,
      height: SIZE,
      depth: SIZE,
      material: {
        type: 'shader',
        color: COLORS[i % COLORS.length],
        intensity: 0.85 + (i % 5) * 0.12,
        uniforms: {
          uPhase: i * 0.41,
        },
      },
      position: [x, y, z],
      rotation: [0.12 * row, 0.18 * col, 0],
      rotationSpeed: [0.12 + row * 0.03, 0.22 + col * 0.025, 0],
    });
  }
}

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · shader (self-illumination)',
    width: 1100,
    height: 680,
    resizable: false,
    background: 0x05070b,

    camera: {
      fov: 46,
      near: 0.1,
      far: 100,
      position: [0, 5.4, 12],
      lookAt: [0, 0.5, 0],
    },

    gameloop({ camera }) {
      const t = performance.now() * 0.0001;
      const r = 12;
      camera.position.x = Math.sin(t) * r;
      camera.position.z = Math.cos(t) * r;
      camera.position.y = 4.8 + Math.sin(t * 0.8) * 0.5;
      camera.lookAt(0, 0.55, 0);
    },
  },

  // Dim ambient only — cubes glow from their shaders, not from lights
  lights: [{ type: 'ambient', color: 0x6a7a8a, intensity: 0.05 }],

  elements: [
    ...cubes,
    {
      type: 'geometry',
      geometry: 'plane',
      width: 22,
      height: 16,
      material: {
        type: 'basic',
        color: 0x0a0d12,
        side: 'double',
      },
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },
  ],
});
