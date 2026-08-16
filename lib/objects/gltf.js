import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyTransform } from '../graphics/transform.js';
import { resolveImagePath } from '../graphics/texture.js';
import { ensureNodeGltfPolyfill } from '../platform/nodeGltfPolyfill.js';
import { vec3 } from '../utils/math.js';

/**
 * GLB / glTF model element (`type: 'gltf'`).
 *
 * Loads via Three.js GLTFLoader. On WebGL1, SkinnedMesh poses are CPU-baked
 * each frame (same approach as the raw char demo).
 *
 * ```js
 * {
 *   type: 'gltf',
 *   model: 'assets/char.glb',   // or `path` / `src`
 *   position: [0, 0, 0],
 *   rotation: [0, 0, 0],
 *   scale: 1,                   // or [sx,sy,sz]
 *   animation: 'ArmatureAction', // clip name or index (optional)
 *   animationPlaying: true,
 *   center: true,               // center XZ + feet on y=0 of local origin
 *   visible: true,
 * }
 * ```
 *
 * Runtime:
 *   `.setAnimation(nameOrIndex)` · `.playAnimation()` · `.pauseAnimation()`
 *   `.stopAnimation()` · `.animations` · `.currentAnimation` · `.animationPlaying`
 */

const _skinVertex = new THREE.Vector3();
const _skinned = new THREE.Vector3();
const _temp = new THREE.Vector3();
const _boneMat = new THREE.Matrix4();

/**
 * Convert loader Image/ImageData textures into DataTextures for WebGL1.
 * @param {THREE.Texture} texture
 * @returns {THREE.Texture|null}
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

/**
 * @param {THREE.SkinnedMesh} skinnedMesh
 * @param {object[]} skinnedPairs
 */
function prepareSkinnedMesh(skinnedMesh, skinnedPairs) {
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

  const parent = skinnedMesh.parent;
  if (parent) parent.add(displayMesh);
  else skinnedMesh.add(displayMesh);

  displayMesh.position.copy(skinnedMesh.position);
  displayMesh.quaternion.copy(skinnedMesh.quaternion);
  displayMesh.scale.copy(skinnedMesh.scale);

  skinnedMesh.visible = false;
  skinnedPairs.push({ skinnedMesh, displayMesh, basePosition });
}

/**
 * @param {{ skinnedMesh: THREE.SkinnedMesh, displayMesh: THREE.Mesh, basePosition: Float32Array }} pair
 */
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
 * @param {string} modelPath
 * @returns {Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>}
 */
export async function loadGltfFile(modelPath) {
  ensureNodeGltfPolyfill();
  const full = resolveImagePath(modelPath);
  if (!fs.existsSync(full)) {
    throw new Error(`gltf model not found: ${full}`);
  }

  const file = fs.readFileSync(full);
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });
}

/**
 * List clip names (and generate names for empty ones).
 * @param {THREE.AnimationClip[]} clips
 * @returns {string[]}
 */
function clipNames(clips) {
  return clips.map((c, i) => (c.name && String(c.name).trim() ? c.name : `clip${i}`));
}

/**
 * @param {THREE.AnimationClip[]} clips
 * @param {string|number|null|undefined} nameOrIndex
 * @returns {THREE.AnimationClip|null}
 */
function resolveClip(clips, nameOrIndex) {
  if (!clips.length) return null;
  if (nameOrIndex == null) return clips[0];
  if (typeof nameOrIndex === 'number' && Number.isFinite(nameOrIndex)) {
    const i = Math.max(0, Math.min(clips.length - 1, Math.floor(nameOrIndex)));
    return clips[i];
  }
  const key = String(nameOrIndex);
  const byName = clips.find((c) => c.name === key);
  if (byName) return byName;
  const names = clipNames(clips);
  const idx = names.indexOf(key);
  if (idx >= 0) return clips[idx];
  // case-insensitive
  const lower = key.toLowerCase();
  const i2 = names.findIndex((n) => n.toLowerCase() === lower);
  return i2 >= 0 ? clips[i2] : clips[0];
}

/**
 * @param {object} def
 */
export async function createGltfObject(def) {
  const modelPath = def.model ?? def.path ?? def.src ?? def.file;
  if (!modelPath) {
    throw new Error('gltf element requires `model` (path to .glb / .gltf)');
  }

  const gltf = await loadGltfFile(modelPath);
  const root = new THREE.Group();
  root.name = def.name ?? 'gltf';

  const model = gltf.scene;
  root.add(model);

  /** @type {{ skinnedMesh: THREE.SkinnedMesh, displayMesh: THREE.Mesh, basePosition: Float32Array }[]} */
  const skinnedPairs = [];

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
    if (obj.isSkinnedMesh) prepareSkinnedMesh(obj, skinnedPairs);
  });

  // Optional center: XZ center + feet on y=0 (local group space)
  if (def.center !== false) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
  }

  // Uniform scale before applyTransform scale (def.scale can still override via transform)
  if (def.modelScale != null) {
    const s = Number(def.modelScale) || 1;
    model.scale.multiplyScalar(s);
  }

  applyTransform(root, {
    position: def.position,
    rotation: def.rotation,
    scale: def.scale != null ? (Array.isArray(def.scale) ? def.scale : [def.scale, def.scale, def.scale]) : [1, 1, 1],
  });
  root.visible = def.visible !== false;

  const clips = gltf.animations ?? [];
  const names = clipNames(clips);
  /** @type {THREE.AnimationMixer|null} */
  let mixer = clips.length ? new THREE.AnimationMixer(model) : null;
  /** @type {THREE.AnimationAction|null} */
  let currentAction = null;
  /** @type {string|null} */
  let currentName = null;
  let playing = def.animationPlaying !== false;

  function setAnimation(nameOrIndex, opts = {}) {
    if (!mixer || !clips.length) return null;
    const clip = resolveClip(clips, nameOrIndex);
    if (!clip) return null;

    const nextName = clip.name && String(clip.name).trim() ? clip.name : names[clips.indexOf(clip)];
    if (currentAction && currentName === nextName) {
      if (opts.restart) {
        currentAction.reset();
        currentAction.play();
        currentAction.paused = !playing;
      }
      return currentAction;
    }

    if (currentAction) {
      currentAction.fadeOut(opts.fade ?? 0.15);
    }

    const action = mixer.clipAction(clip);
    action.reset();
    action.fadeIn(opts.fade ?? 0.15);
    action.play();
    action.paused = !playing;
    currentAction = action;
    currentName = nextName;
    def.animation = nextName;
    return action;
  }

  function playAnimation() {
    playing = true;
    if (currentAction) {
      currentAction.paused = false;
      if (!currentAction.isRunning()) currentAction.play();
    } else if (clips.length) {
      setAnimation(def.animation ?? 0);
      if (currentAction) currentAction.paused = false;
    }
  }

  function pauseAnimation() {
    playing = false;
    if (currentAction) currentAction.paused = true;
  }

  function stopAnimation() {
    playing = false;
    if (currentAction) {
      currentAction.stop();
      currentAction = null;
      currentName = null;
    }
  }

  // Start clip if requested
  if (mixer && clips.length && def.animation !== false && def.animation !== null) {
    setAnimation(def.animation ?? 0);
    if (!playing && currentAction) currentAction.paused = true;
  }

  // Initial bind-pose bake
  root.updateMatrixWorld(true);
  for (const pair of skinnedPairs) bakeSkinnedMesh(pair);

  /** @type {number[]|null} */
  let force = null;
  if (def.pushForce != null) {
    const pf = def.pushForce;
    if (Array.isArray(pf) && pf.length >= 3) {
      force = [Number(pf[0]) || 0, Number(pf[1]) || 0, Number(pf[2]) || 0];
    }
  }

  return {
    root,
    def,
    model,
    gltf,
    mixer,
    get animations() {
      return names.slice();
    },
    get currentAnimation() {
      return currentName;
    },
    get animationPlaying() {
      return playing && !!currentAction && !currentAction.paused;
    },
    set animationPlaying(value) {
      if (value) playAnimation();
      else pauseAnimation();
    },
    setAnimation,
    playAnimation,
    pauseAnimation,
    stopAnimation,
    get visible() {
      return root.visible;
    },
    set visible(value) {
      root.visible = !!value;
    },
    get pushForce() {
      return force;
    },
    set pushForce(value) {
      if (value == null) {
        force = null;
        return;
      }
      if (Array.isArray(value) && value.length >= 3) {
        force = [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
      }
    },
    update: (delta) => {
      if (force) {
        root.position.x += force[0] * delta;
        root.position.y += force[1] * delta;
        root.position.z += force[2] * delta;
      }
      if (mixer) mixer.update(delta);
      root.updateMatrixWorld(true);
      for (const pair of skinnedPairs) bakeSkinnedMesh(pair);
    },
  };
}
