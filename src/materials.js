/**
 * Many cubes — textures, raw colors, glossy / glare materials, transparency.
 *
 * Includes one almost-transparent blue cube (opacity 0.2).
 *
 * Run: npm run materials
 */
import { engine } from '../lib/engine.js';

const SIZE = 0.85;
const GAP = 1.35;
const ROWS = 3;
const COLS = 5;

/** @type {object[]} material recipes cycled across the grid */
const RECIPES = [
  // Brick texture — matte
  {
    material: { type: 'standard', metalness: 0.05, roughness: 0.9 },
    texture: { image: 'assets/brick.jpeg', imageFill: 'fill' },
  },
  // Brick tiled + warm raw tint
  {
    material: { type: 'standard', metalness: 0.1, roughness: 0.75 },
    texture: {
      image: 'assets/brick.jpeg',
      imageFill: 'tile',
      repeat: [2, 2],
      color: 0xffccaa,
    },
  },
  // Raw solid colors
  {
    material: {
      type: 'standard',
      color: 0xff6b6b,
      metalness: 0.15,
      roughness: 0.55,
    },
  },
  {
    material: {
      type: 'standard',
      color: 0x7ee787,
      metalness: 0.1,
      roughness: 0.6,
    },
  },
  {
    material: {
      type: 'standard',
      color: 0xffc857,
      metalness: 0.2,
      roughness: 0.45,
    },
  },
  // Metallic glare (low roughness)
  {
    material: {
      type: 'standard',
      color: 0xc0c8d8,
      metalness: 0.95,
      roughness: 0.12,
    },
  },
  {
    material: {
      type: 'standard',
      color: 0xffd700,
      metalness: 1,
      roughness: 0.18,
    },
  },
  {
    material: {
      type: 'standard',
      color: 0xb8f2ff,
      metalness: 0.85,
      roughness: 0.08,
    },
  },
  // Phong “glare” (shininess)
  {
    material: {
      type: 'phong',
      color: 0xff8fab,
      shininess: 120,
    },
  },
  {
    material: {
      type: 'phong',
      color: 0x9b5de5,
      shininess: 90,
    },
  },
  // Brick + metallic-ish
  {
    material: { type: 'standard', metalness: 0.55, roughness: 0.35 },
    texture: {
      image: 'assets/brick.jpeg',
      imageFill: 'fill',
      color: 0xccddee,
    },
  },
  // Basic flat color
  {
    material: { type: 'basic', color: 0x56cfe1 },
  },
  // Almost transparent blue (requested)
  {
    material: {
      type: 'standard',
      color: 0x3a86ff,
      metalness: 0.05,
      roughness: 0.25,
      transparent: true,
      opacity: 0.2,
      side: 'double',
    },
  },
  // More textured
  {
    material: { type: 'standard', metalness: 0.0, roughness: 1 },
    texture: {
      image: 'assets/brick.jpeg',
      imageFill: 'tile',
      repeat: [3, 3],
      raw: 0xa8dadc,
    },
  },
  // Chrome-like purple
  {
    material: {
      type: 'standard',
      color: 0x7b2cbf,
      metalness: 0.9,
      roughness: 0.15,
    },
  },
];

/** @type {object[]} */
const cubes = [];
let recipeIndex = 0;

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const recipe = RECIPES[recipeIndex % RECIPES.length];
    recipeIndex++;

    const x = (col - (COLS - 1) / 2) * GAP;
    const z = (row - (ROWS - 1) / 2) * GAP;
    const y = SIZE / 2;

    cubes.push({
      type: 'geometry',
      geometry: 'box',
      width: SIZE,
      height: SIZE,
      depth: SIZE,
      material: recipe.material,
      ...(recipe.texture ? { texture: recipe.texture } : {}),
      position: [x, y, z],
      rotation: [0, (col + row) * 0.15, 0],
      rotationSpeed: [0.15 + row * 0.05, 0.25 + col * 0.04, 0],
      edges:
        recipe.material?.opacity != null && recipe.material.opacity < 1
          ? { color: 0x9ecbff }
          : { color: 0x2a3340 },
    });
  }
}

// Put the transparent blue near the front center for visibility (swap if needed)
const transparentIdx = cubes.findIndex(
  (c) => c.material?.opacity === 0.2 && c.material?.color === 0x3a86ff,
);
if (transparentIdx >= 0) {
  // Move transparent cube to front row center
  cubes[transparentIdx].position = [0, SIZE / 2 + 0.01, (ROWS - 1) * 0.5 * GAP + GAP * 0.35];
  cubes[transparentIdx].rotationSpeed = [0.2, 0.45, 0];
}

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · materials showcase',
    width: 1000,
    height: 640,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 48,
      near: 0.1,
      far: 100,
      position: [0, 4.2, 9.5],
      lookAt: [0, 0.6, 0],
    },

    gameloop({ delta, camera }) {
      // Slow orbit around the showcase
      const t = performance.now() * 0.00012;
      const r = 9.5;
      camera.position.x = Math.sin(t) * r;
      camera.position.z = Math.cos(t) * r;
      camera.position.y = 3.8 + Math.sin(t * 0.7) * 0.4;
      camera.lookAt(0, 0.7, 0);
      void delta;
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.4 },
    {
      type: 'directional',
      color: 0xfff5e6,
      intensity: 1.35,
      position: [6, 10, 5],
    },
    {
      type: 'directional',
      color: 0x88aaff,
      intensity: 0.45,
      position: [-5, 3, -4],
    },
    {
      type: 'directional',
      color: 0xffffff,
      intensity: 0.55,
      position: [0, 4, 8],
    },
  ],

  elements: [
    ...cubes,
    // Ground
    {
      type: 'geometry',
      geometry: 'plane',
      width: 18,
      height: 18,
      material: {
        type: 'standard',
        color: 0x141a22,
        metalness: 0.05,
        roughness: 0.95,
        side: 'double',
      },
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },
  ],
});
