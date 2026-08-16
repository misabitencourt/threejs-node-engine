/**
 * Engine core — declarative Three.js + native OpenGL (Node, no browser).
 *
 * Usage:
 *   import { engine } from '../lib/engine.js'
 *   engine.create({ fps, window: { camera, ... }, elements: [...] })
 *
 * Modules:
 *   lib/core/          create + frame loop
 *   lib/platform/      native window, WebGL renderer, controls (keyboard)
 *   lib/scene/         camera
 *   lib/graphics/      geometry, material, transform, lights
 *   lib/objects/       scene object factories (geometry, …)
 *   lib/utils/         math helpers
 *
 * Optional window.gameloop(ctx) runs every frame with scene, window, controls.
 */
import { create } from './core/create.js';
import { resolveFullscreen } from './platform/window.js';
import { registerObjectType } from './objects/index.js';
import { pushForceFromRotation } from './utils/pushForce.js';
import { createAudio, decodeAudioFile } from './platform/audio.js';
import { scale3d, scaleBy, getScale } from './utils/scale.js';
import { scale2d, scaleBy2d, getScale2d } from './utils/scale2d.js';
import {
  createHeightmap,
  sampleHeightAt,
  loadHeightmapSamples,
  worldToHeightmapPixel,
} from './utils/heightmap.js';
import {
  create3dTileMap,
  sampleTileHeightAt,
  setTileMapScale,
} from './utils/tile3d.js';
import {
  loadBackgroundTexture,
  applyBackgroundFill,
  setSceneBackground,
} from './objects/background.js';
import { createBitmap, parsePixelRgba } from './utils/bitmap.js';
import {
  createShaderMaterial,
  setShaderUniform,
  updateShaderMaterial,
  DEFAULT_VERTEX_SHADER,
  DEFAULT_FRAGMENT_SHADER,
} from './graphics/shader.js';
import { createMaterial, resolveMaterialDef } from './graphics/material.js';
import collision, {
  collide,
  intersects,
  collideBoxBox,
  collideSphereSphere,
  collideBoxSphere,
  collideBoxCylinder,
  collideBoxCone,
  collideCylinderCylinder,
  collideConeCone,
  moveBoxWithCollisions,
  resolveBoxCollisions,
  shapeFromGeometryDef,
  boxFromSize,
} from './utils/collision.js';

/**
 * Public config / runtime types for TypeScript consumers.
 * @typedef {import('./core/create.js').EngineConfig} EngineConfig
 * @typedef {import('./core/create.js').EngineWindowConfig} EngineWindowConfig
 * @typedef {import('./core/create.js').EngineCameraConfig} EngineCameraConfig
 * @typedef {import('./core/create.js').EngineGameLoopCallback} EngineGameLoopCallback
 * @typedef {import('./core/create.js').EngineInstance} EngineInstance
 * @typedef {import('./objects/geometry.js').RuntimeObject} RuntimeObject
 * @typedef {import('./platform/controls.js').KeyboardState} KeyboardState
 * @typedef {import('./platform/controls.js').MouseState} MouseState
 */

/** Engine API surface — call `engine.create(jsonConfig)`. */
export const engine = {
  create,
  resolveFullscreen,
  registerObjectType,
  pushForceFromRotation,
  createAudio,
  decodeAudioFile,
  scale3d,
  scaleBy,
  getScale,
  scale2d,
  scaleBy2d,
  getScale2d,
  createHeightmap,
  sampleHeightAt,
  create3dTileMap,
  sampleTileHeightAt,
  setTileMapScale,
  loadBackgroundTexture,
  applyBackgroundFill,
  setSceneBackground,
  createBitmap,
  parsePixelRgba,
  createMaterial,
  resolveMaterialDef,
  createShaderMaterial,
  setShaderUniform,
  updateShaderMaterial,
  collision,
  collide,
  intersects,
  moveBoxWithCollisions,
  resolveBoxCollisions,
  shapeFromGeometryDef,
  boxFromSize,
};

export {
  create,
  resolveFullscreen,
  registerObjectType,
  pushForceFromRotation,
  createAudio,
  decodeAudioFile,
  scale3d,
  scaleBy,
  getScale,
  scale2d,
  scaleBy2d,
  getScale2d,
  createHeightmap,
  sampleHeightAt,
  loadHeightmapSamples,
  worldToHeightmapPixel,
  create3dTileMap,
  sampleTileHeightAt,
  setTileMapScale,
  loadBackgroundTexture,
  applyBackgroundFill,
  setSceneBackground,
  createBitmap,
  parsePixelRgba,
  createMaterial,
  resolveMaterialDef,
  createShaderMaterial,
  setShaderUniform,
  updateShaderMaterial,
  DEFAULT_VERTEX_SHADER,
  DEFAULT_FRAGMENT_SHADER,
  collision,
  collide,
  intersects,
  collideBoxBox,
  collideSphereSphere,
  collideBoxSphere,
  collideBoxCylinder,
  collideBoxCone,
  collideCylinderCylinder,
  collideConeCone,
  moveBoxWithCollisions,
  resolveBoxCollisions,
  shapeFromGeometryDef,
  boxFromSize,
};
export default engine;
