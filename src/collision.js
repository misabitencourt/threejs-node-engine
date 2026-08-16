/**
 * Shape collision demo — drive a cube; solid obstacles block it.
 *
 * Obstacles: sphere, box, cylinder, cone (lib/utils/collision.js).
 *
 * Controls (like controls/push demos):
 *   WASD / arrows — move the player cube
 *   Mouse (click to capture) — orbit camera
 *   Esc — release mouse
 *
 * Run: npm run collision
 */
import * as THREE from 'three';
import { engine } from '../lib/engine.js';
import {
  boxFromSize,
  shapeFromGeometryDef,
  moveBoxWithCollisions,
} from '../lib/utils/collision.js';

const MOVE_SPEED = 5;
const CAMERA_DISTANCE = 9;
const LOOK_SENSITIVITY = 0.0025;
const PITCH_MIN = 0.2;
const PITCH_MAX = 1.15;

const PLAYER_SIZE = [1, 1, 1];

let yaw = 0.7;
let pitch = 0.45;

/** @type {import('../lib/utils/collision.js').Shape[]} */
let obstacles = [];

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · collision (cube vs shapes)',
    width: 960,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 55,
      near: 0.1,
      far: 200,
      position: [6, 5, 8],
      lookAt: [0, 0.5, 0],
    },

    gameloop({ delta, camera, elements, controls }) {
      const player = elements.find((e) => e.def?.id === 'player');
      if (!player) return;

      // Build obstacle shapes once from static element defs + roots
      if (obstacles.length === 0) {
        for (const el of elements) {
          if (!el.def?.id || el.def.id === 'player' || el.def.id === 'ground') continue;
          if (el.def.type !== 'geometry') continue;
          const shape = shapeFromGeometryDef(el.def, el.root.position);
          if (shape) obstacles.push(shape);
        }
      }

      const { keyboard, mouse } = controls;
      const body = player.root;

      // --- Mouse orbit ---
      if (mouse.locked || mouse.dx !== 0 || mouse.dy !== 0) {
        yaw -= mouse.dx * LOOK_SENSITIVITY;
        pitch += mouse.dy * LOOK_SENSITIVITY;
        pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
      }

      // --- Movement in camera XZ plane (like FPS strafe, on the cube) ---
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

      const move = new THREE.Vector3();
      const step = MOVE_SPEED * delta;

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

      const playerBox = boxFromSize(
        [body.position.x, body.position.y, body.position.z],
        PLAYER_SIZE,
      );

      moveBoxWithCollisions(
        playerBox,
        [move.x, 0, move.z],
        obstacles,
        { lockY: true, iterations: 6 },
      );

      body.position.set(playerBox.center[0], playerBox.center[1], playerBox.center[2]);

      // Face move direction when moving
      if (move.lengthSq() > 1e-8) {
        body.rotation.y = Math.atan2(move.x, move.z);
      }

      // Camera follow
      const t = body.position;
      camera.position.set(
        t.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        t.y + Math.sin(pitch) * CAMERA_DISTANCE,
        t.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      );
      camera.lookAt(t.x, t.y + 0.4, t.z);
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xfff2d6,
      intensity: 1.15,
      position: [6, 12, 4],
    },
    {
      type: 'directional',
      color: 0x88aaff,
      intensity: 0.3,
      position: [-4, 3, -3],
    },
  ],

  elements: [
    // Player cube (controlled)
    {
      id: 'player',
      type: 'geometry',
      geometry: 'box',
      width: PLAYER_SIZE[0],
      height: PLAYER_SIZE[1],
      depth: PLAYER_SIZE[2],
      material: {
        type: 'standard',
        color: 0x4f8cff,
        metalness: 0.25,
        roughness: 0.4,
      },
      position: [-4, 0.5, 0],
      edges: { color: 0xc8dcff },
    },

    // Obstacle: sphere
    {
      id: 'obs-sphere',
      type: 'geometry',
      geometry: 'sphere',
      radius: 0.85,
      material: {
        type: 'standard',
        color: 0xff6b6b,
        metalness: 0.2,
        roughness: 0.45,
      },
      position: [0, 0.85, 0],
    },

    // Obstacle: cube
    {
      id: 'obs-box',
      type: 'geometry',
      geometry: 'box',
      width: 1.4,
      height: 1.4,
      depth: 1.4,
      material: {
        type: 'standard',
        color: 0xffc857,
        metalness: 0.2,
        roughness: 0.5,
      },
      position: [3, 0.7, 2],
      edges: { color: 0xffe6a8 },
    },

    // Obstacle: cylinder
    {
      id: 'obs-cylinder',
      type: 'geometry',
      geometry: 'cylinder',
      radius: 0.7,
      height: 1.6,
      material: {
        type: 'standard',
        color: 0x7ee787,
        metalness: 0.2,
        roughness: 0.45,
      },
      position: [2.5, 0.8, -2.5],
    },

    // Obstacle: cone
    {
      id: 'obs-cone',
      type: 'geometry',
      geometry: 'cone',
      radius: 0.9,
      height: 1.8,
      material: {
        type: 'standard',
        color: 0xc084fc,
        metalness: 0.2,
        roughness: 0.45,
      },
      position: [-1.5, 0.9, 3],
    },

    // Ground (no collision shape — player Y locked)
    {
      id: 'ground',
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
