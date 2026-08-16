/**
 * Camera-fixed 2D sprite + scale2d helper (screen pixel size).
 *
 * Same idea as `npm run scale`, but for a Cartesian HUD sprite:
 *   Hold F — scale up (larger on screen)
 *   Hold Q — scale down
 *
 * Sheet: assets/char.png (walk frame), position in screen pixels.
 *
 * Run: npm run scale2d
 */
import { engine } from '../lib/engine.js';
import { scaleBy2d, getScale2d } from '../lib/utils/scale2d.js';

const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 17;
const PIXEL_SCALE = 4;
const SCALE_SPEED = 1.35;
const SCALE_MIN = 24; // px (shortest side clamp via each axis)
const SCALE_MAX = 320;

let logged = false;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · scale2d (F up · Q down)',
    width: 900,
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

    gameloop({ delta, elements, controls, camera }) {
      // Slow orbit so it is obvious the sprite is camera-fixed
      const t = performance.now() * 0.00025;
      camera.position.x = Math.cos(t) * 4;
      camera.position.z = Math.sin(t) * 4;
      camera.position.y = 2.2;
      camera.lookAt(0, 0, 0);

      const sprite = elements.find((e) => e.def?.type === '2dimagesprite');
      const label = elements.find((e) => e.def?.id === 'scale-label');
      if (!sprite) return;

      const { keyboard } = controls;

      if (keyboard.isDown('f')) {
        const factor = Math.pow(SCALE_SPEED, delta);
        scaleBy2d(sprite, factor, { min: SCALE_MIN, max: SCALE_MAX });
      }
      if (keyboard.isDown('q')) {
        const factor = Math.pow(1 / SCALE_SPEED, delta);
        scaleBy2d(sprite, factor, { min: SCALE_MIN, max: SCALE_MAX });
      }

      const sz = getScale2d(sprite);
      if (label?.setText && sz) {
        label.setText(`size ${Math.round(sz[0])}×${Math.round(sz[1])} px · F/Q`);
      }

      if (!logged) {
        logged = true;
        console.log('Hold F to scale up, Q to scale down (2d screen pixels)');
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
  ],

  elements: [
    // Background cube (world space) — spins via rotationSpeed
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

    // Camera-fixed 2D sprite (Cartesian screen px)
    {
      type: '2dimagesprite',
      image: 'assets/char.png',
      position: [390, 250], // top-left origin, y down
      pixelScale: PIXEL_SCALE,
      crop: {
        x: 2 * SPRITE_WIDTH,
        y: 0,
        w: SPRITE_WIDTH,
        h: SPRITE_HEIGHT,
      },
      visible: true,
    },

    {
      id: 'scale-label',
      type: '2dtext',
      text: 'size · F/Q',
      position: [16, 16],
      fontSize: 22,
      color: '#9fd3ff',
      padding: 6,
    },
  ],
});
