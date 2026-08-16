/**
 * Tilemap terrain: one plane per tile. Four points from rotation; heights from neighbors.
 *
 * Stack:
 *   @kmamal/sdl  → native window
 *   @kmamal/gl   → WebGL1 context
 *   three (r162) → BufferGeometry quads
 *
 * 3d tile,
 * 0 = no rotation
 * 1 = 45deg left
 * 2 = 45deg top
 * 3 = 45deg right
 * 4 = 45deg bottom
 *
 * Named side = LOW edge of a 45° ramp (rise = run = TILE_SIZE).
 * Heights live on a shared (COLS+1)×(ROWS+1) vertex grid so edges match
 * left / top / right / bottom neighbors.
 */
import sdl from '@kmamal/sdl';
import createContext from '@kmamal/gl';
import * as THREE from 'three';

// 3d tile,
// 0 = no rotation
// 1 = 45deg left
// 2 = 45deg top
// 3 = 45deg right
// 4 = 45deg bottom
const tile = {
  width: 16,
  height: 16,

  rotations: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
};

const COLS = tile.width;
const ROWS = tile.height;
const TILE_SIZE = 1;
/** 45° ramp: tan(45°)=1 → vertical step equals tile side */
const STEP = TILE_SIZE;

const WIN_W = 960;
const WIN_H = 640;
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;

const GW = COLS + 1;
const GH = ROWS + 1;

function rotationAt(x, z) {
  if (x < 0 || z < 0 || x >= COLS || z >= ROWS) return 0;
  return tile.rotations[z * COLS + x] ?? 0;
}

/**
 * Corner heights relative to top-left, from tile rotation.
 *
 *   TL ---- TR     top    = smaller Z
 *   |        |
 *   BL ---- BR     bottom = larger Z
 *
 * Named side is LOW (45° ramp).
 */
function cornersFromRotation(hTL, rotation) {
  switch (rotation) {
    case 1: // 45deg left  — left low, right high
      return { hTL, hTR: hTL + STEP, hBL: hTL, hBR: hTL + STEP };
    case 2: // 45deg top   — top low, bottom high
      return { hTL, hTR: hTL, hBL: hTL + STEP, hBR: hTL + STEP };
    case 3: // 45deg right — right low, left high
      return { hTL, hTR: hTL - STEP, hBL: hTL, hBR: hTL - STEP };
    case 4: // 45deg bottom — bottom low, top high
      return { hTL, hTR: hTL, hBL: hTL - STEP, hBR: hTL - STEP };
    default: // 0 = no rotation
      return { hTL, hTR: hTL, hBL: hTL, hBR: hTL };
  }
}

/**
 * Shared vertex height grid.
 *
 * Walk left→right, top→bottom. For each tile:
 *   - hTL comes from left/top neighbors (already written into the grid)
 *   - other three corners from `cornersFromRotation`
 *   - write all four so the right and bottom neighbors can read them
 *
 * A second averaging pass smooths any seam conflicts between neighbors.
 */
function buildHeightGrid() {
  const heights = new Float32Array(GW * GH);
  const sum = new Float32Array(GW * GH);
  const n = new Uint16Array(GW * GH);

  const at = (x, z) => z * GW + x;

  function add(x, z, y) {
    const i = at(x, z);
    sum[i] += y;
    n[i] += 1;
    heights[i] = sum[i] / n[i];
  }

  // Pass 1 — forward propagation via left + top neighbors
  for (let z = 0; z < ROWS; z++) {
    for (let x = 0; x < COLS; x++) {
      const r = rotationAt(x, z);

      // Neighbor rotations (used when TL not yet constrained)
      const leftR = rotationAt(x - 1, z);
      const topR = rotationAt(x, z - 1);
      const rightR = rotationAt(x + 1, z);
      const bottomR = rotationAt(x, z + 1);

      // TL height: already set by left tile’s TR and/or top tile’s BL
      let hTL = heights[at(x, z)];

      // If both left and top wrote different values, heights[] is already averaged.
      // If neither wrote (first cell), hTL stays 0.
      if (x === 0 && z === 0) hTL = 0;

      // Explicit neighbor contributions when estimating a missing TL
      if (n[at(x, z)] === 0) {
        const guesses = [];
        if (x > 0) {
          // left neighbor BR / TR path — left tile should have written (x, z)
          // as its TR; if still empty, derive from left’s TL + rotation
          const leftTL = heights[at(x - 1, z)];
          const leftCorners = cornersFromRotation(leftTL, leftR);
          guesses.push(leftCorners.hTR);
        }
        if (z > 0) {
          const topTL = heights[at(x, z - 1)];
          const topCorners = cornersFromRotation(topTL, topR);
          guesses.push(topCorners.hBL);
        }
        if (guesses.length) {
          hTL = guesses.reduce((a, b) => a + b, 0) / guesses.length;
        }
      } else {
        hTL = heights[at(x, z)];
      }

      // Optional: pull hTL toward what right/bottom ramps will need later
      // (kept simple — rotation of this tile dominates)
      void rightR;
      void bottomR;

      const { hTR, hBL, hBR } = cornersFromRotation(hTL, r);

      add(x, z, hTL);
      add(x + 1, z, hTR);
      add(x, z + 1, hBL);
      add(x + 1, z + 1, hBR);
    }
  }

  // Pass 2 — re-apply each tile from averaged TL; re-average all corners
  sum.fill(0);
  n.fill(0);
  for (let z = 0; z < ROWS; z++) {
    for (let x = 0; x < COLS; x++) {
      const r = rotationAt(x, z);
      const hTL = heights[at(x, z)];
      const { hTR, hBL, hBR } = cornersFromRotation(hTL, r);
      add(x, z, hTL);
      add(x + 1, z, hTR);
      add(x, z + 1, hBL);
      add(x + 1, z + 1, hBR);
    }
  }

  return heights;
}

/** Four world-space points for tile (tx, tz) from the shared height grid. */
function tileCorners(tx, tz, heights) {
  const hTL = heights[tz * GW + tx];
  const hTR = heights[tz * GW + (tx + 1)];
  const hBL = heights[(tz + 1) * GW + tx];
  const hBR = heights[(tz + 1) * GW + (tx + 1)];

  const x0 = tx * TILE_SIZE;
  const x1 = (tx + 1) * TILE_SIZE;
  const z0 = tz * TILE_SIZE;
  const z1 = (tz + 1) * TILE_SIZE;

  return {
    tl: new THREE.Vector3(x0, hTL, z0),
    tr: new THREE.Vector3(x1, hTR, z0),
    bl: new THREE.Vector3(x0, hBL, z1),
    br: new THREE.Vector3(x1, hBR, z1),
    rotation: rotationAt(tx, tz),
  };
}

function createTileMesh(corners, color) {
  const { tl, tr, bl, br } = corners;
  const positions = new Float32Array([
    tl.x,
    tl.y,
    tl.z,
    bl.x,
    bl.y,
    bl.z,
    tr.x,
    tr.y,
    tr.z,

    tr.x,
    tr.y,
    tr.z,
    bl.x,
    bl.y,
    bl.z,
    br.x,
    br.y,
    br.z,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.08,
      roughness: 0.85,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  );
}

function colorForRotation(r) {
  switch (r) {
    case 1:
      return 0xe76f51; // left
    case 2:
      return 0x2a9d8f; // top
    case 3:
      return 0xe9c46a; // right
    case 4:
      return 0xf4a261; // bottom
    default:
      return 0x40916c; // flat
  }
}

// ---------------------------------------------------------------------------
// Window / renderer
// ---------------------------------------------------------------------------

const window = sdl.video.createWindow({
  title: 'threejs-node-engine · tilemap',
  width: WIN_W,
  height: WIN_H,
  resizable: false,
  opengl: true,
});

const { pixelWidth, pixelHeight, native } = window;
const gl = createContext(pixelWidth, pixelHeight, {
  window: native,
  antialias: true,
  depth: true,
  stencil: false,
  alpha: false,
});

if (!gl) {
  console.error('Failed to create WebGL context for window.');
  process.exit(1);
}

const canvas = {
  width: pixelWidth,
  height: pixelHeight,
  style: {},
  addEventListener() {},
  removeEventListener() {},
  getContext(type) {
    if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
      return gl;
    }
    return null;
  },
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  context: gl,
  antialias: true,
  alpha: false,
});
renderer.setSize(pixelWidth, pixelHeight);
renderer.setPixelRatio(1);
renderer.setClearColor(0x7ec8e3, 1);
THREE.ColorManagement.enabled = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x7ec8e3, 20, 48);

const camera = new THREE.PerspectiveCamera(50, pixelWidth / pixelHeight, 0.1, 200);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
sun.position.set(10, 18, 6);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8ecae6, 0.35);
fill.position.set(-8, 6, -10);
scene.add(fill);

const heights = buildHeightGrid();
const mapRoot = new THREE.Group();
mapRoot.position.set((-COLS * TILE_SIZE) / 2, 0, (-ROWS * TILE_SIZE) / 2);

let tileCount = 0;
for (let z = 0; z < ROWS; z++) {
  for (let x = 0; x < COLS; x++) {
    const corners = tileCorners(x, z, heights);
    mapRoot.add(createTileMesh(corners, colorForRotation(corners.rotation)));

    const { tl, tr, bl, br } = corners;
    mapRoot.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([tl, tr, br, bl, tl]),
        new THREE.LineBasicMaterial({ color: 0x1b4332, transparent: true, opacity: 0.35 }),
      ),
    );
    tileCount++;
  }
}

scene.add(mapRoot);

const box = new THREE.Box3().setFromObject(mapRoot);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const orbitRadius = Math.max(size.x, size.z) * 0.95;
const orbitHeight = Math.max(size.y, 2) + 8;
let orbitAngle = 0.7;

function placeCamera(angle) {
  camera.position.set(
    center.x + Math.cos(angle) * orbitRadius,
    center.y + orbitHeight,
    center.z + Math.sin(angle) * orbitRadius,
  );
  camera.lookAt(center);
}
placeCamera(orbitAngle);

const clock = new THREE.Clock();
let running = true;
let frameTimer = null;

window.on('close', () => {
  running = false;
  if (frameTimer !== null) clearTimeout(frameTimer);
});

function frame() {
  if (!running || window.destroyed) return;
  const tickStart = performance.now();
  const delta = clock.getDelta();

  orbitAngle += 0.15 * delta;
  placeCamera(orbitAngle);

  renderer.render(scene, camera);
  gl.swap();

  frameTimer = setTimeout(frame, Math.max(0, FRAME_MS - (performance.now() - tickStart)));
}

let minH = Infinity;
let maxH = -Infinity;
for (let i = 0; i < heights.length; i++) {
  minH = Math.min(minH, heights[i]);
  maxH = Math.max(maxH, heights[i]);
}

console.log(
  `Tilemap ${COLS}×${ROWS} = ${tileCount} planes | Y ${minH.toFixed(2)}…${maxH.toFixed(2)} | step=${STEP} (45°)`,
);
console.log(
  `OpenGL window ${pixelWidth}x${pixelHeight} @ ${TARGET_FPS}fps — close the window to exit.`,
);
frame();
