/**
 * Blue cube scene manipulation: press F to duplicate the last cube
 * and place it at x + cubeSize.
 *
 * Run: npm run duplicate
 */
import { engine } from '../lib/engine.js';

const CUBE_SIZE = 1;

const blueCube = {
  type: 'geometry',
  geometry: 'box',
  width: CUBE_SIZE,
  height: CUBE_SIZE,
  depth: CUBE_SIZE,
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
};

/** Tracks the rightmost cube X so async spawns still chain correctly. */
let lastCubeX = blueCube.position[0];
let cubeCount = 1;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · duplicate (press F)',
    width: 900,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 50,
      near: 0.1,
      far: 200,
      position: [4, 3, 8],
      lookAt: [2, 0, 0],
    },

    gameloop({ controls, elements, addElement }) {
      if (!controls.keyboard.justPressed('f')) return;

      const last = elements[elements.length - 1];
      if (!last) return;

      const size = last.def?.width ?? last.def?.depth ?? CUBE_SIZE;
      const x = lastCubeX + size;
      lastCubeX = x;
      cubeCount += 1;

      // Clone the last cube's definition, shift X by one cube size
      const nextDef = {
        ...last.def,
        material: last.def?.material ? { ...last.def.material } : { ...blueCube.material },
        edges:
          last.def?.edges && typeof last.def.edges === 'object'
            ? { ...last.def.edges }
            : last.def?.edges,
        rotationSpeed: Array.isArray(last.def?.rotationSpeed)
          ? [...last.def.rotationSpeed]
          : last.def?.rotationSpeed,
        position: [x, last.root.position.y, last.root.position.z],
        rotation: [last.root.rotation.x, last.root.rotation.y, last.root.rotation.z],
      };

      addElement(nextDef);
      console.log(`Duplicated cube → x=${x.toFixed(2)} (count: ${cubeCount})`);
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

  elements: [blueCube],
});
