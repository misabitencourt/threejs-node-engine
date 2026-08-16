import * as THREE from 'three';
import { createNativeWindow } from '../platform/window.js';
import { createRenderer } from '../platform/renderer.js';
import { createControlsState } from '../platform/controls.js';
import { createAudio } from '../platform/audio.js';
import { createCamera } from '../scene/camera.js';
import { addLightsToScene } from '../graphics/lights.js';
import { createSceneObject } from '../objects/index.js';
import { startLoop } from './loop.js';

/**
 * @typedef {object} EngineCameraConfig
 * @property {number} [fov]
 * @property {number} [near]
 * @property {number} [far]
 * @property {number[]} [position]
 * @property {number[]} [lookAt]
 */

/**
 * Called once per frame when set on `window.gameloop`.
 * @callback EngineGameLoopCallback
 * @param {object} ctx
 * @param {number} ctx.delta                 seconds since last frame
 * @param {THREE.Scene} ctx.scene
 * @param {THREE.Camera} ctx.camera          main camera (window.camera config)
 * @param {THREE.WebGLRenderer} ctx.renderer
 * @param {object} ctx.window                native window facade
 * @param {import('../objects/geometry.js').RuntimeObject[]} ctx.elements
 * @param {(def: object) => Promise<import('../objects/geometry.js').RuntimeObject>} ctx.addElement
 * @param {{
 *   keyboard: import('../platform/controls.js').KeyboardState,
 *   mouse: import('../platform/controls.js').MouseState,
 * }} ctx.controls
 * @param {Awaited<ReturnType<typeof createAudio>>} ctx.audio
 */

/**
 * @typedef {object} EngineWindowConfig
 * @property {string} [title]
 * @property {number} [width]
 * @property {number} [height]
 * @property {boolean} [resizable]
 * @property {boolean} [fullscreen]  desktop-size exclusive window (alias `fullScreen`)
 * @property {number} [background]
 * @property {string|object} [backgroundImage]  scene backdrop path or `{ image, imageFill?, intensity? }`
 * @property {EngineCameraConfig} [camera]
 * @property {EngineGameLoopCallback} [gameloop]  optional per-frame hook
 * @property {boolean} [lockPointerOnClick=true]  click captures mouse (FPS); false for UI/HUD
 */

/**
 * @typedef {object} EngineConfig
 * @property {number} [fps]
 * @property {EngineWindowConfig} window
 * @property {object[]} [lights]
 * @property {object[]} [elements]
 * @property {boolean|object} [audio]  true/omit = on; false = disable; `{ enabled?: boolean }`
 */

/**
 * Runtime handle returned by {@link create}.
 * @typedef {object} EngineInstance
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {object} window  native SDL window surface
 * @property {{
 *   keyboard: import('../platform/controls.js').KeyboardState,
 *   mouse: import('../platform/controls.js').MouseState,
 *   refresh: () => void,
 * }} controls
 * @property {import('../objects/geometry.js').RuntimeObject[]} elements
 * @property {(def: object) => Promise<import('../objects/geometry.js').RuntimeObject>} addElement
 * @property {Awaited<ReturnType<typeof createAudio>>} audio
 * @property {() => void} stop
 */

/**
 * Create and run an engine instance from a JSON config.
 * Loads textures asynchronously before starting the render loop.
 * @param {EngineConfig} config
 * @returns {Promise<EngineInstance>}
 */
export async function create(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('engine.create(config): config object required');
  }
  if (!config.window || typeof config.window !== 'object') {
    throw new Error('engine.create(config): config.window is required');
  }

  const fps = config.fps ?? 60;
  const win = config.window;
  const background = win.background ?? 0x0b0f14;
  const gameloop =
    typeof win.gameloop === 'function'
      ? /** @type {EngineGameLoopCallback} */ (win.gameloop)
      : null;

  const surface = createNativeWindow(win);
  const { sdlWindow, gl, canvas, pixelWidth, pixelHeight, title } = surface;

  const audioOpts =
    config.audio === false
      ? { enabled: false }
      : typeof config.audio === 'object' && config.audio
        ? config.audio
        : { enabled: true };
  const audio = await createAudio(audioOpts);

  const renderer = createRenderer(surface, background);
  const scene = new THREE.Scene();
  const camera = createCamera(win.camera ?? {}, pixelWidth / pixelHeight);
  // Camera must be in the scene graph so children (e.g. 2dtext HUD sprites) are rendered.
  scene.add(camera);
  const viewport = { width: pixelWidth, height: pixelHeight };
  const controls = createControlsState(sdlWindow, viewport);

  addLightsToScene(scene, config.lights);

  const objectCtx = {
    camera,
    scene,
    width: viewport.width,
    height: viewport.height,
  };

  /**
   * Parent runtime root: scene by default, camera for HUD (`mount: 'camera'`),
   * or scene.background for `mount: 'background'` (no mesh in the graph).
   * @param {import('../objects/geometry.js').RuntimeObject & { mount?: string, onAttach?: Function }} entry
   */
  function attachEntry(entry) {
    if (entry.mount === 'camera') {
      camera.add(entry.root);
      entry.onAttach?.(camera, { width: viewport.width, height: viewport.height });
    } else if (entry.mount === 'background') {
      entry.onAttach?.(scene, { width: viewport.width, height: viewport.height });
    } else {
      scene.add(entry.root);
      entry.onAttach?.(scene, { width: viewport.width, height: viewport.height });
    }
  }

  /** @type {import('../objects/geometry.js').RuntimeObject[]} */
  const runtimeElements = [];

  // Window-level background image (same resource as type: 'background')
  if (win.backgroundImage) {
    const bgDef =
      typeof win.backgroundImage === 'string'
        ? { type: 'background', image: win.backgroundImage }
        : { type: 'background', ...win.backgroundImage };
    const entry = await createSceneObject(bgDef, objectCtx);
    attachEntry(entry);
    runtimeElements.push(entry);
  }

  const elements = Array.isArray(config.elements) ? config.elements : [];
  for (const def of elements) {
    const entry = await createSceneObject(def, objectCtx);
    attachEntry(entry);
    runtimeElements.push(entry);
  }

  /**
   * Spawn a new element at runtime (from a JSON def, same shape as config.elements[]).
   * @param {object} def
   * @returns {Promise<import('../objects/geometry.js').RuntimeObject>}
   */
  async function addElement(def) {
    const entry = await createSceneObject(def, objectCtx);
    attachEntry(entry);
    runtimeElements.push(entry);
    return entry;
  }

  /**
   * Keep GL / renderer / camera / HUD in sync when the drawable size changes
   * (fullscreen toggle or a resize event).
   * @param {number} w
   * @param {number} h
   */
  function applyViewport(w, h) {
    const nextW = Math.max(1, w | 0);
    const nextH = Math.max(1, h | 0);
    if (nextW === viewport.width && nextH === viewport.height) return;

    viewport.width = nextW;
    viewport.height = nextH;
    objectCtx.width = nextW;
    objectCtx.height = nextH;
    windowInfo.width = nextW;
    windowInfo.height = nextH;
    canvas.width = nextW;
    canvas.height = nextH;

    if (typeof gl.resize === 'function') {
      gl.resize(nextW, nextH);
    }
    renderer.setSize(nextW, nextH, false);
    camera.aspect = nextW / nextH;
    camera.updateProjectionMatrix();

    for (const entry of runtimeElements) {
      if (entry.mount === 'camera' || entry.mount === 'background') {
        entry.onAttach?.(entry.mount === 'camera' ? camera : scene, {
          width: nextW,
          height: nextH,
        });
      }
    }
  }

  function setFullscreen(on) {
    sdlWindow.setFullscreen(!!on);
    applyViewport(sdlWindow.pixelWidth, sdlWindow.pixelHeight);
  }

  /** Lightweight window info passed to `gameloop` (not the raw SDL handle alone). */
  const windowInfo = {
    title,
    width: viewport.width,
    height: viewport.height,
    get fullscreen() {
      return !!sdlWindow.fullscreen;
    },
    set fullscreen(value) {
      setFullscreen(value);
    },
    setFullscreen,
    /** @type {typeof sdlWindow} */
    native: sdlWindow,
  };

  sdlWindow.on('resize', (event) => {
    applyViewport(
      event?.pixelWidth ?? sdlWindow.pixelWidth,
      event?.pixelHeight ?? sdlWindow.pixelHeight,
    );
  });

  // Click to capture mouse for FPS look (default); UI demos set lockPointerOnClick: false
  const lockPointerOnClick = win.lockPointerOnClick !== false;
  if (lockPointerOnClick) {
    sdlWindow.on('mouseButtonDown', () => {
      if (!controls.mouse.locked) {
        controls.mouse.lock();
      }
    });
  }

  /** @type {Promise<unknown>[]} */
  const pendingSpawns = [];

  const { stop: stopLoop } = startLoop({
    fps,
    shouldContinue: () => !sdlWindow.destroyed,
    onFrame: (delta) => {
      controls.refresh();

      // Escape always unlocks the mouse (even without gameloop())
      if (controls.keyboard.isDown('escape') && controls.mouse.locked) {
        controls.mouse.unlock();
      }

      for (const entry of runtimeElements) {
        entry.update?.(delta);
      }

      if (gameloop) {
        gameloop({
          delta,
          scene,
          camera,
          renderer,
          window: windowInfo,
          elements: runtimeElements,
          addElement: (def) => {
            const p = addElement(def);
            pendingSpawns.push(p);
            return p;
          },
          controls,
          audio,
        });
      }

      audio.update();

      renderer.render(scene, camera);
      gl.swap();
    },
  });

  function stop() {
    controls.mouse.unlock();
    audio.close();
    stopLoop();
  }

  sdlWindow.on('close', () => {
    stop();
  });

  console.log(
    `Engine · "${title}" ${viewport.width}x${viewport.height} @ ${fps}fps · ${elements.length} element(s)` +
      (sdlWindow.fullscreen ? ' · fullscreen' : '') +
      (gameloop ? ' · gameloop()' : '') +
      (audio.enabled ? ' · audio' : ''),
  );

  return {
    scene,
    camera,
    renderer,
    window: sdlWindow,
    controls,
    elements: runtimeElements,
    addElement,
    audio,
    stop,
  };
}
