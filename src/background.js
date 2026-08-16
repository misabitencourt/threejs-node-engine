/**
 * Cube walks on a 3D tile map with a scene background image.
 *
 * - WASD / arrows move the cube (camera-relative, XZ)
 * - Mouse orbits the camera behind the cube
 * - Cube Y from bilinear sample on the 3D tile height grid
 * - Scene backdrop: assets/cloud.jpg (`type: 'background'`)
 *
 * Element: type `background` · helpers in lib/objects/background.js
 *
 * Run: npm run background
 */
import * as THREE from 'three';
import { engine } from '../lib/engine.js';
import { sampleTileHeightAt } from '../lib/utils/tile3d.js';

const MOVE_SPEED = 5;
const LOOK_SENSITIVITY = 0.0025;
const CUBE_SIZE = 0.45;
const HALF = CUBE_SIZE / 2;
const CAMERA_DISTANCE = 12;
const CAMERA_PITCH_MIN = 0.2;
const CAMERA_PITCH_MAX = 1.15;

const MAP_COLS = 16;
const MAP_ROWS = 16;
const TILE_SIZE = 1;

let yaw = 0.7;
let pitch = 0.45;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · 3dtile + cube + background',
    width: 960,
    height: 600,
    resizable: false,
    // Clear color if the background image is hidden
    background: 0x7ec8e3,

    camera: {
      fov: 50,
      near: 0.1,
      far: 200,
      position: [8, 10, 12],
      lookAt: [0, 1, 0],
    },

    gameloop({ delta, camera, elements, controls }) {
      const terrain = elements.find(
        (e) => e.def?.type === '3dtile' || e.def?.type === 'tile3d' || e.def?.type === 'tilemap',
      );
      const cube = elements.find((e) => e.def?.id === 'player');
      if (!terrain?.tilemap || !cube) return;

      const map = terrain.tilemap;
      const body = cube.root;
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

      let x = body.position.x + move.x;
      let z = body.position.z + move.z;

      const margin = HALF + 0.05;
      x = Math.max(map.bounds.minX + margin, Math.min(map.bounds.maxX - margin, x));
      z = Math.max(map.bounds.minZ + margin, Math.min(map.bounds.maxZ - margin, z));

      const ySample = sampleTileHeightAt(map, x, z, 0);
      body.position.set(x, ySample + HALF, z);

      if (move.lengthSq() > 1e-8) {
        body.rotation.y = Math.atan2(move.x, move.z);
      }

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
    { type: 'ambient', color: 0xffffff, intensity: 0.5 },
    {
      type: 'directional',
      color: 0xfff5e0,
      intensity: 1.1,
      position: [10, 18, 6],
    },
    {
      type: 'directional',
      color: 0x8ecae6,
      intensity: 0.35,
      position: [-8, 6, -10],
    },
  ],

  elements: [
    {
      type: 'background',
      image: 'assets/cloud.jpg',
      imageFill: 'cover',
    },
    {
      type: '3dtile',
      width: MAP_COLS,
      height: MAP_ROWS,
      tileSize: TILE_SIZE,
      step: TILE_SIZE,
      position: [0, 0, 0],
      wireframe: true,
      material: {
        type: 'standard',
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.9,
        side: 'double',
      },
      texture: {
        image: 'assets/brick.jpeg',
        imageFill: 'tile',
        repeat: [1, 1],
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
      position: [0, 2, 0],
      edges: { color: 0xc8dcff },
    },
    {
      type: '2dtext',
      text: 'WASD walk · mouse orbit · cloud background',
      position: [16, 14],
      fontSize: 22,
      color: '#0b1a24',
      padding: 8,
      background: '#ffffffcc',
    },
  ],
});
