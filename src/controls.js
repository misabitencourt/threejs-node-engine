/**
 * First-person controls: arrows move the camera, mouse looks around.
 * Static cube in the scene as a reference object.
 *
 * Click the window to capture the mouse · Esc to release
 * Arrows (or WASD) — move · Mouse — look
 *
 * Run: npm run controls
 */
import * as THREE from 'three';
import { engine } from '../lib/engine.js';

const MOVE_SPEED = 5; // units / second
const LOOK_SENSITIVITY = 0.0025; // radians / pixel
const PITCH_LIMIT = Math.PI / 2 - 0.05;

// Yaw / pitch kept outside the loop so look direction accumulates.
// Camera starts at +Z looking toward origin (-Z) → yaw 0 in Three.js.
let yaw = 0;
let pitch = -0.08;

engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · FPS controls',
    width: 800,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 70,
      near: 0.1,
      far: 200,
      // Eye-level, looking toward the cube at the origin
      position: [0, 1.6, 5],
      lookAt: [0, 1.2, 0],
    },

    /**
     * Per-frame hook: scene + camera + controls (keyboard + mouse).
     */
    gameloop({ delta, camera, controls }) {
      const { keyboard, mouse } = controls;

      // --- Mouse look (angle) ---
      if (mouse.locked || mouse.dx !== 0 || mouse.dy !== 0) {
        yaw -= mouse.dx * LOOK_SENSITIVITY;
        pitch -= mouse.dy * LOOK_SENSITIVITY;
        pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
      }

      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      // --- Arrow keys move camera position (WASD also works) ---
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() > 1e-8) forward.normalize();

      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
      if (right.lengthSq() > 1e-8) right.normalize();

      const step = MOVE_SPEED * delta;
      const move = new THREE.Vector3();

      if (keyboard.isDown('up') || keyboard.isDown('arrowup') || keyboard.isDown('w')) {
        move.addScaledVector(forward, step);
      }
      if (keyboard.isDown('down') || keyboard.isDown('arrowdown') || keyboard.isDown('s')) {
        move.addScaledVector(forward, -step);
      }
      if (keyboard.isDown('left') || keyboard.isDown('arrowleft') || keyboard.isDown('a')) {
        move.addScaledVector(right, -step);
      }
      if (keyboard.isDown('right') || keyboard.isDown('arrowright') || keyboard.isDown('d')) {
        move.addScaledVector(right, step);
      }

      camera.position.add(move);
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
      position: [0, 0.5, 0],
      rotation: [0, 0.4, 0],
      edges: { color: 0xc8dcff },
    },
    // Simple ground plane for reference while walking
    {
      type: 'geometry',
      geometry: 'plane',
      width: 40,
      height: 40,
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
