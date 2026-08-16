/**
 * Heightmap terrain + controlled cube (controls-style).
 *
 * - WASD / arrows move the cube (camera-relative, XZ)
 * - Mouse orbits the camera at a distance behind the cube
 * - Cube Y is sampled from the heightmap under its (x, z)
 * - Terrain uses material + tiled brick texture
 *
 * Helpers: lib/utils/heightmap.js · element type `heightmap`
 *
 * Run: npm run heightmap
 */
import * as THREE from 'three';
import { engine } from '../lib/engine.js';
import { sampleHeightAt } from '../lib/utils/heightmap.js';

const MOVE_SPEED = 18; // larger map → faster ground speed
const LOOK_SENSITIVITY = 0.0025;
const CUBE_SIZE = 0.6;
const HALF = CUBE_SIZE / 2;
/** Chase-camera distance behind the cube (world units) */
const CAMERA_DISTANCE = 28;
const CAMERA_PITCH_MIN = 0.2;
const CAMERA_PITCH_MAX = 1.15;

// Terrain (must match element def)
const TERRAIN_SIZE = 24;
/** Map scale — world footprint & height = base × scale */
const MAP_SCALE = 10;
const MAX_HEIGHT = 4.5;

let yaw = 0.6;
let pitch = 0.45;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · heightmap + cube',
    width: 960,
    height: 600,
    resizable: false,
    background: 0x87b5d9,

    camera: {
      fov: 60,
      near: 0.1,
      far: 2000,
      position: [0, 40, 80],
      lookAt: [0, 10, 0],
    },

    gameloop({ delta, camera, elements, controls }) {
      const terrain = elements.find((e) => e.def?.type === 'heightmap');
      const cube = elements.find((e) => e.def?.id === 'player');
      if (!terrain?.heightmap || !cube) return;

      const hm = terrain.heightmap;
      const body = cube.root;
      const { keyboard, mouse } = controls;

      // --- Mouse orbit around the cube ---
      if (mouse.locked || mouse.dx !== 0 || mouse.dy !== 0) {
        yaw -= mouse.dx * LOOK_SENSITIVITY;
        pitch += mouse.dy * LOOK_SENSITIVITY;
        pitch = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, pitch));
      }

      // --- Move cube on XZ relative to look yaw ---
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

      let x = body.position.x + move.x;
      let z = body.position.z + move.z;

      // Keep inside terrain footprint (with a small margin)
      const margin = HALF + 0.05;
      x = Math.max(hm.bounds.minX + margin, Math.min(hm.bounds.maxX - margin, x));
      z = Math.max(hm.bounds.minZ + margin, Math.min(hm.bounds.maxZ - margin, z));

      // Y from heightmap helper — pass map scale so sampling matches terrain size
      const ySample = sampleHeightAt(hm, x, z, MAP_SCALE, 0);

      body.position.set(x, ySample + HALF, z);

      // Face move direction
      if (move.lengthSq() > 1e-8) {
        body.rotation.y = Math.atan2(move.x, move.z);
      }

      // Third-person camera: stay well behind / above the cube
      const cy = body.position.y;
      camera.position.set(
        x + Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        cy + Math.sin(pitch) * CAMERA_DISTANCE,
        z + Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      );
      camera.lookAt(x, cy + HALF, z);
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xfff2d6,
      intensity: 1.15,
      position: [80, 120, 60],
    },
    {
      type: 'directional',
      color: 0x6a8cff,
      intensity: 0.35,
      position: [-60, 40, -50],
    },
  ],

  elements: [
    {
      type: 'heightmap',
      image: 'assets/map-01.png', // height / displacement source
      size: TERRAIN_SIZE,
      scale: MAP_SCALE, // 10× → worldSize 240, peak height 45
      maxHeight: MAX_HEIGHT,
      position: [0, 0, 0],
      wireframe: true,
      material: {
        type: 'standard',
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.92,
      },
      texture: {
        image: 'assets/brick.jpeg',
        imageFill: 'tile',
        repeat: [24, 24],
      },
    },
    {
      id: 'player',
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
      // Start near center; Y will be corrected on first frame
      position: [0, MAX_HEIGHT * MAP_SCALE * 0.5 + HALF, 0],
      edges: { color: 0xc8dcff },
    },
  ],
});
