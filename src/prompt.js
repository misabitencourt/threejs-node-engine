/**
 * Name prompt UI with camera-fixed 2dtext + background cube.
 *
 * Layout (screen pixels, top-left origin):
 *   - "What is your name?" label
 *   - Input line (typed characters)
 *   - OK / Cancel buttons (click hit-boxes)
 *
 * Type to fill the input. Click OK → hide UI (cube remains).
 * Click Cancel → console.log only (UI stays).
 *
 * Run: npm run prompt
 */
import { engine } from '../lib/engine.js';

const WIN_W = 900;
const WIN_H = 600;

/** Approximate hit boxes for clickable 2dtext (top-left, y down). */
const HIT = {
  ok: { x: 320, y: 320, w: 90, h: 40 },
  cancel: { x: 460, y: 320, w: 130, h: 40 },
};

const PRINTABLE = 'abcdefghijklmnopqrstuvwxyz0123456789';

let playerName = '';
let promptOpen = true;
let prevLeft = false;
let cursorBlink = 0;

/**
 * @param {number} mx
 * @param {number} my
 * @param {{ x: number, y: number, w: number, h: number }} box
 */
function hit(mx, my, box) {
  return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h;
}

/**
 * @param {import('../lib/platform/controls.js').KeyboardState} keyboard
 * @returns {string|null} single character or control: 'backspace' | 'enter' | null
 */
function readTypedKey(keyboard) {
  if (keyboard.justPressed('backspace')) return 'backspace';
  if (keyboard.justPressed('return') || keyboard.justPressed('enter')) return 'enter';
  if (keyboard.justPressed('space')) return ' ';

  for (const ch of PRINTABLE) {
    if (keyboard.justPressed(ch)) return ch;
  }
  return null;
}

/**
 * @param {object[]} elements
 * @param {string} id
 */
function byId(elements, id) {
  return elements.find((e) => e.def?.id === id);
}

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · prompt (name)',
    width: WIN_W,
    height: WIN_H,
    resizable: false,
    background: 0x0b0f14,
    // Keep free cursor so OK / Cancel can be clicked
    lockPointerOnClick: false,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [2.8, 2.0, 4.2],
      lookAt: [0, 0.5, 0],
    },

    gameloop({ delta, camera, elements, controls }) {
      // Gentle spin on the cube so the background stays alive
      const cube = elements.find((e) => e.def?.type === 'geometry');
      if (cube?.root) {
        cube.root.rotation.y += 0.35 * delta;
      }
      camera.lookAt(0, 0.5, 0);

      const label = byId(elements, 'prompt-label');
      const input = byId(elements, 'prompt-input');
      const okBtn = byId(elements, 'prompt-ok');
      const cancelBtn = byId(elements, 'prompt-cancel');
      if (!label || !input || !okBtn || !cancelBtn) return;

      const leftDown = controls.mouse.isDown('left');
      const leftClick = leftDown && !prevLeft;
      prevLeft = leftDown;

      if (!promptOpen) return;

      // --- typing into the input 2dtext ---
      const key = readTypedKey(controls.keyboard);
      if (key === 'backspace') {
        playerName = playerName.slice(0, -1);
      } else if (key === 'enter') {
        // Enter = OK
        console.log(`OK → player name: "${playerName}"`);
        promptOpen = false;
        for (const el of [label, input, okBtn, cancelBtn]) el.visible = false;
        return;
      } else if (key != null && playerName.length < 24) {
        playerName += key;
      }

      cursorBlink += delta;
      const showCursor = Math.floor(cursorBlink * 2) % 2 === 0;
      const display =
        playerName.length === 0
          ? showCursor
            ? '_'
            : ' '
          : playerName + (showCursor ? '_' : '');
      input.setText(display);

      // --- click OK / Cancel ---
      if (!leftClick) return;

      const mx = controls.mouse.x;
      const my = controls.mouse.y;

      if (hit(mx, my, HIT.ok)) {
        console.log(`OK → player name: "${playerName}"`);
        promptOpen = false;
        for (const el of [label, input, okBtn, cancelBtn]) el.visible = false;
      } else if (hit(mx, my, HIT.cancel)) {
        console.log(`Cancel → discarded name: "${playerName}"`);
      }
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xfff2d6,
      intensity: 1.15,
      position: [4, 7, 5],
    },
  ],

  elements: [
    // Background cube (stays after OK)
    {
      type: 'geometry',
      geometry: 'box',
      width: 1,
      height: 1,
      depth: 1,
      material: {
        type: 'standard',
        color: 0x4f8cff,
        metalness: 0.25,
        roughness: 0.4,
      },
      position: [0, 0.5, 0],
      rotation: [0, 0.4, 0],
      edges: { color: 0xc8dcff },
    },
    {
      type: 'geometry',
      geometry: 'plane',
      width: 20,
      height: 20,
      material: {
        type: 'standard',
        color: 0x1a222c,
        metalness: 0.05,
        roughness: 0.95,
        side: 'double',
      },
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },

    // Prompt UI (screen px)
    {
      id: 'prompt-label',
      type: '2dtext',
      text: 'What is your name?',
      position: [280, 180],
      fontSize: 32,
      color: '#e8eef7',
      padding: 8,
    },
    {
      id: 'prompt-input',
      type: '2dtext',
      text: '_',
      position: [280, 240],
      fontSize: 30,
      color: '#7ee787',
      padding: 8,
      background: '#1e2a38',
    },
    {
      id: 'prompt-ok',
      type: '2dtext',
      text: 'OK',
      position: [HIT.ok.x, HIT.ok.y],
      fontSize: 28,
      color: '#7ee787',
      padding: 10,
      background: '#1a3d2a',
    },
    {
      id: 'prompt-cancel',
      type: '2dtext',
      text: 'Cancel',
      position: [HIT.cancel.x, HIT.cancel.y],
      fontSize: 28,
      color: '#ff9b9b',
      padding: 10,
      background: '#3d1a1a',
    },
  ],
});
