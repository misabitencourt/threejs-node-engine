/**
 * Heightmap terrain from assets/map-01.png via Three.js on Node.js (no browser).
 *
 * Stack:
 *   @kmamal/sdl      → native window
 *   @kmamal/gl       → WebGL1 context
 *   three (r162)     → PlaneGeometry displaced by height samples
 *   @napi-rs/canvas  → decode PNG pixels
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import sdl from '@kmamal/sdl';
import createContext from '@kmamal/gl';
import * as THREE from 'three';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEIGHTMAP_PATH = path.resolve(__dirname, '..', '..', 'assets', 'map-01.png');

const WIDTH = 900;
const HEIGHT = 600;
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;

// World size of the terrain plane
const TERRAIN_SIZE = 24;
// Peak elevation after normalizing map values to 0..1
const MAX_HEIGHT = 4.5;

const window = sdl.video.createWindow({
  title: 'threejs-node-engine · heightmap',
  width: WIDTH,
  height: HEIGHT,
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
renderer.setClearColor(0x87b5d9, 1);
THREE.ColorManagement.enabled = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87b5d9, 18, 55);

const camera = new THREE.PerspectiveCamera(50, pixelWidth / pixelHeight, 0.1, 200);
camera.position.set(14, 10, 14);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));

const sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
sun.position.set(12, 20, 8);
scene.add(sun);

const fill = new THREE.DirectionalLight(0x6a8cff, 0.35);
fill.position.set(-10, 6, -8);
scene.add(fill);

/**
 * Sample heightmap PNG → PlaneGeometry with Y displacement + vertex colors.
 * @returns {{ mesh: THREE.Mesh, segs: number, stats: object }}
 */
async function buildHeightmapTerrain() {
  const img = await loadImage(HEIGHTMAP_PATH);
  const w = img.width;
  const h = img.height;

  const imgCanvas = createCanvas(w, h);
  const ctx = imgCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  // One vertex per pixel → segments = resolution - 1
  const segsX = w - 1;
  const segsY = h - 1;
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segsX, segsY);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  // Luminance per pixel (row-major, top-left origin in image)
  const heights = new Float32Array(w * h);
  let minL = 1;
  let maxL = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const luma = (data[i] + data[i + 1] + data[i + 2]) / (3 * 255);
      heights[y * w + x] = luma;
      if (luma < minL) minL = luma;
      if (luma > maxL) maxL = luma;
    }
  }

  const range = Math.max(1e-6, maxL - minL);
  const low = new THREE.Color(0x2d6a4f); // deep green
  const mid = new THREE.Color(0x95d5b2); // light green
  const high = new THREE.Color(0xf4f1de); // pale ridge
  const rock = new THREE.Color(0x6c757d);
  const tmp = new THREE.Color();

  // PlaneGeometry vertices: grid (segsX+1) * (segsY+1), row-major from -Y to +Y in local
  // After rotateX(-90°): local Y becomes world Z; we set world Y from height.
  // Vertex index layout matches: row j (0..segsY), col i (0..segsX)
  for (let j = 0; j <= segsY; j++) {
    for (let i = 0; i <= segsX; i++) {
      const vi = j * (segsX + 1) + i;
      // Map plane UV grid → image: j=0 is -Z side; image y=0 is top
      const px = i;
      const py = segsY - j;
      const t = (heights[py * w + px] - minL) / range;
      const elev = t * MAX_HEIGHT;
      positions.setY(vi, elev);

      // Height-based coloring
      if (t < 0.35) tmp.copy(low).lerp(mid, t / 0.35);
      else if (t < 0.7) tmp.copy(mid).lerp(high, (t - 0.35) / 0.35);
      else tmp.copy(high).lerp(rock, (t - 0.7) / 0.3);

      colors[vi * 3] = tmp.r;
      colors[vi * 3 + 1] = tmp.g;
      colors[vi * 3 + 2] = tmp.b;
    }
  }

  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.05,
    roughness: 0.88,
    flatShading: false,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;

  // Wireframe overlay for terrain structure
  const wire = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0x1b4332,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    }),
  );
  mesh.add(wire);

  return {
    mesh,
    segs: segsX,
    stats: {
      width: w,
      height: h,
      minLuma: minL,
      maxLuma: maxL,
      vertices: positions.count,
    },
  };
}

const { mesh: terrain, stats } = await buildHeightmapTerrain();
scene.add(terrain);

// Orbit pivot at terrain center (slightly above mean height)
const target = new THREE.Vector3(0, MAX_HEIGHT * 0.25, 0);
const orbitRadius = 18;
const orbitHeight = 9;
let orbitAngle = 0.6;

function placeCamera(angle) {
  camera.position.set(Math.cos(angle) * orbitRadius, orbitHeight, Math.sin(angle) * orbitRadius);
  camera.lookAt(target);
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

  orbitAngle += 0.12 * delta;
  placeCamera(orbitAngle);

  renderer.render(scene, camera);
  gl.swap();

  const spent = performance.now() - tickStart;
  frameTimer = setTimeout(frame, Math.max(0, FRAME_MS - spent));
}

console.log(
  `Heightmap ${path.basename(HEIGHTMAP_PATH)} ${stats.width}x${stats.height} → ` +
    `${stats.vertices} verts, luma ${stats.minLuma.toFixed(3)}–${stats.maxLuma.toFixed(3)}`,
);
console.log(
  `OpenGL window ${pixelWidth}x${pixelHeight} @ ${TARGET_FPS}fps — close the window to exit.`,
);
frame();
