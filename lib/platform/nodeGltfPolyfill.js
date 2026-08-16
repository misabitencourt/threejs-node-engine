/**
 * One-shot Node polyfills so three's GLTFLoader can decode embedded images
 * without a browser DOM (used by @napi-rs/canvas).
 */
import fs from 'node:fs';
import { Blob } from 'node:buffer';
import { createCanvas, loadImage } from '@napi-rs/canvas';

let installed = false;

class NodeImage {
  #src = '';
  #listeners = { load: new Set(), error: new Set() };

  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  complete = false;
  /** @type {Uint8ClampedArray | null} */
  data = null;
  onload = null;
  onerror = null;

  addEventListener(type, fn) {
    this.#listeners[type]?.add(fn);
  }

  removeEventListener(type, fn) {
    this.#listeners[type]?.delete(fn);
  }

  get src() {
    return this.#src;
  }

  set src(url) {
    this.#src = url;
    this.#load(url);
  }

  async #load(url) {
    try {
      let buffer;
      if (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:')) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } else if (url.startsWith('data:')) {
        const comma = url.indexOf(',');
        const meta = url.slice(0, comma);
        const payload = url.slice(comma + 1);
        buffer = meta.includes(';base64')
          ? Buffer.from(payload, 'base64')
          : Buffer.from(decodeURIComponent(payload));
      } else {
        buffer = await fs.promises.readFile(url);
      }

      const decoded = await loadImage(buffer);
      const canvas = createCanvas(decoded.width, decoded.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(decoded, 0, 0);
      const imageData = ctx.getImageData(0, 0, decoded.width, decoded.height);

      this.width = imageData.width;
      this.height = imageData.height;
      this.naturalWidth = imageData.width;
      this.naturalHeight = imageData.height;
      this.data = imageData.data;
      this.complete = true;

      this.onload?.call(this);
      for (const fn of this.#listeners.load) fn.call(this);
    } catch (err) {
      this.onerror?.call(this, err);
      for (const fn of this.#listeners.error) fn.call(this, err);
    }
  }
}

/**
 * Install global polyfills once (safe to call multiple times).
 */
export function ensureNodeGltfPolyfill() {
  if (installed) return;
  installed = true;

  globalThis.self = globalThis;
  globalThis.Blob = Blob;
  globalThis.Image = NodeImage;
  globalThis.HTMLImageElement = NodeImage;
  globalThis.document = {
    createElementNS(_ns, tag) {
      if (tag === 'img') return new NodeImage();
      if (tag === 'canvas') return createCanvas(1, 1);
      return {};
    },
    createElement(tag) {
      if (tag === 'img') return new NodeImage();
      if (tag === 'canvas') return createCanvas(1, 1);
      return {};
    },
  };
}
