import { createGeometryObject } from './geometry.js';
import { createImageSpriteObject } from './imageSprite.js';
import { createImageSprite2DObject } from './imageSprite2d.js';
import { createHeightmapObject } from './heightmap.js';
import { createTile3dObject } from './tile3d.js';
import { createGltfObject } from './gltf.js';
import { createTextObject } from './text.js';
import { createText2DObject } from './text2d.js';
import { createBackgroundObject } from './background.js';
import { createBitmap2DObject } from './bitmap2d.js';

/**
 * @typedef {import('./geometry.js').RuntimeObject} RuntimeObject
 */

/**
 * Optional context passed when building scene objects (camera, viewport size).
 * @typedef {object} CreateObjectContext
 * @property {import('three').PerspectiveCamera} [camera]
 * @property {number} [width]
 * @property {number} [height]
 */

/** @type {Record<string, (def: object, ctx?: CreateObjectContext) => Promise<RuntimeObject>|RuntimeObject>} */
const factories = {
  geometry: createGeometryObject,
  '3dimagesprite': createImageSpriteObject,
  // aliases
  imagesprite: createImageSpriteObject,
  imageSprite: createImageSpriteObject,
  text: createTextObject,
  '3dtext': createTextObject,
  '2dtext': createText2DObject,
  text2d: createText2DObject,
  '2dimagesprite': createImageSprite2DObject,
  imageSprite2d: createImageSprite2DObject,
  imagesprite2d: createImageSprite2DObject,
  heightmap: createHeightmapObject,
  '3dtile': createTile3dObject,
  tile3d: createTile3dObject,
  tilemap: createTile3dObject,
  gltf: createGltfObject,
  glb: createGltfObject,
  model: createGltfObject,
  background: createBackgroundObject,
  backgroundImage: createBackgroundObject,
  backdrop: createBackgroundObject,
  '2dbitmap': createBitmap2DObject,
  bitmap: createBitmap2DObject,
  bitmap2d: createBitmap2DObject,
  pixels: createBitmap2DObject,
};

/**
 * Build a scene object from a JSON definition.
 * @param {object} def
 * @param {CreateObjectContext} [ctx]
 * @returns {Promise<RuntimeObject>}
 */
export async function createSceneObject(def, ctx = {}) {
  if (!def || typeof def !== 'object') {
    throw new Error('Object definition must be an object');
  }

  const type = def.type;
  const factory = factories[type];
  if (!factory) {
    const supported = Object.keys(factories).join(', ');
    throw new Error(`Unknown object type: "${type}". Supported: ${supported}`);
  }

  return await factory(def, ctx);
}

/**
 * Register a custom object type factory (for engine extensions).
 * @param {string} type
 * @param {(def: object) => RuntimeObject} factory
 */
export function registerObjectType(type, factory) {
  factories[type] = factory;
}
