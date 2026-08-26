/**
 * HUD `opacity` on 2D elements (2dimagesprite, 2dbitmap, 2dtext).
 *
 * Sprite in back, rectangle in front at 0.5 so the character shows through.
 *
 * Run: npm run opacity
 */
import { engine } from '../lib/engine.js';

const WIN_W = 900;
const WIN_H = 600;

const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 17;
const SPRITE_FRAME = 2;
const PIXEL_SCALE = 14;

const RECT_X = 330;
const RECT_Y = 190;
const RECT_W = 400;
const RECT_H = 180;

const COLOR_FRAME = 0x0b1a24;
const COLOR_FILL = 0x4f8cff;

const RECT_COLS = 18;
const RECT_ROWS = 8;

/** Solid rectangle with a 1-pixel dark frame. */
const rectPixels = [];
for (let y = 0; y < RECT_ROWS; y++) {
  for (let x = 0; x < RECT_COLS; x++) {
    const edge = x === 0 || y === 0 || x === RECT_COLS - 1 || y === RECT_ROWS - 1;
    rectPixels.push(edge ? COLOR_FRAME : COLOR_FILL);
  }
}

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · opacity (HUD)',
    width: WIN_W,
    height: WIN_H,
    resizable: false,
    background: 0x0b0f14,
    lockPointerOnClick: false,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [3.2, 2.4, 5.5],
      lookAt: [0, 0.6, 0],
    },

    gameloop({ camera }) {
      const t = performance.now() * 0.0002;
      camera.position.x = Math.cos(t) * 5.5;
      camera.position.z = Math.sin(t) * 5.5;
      camera.position.y = 2.4;
      camera.lookAt(0, 0.6, 0);
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xfff2d6,
      intensity: 1.0,
      position: [4, 8, 5],
    },
  ],

  elements: [
    {
      type: '2dimagesprite',
      image: 'assets/char.png',
      position: [260, 140],
      pixelScale: PIXEL_SCALE,
      crop: {
        x: SPRITE_FRAME * SPRITE_WIDTH,
        y: 0,
        w: SPRITE_WIDTH,
        h: SPRITE_HEIGHT,
      },
      zIndex: 0,
    },
    {
      type: '2dbitmap',
      width: RECT_COLS,
      height: RECT_ROWS,
      pixels: rectPixels,
      position: [RECT_X, RECT_Y],
      size: [RECT_W, RECT_H],
      zIndex: 1,
      opacity: 0.5,
    },
    {
      type: '2dtext',
      text: 'opacity 0.5 · sprite shows through the rectangle',
      position: [24, 20],
      fontSize: 22,
      color: '#9fd3ff',
      padding: 6,
      zIndex: 2,
    },
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
      position: [0, 0.5, 0],
      rotation: [0, 0.35, 0],
      edges: { color: 0xc8dcff },
    },
    {
      type: 'geometry',
      geometry: 'plane',
      width: 20,
      height: 20,
      material: {
        type: 'standard',
        color: 0x1a222c,
        metalness: 0.05,
        roughness: 0.95,
        side: 'double',
      },
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },
  ],
});
