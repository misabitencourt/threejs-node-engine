/**
 * 3dimagesprite — PNG plane with alpha + crop animation (walk cycle).
 *
 * Sheet: assets/char.png (504×17, frames 24×17)
 * Walk frames: 2 … 3
 *
 * Arrows / WASD: move via pushForce (local → world by rotation)
 * A/D: turn · Mouse: orbit camera
 *
 * Run: npm run sprite
 */
import * as THREE from 'three';
import { engine } from '../lib/engine.js';
import { pushForceFromRotation } from '../lib/utils/pushForce.js';

const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 17;
const SPRITE_WALK_START = 2;
const SPRITE_WALK_END = 3;

const MOVE_SPEED = 4;
const TURN_SPEED = 2.5;
const ANIM_FPS = 8;
const CAMERA_DISTANCE = 6;
const LOOK_SENSITIVITY = 0.0025;
const PITCH_MIN = 0.2;
const PITCH_MAX = 1.1;

const WALK_FRAMES = [];
for (let f = SPRITE_WALK_START; f <= SPRITE_WALK_END; f++) {
  WALK_FRAMES.push(f);
}

let yaw = 0.5;
let pitch = 0.4;
let animTime = 0;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · 3dimagesprite (char walk)',
    width: 900,
    height: 600,
    resizable: false,
    background: 0x87b5d9,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [4, 3, 6],
      lookAt: [0, 0.5, 0],
    },

    gameloop({ delta, camera, elements, controls }) {
      const sprite = elements[0];
      if (!sprite) return;

      const { keyboard, mouse } = controls;
      const body = sprite.root;

      // Mouse orbit
      if (mouse.locked || mouse.dx !== 0 || mouse.dy !== 0) {
        yaw -= mouse.dx * LOOK_SENSITIVITY;
        pitch += mouse.dy * LOOK_SENSITIVITY;
        pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
      }

      // Turn
      if (keyboard.isDown('left') || keyboard.isDown('arrowleft') || keyboard.isDown('a')) {
        body.rotation.y += TURN_SPEED * delta;
      }
      if (keyboard.isDown('right') || keyboard.isDown('arrowright') || keyboard.isDown('d')) {
        body.rotation.y -= TURN_SPEED * delta;
      }

      // Local push (forward = −Z)
      let localZ = 0;
      const moving =
        keyboard.isDown('up') ||
        keyboard.isDown('arrowup') ||
        keyboard.isDown('w') ||
        keyboard.isDown('down') ||
        keyboard.isDown('arrowdown') ||
        keyboard.isDown('s');

      if (keyboard.isDown('up') || keyboard.isDown('arrowup') || keyboard.isDown('w')) {
        localZ -= MOVE_SPEED;
      }
      if (keyboard.isDown('down') || keyboard.isDown('arrowdown') || keyboard.isDown('s')) {
        localZ += MOVE_SPEED;
      }

      sprite.pushForce = pushForceFromRotation(body, [0, 0, localZ]);

      // Walk animation between frames 2–3 while moving
      if (moving) {
        animTime += delta;
        const idx = Math.floor(animTime * ANIM_FPS) % WALK_FRAMES.length;
        const frame = WALK_FRAMES[idx];
        sprite.setFrame(frame, SPRITE_WIDTH, SPRITE_HEIGHT);
      } else {
        animTime = 0;
        sprite.setFrame(SPRITE_WALK_START, SPRITE_WIDTH, SPRITE_HEIGHT);
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
    { type: 'ambient', color: 0xffffff, intensity: 0.85 },
    {
      type: 'directional',
      color: 0xffffff,
      intensity: 0.6,
      position: [4, 8, 3],
    },
  ],

  elements: [
    {
      type: '3dimagesprite',
      image: 'assets/char.png',
      // Plane size in world units (keeps sprite aspect 24:17)
      size: [1.2, 1.2 * (SPRITE_HEIGHT / SPRITE_WIDTH)],
      position: [0, 0.55, 0],
      rotation: [0, 0, 0],
      crop: {
        x: SPRITE_WALK_START * SPRITE_WIDTH,
        y: 0,
        w: SPRITE_WIDTH,
        h: SPRITE_HEIGHT,
      },
      // pushForce set each frame from input
    },
    {
      type: 'geometry',
      geometry: 'plane',
      width: 40,
      height: 40,
      material: {
        type: 'standard',
        color: 0x3d5a40,
        metalness: 0.05,
        roughness: 0.95,
        side: 'double',
      },
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },
  ],
});
