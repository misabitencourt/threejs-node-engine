import { parseColor } from '../graphics/texture.js';

/**
 * CPU bitmap — row-major pixel buffer, Cartesian origin top-left, y down.
 *
 * Each cell is RGBA. Colors accept hex `0xrrggbb` / `'#rrggbb'`,
 * `[r,g,b]` / `[r,g,b,a]` (0–255), or `{ r, g, b, a }`.
 *
 * ```js
 * const bmp = createBitmap({ width: 16, height: 16, fill: 0x1b4332 })
 * bmp.setPixel(3, 4, 0x4f8cff)
 * bmp.pixels = [0xff0000, 0x00ff00, ...]
 * ```
 *
 * @typedef {object} Bitmap
 * @property {number} width
 * @property {number} height
 * @property {Uint8ClampedArray} data  RGBA bytes, length width*height*4
 * @property {(x: number, y: number, color: unknown) => boolean} setPixel
 * @property {(x: number, y: number) => number} getPixel  0xrrggbb (alpha ignored)
 * @property {(x: number, y: number) => [number, number, number, number]} getPixelRgba
 * @property {(color?: unknown) => void} fill
 * @property {(pixels: unknown) => void} setPixels
 * @property {() => number[]} getPixels  flat 0xrrggbb row-major
 * @property {(fn: () => void) => () => void} onChange
 * @property {() => void} touch  mark dirty after writing `.data` directly
 */

/**
 * Expand a color value to RGBA 0–255.
 * Numbers / `#rrggbb` are opaque unless `#rrggbbaa` or `{ a }` / `[r,g,b,a]`.
 *
 * @param {unknown} value
 * @param {number} [fallback=0x000000]
 * @returns {[number, number, number, number]}
 */
export function parsePixelRgba(value, fallback = 0x000000) {
  if (value == null) {
    return hexToRgba(fallback, 255);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = value >>> 0;
    return hexToRgba(n, 255);
  }

  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('#') && (s.length === 9 || s.length === 5)) {
      if (s.length === 9) {
        const rgb = parseInt(s.slice(1, 7), 16);
        const a = parseInt(s.slice(7, 9), 16);
        return hexToRgba(rgb, Number.isFinite(a) ? a : 255);
      }
      const r = s[1] + s[1];
      const g = s[2] + s[2];
      const b = s[3] + s[3];
      const a = s[4] + s[4];
      return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16)];
    }
    return hexToRgba(parseColor(s, fallback), 255);
  }

  if (Array.isArray(value) && value.length >= 3) {
    return [
      clampByte(value[0]),
      clampByte(value[1]),
      clampByte(value[2]),
      value.length >= 4 ? clampByte(value[3]) : 255,
    ];
  }

  if (value && typeof value === 'object') {
    const o = /** @type {{ r?: number, g?: number, b?: number, a?: number }} */ (value);
    if (o.r != null || o.g != null || o.b != null) {
      return [
        clampByte(o.r ?? 0),
        clampByte(o.g ?? 0),
        clampByte(o.b ?? 0),
        o.a != null ? clampByte(o.a) : 255,
      ];
    }
  }

  return hexToRgba(fallback, 255);
}

/**
 * Pack RGB bytes to 0xrrggbb (engine color number).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function packRgb(r, g, b) {
  return ((clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)) >>> 0;
}

/**
 * Create a mutable bitmap buffer.
 *
 * `pixels` may be a flat color list, a row-major 2D array, RGBA bytes,
 * or another bitmap (`{ width, height, data }`).
 *
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {unknown} [options.pixels]
 * @param {unknown} [options.fill]
 * @returns {Bitmap}
 */
export function createBitmap(options = {}) {
  const from = isBitmapLike(options.pixels) ? options.pixels : options.bitmap;
  const width = Math.max(
    1,
    Math.floor(options.width ?? options.w ?? from?.width ?? 1) || 1,
  );
  const height = Math.max(
    1,
    Math.floor(options.height ?? options.h ?? from?.height ?? 1) || 1,
  );

  const data = new Uint8ClampedArray(width * height * 4);
  /** @type {Set<() => void>} */
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {unknown} color
   */
  function setPixel(x, y, color) {
    const ix = Math.floor(Number(x));
    const iy = Math.floor(Number(y));
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
    const [r, g, b, a] = parsePixelRgba(color);
    const i = (iy * width + ix) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
    notify();
    return true;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {[number, number, number, number]}
   */
  function getPixelRgba(x, y) {
    const ix = Math.floor(Number(x));
    const iy = Math.floor(Number(y));
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return [0, 0, 0, 0];
    const i = (iy * width + ix) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  function getPixel(x, y) {
    const [r, g, b] = getPixelRgba(x, y);
    return packRgb(r, g, b);
  }

  /**
   * @param {unknown} [color]
   */
  function fill(color = options.fill ?? 0x000000) {
    const [r, g, b, a] = parsePixelRgba(color, 0x000000);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    notify();
  }

  /**
   * @param {unknown} pixels
   */
  function setPixels(pixels) {
    writePixels(data, width, height, pixels);
    notify();
  }

  function getPixels() {
    const out = new Array(width * height);
    for (let i = 0; i < out.length; i++) {
      const o = i * 4;
      out[i] = packRgb(data[o], data[o + 1], data[o + 2]);
    }
    return out;
  }

  if (options.pixels != null) {
    writePixels(data, width, height, options.pixels);
  } else if (from) {
    writePixels(data, width, height, from);
  } else if (options.fill != null) {
    writeFill(data, parsePixelRgba(options.fill));
  } else {
    writeFill(data, [0, 0, 0, 0]);
  }

  return {
    width,
    height,
    data,
    setPixel,
    getPixel,
    getPixelRgba,
    fill,
    setPixels,
    getPixels,
    /**
     * @param {() => void} fn
     * @returns {() => void}
     */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    touch: notify,
    get pixels() {
      return getPixels();
    },
    set pixels(value) {
      setPixels(value);
    },
  };
}

/**
 * @param {unknown} value
 * @returns {value is { width: number, height: number, data: ArrayLike<number> }}
 */
function isBitmapLike(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof /** @type {{ width?: unknown }} */ (value).width === 'number' &&
    typeof /** @type {{ height?: unknown }} */ (value).height === 'number' &&
    /** @type {{ data?: unknown }} */ (value).data != null &&
    typeof /** @type {{ data: { length?: unknown } }} */ (value).data.length === 'number'
  );
}

/**
 * @param {number} n
 */
function clampByte(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * @param {number} rgb
 * @param {number} a
 * @returns {[number, number, number, number]}
 */
function hexToRgba(rgb, a) {
  const n = rgb >>> 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, clampByte(a)];
}

/**
 * @param {Uint8ClampedArray} data
 * @param {[number, number, number, number]} rgba
 */
function writeFill(data, rgba) {
  const [r, g, b, a] = rgba;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
}

/**
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {unknown} pixels
 */
function writePixels(data, width, height, pixels) {
  if (pixels == null) return;

  if (isBitmapLike(pixels)) {
    const src = pixels.data;
    const sw = pixels.width;
    const sh = pixels.height;
    const copyW = Math.min(width, sw);
    const copyH = Math.min(height, sh);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        const si = (y * sw + x) * 4;
        const di = (y * width + x) * 4;
        data[di] = src[si];
        data[di + 1] = src[si + 1];
        data[di + 2] = src[si + 2];
        data[di + 3] = src[si + 3];
      }
    }
    return;
  }

  if (pixels instanceof Uint8ClampedArray || pixels instanceof Uint8Array) {
    const n = Math.min(data.length, pixels.length);
    for (let i = 0; i < n; i++) data[i] = pixels[i];
    return;
  }

  if (Array.isArray(pixels) && pixels.length > 0 && Array.isArray(pixels[0])) {
    const rows = /** @type {unknown[][]} */ (pixels);
    const rh = Math.min(height, rows.length);
    for (let y = 0; y < rh; y++) {
      const row = rows[y] ?? [];
      const rw = Math.min(width, row.length);
      for (let x = 0; x < rw; x++) {
        const [r, g, b, a] = parsePixelRgba(row[x]);
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    return;
  }

  if (Array.isArray(pixels) || ArrayBuffer.isView(pixels)) {
    const list = /** @type {ArrayLike<unknown>} */ (pixels);
    const n = Math.min(width * height, list.length);
    for (let i = 0; i < n; i++) {
      const [r, g, b, a] = parsePixelRgba(list[i]);
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = a;
    }
  }
}

export default createBitmap;
