/**
 * pushForce + third-person camera.
 *
 * - Arrow keys build a local push; helper rotates it by the cube's orientation
 * - Mouse orbits the camera at a fixed distance around the cube
 * - Click to capture mouse · Esc to release
 *
 * Run: npm run push
 */
import * as THREE from 'three';
import { engine } from '../lib/engine.js';
import { pushForceFromRotation } from '../lib/utils/pushForce.js';

const MOVE_SPEED = 6; // units/s in local space
const TURN_SPEED = 2.2; // rad/s when pressing left/right
const CAMERA_DISTANCE = 7;
const LOOK_SENSITIVITY = 0.0025;
const PITCH_MIN = 0.15;
const PITCH_MAX = 1.2;

// Orbit angles around the cube (mouse)
let yaw = 0.6;
let pitch = 0.45;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · pushForce (arrows + mouse cam)',
    width: 900,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 55,
      near: 0.1,
      far: 200,
      position: [5, 4, 7],
      lookAt: [0, 0.5, 0],
    },

    gameloop({ delta, camera, elements, controls }) {
      const cube = elements[0];
      if (!cube) return;

      const { keyboard, mouse } = controls;
      const body = cube.root; // { position, rotation }

      // --- Mouse: orbit camera around cube ---
      if (mouse.locked || mouse.dx !== 0 || mouse.dy !== 0) {
        yaw -= mouse.dx * LOOK_SENSITIVITY;
        pitch += mouse.dy * LOOK_SENSITIVITY;
        pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
      }

      // --- Left / right: turn the cube (changes forward for pushForce) ---
      if (keyboard.isDown('left') || keyboard.isDown('arrowleft') || keyboard.isDown('a')) {
        body.rotation.y += TURN_SPEED * delta;
      }
      if (keyboard.isDown('right') || keyboard.isDown('arrowright') || keyboard.isDown('d')) {
        body.rotation.y -= TURN_SPEED * delta;
      }

      // --- Up / down: local-space push ( -Z = forward in Three.js ) ---
      let localX = 0;
      let localZ = 0;

      if (keyboard.isDown('up') || keyboard.isDown('arrowup') || keyboard.isDown('w')) {
        localZ -= MOVE_SPEED; // forward
      }
      if (keyboard.isDown('down') || keyboard.isDown('arrowdown') || keyboard.isDown('s')) {
        localZ += MOVE_SPEED; // backward
      }

      // World push = local force rotated by object.rotation
      cube.pushForce = pushForceFromRotation(body, [localX, 0, localZ]);

      // --- Fixed-distance follow ---
      const target = body.position;
      const offset = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        Math.sin(pitch) * CAMERA_DISTANCE,
        Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      );

      camera.position.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
      camera.lookAt(target.x, target.y + 0.4, target.z);
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xffffff,
      intensity: 1.15,
      position: [6, 10, 4],
    },
    {
      type: 'directional',
      color: 0x88aaff,
      intensity: 0.3,
      position: [-4, 2, -3],
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
      edges: { color: 0xc8dcff },
    },
    {
      type: 'geometry',
      geometry: 'plane',
      width: 60,
      height: 60,
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
