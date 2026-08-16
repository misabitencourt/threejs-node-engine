import * as THREE from 'three';
import { createMaterial } from '../graphics/material.js';
import { applyTexture } from '../graphics/texture.js';
import { vec3 } from './math.js';

/**
 * 3D tile terrain — one quad per cell with rotations:
 *   0 = flat
 *   1 = 45° left  (left low)
 *   2 = 45° top   (top / −Z low)
 *   3 = 45° right (right low)
 *   4 = 45° bottom (bottom / +Z low)
 *
 * Heights live on a shared (cols+1)×(rows+1) grid so edges match neighbors.
 */

/**
 * @typedef {object} Tile3dOptions
 * @property {number} [width=16]           columns
 * @property {number} [height=16]          rows
 * @property {number} [tileSize=1]         base world size of one cell (before scale)
 * @property {number} [scale=1]            map scale multiplier (XZ + ramp height)
 * @property {number} [step]               vertical step for 45° ramps before scale (default = tileSize)
 * @property {number[]} [rotations]        length width*height, values 0..4
 * @property {number[]|{x?:number,y?:number,z?:number}} [position=[0,0,0]]  map center
 * @property {boolean} [wireframe=true]    edge outlines
 * @property {boolean} [colorByRotation=true]  tint tiles by rotation (ignored if material/texture)
 * @property {object} [material]
 * @property {import('../graphics/texture.js').TextureConfig} [texture]
 */

/**
 * @typedef {object} Tile3dMap
 * @property {THREE.Group} mesh
 * @property {(worldX: number, worldZ: number, fallback?: number) => number} sampleHeight
 * @property {(worldX: number, worldZ: number) => boolean} contains
 * @property {{ minX: number, maxX: number, minZ: number, maxZ: number }} bounds
 * @property {number} cols
 * @property {number} rows
 * @property {number} tileSize   world cell size (base × scale)
 * @property {number} baseTileSize
 * @property {number} scale
 * @property {number} step       world ramp step (base × scale)
 * @property {Float32Array} heights  grid (cols+1)*(rows+1) in world units
 * @property {number[]} rotations
 * @property {[number, number, number]} origin  world position of tile (0,0) corner (TL in XZ)
 * @property {[number, number, number]} position  map center
 */

/**
 * Resolve / apply tilemap scale to size options.
 *
 * ```js
 * setTileMapScale({ tileSize: 1, step: 1 }, 10)
 * // → { tileSize: 10, step: 10, scale: 10, baseTileSize: 1, baseStep: 1 }
 * ```
 *
 * @param {object} [options={}]  may include `tileSize`, `size`, `step`, `scale`
 * @param {number} [scale]       override scale (default: `options.scale` or 1)
 * @returns {{
 *   scale: number,
 *   baseTileSize: number,
 *   baseStep: number,
 *   tileSize: number,
 *   step: number,
 * }}
 */
export function setTileMapScale(options = {}, scale) {
  const s = Math.max(1e-8, Number(scale ?? options.scale ?? 1) || 1);
  const baseTileSize = Number(options.tileSize ?? options.size ?? 1) || 1;
  const baseStep =
    options.step != null ? Number(options.step) || baseTileSize : baseTileSize;
  return {
    scale: s,
    baseTileSize,
    baseStep,
    tileSize: baseTileSize * s,
    step: baseStep * s,
  };
}

/** @param {number} v @param {number} lo @param {number} hi */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Default demo layout (same idea as raw tilemap: bands of ramps).
 * @param {number} cols
 * @param {number} rows
 * @returns {number[]}
 */
export function defaultTileRotations(cols, rows) {
  const out = new Array(cols * rows).fill(0);
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const i = z * cols + x;
      // A few ramp bands for hills
      if (z >= 3 && z <= 5) out[i] = 2; // top-low ramp strip
      else if (z >= 10 && z <= 12) out[i] = 4; // bottom-low
      else if (x >= 3 && x <= 5 && z >= 6 && z <= 9) out[i] = 1; // left-low
      else if (x >= 10 && x <= 12 && z >= 6 && z <= 9) out[i] = 3; // right-low
    }
  }
  return out;
}

/**
 * @param {number} hTL
 * @param {number} rotation
 * @param {number} step
 */
export function cornersFromRotation(hTL, rotation, step) {
  switch (rotation) {
    case 1: // left low
      return { hTL, hTR: hTL + step, hBL: hTL, hBR: hTL + step };
    case 2: // top (−Z) low
      return { hTL, hTR: hTL, hBL: hTL + step, hBR: hTL + step };
    case 3: // right low
      return { hTL, hTR: hTL - step, hBL: hTL, hBR: hTL - step };
    case 4: // bottom (+Z) low
      return { hTL, hTR: hTL, hBL: hTL - step, hBR: hTL - step };
    default:
      return { hTL, hTR: hTL, hBL: hTL, hBR: hTL };
  }
}

/**
 * Build shared vertex height grid from tile rotations.
 * @param {number} cols
 * @param {number} rows
 * @param {number[]} rotations
 * @param {number} step
 * @returns {Float32Array}
 */
export function buildTileHeightGrid(cols, rows, rotations, step) {
  const gw = cols + 1;
  const gh = rows + 1;
  const heights = new Float32Array(gw * gh);
  const sum = new Float32Array(gw * gh);
  const n = new Uint16Array(gw * gh);

  const at = (x, z) => z * gw + x;
  const rotationAt = (x, z) => {
    if (x < 0 || z < 0 || x >= cols || z >= rows) return 0;
    return rotations[z * cols + x] ?? 0;
  };

  function add(x, z, y) {
    const i = at(x, z);
    sum[i] += y;
    n[i] += 1;
    heights[i] = sum[i] / n[i];
  }

  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      sum.fill(0);
      n.fill(0);
    }
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        const r = rotationAt(x, z);
        let hTL = heights[at(x, z)];

        if (pass === 0 && n[at(x, z)] === 0) {
          const guesses = [];
          if (x > 0) {
            const leftTL = heights[at(x - 1, z)];
            guesses.push(cornersFromRotation(leftTL, rotationAt(x - 1, z), step).hTR);
          }
          if (z > 0) {
            const topTL = heights[at(x, z - 1)];
            guesses.push(cornersFromRotation(topTL, rotationAt(x, z - 1), step).hBL);
          }
          if (guesses.length) {
            hTL = guesses.reduce((a, b) => a + b, 0) / guesses.length;
          } else if (x === 0 && z === 0) {
            hTL = 0;
          }
        } else {
          hTL = heights[at(x, z)];
        }

        const { hTR, hBL, hBR } = cornersFromRotation(hTL, r, step);
        add(x, z, hTL);
        add(x + 1, z, hTR);
        add(x, z + 1, hBL);
        add(x + 1, z + 1, hBR);
      }
    }
  }

  // Normalize so minimum height is 0 (float terrain up)
  let minH = Infinity;
  for (let i = 0; i < heights.length; i++) minH = Math.min(minH, heights[i]);
  if (Number.isFinite(minH) && minH !== 0) {
    for (let i = 0; i < heights.length; i++) heights[i] -= minH;
  }

  return heights;
}

/**
 * Bilinear sample on the height grid at world XZ.
 *
 * @param {Pick<Tile3dMap, 'heights'|'cols'|'rows'|'tileSize'|'origin'>} map
 * @param {number} worldX
 * @param {number} worldZ
 * @param {number} [fallback=0]
 */
export function sampleTileHeightAt(map, worldX, worldZ, fallback = 0) {
  const cols = map.cols;
  const rows = map.rows;
  const ts = map.tileSize;
  const origin = map.origin ?? [0, 0, 0];
  const localX = worldX - origin[0];
  const localZ = worldZ - origin[2];

  if (localX < 0 || localZ < 0 || localX > cols * ts || localZ > rows * ts) {
    return fallback;
  }

  // Continuous grid coords in [0, cols] × [0, rows]
  const gx = clamp(localX / ts, 0, cols);
  const gz = clamp(localZ / ts, 0, rows);
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(x0 + 1, cols);
  const z1 = Math.min(z0 + 1, rows);
  const tx = gx - x0;
  const tz = gz - z0;

  const gw = cols + 1;
  const h = map.heights;
  const h00 = h[z0 * gw + x0];
  const h10 = h[z0 * gw + x1];
  const h01 = h[z1 * gw + x0];
  const h11 = h[z1 * gw + x1];

  const a = h00 * (1 - tx) + h10 * tx;
  const b = h01 * (1 - tx) + h11 * tx;
  return origin[1] + a * (1 - tz) + b * tz;
}

/**
 * @param {number} r
 */
function colorForRotation(r) {
  switch (r) {
    case 1:
      return 0xe76f51;
    case 2:
      return 0x2a9d8f;
    case 3:
      return 0xe9c46a;
    case 4:
      return 0xf4a261;
    default:
      return 0x40916c;
  }
}

/**
 * Create 3D tile terrain mesh + height sampler.
 *
 * @param {Tile3dOptions} options
 * @returns {Promise<Tile3dMap>}
 */
export async function create3dTileMap(options = {}) {
  const cols = Math.max(1, Math.floor(options.width ?? options.cols ?? 16));
  const rows = Math.max(1, Math.floor(options.height ?? options.rows ?? 16));
  const sized = setTileMapScale(options, options.scale);
  const tileSize = sized.tileSize;
  const step = sized.step;
  const scale = sized.scale;
  const center = vec3(options.position, [0, 0, 0]);
  const wantWire = options.wireframe !== false;
  const hasCustomLook = options.material != null || options.texture != null;
  const colorByRotation =
    options.colorByRotation != null ? options.colorByRotation !== false : !hasCustomLook;

  let rotations = options.rotations;
  if (!Array.isArray(rotations) || rotations.length < cols * rows) {
    rotations = defaultTileRotations(cols, rows);
  } else {
    rotations = rotations.slice(0, cols * rows);
  }

  const heights = buildTileHeightGrid(cols, rows, rotations, step);

  // Origin = world position of tile (0,0) corner (top-left in XZ: min X, min Z)
  const mapW = cols * tileSize;
  const mapD = rows * tileSize;
  /** @type {[number, number, number]} */
  const origin = [center[0] - mapW / 2, center[1], center[2] - mapD / 2];

  const root = new THREE.Group();
  root.name = '3dtile';
  root.position.set(origin[0], origin[1], origin[2]);

  /** @type {THREE.Material} */
  let sharedMaterial = null;
  if (hasCustomLook) {
    sharedMaterial = createMaterial(
      options.material ?? {
        type: 'standard',
        color: 0xffffff,
        metalness: 0.08,
        roughness: 0.85,
        side: 'double',
      },
    );
    if ('flatShading' in sharedMaterial) {
      /** @type {THREE.MeshStandardMaterial} */ (sharedMaterial).flatShading = true;
    }
    if ('side' in sharedMaterial) {
      /** @type {THREE.MeshStandardMaterial} */ (sharedMaterial).side = THREE.DoubleSide;
    }
    await applyTexture(sharedMaterial, options.texture);
  }

  const gw = cols + 1;

  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const hTL = heights[z * gw + x];
      const hTR = heights[z * gw + (x + 1)];
      const hBL = heights[(z + 1) * gw + x];
      const hBR = heights[(z + 1) * gw + (x + 1)];
      const r = rotations[z * cols + x] ?? 0;

      const x0 = x * tileSize;
      const x1 = (x + 1) * tileSize;
      const z0 = z * tileSize;
      const z1 = (z + 1) * tileSize;

      // Two triangles (same winding as raw tilemap)
      const positions = new Float32Array([
        x0,
        hTL,
        z0,
        x0,
        hBL,
        z1,
        x1,
        hTR,
        z0,

        x1,
        hTR,
        z0,
        x0,
        hBL,
        z1,
        x1,
        hBR,
        z1,
      ]);

      const uvs = new Float32Array([0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0]);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();

      let material;
      if (sharedMaterial) {
        material = sharedMaterial;
      } else {
        material = new THREE.MeshStandardMaterial({
          color: colorByRotation ? colorForRotation(r) : 0x40916c,
          metalness: 0.08,
          roughness: 0.85,
          flatShading: true,
          side: THREE.DoubleSide,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.tile = { x, z, rotation: r };
      root.add(mesh);

      if (wantWire) {
        const tl = new THREE.Vector3(x0, hTL, z0);
        const tr = new THREE.Vector3(x1, hTR, z0);
        const bl = new THREE.Vector3(x0, hBL, z1);
        const br = new THREE.Vector3(x1, hBR, z1);
        root.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([tl, tr, br, bl, tl]),
            new THREE.LineBasicMaterial({ color: 0x1b4332, transparent: true, opacity: 0.35 }),
          ),
        );
      }
    }
  }

  /** @type {Tile3dMap} */
  const map = {
    mesh: root,
    heights,
    rotations,
    cols,
    rows,
    tileSize,
    baseTileSize: sized.baseTileSize,
    scale,
    step,
    origin,
    position: center,
    bounds: {
      minX: origin[0],
      maxX: origin[0] + mapW,
      minZ: origin[2],
      maxZ: origin[2] + mapD,
    },
    sampleHeight(worldX, worldZ, fallback = 0) {
      return sampleTileHeightAt(map, worldX, worldZ, fallback);
    },
    contains(worldX, worldZ) {
      const lx = worldX - origin[0];
      const lz = worldZ - origin[2];
      return lx >= 0 && lz >= 0 && lx <= mapW && lz <= mapD;
    },
  };

  return map;
}

export default create3dTileMap;
