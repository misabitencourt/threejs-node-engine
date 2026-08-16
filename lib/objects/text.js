import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { createMaterial, resolveMaterialDef } from '../graphics/material.js';
import { bindShaderMaterial } from '../graphics/shader.js';
import { applyTransform } from '../graphics/transform.js';
import { applyTexture } from '../graphics/texture.js';

const require = createRequire(import.meta.url);

/** @type {Map<string, import('three/examples/jsm/loaders/FontLoader.js').Font>} */
const fontCache = new Map();

/**
 * Resolve default Helvetiker font shipped with three.js.
 * @returns {string}
 */
function defaultFontPath() {
  return require.resolve('three/examples/fonts/helvetiker_regular.typeface.json');
}

/**
 * @param {string} fontPath
 * @returns {import('three/examples/jsm/loaders/FontLoader.js').Font}
 */
function loadFont(fontPath) {
  const full = path.isAbsolute(fontPath)
    ? fontPath
    : path.resolve(process.cwd(), fontPath);

  if (fontCache.has(full)) return fontCache.get(full);

  if (!fs.existsSync(full)) {
    throw new Error(`Text font not found: ${full}`);
  }

  const json = JSON.parse(fs.readFileSync(full, 'utf8'));
  const font = new FontLoader().parse(json);
  fontCache.set(full, font);
  return font;
}

/**
 * @param {unknown} value
 * @returns {number[]|null}
 */
function parsePushForce(value) {
  if (value == null) return null;
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  }
  if (typeof value === 'object') {
    const o = /** @type {{ x?: number, y?: number, z?: number }} */ (value);
    if (o.x != null || o.y != null || o.z != null) {
      return [Number(o.x) || 0, Number(o.y) || 0, Number(o.z) || 0];
    }
  }
  return null;
}

/**
 * Build extruded 3D text mesh via Three.js TextGeometry + FontLoader.
 *
 * ```js
 * {
 *   type: 'text',
 *   text: 'Hello',
 *   font: 'optional/path/to.typeface.json', // default: Helvetiker regular
 *   size: 0.5,           // glyph size
 *   height: 0.12,        // extrusion depth
 *   curveSegments: 4,
 *   bevelEnabled: true,
 *   bevelThickness: 0.02,
 *   bevelSize: 0.01,
 *   center: true,        // center geometry on origin
 *   material: { type: 'standard', color: 0xffcc00 },
 *   position: [0, 1, 0],
 *   rotation: [0, 0.4, 0],
 *   pushForce: null,
 *   visible: true,
 * }
 * ```
 *
 * Runtime: `.setText(string)`, `.pushForce`, `.visible`
 *
 * @param {object} def
 */
export async function createTextObject(def) {
  const content = def.text != null ? String(def.text) : '';
  if (!content) {
    throw new Error('text element requires a non-empty `text` string');
  }

  const fontPath = def.font || defaultFontPath();
  const font = loadFont(fontPath);

  const size = def.size ?? 0.5;
  const height = def.height ?? def.depth ?? 0.1;
  const curveSegments = def.curveSegments ?? 4;
  const bevelEnabled = def.bevelEnabled ?? false;
  const bevelThickness = def.bevelThickness ?? 0.02;
  const bevelSize = def.bevelSize ?? 0.01;
  const bevelOffset = def.bevelOffset ?? 0;
  const bevelSegments = def.bevelSegments ?? 2;
  const center = def.center !== false;

  function buildGeometry(str) {
    const geometry = new TextGeometry(str, {
      font,
      size,
      height,
      curveSegments,
      bevelEnabled,
      bevelThickness,
      bevelSize,
      bevelOffset,
      bevelSegments,
    });
    geometry.computeBoundingBox();
    if (center && geometry.boundingBox) {
      const bb = geometry.boundingBox;
      const midX = (bb.max.x + bb.min.x) / 2;
      const midY = (bb.max.y + bb.min.y) / 2;
      geometry.translate(-midX, -midY, -(bb.max.z + bb.min.z) / 2);
    }
    return geometry;
  }

  let geometry = buildGeometry(content);
  const material = createMaterial(
    resolveMaterialDef(def) ??
      def.material ?? {
        type: 'standard',
        color: 0xffcc66,
        metalness: 0.2,
        roughness: 0.45,
      },
  );
  await applyTexture(material, def.texture);

  const mesh = new THREE.Mesh(geometry, material);
  applyTransform(mesh, def);
  mesh.visible = def.visible !== false;

  /** @type {number[]|null} */
  let force = parsePushForce(def.pushForce);
  let currentText = content;

  function setText(next) {
    const str = next != null ? String(next) : '';
    if (str === currentText) return;
    currentText = str;
    const nextGeom = buildGeometry(str || ' ');
    mesh.geometry.dispose();
    mesh.geometry = nextGeom;
    geometry = nextGeom;
    def.text = currentText;
  }

  const entry = {
    root: mesh,
    def,
    get text() {
      return currentText;
    },
    set text(value) {
      setText(value);
    },
    setText,
    get visible() {
      return mesh.visible;
    },
    set visible(value) {
      mesh.visible = !!value;
    },
    get pushForce() {
      return force;
    },
    set pushForce(value) {
      force = parsePushForce(value);
    },
    update: (delta) => {
      if (force) {
        mesh.position.x += force[0] * delta;
        mesh.position.y += force[1] * delta;
        mesh.position.z += force[2] * delta;
      }
      if (Array.isArray(def.rotationSpeed)) {
        const speed = def.rotationSpeed;
        mesh.rotation.x += (speed[0] ?? 0) * delta;
        mesh.rotation.y += (speed[1] ?? 0) * delta;
        mesh.rotation.z += (speed[2] ?? 0) * delta;
      }
    },
  };
  return bindShaderMaterial(entry, material);
}
