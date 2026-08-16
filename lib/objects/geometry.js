import * as THREE from 'three';
import { createGeometry } from '../graphics/geometry.js';
import { createMaterial, resolveMaterialDef } from '../graphics/material.js';
import { bindShaderMaterial } from '../graphics/shader.js';
import { applyTransform } from '../graphics/transform.js';
import { applyTexture } from '../graphics/texture.js';

/**
 * Runtime scene entry produced from a JSON object definition.
 * @typedef {object} RuntimeObject
 * @property {THREE.Object3D} root
 * @property {object} def       original element definition (for cloning / spawn)
 * @property {boolean} visible  when false, element is not rendered
 * @property {number[]|null} pushForce  continuous push (units/sec); null = none
 * @property {(delta: number) => void} [update]
 */

/**
 * Normalize pushForce config: undefined/null → null, else [x,y,z].
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
 * Build a mesh object from `{ type: 'geometry', geometry: 'box'|..., ... }`.
 *
 * Supports:
 * - `visible` (default `true`)
 * - `texture` `{ color|raw?, image?, imageFill?, repeat? }`
 * - `pushForce` undefined or Vector3 `[x,y,z]` / `{x,y,z}` — continuous push (units/s)
 * - `rotationSpeed` `[rx,ry,rz]` rad/s
 * - `material.type: 'shader'` or `shader: { color, uniforms, vertexShader?, fragmentShader? }`
 *
 * @param {object} def
 * @returns {Promise<RuntimeObject>}
 */
export async function createGeometryObject(def) {
  const geometry = createGeometry(def);
  const material = createMaterial(resolveMaterialDef(def) ?? def.material);
  await applyTexture(material, def.texture);

  const mesh = new THREE.Mesh(geometry, material);
  applyTransform(mesh, def);

  // visible defaults to true; false → not rendered in the scene
  mesh.visible = def.visible !== false;

  if (def.edges) {
    const edgeColor =
      typeof def.edges === 'object' && def.edges.color != null ? def.edges.color : 0xc8dcff;
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: edgeColor }),
      ),
    );
  }

  const speed = Array.isArray(def.rotationSpeed) ? def.rotationSpeed : null;
  /** @type {number[]|null} */
  let force = parsePushForce(def.pushForce);

  const entry = {
    root: mesh,
    def,
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
      if (speed) {
        mesh.rotation.x += (speed[0] ?? 0) * delta;
        mesh.rotation.y += (speed[1] ?? 0) * delta;
        mesh.rotation.z += (speed[2] ?? 0) * delta;
      }
    },
  };
  return bindShaderMaterial(entry, material);
}
