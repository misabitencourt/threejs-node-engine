/**
 * OpenGL character viewer via Three.js on Node.js (no browser).
 * Loads assets/char.glb with GLTFLoader into a native window.
 *
 * Stack:
 *   @kmamal/sdl      → native window
 *   @kmamal/gl       → WebGL1 context bound to that window
 *   three (r162)     → scene + WebGLRenderer + GLTFLoader
 *   @napi-rs/canvas  → decode embedded GLB textures (no DOM Image)
 *
 * Note: three r162 skinning shaders need WebGL2 (texelFetch). We CPU-bake
 * SkinnedMesh poses each frame so animation still works on WebGL1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Blob } from 'node:buffer';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import sdl from '@kmamal/sdl';
import createContext from '@kmamal/gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- Node polyfills so GLTFLoader can resolve embedded images ---
class NodeImage {
  #src = '';
  #listeners = { load: new Set(), error: new Set() };

  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  complete = false;
  /** @type {Uint8ClampedArray | null} */
  data = null;
  onload = null;
  onerror = null;

  addEventListener(type, fn) {
    this.#listeners[type]?.add(fn);
  }

  removeEventListener(type, fn) {
    this.#listeners[type]?.delete(fn);
  }

  get src() {
    return this.#src;
  }

  set src(url) {
    this.#src = url;
    this.#load(url);
  }

  async #load(url) {
    try {
      let buffer;
      if (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:')) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } else if (url.startsWith('data:')) {
        const comma = url.indexOf(',');
        const meta = url.slice(0, comma);
        const payload = url.slice(comma + 1);
        buffer = meta.includes(';base64')
          ? Buffer.from(payload, 'base64')
          : Buffer.from(decodeURIComponent(payload));
      } else {
        buffer = await fs.promises.readFile(url);
      }

      const decoded = await loadImage(buffer);
      const canvas = createCanvas(decoded.width, decoded.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(decoded, 0, 0);
      const imageData = ctx.getImageData(0, 0, decoded.width, decoded.height);

      // ImageData-shaped: headless-gl texImage2D accepts this
      this.width = imageData.width;
      this.height = imageData.height;
      this.naturalWidth = imageData.width;
      this.naturalHeight = imageData.height;
      this.data = imageData.data;
      this.complete = true;

      this.onload?.call(this);
      for (const fn of this.#listeners.load) fn.call(this);
    } catch (err) {
      this.onerror?.call(this, err);
      for (const fn of this.#listeners.error) fn.call(this, err);
    }
  }
}

globalThis.self = globalThis;
globalThis.Blob = Blob;
globalThis.Image = NodeImage;
globalThis.HTMLImageElement = NodeImage;
globalThis.document = {
  createElementNS(_ns, tag) {
    if (tag === 'img') return new NodeImage();
    if (tag === 'canvas') return createCanvas(1, 1);
    return {};
  },
  createElement(tag) {
    if (tag === 'img') return new NodeImage();
    if (tag === 'canvas') return createCanvas(1, 1);
    return {};
  },
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.resolve(__dirname, '..', '..', 'assets', 'char.glb');

const WIDTH = 800;
const HEIGHT = 600;
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;

const window = sdl.video.createWindow({
  title: 'threejs-node-engine · char.glb',
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
renderer.setClearColor(0x0b0f14, 1);
// No DOM canvas for sRGB conversion — keep linear upload path
THREE.ColorManagement.enabled = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, pixelWidth / pixelHeight, 0.05, 100);
camera.position.set(0, 1.2, 3);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 1.25);
key.position.set(3, 6, 4);
scene.add(key);

const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
fill.position.set(-4, 2, -2);
scene.add(fill);

scene.add(new THREE.HemisphereLight(0xb1e1ff, 0x444444, 0.35));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(2.5, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a222c, metalness: 0.1, roughness: 0.9 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

/** @type {THREE.Object3D | null} */
let model = null;
/** @type {THREE.AnimationMixer | null} */
let mixer = null;

/** CPU-skinning display pairs (WebGL1 cannot run three r162 skinning shaders) */
const skinnedPairs = [];
const _skinVertex = new THREE.Vector3();
const _skinned = new THREE.Vector3();
const _temp = new THREE.Vector3();
const _boneMat = new THREE.Matrix4();

/**
 * Prepare a SkinnedMesh for WebGL1: keep skeleton for animation, hide the
 * GPU skinned mesh (WebGL2 shader), and draw a CPU-baked static Mesh sibling.
 */
function prepareSkinnedMesh(skinnedMesh) {
  const source = skinnedMesh.geometry;
  const basePosition = new Float32Array(source.attributes.position.array);

  const displayGeometry = source.clone();
  displayGeometry.deleteAttribute('skinIndex');
  displayGeometry.deleteAttribute('skinWeight');

  const materials = skinnedMesh.material;
  const displayMaterial = Array.isArray(materials)
    ? materials.map((m) => m.clone())
    : materials.clone();

  const displayMesh = new THREE.Mesh(displayGeometry, displayMaterial);
  displayMesh.name = `${skinnedMesh.name || 'mesh'}_baked`;
  displayMesh.frustumCulled = false;

  // Sibling (not child): parent.visible=false would hide children too
  const parent = skinnedMesh.parent;
  if (parent) parent.add(displayMesh);
  else scene.add(displayMesh);

  displayMesh.position.copy(skinnedMesh.position);
  displayMesh.quaternion.copy(skinnedMesh.quaternion);
  displayMesh.scale.copy(skinnedMesh.scale);

  // Skeleton/mixer still update; skip WebGL2 skinning program
  skinnedMesh.visible = false;

  skinnedPairs.push({ skinnedMesh, displayMesh, basePosition });
}

function bakeSkinnedMesh({ skinnedMesh, displayMesh, basePosition }) {
  const skeleton = skinnedMesh.skeleton;
  skeleton.update();

  const position = displayMesh.geometry.attributes.position;
  const skinIndex = skinnedMesh.geometry.attributes.skinIndex;
  const skinWeight = skinnedMesh.geometry.attributes.skinWeight;
  const boneMatrices = skeleton.boneMatrices;
  const bindMatrix = skinnedMesh.bindMatrix;
  const bindMatrixInverse = skinnedMesh.bindMatrixInverse;

  for (let i = 0, count = position.count; i < count; i++) {
    _skinVertex.fromArray(basePosition, i * 3);
    _skinVertex.applyMatrix4(bindMatrix);

    _skinned.set(0, 0, 0);
    for (let j = 0; j < 4; j++) {
      const weight =
        j === 0
          ? skinWeight.getX(i)
          : j === 1
            ? skinWeight.getY(i)
            : j === 2
              ? skinWeight.getZ(i)
              : skinWeight.getW(i);
      if (weight === 0) continue;

      const boneIndex =
        j === 0
          ? skinIndex.getX(i)
          : j === 1
            ? skinIndex.getY(i)
            : j === 2
              ? skinIndex.getZ(i)
              : skinIndex.getW(i);

      _boneMat.fromArray(boneMatrices, boneIndex * 16);
      _temp.copy(_skinVertex).applyMatrix4(_boneMat).multiplyScalar(weight);
      _skinned.add(_temp);
    }

    _skinned.applyMatrix4(bindMatrixInverse);
    position.setXYZ(i, _skinned.x, _skinned.y, _skinned.z);
  }

  position.needsUpdate = true;
  displayMesh.geometry.computeVertexNormals();

  displayMesh.position.copy(skinnedMesh.position);
  displayMesh.quaternion.copy(skinnedMesh.quaternion);
  displayMesh.scale.copy(skinnedMesh.scale);
}

/**
 * Convert loader Image/ImageData textures into DataTextures so WebGL1
 * uploads via image.data (no canvas drawImage / sRGB browser path).
 */
function configureTextureForWebGL1(texture) {
  if (!texture || !texture.isTexture) return null;

  const image = texture.image;
  if (image?.data && image.width && image.height && !texture.isDataTexture) {
    const dataTexture = new THREE.DataTexture(
      image.data,
      image.width,
      image.height,
      THREE.RGBAFormat,
    );
    dataTexture.flipY = texture.flipY;
    dataTexture.wrapS = THREE.ClampToEdgeWrapping;
    dataTexture.wrapT = THREE.ClampToEdgeWrapping;
    dataTexture.magFilter = THREE.LinearFilter;
    dataTexture.minFilter = THREE.LinearFilter;
    dataTexture.generateMipmaps = false;
    dataTexture.colorSpace = THREE.NoColorSpace;
    dataTexture.needsUpdate = true;
    return dataTexture;
  }

  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

async function loadModel() {
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(`Model not found: ${MODEL_PATH}`);
  }

  const file = fs.readFileSync(MODEL_PATH);
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });

  model = gltf.scene;

  model.traverse((obj) => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'aoMap',
          'emissiveMap',
        ]) {
          if (!mat[key]) continue;
          mat[key] = configureTextureForWebGL1(mat[key]);
        }
      }
    }
    if (obj.isSkinnedMesh) prepareSkinnedMesh(obj);
  });

  // Center model and place on ground
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.y -= box2.min.y;

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  camera.position.set(dist * 0.55, size.y * 0.55, dist * 1.15);
  camera.near = maxDim / 100;
  camera.far = maxDim * 20;
  camera.lookAt(0, size.y * 0.4, 0);
  camera.updateProjectionMatrix();

  scene.add(model);

  // Initial bind-pose bake
  for (const pair of skinnedPairs) bakeSkinnedMesh(pair);

  if (gltf.animations?.length) {
    mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations[0];
    mixer.clipAction(clip).play();
    console.log(`Playing animation: "${clip.name || 'clip0'}" (${gltf.animations.length} clip(s))`);
  }

  let meshCount = 0;
  let textured = 0;
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    meshCount++;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (mats.some((m) => m?.map)) textured++;
  });
  console.log(
    `Loaded ${path.basename(MODEL_PATH)} — ${meshCount} mesh(es), ${textured} textured, size ~${maxDim.toFixed(2)}`,
  );
}

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

  if (mixer) mixer.update(delta);
  // Keep skeleton world matrices in sync, then CPU-bake skinning for WebGL1
  if (model) model.updateMatrixWorld(true);
  for (const pair of skinnedPairs) bakeSkinnedMesh(pair);

  if (model) model.rotation.y += 0.25 * delta;

  renderer.render(scene, camera);
  gl.swap();

  const spent = performance.now() - tickStart;
  frameTimer = setTimeout(frame, Math.max(0, FRAME_MS - spent));
}

try {
  await loadModel();
  console.log(
    `OpenGL window ${pixelWidth}x${pixelHeight} @ ${TARGET_FPS}fps — close the window to exit.`,
  );
  frame();
} catch (err) {
  console.error('Failed to load model:', err);
  process.exit(1);
}
