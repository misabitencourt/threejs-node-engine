import sdl from '@kmamal/sdl';
import createContext from '@kmamal/gl';

/**
 * @typedef {object} NativeSurface
 * @property {import('@kmamal/sdl').Window} sdlWindow
 * @property {WebGLRenderingContext} gl
 * @property {object} canvas
 * @property {number} pixelWidth   GL drawable width (may be window points, not retina pixels)
 * @property {number} pixelHeight  GL drawable height
 * @property {boolean} useLogicalSize  true when the EGL surface is in window points
 * @property {string} title
 */

/**
 * Size of the actual GL color buffer for this window.
 *
 * On macOS retina, SDL `pixelWidth` is 2× window points, but ANGLE's EGL
 * window surface is often in points. Rendering at pixel size then maps NDC
 * onto a viewport twice as large as the drawable, so camera-fixed HUD
 * (`2dtext`, `2dimagesprite`, `2dbitmap`) is clipped off-screen.
 *
 * @param {import('@kmamal/sdl').Window} sdlWindow
 * @param {WebGLRenderingContext} gl
 * @returns {{ width: number, height: number, useLogicalSize: boolean }}
 */
export function resolveGlDrawableSize(sdlWindow, gl) {
  const logicalW = Math.max(1, sdlWindow.width | 0);
  const logicalH = Math.max(1, sdlWindow.height | 0);
  const pixelW = Math.max(1, sdlWindow.pixelWidth | 0);
  const pixelH = Math.max(1, sdlWindow.pixelHeight | 0);

  if (pixelW === logicalW && pixelH === logicalH) {
    return { width: pixelW, height: pixelH, useLogicalSize: false };
  }

  const prevViewport = gl.getParameter(gl.VIEWPORT);
  gl.viewport(0, 0, pixelW, pixelH);
  gl.clearColor(0.11, 0.33, 0.55, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const sample = new Uint8Array(4);
  gl.readPixels(logicalW, logicalH, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
  gl.getError();
  if (prevViewport) {
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
  }

  const retinaBuffer = sample[0] > 8 || sample[1] > 8 || sample[2] > 8;
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return retinaBuffer
    ? { width: pixelW, height: pixelH, useLogicalSize: false }
    : { width: logicalW, height: logicalH, useLogicalSize: true };
}

/**
 * Current drawable size, using the same points-vs-pixels choice as startup.
 * @param {import('@kmamal/sdl').Window} sdlWindow
 * @param {boolean} useLogicalSize
 * @param {{ width?: number, height?: number, pixelWidth?: number, pixelHeight?: number }} [event]
 * @returns {{ width: number, height: number }}
 */
export function currentDrawableSize(sdlWindow, useLogicalSize, event) {
  if (useLogicalSize) {
    return {
      width: Math.max(1, (event?.width ?? sdlWindow.width) | 0),
      height: Math.max(1, (event?.height ?? sdlWindow.height) | 0),
    };
  }
  return {
    width: Math.max(1, (event?.pixelWidth ?? sdlWindow.pixelWidth) | 0),
    height: Math.max(1, (event?.pixelHeight ?? sdlWindow.pixelHeight) | 0),
  };
}

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

  const { native } = sdlWindow;
  const probeW = Math.max(1, sdlWindow.pixelWidth | 0);
  const probeH = Math.max(1, sdlWindow.pixelHeight | 0);
  const gl = createContext(probeW, probeH, {
    window: native,
    antialias: true,
    depth: true,
    stencil: false,
    alpha: false,
  });

  if (!gl) {
    throw new Error('Failed to create WebGL context for window');
  }

  const drawable = resolveGlDrawableSize(sdlWindow, gl);
  const pixelWidth = drawable.width;
  const pixelHeight = drawable.height;
  const useLogicalSize = drawable.useLogicalSize;

  if (pixelWidth !== probeW || pixelHeight !== probeH) {
    gl.drawingBufferWidth = pixelWidth;
    gl.drawingBufferHeight = pixelHeight;
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.scissor(0, 0, pixelWidth, pixelHeight);
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
    useLogicalSize,
    title,
  };
}
