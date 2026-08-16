import { create3dTileMap } from '../utils/tile3d.js';
import { resolveMaterialDef } from '../graphics/material.js';
import { bindShaderMaterial, findShaderMaterial } from '../graphics/shader.js';

/**
 * Engine element: 3D tile terrain (`type: '3dtile'`).
 *
 * ```js
 * {
 *   type: '3dtile',
 *   width: 16,
 *   height: 16,
 *   tileSize: 1,               // base cell size
 *   scale: 10,                 // world cell = tileSize * scale
 *   step: 1,                   // base ramp height (also × scale)
 *   rotations: [0,2,2,4, ...], // optional; default demo ramps
 *   position: [0, 0, 0],       // map center
 *   wireframe: true,
 *   material: { type: 'standard', roughness: 0.9 },
 *   texture: { image: 'assets/brick.jpeg', imageFill: 'tile', repeat: [1, 1] },
 * }
 * ```
 *
 * Runtime: `.sampleHeight(x, z)`, `.contains(x, z)`, `.tilemap` / `.tile3d`
 * Helper: `setTileMapScale(opts, scale)` from `lib/utils/tile3d.js` / engine
 *
 * @param {object} def
 */
export async function createTile3dObject(def) {
  const map = await create3dTileMap({
    width: def.width ?? def.cols,
    height: def.height ?? def.rows,
    tileSize: def.tileSize ?? def.size,
    scale: def.scale,
    step: def.step,
    rotations: def.rotations,
    position: def.position,
    wireframe: def.wireframe,
    colorByRotation: def.colorByRotation,
    material: resolveMaterialDef(def) ?? def.material,
    texture: def.texture,
  });

  map.mesh.visible = def.visible !== false;

  const entry = {
    root: map.mesh,
    def,
    tilemap: map,
    tile3d: map,
    sampleHeight: (x, z, fallback) => map.sampleHeight(x, z, fallback),
    contains: (x, z) => map.contains(x, z),
    get visible() {
      return map.mesh.visible;
    },
    set visible(value) {
      map.mesh.visible = !!value;
    },
    update: () => {},
  };
  return bindShaderMaterial(entry, findShaderMaterial(map.mesh));
}
