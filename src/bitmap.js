/**
 * Cube walks on a 3D tile map with a 2D bitmap worldmap (screen pixels).
 *
 * - WASD / arrows move the cube (camera-relative, XZ)
 * - Mouse orbits the camera behind the cube
 * - Cube Y from bilinear sample on the 3D tile height grid
 * - Top-right HUD: `2dbitmap` painted from the tile grid + player cell
 *
 * Element: type `2dbitmap` · helper `engine.createBitmap`
 *
 * Run: npm run bitmap
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

const WIN_W = 960;
const WIN_H = 600;
const MARGIN = 16;
const MAP_PAD = 2;
const BMP_W = MAP_COLS + MAP_PAD * 2;
const BMP_H = MAP_ROWS + MAP_PAD * 2;
const PIXEL_SCALE = 8;
const MINIMAP_W = BMP_W * PIXEL_SCALE;
const MINIMAP_H = BMP_H * PIXEL_SCALE;

const COLOR_FRAME = 0x0b1a24;
const COLOR_PLAYER = 0x4f8cff;
const ROT_COLORS = {
  0: 0x40916c,
  1: 0xe76f51,
  2: 0x2a9d8f,
  3: 0xe9c46a,
  4: 0xf4a261,
};

let yaw = 0.7;
let pitch = 0.45;

/**
 * Shade 0xrrggbb toward white (high) or black (low).
 * @param {number} hex
 * @param {number} t  0..1
 */
function shade(hex, t) {
  const u = Math.max(0, Math.min(1, t));
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const lift = u * 0.45;
  const dim = (1 - u) * 0.35;
  return (
    ((Math.round(r * (1 - dim) + 255 * lift) << 16) |
      (Math.round(g * (1 - dim) + 255 * lift) << 8) |
      Math.round(b * (1 - dim) + 255 * lift)) >>>
    0
  );
}

/**
 * Paint tile heights / ramps and the player onto the HUD bitmap.
 * Bitmap (0,0) is top-left; tile (0,0) is min X / min Z.
 *
 * @param {{ fill: Function, setPixel: Function }} bmp
 * @param {object} map
 * @param {number} playerX
 * @param {number} playerZ
 */
function paintWorldmap(bmp, map, playerX, playerZ) {
  bmp.fill(COLOR_FRAME);

  const cols = map.cols;
  const rows = map.rows;
  const ts = map.tileSize;
  const origin = map.origin;
  const rotations = map.rotations;
  const heights = map.heights;
  const gw = cols + 1;

  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const span = Math.max(1e-6, maxH - minH);

  for (let tz = 0; tz < rows; tz++) {
    for (let tx = 0; tx < cols; tx++) {
      const r = rotations[tz * cols + tx] ?? 0;
      const h = heights[tz * gw + tx] ?? 0;
      const base = ROT_COLORS[r] ?? ROT_COLORS[0];
      bmp.setPixel(tx + MAP_PAD, tz + MAP_PAD, shade(base, (h - minH) / span));
    }
  }

  const col = Math.floor((playerX - origin[0]) / ts);
  const row = Math.floor((playerZ - origin[2]) / ts);
  if (col >= 0 && row >= 0 && col < cols && row < rows) {
    bmp.setPixel(col + MAP_PAD, row + MAP_PAD, COLOR_PLAYER);
  }
}

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · 3dtile + cube + worldmap',
    width: WIN_W,
    height: WIN_H,
    resizable: false,
    background: 0x7ec8e3,

    camera: {
      fov: 50,
      near: 0.1,
      far: 200,
      position: [8, 10, 12],
      lookAt: [0, 1, 0],
    },

    gameloop({ delta, camera, elements, controls, window: win }) {
      const terrain = elements.find(
        (e) => e.def?.type === '3dtile' || e.def?.type === 'tile3d' || e.def?.type === 'tilemap',
      );
      const cube = elements.find((e) => e.def?.id === 'player');
      const minimap = elements.find((e) => e.def?.id === 'worldmap');
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

      if (minimap) {
        minimap.position = [win.width - MARGIN - MINIMAP_W, MARGIN];
        paintWorldmap(minimap, map, x, z);
      }
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
      id: 'worldmap',
      type: '2dbitmap',
      width: BMP_W,
      height: BMP_H,
      fill: COLOR_FRAME,
      position: [WIN_W - MARGIN - MINIMAP_W, MARGIN],
      pixelScale: PIXEL_SCALE,
    },
    {
      type: '2dtext',
      text: 'WASD walk · mouse orbit',
      position: [16, 14],
      fontSize: 22,
      color: '#0b1a24',
      padding: 8,
      background: '#ffffffcc',
    },
    {
      type: '2dtext',
      text: 'map',
      position: [WIN_W - MARGIN - MINIMAP_W, MARGIN + MINIMAP_H + 6],
      fontSize: 18,
      color: '#0b1a24',
      padding: 6,
      background: '#ffffffcc',
    },
  ],
});
