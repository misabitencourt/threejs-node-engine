/**
 * GLB character via engine `gltf` element.
 *
 * assets/monk_character.glb has no animations → uses assets/char.glb
 * (clip: "ArmatureAction").
 *
 * WASD / arrows — move on XZ
 * Animation plays only while moving; pauses when idle
 * Mouse — orbit camera
 *
 * Run: npm run gltf
 */
import fs from 'node:fs';
import * as THREE from 'three';
import { engine } from '../lib/engine.js';

const MOVE_SPEED = 3.5;
const LOOK_SENSITIVITY = 0.0025;
const CAMERA_DISTANCE = 4.5;
const CAMERA_PITCH_MIN = 0.15;
const CAMERA_PITCH_MAX = 1.1;

const MONK = 'assets/monk_character.glb';
const CHAR = 'assets/char.glb';

// Prefer monk only if it exists *and* has clips — inspected offline: monk has 0 clips.
const MODEL_PATH = fs.existsSync(CHAR) ? CHAR : MONK;

let yaw = 0.5;
let pitch = 0.4;
let loggedAnims = false;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · gltf (WASD walk)',
    width: 900,
    height: 600,
    resizable: false,
    background: 0x0b0f14,

    camera: {
      fov: 45,
      near: 0.05,
      far: 100,
      position: [2.5, 2, 4],
      lookAt: [0, 0.8, 0],
    },

    gameloop({ delta, camera, elements, controls }) {
      const char = elements.find((e) => e.def?.type === 'gltf' || e.def?.type === 'glb');
      if (!char) return;

      if (!loggedAnims) {
        loggedAnims = true;
        console.log(
          `Model: ${char.def.model} · clips: [${(char.animations || []).join(', ') || 'none'}]`,
        );
        if (!char.animations?.length) {
          console.log('No animations on this GLB — movement still works, pose is static.');
        } else {
          // Ensure walk clip is selected (paused until we move)
          char.setAnimation(char.def.animation ?? char.animations[0]);
          char.pauseAnimation();
        }
      }

      const body = char.root;
      const { keyboard, mouse } = controls;

      if (mouse.locked || mouse.dx !== 0 || mouse.dy !== 0) {
        yaw -= mouse.dx * LOOK_SENSITIVITY;
        pitch += mouse.dy * LOOK_SENSITIVITY;
        pitch = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, pitch));
      }

      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
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

      const moving = move.lengthSq() > 1e-10;

      if (moving) {
        body.position.x += move.x;
        body.position.z += move.z;
        // Face movement direction (Three.js: +Z is default forward for many models — flip if needed)
        body.rotation.y = Math.atan2(move.x, move.z);

        if (char.animations?.length && !char.animationPlaying) {
          char.playAnimation();
        }
      } else if (char.animations?.length && char.animationPlaying) {
        char.pauseAnimation();
      }

      // Orbit camera around character
      const t = body.position;
      const headY = t.y + 1.0;
      camera.position.set(
        t.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        t.y + Math.sin(pitch) * CAMERA_DISTANCE + 0.6,
        t.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      );
      camera.lookAt(t.x, headY, t.z);
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.55 },
    {
      type: 'directional',
      color: 0xffffff,
      intensity: 1.2,
      position: [3, 6, 4],
    },
    {
      type: 'directional',
      color: 0x88aaff,
      intensity: 0.35,
      position: [-4, 2, -2],
    },
  ],

  elements: [
    {
      type: 'gltf',
      model: MODEL_PATH,
      // char.glb walk cycle
      animation: 'ArmatureAction',
      animationPlaying: false, // only while moving
      center: true,
      position: [0, 0, 0],
      scale: 0.07,
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
