import sdl from '@kmamal/sdl';

/**
 * Input state polled each frame and exposed on `window.gameloop` as `controls`.
 *
 * Keyboard keys are lowercase names from:
 *   - virtual keys (e.g. "a", "arrowleft", "space") via getKey(scancode)
 *   - scancode enum names (e.g. "a", "left", "space")
 *
 * Mouse provides position, frame movement (dx/dy), buttons, and optional lock
 * for first-person look (cursor hidden + re-centered).
 *
 * @typedef {object} KeyboardState
 * @property {Record<string, boolean>} keys
 * @property {string[]} pressed
 * @property {(key: string) => boolean} isDown
 * @property {(key: string) => boolean} justPressed  true only on the frame the key goes down
 * @property {() => void} refresh
 *
 * @typedef {object} MouseState
 * @property {number} x           position in window coords
 * @property {number} y
 * @property {number} dx          movement since last refresh (pixels)
 * @property {number} dy
 * @property {Record<string, boolean>} buttons  left/middle/right
 * @property {(button?: string) => boolean} isDown
 * @property {boolean} locked
 * @property {() => void} lock
 * @property {() => void} unlock
 * @property {() => void} refresh
 */

/**
 * @param {object} sdlWindow  @kmamal/sdl window
 * @param {{ width: number, height: number }} size  pixel size of the drawable
 * @returns {{ keyboard: KeyboardState, mouse: MouseState, refresh: () => void }}
 */
export function createControlsState(sdlWindow, size) {
  /** @type {Record<string, boolean>} */
  let keys = Object.create(null);
  /** @type {Record<string, boolean>} */
  let prevKeys = Object.create(null);

  let mouseX = 0;
  let mouseY = 0;
  let accumDx = 0;
  let accumDy = 0;
  let frameDx = 0;
  let frameDy = 0;
  let locked = false;
  let ignoreNextMove = false;

  const buttonNames = {
    [sdl.mouse.BUTTON.LEFT]: 'left',
    [sdl.mouse.BUTTON.MIDDLE]: 'middle',
    [sdl.mouse.BUTTON.RIGHT]: 'right',
  };

  /** @type {Record<string, boolean>} */
  let buttons = Object.create(null);

  function centerCursor() {
    const cx = Math.floor(size.width / 2);
    const cy = Math.floor(size.height / 2);
    const screenX = (sdlWindow.x ?? 0) + cx;
    const screenY = (sdlWindow.y ?? 0) + cy;
    ignoreNextMove = true;
    sdl.mouse.setPosition(screenX, screenY);
    mouseX = cx;
    mouseY = cy;
  }

  sdlWindow.on('mouseMove', (event) => {
    mouseX = event.x;
    mouseY = event.y;

    if (ignoreNextMove) {
      ignoreNextMove = false;
      return;
    }

    if (locked) {
      const cx = size.width / 2;
      const cy = size.height / 2;
      accumDx += event.x - cx;
      accumDy += event.y - cy;
      centerCursor();
    } else {
      // Free cursor: deltas come from consecutive positions via position polling
      // Events alone without previous absolute are fine if we use position delta in refresh.
    }
  });

  sdlWindow.on('mouseButtonDown', (event) => {
    const name = buttonNames[event.button];
    if (name) buttons[name] = true;
  });

  sdlWindow.on('mouseButtonUp', (event) => {
    const name = buttonNames[event.button];
    if (name) buttons[name] = false;
  });

  // Track free-cursor movement via absolute position each frame
  let lastScreenX = null;
  let lastScreenY = null;

  const keyboard = {
    get keys() {
      return keys;
    },
    get pressed() {
      return Object.keys(keys);
    },
    isDown(key) {
      if (key == null) return false;
      return !!keys[String(key).toLowerCase()];
    },
    justPressed(key) {
      if (key == null) return false;
      const k = String(key).toLowerCase();
      return !!keys[k] && !prevKeys[k];
    },
    refresh() {
      prevKeys = keys;
      const state = sdl.keyboard.getState();
      const next = Object.create(null);
      const scancodes = sdl.keyboard.SCANCODE;

      for (const name of Object.keys(scancodes)) {
        const code = scancodes[name];
        if (typeof code !== 'number') continue;
        if (!state[code]) continue;

        next[name.toLowerCase()] = true;

        const virtual = sdl.keyboard.getKey(code);
        if (virtual) {
          next[String(virtual).toLowerCase()] = true;
        }
      }

      keys = next;
    },
  };

  const mouse = {
    get x() {
      return mouseX;
    },
    get y() {
      return mouseY;
    },
    get dx() {
      return frameDx;
    },
    get dy() {
      return frameDy;
    },
    get buttons() {
      return buttons;
    },
    get locked() {
      return locked;
    },
    isDown(button = 'left') {
      const name = String(button).toLowerCase();
      if (buttons[name]) return true;
      // also poll hardware in case event was missed
      const map = {
        left: sdl.mouse.BUTTON.LEFT,
        middle: sdl.mouse.BUTTON.MIDDLE,
        right: sdl.mouse.BUTTON.RIGHT,
        0: sdl.mouse.BUTTON.LEFT,
        1: sdl.mouse.BUTTON.MIDDLE,
        2: sdl.mouse.BUTTON.RIGHT,
      };
      const id = map[name];
      return id != null ? !!sdl.mouse.getButton(id) : false;
    },
    lock() {
      if (locked) return;
      locked = true;
      sdl.mouse.hideCursor();
      sdl.mouse.capture(true);
      centerCursor();
      lastScreenX = null;
      lastScreenY = null;
      accumDx = 0;
      accumDy = 0;
    },
    unlock() {
      if (!locked) return;
      locked = false;
      sdl.mouse.uncapture();
      sdl.mouse.showCursor();
      lastScreenX = null;
      lastScreenY = null;
      accumDx = 0;
      accumDy = 0;
    },
    refresh() {
      // Button hardware poll (keeps state honest)
      buttons = {
        left: !!sdl.mouse.getButton(sdl.mouse.BUTTON.LEFT),
        middle: !!sdl.mouse.getButton(sdl.mouse.BUTTON.MIDDLE),
        right: !!sdl.mouse.getButton(sdl.mouse.BUTTON.RIGHT),
      };

      if (locked) {
        frameDx = accumDx;
        frameDy = accumDy;
        accumDx = 0;
        accumDy = 0;
      } else {
        const pos = sdl.mouse.position;
        if (lastScreenX != null && lastScreenY != null) {
          frameDx = pos.x - lastScreenX;
          frameDy = pos.y - lastScreenY;
        } else {
          frameDx = 0;
          frameDy = 0;
        }
        lastScreenX = pos.x;
        lastScreenY = pos.y;
        // window-relative approx
        mouseX = pos.x - (sdlWindow.x ?? 0);
        mouseY = pos.y - (sdlWindow.y ?? 0);
      }
    },
  };

  return {
    keyboard,
    mouse,
    refresh() {
      keyboard.refresh();
      mouse.refresh();
    },
  };
}
