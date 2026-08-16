/**
 * 2dimagesprite — camera-fixed PNG on screen (Cartesian pixels), walk cycle.
 *
 * Same sheet as the 3D sprite demo: assets/char.png (frames 24×17, walk 2…3).
 * Moves in 2D screen space only (no world position / pushForce).
 *
 * Arrows / WASD: move on screen (px)
 * V: toggle visible
 *
 * Run: npm run sprite2d
 */
import { engine } from '../lib/engine.js';

const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 17;
const SPRITE_WALK_START = 2;
const SPRITE_WALK_END = 3;
const PIXEL_SCALE = 4;
const MOVE_SPEED = 160; // screen px/s
const ANIM_FPS = 8;

const WALK_FRAMES = [];
for (let f = SPRITE_WALK_START; f <= SPRITE_WALK_END; f++) {
  WALK_FRAMES.push(f);
}

const DISPLAY_W = SPRITE_WIDTH * PIXEL_SCALE;
const DISPLAY_H = SPRITE_HEIGHT * PIXEL_SCALE;

let animTime = 0;

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · 2dimagesprite (screen walk)',
    width: 900,
    height: 600,
    resizable: false,
    background: 0x1a2836,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [3.2, 2.4, 5.5],
      lookAt: [0, 0.6, 0],
    },

    gameloop({ delta, camera, elements, controls, window: win }) {
      // Slow orbit so HUD/sprite stay fixed on screen while the world moves
      const t = performance.now() * 0.0002;
      camera.position.x = Math.cos(t) * 5.5;
      camera.position.z = Math.sin(t) * 5.5;
      camera.position.y = 2.4;
      camera.lookAt(0, 0.6, 0);

      const sprite = elements.find((e) => e.def?.type === '2dimagesprite');
      const label = elements.find((e) => e.def?.type === '2dtext');
      if (!sprite) return;

      const { keyboard } = controls;
      let [x, y] = sprite.position;
      let moving = false;

      if (keyboard.isDown('left') || keyboard.isDown('arrowleft') || keyboard.isDown('a')) {
        x -= MOVE_SPEED * delta;
        moving = true;
      }
      if (keyboard.isDown('right') || keyboard.isDown('arrowright') || keyboard.isDown('d')) {
        x += MOVE_SPEED * delta;
        moving = true;
      }
      if (keyboard.isDown('up') || keyboard.isDown('arrowup') || keyboard.isDown('w')) {
        y -= MOVE_SPEED * delta; // screen y up = smaller y
        moving = true;
      }
      if (keyboard.isDown('down') || keyboard.isDown('arrowdown') || keyboard.isDown('s')) {
        y += MOVE_SPEED * delta;
        moving = true;
      }

      // Clamp inside the window (top-left anchor)
      const maxX = (win?.width ?? 900) - DISPLAY_W;
      const maxY = (win?.height ?? 600) - DISPLAY_H;
      x = Math.max(0, Math.min(maxX, x));
      y = Math.max(0, Math.min(maxY, y));
      sprite.position = [x, y];

      if (moving) {
        animTime += delta;
        const idx = Math.floor(animTime * ANIM_FPS) % WALK_FRAMES.length;
        sprite.setFrame(WALK_FRAMES[idx], SPRITE_WIDTH, SPRITE_HEIGHT);
      } else {
        animTime = 0;
        sprite.setFrame(SPRITE_WALK_START, SPRITE_WIDTH, SPRITE_HEIGHT);
      }

      if (keyboard.justPressed('v')) {
        sprite.visible = !sprite.visible;
        console.log(`2dimagesprite visible → ${sprite.visible}`);
      }

      if (label?.setText) {
        label.setText(`char @ (${Math.round(x)}, ${Math.round(y)}) px`);
      }
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xfff2d6,
      intensity: 1.0,
      position: [4, 8, 5],
    },
  ],

  elements: [
    {
      type: '2dimagesprite',
      image: 'assets/char.png',
      // Screen pixels: origin top-left, y down
      position: [120, 280],
      pixelScale: PIXEL_SCALE,
      crop: {
        x: SPRITE_WALK_START * SPRITE_WIDTH,
        y: 0,
        w: SPRITE_WIDTH,
        h: SPRITE_HEIGHT,
      },
      visible: true,
    },
    {
      type: '2dtext',
      text: 'char @ (120, 280) px',
      position: [16, 12],
      fontSize: 22,
      color: '#9fd3ff',
      padding: 6,
    },
    {
      type: '2dtext',
      text: 'WASD/arrows: walk on screen · V: hide',
      position: [16, 560],
      fontSize: 20,
      color: '#9fb3c8',
      padding: 4,
    },
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
      rotation: [0, 0.35, 0],
      edges: { color: 0xc8dcff },
    },
    {
      type: 'geometry',
      geometry: 'plane',
      width: 20,
      height: 20,
      material: {
        type: 'standard',
        color: 0x243040,
        metalness: 0.05,
        roughness: 0.95,
        side: 'double',
      },
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },
  ],
});
