import sdl from '@kmamal/sdl';
import createContext from '@kmamal/gl';

/**
 * @typedef {object} NativeSurface
 * @property {import('@kmamal/sdl').Window} sdlWindow
 * @property {WebGLRenderingContext} gl
 * @property {object} canvas
 * @property {number} pixelWidth
 * @property {number} pixelHeight
 * @property {string} title
 */

/**
 * `window.fullscreen` (alias `fullScreen`). Default false.
 * @param {object} [winCfg={}]
 * @returns {boolean}
 */
export function resolveFullscreen(winCfg = {}) {
  if (winCfg.fullscreen != null) return !!winCfg.fullscreen;
  if (winCfg.fullScreen != null) return !!winCfg.fullScreen;
  return false;
}

/**
 * Create a native OpenGL window + WebGL context (no browser).
 * @param {object} winCfg  engine config.window fields (title, size, …)
 * @returns {NativeSurface}
 */
export function createNativeWindow(winCfg) {
  const width = winCfg.width ?? 800;
  const height = winCfg.height ?? 600;
  const title = winCfg.title ?? 'threejs-node-engine';
  const resizable = winCfg.resizable ?? false;
  const fullscreen = resolveFullscreen(winCfg);

  const sdlWindow = sdl.video.createWindow({
    title,
    width,
    height,
    resizable,
    fullscreen,
    opengl: true,
  });

  const { pixelWidth, pixelHeight, native } = sdlWindow;
  const gl = createContext(pixelWidth, pixelHeight, {
    window: native,
    antialias: true,
    depth: true,
    stencil: false,
    alpha: false,
  });

  if (!gl) {
    throw new Error('Failed to create WebGL context for window');
  }

  const canvas = {
    width: pixelWidth,
    height: pixelHeight,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext(type) {
      if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
        return gl;
      }
      return null;
    },
  };

  return {
    sdlWindow,
    gl,
    canvas,
    pixelWidth,
    pixelHeight,
    title,
  };
}
