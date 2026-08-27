/**
 * HUD `mirrorX` / `mirrorY` on 2dimagesprite.
 *
 * Four copies of assets/char.png (walk frame):
 *   original · mirrorX · mirrorY · both
 *
 * Press X / Y to toggle the bottom-right sprite at runtime.
 *
 * Run: npm run mirror2d
 */
import { engine } from '../lib/engine.js';

const WIN_W = 900;
const WIN_H = 600;

const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 17;
const SPRITE_FRAME = 2;
const PIXEL_SCALE = 8;

const DISPLAY_W = SPRITE_WIDTH * PIXEL_SCALE;
const DISPLAY_H = SPRITE_HEIGHT * PIXEL_SCALE;

const COL_LEFT = 150;
const COL_RIGHT = 520;
const ROW_TOP = 90;
const ROW_BOTTOM = 310;
const LABEL_GAP = 8;

const crop = {
  x: SPRITE_FRAME * SPRITE_WIDTH,
  y: 0,
  w: SPRITE_WIDTH,
  h: SPRITE_HEIGHT,
};

function charSprite(id, position, { mirrorX = false, mirrorY = false } = {}) {
  return {
    id,
    type: '2dimagesprite',
    image: 'assets/char.png',
    position,
    pixelScale: PIXEL_SCALE,
    crop,
    mirrorX,
    mirrorY,
    zIndex: 1,
  };
}

function caption(id, text, spritePos) {
  return {
    id,
    type: '2dtext',
    text,
    position: [spritePos[0], spritePos[1] + DISPLAY_H + LABEL_GAP],
    fontSize: 20,
    color: '#9fd3ff',
    padding: 4,
    zIndex: 2,
  };
}

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · mirrorX / mirrorY (HUD)',
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

    gameloop({ camera, elements, controls }) {
      const t = performance.now() * 0.0002;
      camera.position.x = Math.cos(t) * 5.5;
      camera.position.z = Math.sin(t) * 5.5;
      camera.position.y = 2.4;
      camera.lookAt(0, 0.6, 0);

      const both = elements.find((e) => e.def?.id === 'both');
      const bothLabel = elements.find((e) => e.def?.id === 'both-label');
      if (!both) return;

      const { keyboard } = controls;
      if (keyboard.justPressed('x')) both.mirrorX = !both.mirrorX;
      if (keyboard.justPressed('y')) both.mirrorY = !both.mirrorY;

      if (bothLabel?.setText) {
        const mx = both.mirrorX ? 'X' : '·';
        const my = both.mirrorY ? 'Y' : '·';
        bothLabel.setText(`both ${mx}${my} · X/Y toggle`);
      }
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
    charSprite('original', [COL_LEFT, ROW_TOP]),
    caption('original-label', 'original', [COL_LEFT, ROW_TOP]),

    charSprite('flip-x', [COL_RIGHT, ROW_TOP], { mirrorX: true }),
    caption('flip-x-label', 'mirrorX', [COL_RIGHT, ROW_TOP]),

    charSprite('flip-y', [COL_LEFT, ROW_BOTTOM], { mirrorY: true }),
    caption('flip-y-label', 'mirrorY', [COL_LEFT, ROW_BOTTOM]),

    charSprite('both', [COL_RIGHT, ROW_BOTTOM], { mirrorX: true, mirrorY: true }),
    caption('both-label', 'both XY · X/Y toggle', [COL_RIGHT, ROW_BOTTOM]),

    {
      type: '2dtext',
      text: 'mirrorX / mirrorY · 2dimagesprite',
      position: [24, 20],
      fontSize: 22,
      color: '#9fd3ff',
      padding: 6,
      zIndex: 3,
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
