/**
 * Audio demo — background music (ogg) + SFX (mp3) via engine audio API.
 *
 * - Music starts automatically (assets/music.ogg, looped)
 * - Press F — play sound effect (assets/sfx.mp3)
 *
 * Formats: wav, mp3, ogg (mp3/ogg need ffmpeg on PATH).
 *
 * Run: npm run audio
 */
import { engine } from '../lib/engine.js';

const MUSIC = 'assets/music.ogg';
const SFX = 'assets/sfx.mp3';

let musicStarted = false;

const app = await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · audio (F = sfx)',
    width: 800,
    height: 500,
    resizable: false,
    background: 0x0b0f14,
    lockPointerOnClick: false,

    camera: {
      fov: 50,
      near: 0.1,
      far: 100,
      position: [2.4, 1.8, 2.8],
      lookAt: [0, 0, 0],
    },

    async gameloop({ controls, audio, elements }) {
      // Start BGM once (async decode on first frames)
      if (!musicStarted && audio?.enabled) {
        musicStarted = true;
        try {
          await audio.playMusic(MUSIC, { loop: true, volume: 0.4 });
          console.log(`Music · ${MUSIC} (loop)`);
        } catch (err) {
          console.warn('Music failed:', err?.message || err);
        }
      }

      if (controls.keyboard.justPressed('f') && audio?.enabled) {
        try {
          await audio.playSfx(SFX, { volume: 0.85 });
          console.log(`SFX · ${SFX}`);
        } catch (err) {
          console.warn('SFX failed:', err?.message || err);
        }
      }

      // Subtle spin so the scene feels alive
      const cube = elements.find((e) => e.def?.type === 'geometry' && e.def?.geometry === 'box');
      if (cube?.root) {
        cube.root.rotation.y += 0.35 * (1 / 60);
      }
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.45 },
    {
      type: 'directional',
      color: 0xfff2d6,
      intensity: 1.15,
      position: [4, 6, 3],
    },
  ],

  elements: [
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
      position: [0, 0, 0],
      rotation: [0.45, 0.7, 0.15],
      edges: { color: 0xc8dcff },
    },
    {
      type: '2dtext',
      text: 'Press F to play SFX',
      position: [24, 24],
      fontSize: 36,
      color: '#7ee787',
      padding: 10,
    },
    {
      type: '2dtext',
      text: 'Background music: assets/music.ogg (loop)',
      position: [24, 80],
      fontSize: 20,
      color: '#9fb3c8',
      padding: 6,
    },
    {
      type: '2dtext',
      text: 'SFX: assets/sfx.mp3 · formats: wav / mp3 / ogg',
      position: [24, 120],
      fontSize: 18,
      color: '#6b7c8f',
      padding: 4,
    },
  ],
});

// Also available as app.audio after create
void app;
