/**
 * Camera-fixed 2D HUD text (`type: '2dtext'`).
 *
 * - Label stays locked to the camera (screen space), not the world
 * - position is a 2D vector only (no 3D transform / no pushForce)
 * - Press T to cycle label text
 * - Press V to toggle visible
 * - WASD/arrows + mouse still move the camera; HUD text stays put on screen
 *
 * Run: npm run text2d
 */
import { engine } from '../lib/engine.js';

const LABELS = ['HUD · 2dtext', 'Fixed on camera', 'position: [x, y]', 'Press T / V'];
let labelIndex = 0;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · 2D text (HUD)',
    width: 900,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [3.2, 2.4, 5.5],
      lookAt: [0, 0.6, 0],
    },

    gameloop({ controls, elements, camera, delta }) {
      // Orbit the camera a bit so it is obvious the label is screen-fixed
      const t = performance.now() * 0.00025;
      camera.position.x = Math.cos(t) * 5.5;
      camera.position.z = Math.sin(t) * 5.5;
      camera.position.y = 2.4;
      camera.lookAt(0, 0.6, 0);

      const hud = elements.find((e) => e.def?.type === '2dtext' || e.mount === 'camera');
      if (!hud) return;

      if (controls.keyboard.justPressed('t') && hud.setText) {
        labelIndex = (labelIndex + 1) % LABELS.length;
        hud.setText(LABELS[labelIndex]);
        console.log(`2dtext → "${LABELS[labelIndex]}"`);
      }

      if (controls.keyboard.justPressed('v')) {
        hud.visible = !hud.visible;
        console.log(`2dtext visible → ${hud.visible}`);
      }

      // Nudge screen-pixel position with IJKL (Cartesian, top-left origin)
      const step = 180 * delta; // px/s
      if (controls.keyboard.isDown('j')) {
        const [x, y] = hud.position;
        hud.position = [x - step, y];
      }
      if (controls.keyboard.isDown('l')) {
        const [x, y] = hud.position;
        hud.position = [x + step, y];
      }
      if (controls.keyboard.isDown('i')) {
        const [x, y] = hud.position;
        hud.position = [x, y - step]; // up = smaller y
      }
      if (controls.keyboard.isDown('k')) {
        const [x, y] = hud.position;
        hud.position = [x, y + step]; // down = larger y
      }
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.5 },
    {
      type: 'directional',
      color: 0xfff2d6,
      intensity: 1.2,
      position: [4, 8, 5],
    },
  ],

  elements: [
    {
      type: '2dtext',
      text: 'HUD · 2dtext',
      // Screen pixels: origin top-left, x→right, y↓down (engine maps to camera)
      position: [24, 20],
      fontSize: 40,
      color: '#7ee787',
      padding: 10,
      visible: true,
    },
    {
      type: '2dtext',
      text: 'T: cycle · V: hide · IJKL: move',
      position: [24, 560],
      fontSize: 22,
      color: '#9fb3c8',
      padding: 6,
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
