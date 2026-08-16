import { createHeightmap } from '../utils/heightmap.js';
import { resolveMaterialDef } from '../graphics/material.js';
import { bindShaderMaterial, findShaderMaterial } from '../graphics/shader.js';

/**
 * Engine element: heightmap terrain (`type: 'heightmap'`).
 *
 * ```js
 * {
 *   type: 'heightmap',
 *   image: 'assets/map-01.png',   // height source (displacement)
 *   size: 24,
 *   scale: 10,                    // worldSize = size * scale
 *   maxHeight: 4.5,
 *   position: [0, 0, 0],
 *   wireframe: true,              // faint wire overlay
 *   material: { type: 'standard', roughness: 0.9 },
 *   texture: {
 *     image: 'assets/brick.jpeg', // surface map (not height)
 *     imageFill: 'tile',
 *     repeat: [8, 8],
 *   },
 * }
 * ```
 *
 * Runtime: `.sampleHeight(x, z, mapScale?)`, `.contains(x, z)`, `.heightmap`, `.visible`
 *
 * @param {object} def
 */
export async function createHeightmapObject(def) {
  const hm = await createHeightmap({
    image: def.image,
    size: def.size,
    scale: def.scale,
    maxHeight: def.maxHeight ?? def.height,
    position: def.position,
    wireframe: def.wireframe,
    normalize: def.normalize,
    vertexColors: def.vertexColors,
    material: resolveMaterialDef(def) ?? def.material,
    texture: def.texture,
  });

  hm.mesh.visible = def.visible !== false;

  const entry = {
    root: hm.mesh,
    def,
    heightmap: hm,
    sampleHeight: (x, z, mapScale) => hm.sampleHeight(x, z, mapScale),
    contains: (x, z, mapScale) => hm.contains(x, z, mapScale),
    get visible() {
      return hm.mesh.visible;
    },
    set visible(value) {
      hm.mesh.visible = !!value;
    },
    update: () => {},
  };
  return bindShaderMaterial(entry, findShaderMaterial(hm.mesh) ?? hm.mesh.material);
}
