import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { parseColor } from './texture.js';

/**
 * Default vertex shader (GLSL1 / WebGL1). Three.js injects
 * projectionMatrix, modelViewMatrix, normalMatrix, position, normal, uv.
 */
export const DEFAULT_VERTEX_SHADER = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  gl_Position = projectionMatrix * mvPosition;
}
`;

/**
 * Default fragment: unlit self-illumination (no scene lights).
 * Facing + rim keep cubes readable; `time` / `uPhase` pulse the glow.
 */
export const DEFAULT_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uOpacity;
uniform float time;
uniform float uPhase;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewPosition);
  float facing = max(dot(n, v), 0.0);
  float rim = pow(1.0 - facing, 2.0);
  float pulse = 0.82 + 0.18 * sin(time * 2.4 + uPhase);
  vec3 emit = uColor * uIntensity * pulse;
  vec3 color = emit * (0.35 + 0.65 * facing) + emit * rim * 0.55;
  gl_FragColor = vec4(color, uOpacity);
}
`;

/**
 * Inline GLSL, or a path to `.glsl` / `.vert` / `.frag` / `.vs` / `.fs`.
 * @param {unknown} src
 * @param {string} fallback
 * @returns {string}
 */
export function resolveShaderSource(src, fallback = '') {
  if (typeof src !== 'string') return fallback;
  const trimmed = src.trim();
  if (!trimmed) return fallback;
  if (!trimmed.includes('\n') && /\.(glsl|vert|frag|vs|fs)$/i.test(trimmed)) {
    const full = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
    if (!fs.existsSync(full)) {
      throw new Error(`Shader file not found: ${full}`);
    }
    return fs.readFileSync(full, 'utf8');
  }
  return src;
}

/**
 * Coerce a JSON-friendly value into a Three.js uniform value.
 * @param {unknown} value
 */
export function coerceUniformValue(value) {
  if (value == null) return value;
  if (value instanceof THREE.Color || value instanceof THREE.Vector2 || value instanceof THREE.Vector3 || value instanceof THREE.Vector4 || value instanceof THREE.Texture) {
    return value;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('#') || s.startsWith('0x') || /^[0-9a-f]{3,8}$/i.test(s)) {
      return new THREE.Color(parseColor(s));
    }
    return value;
  }
  if (Array.isArray(value)) {
    const n = value.length;
    if (n === 2) return new THREE.Vector2(Number(value[0]) || 0, Number(value[1]) || 0);
    if (n === 3) return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
    if (n >= 4) {
      return new THREE.Vector4(
        Number(value[0]) || 0,
        Number(value[1]) || 0,
        Number(value[2]) || 0,
        Number(value[3]) || 0,
      );
    }
    return value;
  }
  if (typeof value === 'object') {
    const o = /** @type {{ r?: number, g?: number, b?: number, x?: number, y?: number, z?: number, w?: number }} */ (value);
    if (o.r != null || o.g != null || o.b != null) {
      return new THREE.Color(o.r ?? 0, o.g ?? 0, o.b ?? 0);
    }
    if (o.w != null) {
      return new THREE.Vector4(o.x ?? 0, o.y ?? 0, o.z ?? 0, o.w);
    }
    if (o.z != null) {
      return new THREE.Vector3(o.x ?? 0, o.y ?? 0, o.z);
    }
    if (o.x != null || o.y != null) {
      return new THREE.Vector2(o.x ?? 0, o.y ?? 0);
    }
  }
  return value;
}

/**
 * @param {unknown} spec  `{ name: { value } }` or `{ name: value }`
 * @returns {Record<string, { value: unknown }>}
 */
export function parseUniforms(spec) {
  /** @type {Record<string, { value: unknown }>} */
  const out = {};
  if (!spec || typeof spec !== 'object') return out;
  for (const [name, raw] of Object.entries(spec)) {
    if (raw && typeof raw === 'object' && 'value' in /** @type {object} */ (raw)) {
      out[name] = { value: coerceUniformValue(/** @type {{ value: unknown }} */ (raw).value) };
    } else {
      out[name] = { value: coerceUniformValue(raw) };
    }
  }
  return out;
}

/**
 * @param {THREE.ShaderMaterial} material
 * @param {string} name
 * @param {unknown} value
 */
export function setShaderUniform(material, name, value) {
  if (!material?.uniforms) return;
  if (!material.uniforms[name]) {
    material.uniforms[name] = { value: coerceUniformValue(value) };
    return;
  }
  const slot = material.uniforms[name];
  const current = slot.value;
  if (current && current.isColor && (typeof value === 'number' || typeof value === 'string')) {
    current.set(parseColor(value));
    return;
  }
  const next = coerceUniformValue(value);
  if (current && current.isVector2 && next && next.isVector2) {
    current.copy(next);
    return;
  }
  if (current && current.isVector3 && next && next.isVector3) {
    current.copy(next);
    return;
  }
  if (current && current.isVector4 && next && next.isVector4) {
    current.copy(next);
    return;
  }
  if (current && current.isColor && next && next.isColor) {
    current.copy(next);
    return;
  }
  slot.value = next;
}

/**
 * Advance built-in time uniforms (`time`, `uTime`) by delta seconds.
 * @param {THREE.Material|THREE.Material[]|null|undefined} material
 * @param {number} delta
 */
export function updateShaderMaterial(material, delta) {
  const list = Array.isArray(material) ? material : [material];
  const dt = Number(delta) || 0;
  for (const mat of list) {
    if (!mat?.isShaderMaterial || !mat.uniforms) continue;
    const u = mat.uniforms;
    if (u.time) u.time.value = (Number(u.time.value) || 0) + dt;
    if (u.uTime) u.uTime.value = (Number(u.uTime.value) || 0) + dt;
  }
}

/**
 * First ShaderMaterial on an object or its descendants.
 * @param {THREE.Object3D|null|undefined} object
 * @returns {THREE.ShaderMaterial|null}
 */
export function findShaderMaterial(object) {
  if (!object) return null;
  const mats = object.material;
  if (Array.isArray(mats)) {
    const hit = mats.find((m) => m?.isShaderMaterial);
    if (hit) return hit;
  } else if (mats?.isShaderMaterial) {
    return mats;
  }
  for (const child of object.children ?? []) {
    const found = findShaderMaterial(child);
    if (found) return found;
  }
  return null;
}

/**
 * Expose uniforms / setUniform on a runtime element and tick time each frame.
 * @param {object} entry
 * @param {THREE.Material|THREE.Material[]|null|undefined} material
 * @returns {object}
 */
export function bindShaderMaterial(entry, material) {
  const shader =
    material?.isShaderMaterial
      ? material
      : Array.isArray(material)
        ? material.find((m) => m?.isShaderMaterial)
        : null;
  if (!shader) return entry;

  entry.uniforms = shader.uniforms;
  entry.setUniform = (name, value) => setShaderUniform(shader, name, value);
  const prev = entry.update;
  entry.update = (delta) => {
    updateShaderMaterial(material, delta);
    prev?.(delta);
  };
  return entry;
}

/**
 * Build a Three.js ShaderMaterial from an engine material / shader def.
 *
 * ```js
 * { type: 'shader', color: 0xff4d6d, intensity: 1.2, uniforms: { uPhase: 0.4 } }
 * { type: 'shader', vertexShader, fragmentShader, uniforms: { time: 0 } }
 * ```
 *
 * @param {object} [def={}]
 * @returns {THREE.ShaderMaterial}
 */
export function createShaderMaterial(def = {}) {
  const color = new THREE.Color(parseColor(def.color ?? def.uColor, 0xffffff));
  const intensity = def.intensity ?? def.uIntensity ?? 1;
  const opacity = def.opacity ?? 1;
  const phase = def.phase ?? def.uPhase ?? 0;

  const uniforms = {
    uColor: { value: color },
    uIntensity: { value: Number(intensity) || 0 },
    uOpacity: { value: Number(opacity) || 0 },
    time: { value: 0 },
    uTime: { value: 0 },
    uPhase: { value: Number(phase) || 0 },
    ...parseUniforms(def.uniforms),
  };

  // Keep convenience fields in sync if the user also passed them in uniforms
  if (def.color != null || def.uColor != null) {
    uniforms.uColor = { value: color };
  }
  if (def.intensity != null || def.uIntensity != null) {
    uniforms.uIntensity = { value: Number(intensity) || 0 };
  }
  if (def.opacity != null) {
    uniforms.uOpacity = { value: Number(opacity) || 0 };
  }

  const vertexShader = resolveShaderSource(
    def.vertexShader ?? def.vertex,
    DEFAULT_VERTEX_SHADER,
  );
  const fragmentShader = resolveShaderSource(
    def.fragmentShader ?? def.fragment,
    DEFAULT_FRAGMENT_SHADER,
  );

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: !!def.transparent || (def.opacity != null && def.opacity < 1),
    opacity: Number(opacity) || 1,
    wireframe: !!def.wireframe,
    side: def.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
    depthTest: def.depthTest !== false,
    depthWrite: def.depthWrite !== false,
    lights: false,
    fog: false,
  });
  material.userData.engineShader = true;
  return material;
}
