import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as THREE from 'three';
import { createMaterial } from '../graphics/material.js';
import { applyTexture, resolveImagePath } from '../graphics/texture.js';
import { vec3 } from './math.js';

/**
 * Heightmap terrain helpers — load a greyscale PNG, build a displaced mesh,
 * and sample elevation at world (x, z).
 *
 * World layout matches Three.js PlaneGeometry(worldSize,worldSize) rotated -90° on X
 * where worldSize = size * scale:
 *   X: left → right, Z after rotate matches sampleHeightAt mapping
 * Mesh Y is elevation (0 … maxHeight * scale after normalize).
 *
 * Optional `material` / `texture` use the same helpers as geometry elements.
 * When either is set, height-based vertex colors default off so the map shows.
 */

/**
 * @typedef {object} HeightmapOptions
 * @property {string} image                 path to height PNG (displacement source)
 * @property {number} [size=24]             base world width & depth (before scale)
 * @property {number} [scale=1]             map scale multiplier (XZ + height)
 * @property {number} [maxHeight=4.5]       peak elevation before scale
 * @property {number[]|{x?:number,y?:number,z?:number}} [position=[0,0,0]]
 * @property {boolean} [wireframe=true]     faint wire overlay (not material.wireframe)
 * @property {boolean} [normalize=true]     stretch luma to 0..1 before height
 * @property {boolean} [vertexColors]       height-tint colors (default: on if no material/texture)
 * @property {object} [material]            same as geometry `material` (type, color, metalness, …)
 * @property {import('../graphics/texture.js').TextureConfig} [texture]  same as geometry `texture`
 */

/**
 * @typedef {object} Heightmap
 * @property {THREE.Mesh} mesh
 * @property {(worldX: number, worldZ: number, mapScale?: number) => number} sampleHeight
 * @property {(worldX: number, worldZ: number, mapScale?: number) => boolean} contains
 * @property {{ minX: number, maxX: number, minZ: number, maxZ: number }} bounds
 * @property {number} size       base size (before scale)
 * @property {number} scale      map scale used to build the mesh
 * @property {number} worldSize  size * scale
 * @property {number} maxHeight  base peak height (before scale)
 * @property {[number, number, number]} position
 * @property {{ width: number, height: number, minLuma: number, maxLuma: number, vertices: number }} stats
 * @property {Float32Array} heights  normalized 0..1 samples (row-major, image top-left)
 * @property {number} mapWidth
 * @property {number} mapHeight
 */

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Bilinear sample of a row-major float grid.
 * @param {Float32Array} data
 * @param {number} w
 * @param {number} h
 * @param {number} fx  pixel x (can be fractional)
 * @param {number} fy  pixel y (can be fractional)
 */
export function sampleGridBilinear(data, w, h, fx, fy) {
  const x = clamp(fx, 0, w - 1);
  const y = clamp(fy, 0, h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = x - x0;
  const ty = y - y0;

  const h00 = data[y0 * w + x0];
  const h10 = data[y0 * w + x1];
  const h01 = data[y1 * w + x0];
  const h11 = data[y1 * w + x1];

  const a = h00 * (1 - tx) + h10 * tx;
  const b = h01 * (1 - tx) + h11 * tx;
  return a * (1 - ty) + b * ty;
}

/**
 * Map world XZ → fractional image pixel coords (same mapping as mesh verts).
 *
 * Three.js PlaneGeometry stores verts as (x, -y, 0); after rotateX(-π/2):
 *   j=0        → world z = -worldSize/2
 *   j=segsY    → world z = +worldSize/2
 * Mesh build uses image row py = segsY - j, so:
 *   z = -worldSize/2 → image bottom (py = h-1)
 *   z = +worldSize/2 → image top    (py = 0)
 *
 * @param {number} worldX
 * @param {number} worldZ
 * @param {number} worldSize  full world footprint (base size × map scale)
 * @param {number} mapW
 * @param {number} mapH
 * @param {[number, number, number]} origin  terrain position
 * @returns {[number, number]|null} [fx, fy] or null if outside
 */
export function worldToHeightmapPixel(
  worldX,
  worldZ,
  worldSize,
  mapW,
  mapH,
  origin = [0, 0, 0],
) {
  const half = worldSize / 2;
  const localX = worldX - origin[0];
  const localZ = worldZ - origin[2];

  if (localX < -half || localX > half || localZ < -half || localZ > half) {
    return null;
  }

  // X: -half..+half → 0..mapW-1 (image left → right)
  const fx = ((localX / worldSize) + 0.5) * (mapW - 1);
  // Z inverted vs naive UV: +Z → image top (fy=0), -Z → image bottom (fy=h-1)
  const fy = (0.5 - localZ / worldSize) * (mapH - 1);

  return [fx, fy];
}

/**
 * Resolve map scale from an explicit argument or the heightmap object.
 * @param {Pick<Heightmap, 'scale'|'size'>} hm
 * @param {number} [mapScale]
 */
export function resolveMapScale(hm, mapScale) {
  if (mapScale != null && Number.isFinite(Number(mapScale))) {
    return Math.max(1e-8, Number(mapScale));
  }
  if (hm?.scale != null && Number.isFinite(Number(hm.scale))) {
    return Math.max(1e-8, Number(hm.scale));
  }
  return 1;
}

/**
 * Sample elevation at world (x, z). Returns `fallback` outside the map.
 *
 * World footprint used for sampling is `hm.size * mapScale`.
 * Peak elevation is `hm.maxHeight * mapScale` (uniform map scale).
 *
 * @param {Pick<Heightmap, 'heights'|'mapWidth'|'mapHeight'|'size'|'maxHeight'|'position'|'scale'>} hm
 * @param {number} worldX
 * @param {number} worldZ
 * @param {number} [mapScale]  map scale (default: `hm.scale` or 1)
 * @param {number} [fallback=0]
 * @returns {number} world Y (includes terrain position.y)
 */
export function sampleHeightAt(hm, worldX, worldZ, mapScale, fallback = 0) {
  const scale = resolveMapScale(hm, mapScale);
  const origin = hm.position ?? [0, 0, 0];
  const baseSize = hm.size ?? 24;
  const worldSize = baseSize * scale;

  const pix = worldToHeightmapPixel(
    worldX,
    worldZ,
    worldSize,
    hm.mapWidth,
    hm.mapHeight,
    origin,
  );
  if (!pix) return fallback;

  const t = sampleGridBilinear(hm.heights, hm.mapWidth, hm.mapHeight, pix[0], pix[1]);
  return origin[1] + t * (hm.maxHeight ?? 0) * scale;
}

/**
 * Load PNG luminance into a normalized Float32Array (0..1).
 * @param {string} imagePath
 * @param {boolean} [normalize=true]
 */
export async function loadHeightmapSamples(imagePath, normalize = true) {
  const full = resolveImagePath(imagePath);
  const img = await loadImage(full);
  const w = img.width;
  const h = img.height;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

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

  if (normalize) {
    const range = Math.max(1e-6, maxL - minL);
    for (let i = 0; i < heights.length; i++) {
      heights[i] = (heights[i] - minL) / range;
    }
  }

  return { heights, width: w, height: h, minLuma: minL, maxLuma: maxL };
}

/**
 * Create terrain mesh + height sampler from a heightmap image.
 *
 * @param {HeightmapOptions} options
 * @returns {Promise<Heightmap>}
 */
export async function createHeightmap(options) {
  if (!options?.image) {
    throw new Error('createHeightmap requires `image` (path to PNG)');
  }

  const size = options.size ?? 24;
  const scale = Math.max(1e-8, Number(options.scale ?? 1) || 1);
  const maxHeight = options.maxHeight ?? 4.5;
  const worldSize = size * scale;
  const worldMaxHeight = maxHeight * scale;
  const position = vec3(options.position, [0, 0, 0]);
  const wantWire = options.wireframe !== false;
  const hasCustomLook = options.material != null || options.texture != null;
  // Vertex height-tint: on by default only when no material/texture is provided
  const wantColors =
    options.vertexColors != null ? options.vertexColors !== false : !hasCustomLook;
  const normalize = options.normalize !== false;

  const { heights, width: w, height: h, minLuma, maxLuma } = await loadHeightmapSamples(
    options.image,
    normalize,
  );

  const segsX = w - 1;
  const segsY = h - 1;
  const geometry = new THREE.PlaneGeometry(worldSize, worldSize, segsX, segsY);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = wantColors ? new Float32Array(positions.count * 3) : null;

  const low = new THREE.Color(0x2d6a4f);
  const mid = new THREE.Color(0x95d5b2);
  const high = new THREE.Color(0xf4f1de);
  const rock = new THREE.Color(0x6c757d);
  const tmp = new THREE.Color();

  for (let j = 0; j <= segsY; j++) {
    for (let i = 0; i <= segsX; i++) {
      const vi = j * (segsX + 1) + i;
      // PlaneGeometry row j=0 is world z=-worldSize/2 after rotateX(-π/2).
      // py = segsY - j → that row samples the image bottom (matches sampleHeight).
      const px = i;
      const py = segsY - j;
      const t = heights[py * w + px];
      positions.setY(vi, t * worldMaxHeight);

      if (colors) {
        if (t < 0.35) tmp.copy(low).lerp(mid, t / 0.35);
        else if (t < 0.7) tmp.copy(mid).lerp(high, (t - 0.35) / 0.35);
        else tmp.copy(high).lerp(rock, (t - 0.7) / 0.3);
        colors[vi * 3] = tmp.r;
        colors[vi * 3 + 1] = tmp.g;
        colors[vi * 3 + 2] = tmp.b;
      }
    }
  }

  positions.needsUpdate = true;
  if (colors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  geometry.computeVertexNormals();

  /** @type {THREE.Material} */
  let material;
  if (hasCustomLook) {
    material = createMaterial(
      options.material ?? {
        type: 'standard',
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.88,
      },
    );
    if ('vertexColors' in material) {
      /** @type {THREE.MeshStandardMaterial} */ (material).vertexColors = !!colors;
    }
    if ('flatShading' in material) {
      /** @type {THREE.MeshStandardMaterial} */ (material).flatShading = false;
    }
    await applyTexture(material, options.texture);
  } else {
    material = new THREE.MeshStandardMaterial({
      vertexColors: !!colors,
      color: colors ? 0xffffff : 0x4a7c59,
      metalness: 0.05,
      roughness: 0.88,
      flatShading: false,
      side: THREE.FrontSide,
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);

  if (wantWire) {
    mesh.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x1b4332,
          wireframe: true,
          transparent: true,
          opacity: 0.12,
        }),
      ),
    );
  }

  const half = worldSize / 2;
  /** @type {Heightmap} */
  const hm = {
    mesh,
    heights,
    mapWidth: w,
    mapHeight: h,
    size,
    scale,
    worldSize,
    maxHeight,
    position,
    bounds: {
      minX: position[0] - half,
      maxX: position[0] + half,
      minZ: position[2] - half,
      maxZ: position[2] + half,
    },
    stats: {
      width: w,
      height: h,
      minLuma,
      maxLuma,
      vertices: positions.count,
    },
    sampleHeight(worldX, worldZ, mapScale) {
      return sampleHeightAt(hm, worldX, worldZ, mapScale ?? scale, 0);
    },
    contains(worldX, worldZ, mapScale) {
      const s = resolveMapScale(hm, mapScale);
      return (
        worldToHeightmapPixel(worldX, worldZ, size * s, w, h, position) != null
      );
    },
  };

  return hm;
}

export default createHeightmap;
