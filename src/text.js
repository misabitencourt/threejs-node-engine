/**
 * 3D text element via Three.js FontLoader + TextGeometry (Helvetiker).
 *
 * - Floating title above a cube
 * - Press T to cycle label text
 * - Text slowly yaws (rotationSpeed)
 *
 * Run: npm run text
 */
import { engine } from '../lib/engine.js';

const LABELS = ['Hello Three', 'Node + GL', 'type: text', 'Press T'];
let labelIndex = 0;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · 3D text',
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

    gameloop({ controls, elements }) {
      if (!controls.keyboard.justPressed('t')) return;
      const textEl = elements.find((e) => e.def?.type === 'text' || e.setText);
      if (!textEl?.setText) return;
      labelIndex = (labelIndex + 1) % LABELS.length;
      textEl.setText(LABELS[labelIndex]);
      console.log(`Text → "${LABELS[labelIndex]}"`);
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
    {
      type: 'directional',
      color: 0x88aaff,
      intensity: 0.35,
      position: [-3, 2, -2],
    },
  ],

  elements: [
    {
      type: 'text',
      text: 'Hello Three',
      // Uses three/examples/fonts/helvetiker_regular.typeface.json by default
      size: 0.45,
      height: 0.12,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      center: true,
      material: {
        type: 'standard',
        color: 0xffc857,
        metalness: 0.35,
        roughness: 0.35,
      },
      position: [0, 1.6, 0],
      rotation: [0, 0.35, 0],
      rotationSpeed: [0, 0.4, 0],
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
