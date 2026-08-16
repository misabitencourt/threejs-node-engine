/**
 * 3D char sprite walks on a 3D tile map + distance-based music volume.
 *
 * - Tile map scaled 10× via engine.setTileMapScale / element `scale`
 * - WASD / arrows: move on the tile terrain (Y from height sample)
 * - Walk frames only while moving
 * - Blue box bounces in the map center
 * - Background music: louder the closer the char is to the box
 * - Mouse: orbit camera
 *
 * Run: npm run sprite-tile
 */
import * as THREE from 'three';
import { engine } from '../lib/engine.js';
import { sampleTileHeightAt, setTileMapScale } from '../lib/utils/tile3d.js';

const SPRITE_WIDTH = 24;
const SPRITE_HEIGHT = 17;
const SPRITE_WALK_START = 2;
const SPRITE_WALK_END = 3;
const SPRITE_H = 1.1 * (SPRITE_HEIGHT / SPRITE_WIDTH);
const SPRITE_W = 1.1;

const MOVE_SPEED = 18;
const ANIM_FPS = 8;
const CAMERA_DISTANCE = 28;
const LOOK_SENSITIVITY = 0.0025;
const PITCH_MIN = 0.2;
const PITCH_MAX = 1.15;

const MAP_COLS = 16;
const MAP_ROWS = 16;
const TILE_SIZE = 1;
/** 10× map (world cell = 10, map ~160×160) */
const MAP_SCALE = 2;
const mapSized = setTileMapScale({ tileSize: TILE_SIZE, step: TILE_SIZE }, MAP_SCALE);

const BOX_SIZE = 0.7;
const BOUNCE_AMP = 0.55 * MAP_SCALE * 0.15;
const BOUNCE_SPEED = 3.2;

/** Distance (world units) where music is quietest → loudest */
const VOL_FAR = 14 * MAP_SCALE;
const VOL_NEAR = 1.2 * MAP_SCALE;
const VOL_MIN = 0.08;
const VOL_MAX = 0.95;

const MUSIC = 'assets/music.ogg';

const WALK_FRAMES = [];
for (let f = SPRITE_WALK_START; f <= SPRITE_WALK_END; f++) {
  WALK_FRAMES.push(f);
}

let yaw = 0.65;
let pitch = 0.42;
let animTime = 0;
let bounceT = 0;
let musicStarted = false;

function volumeFromDistance(dist) {
  const t = (dist - VOL_NEAR) / Math.max(1e-6, VOL_FAR - VOL_NEAR);
  const u = 1 - Math.max(0, Math.min(1, t)); // 1 at near, 0 at far
  return VOL_MIN + u * (VOL_MAX - VOL_MIN);
}

await engine.create({
  fps: 60,

  window: {
    title: 'threejs-node-engine · sprite on 3dtile + music',
    width: 960,
    height: 600,
    resizable: false,
    background: 0x7ec8e3,

    camera: {
      fov: 50,
      near: 0.1,
      far: 2000,
      position: [40, 45, 60],
      lookAt: [0, 5, 0],
    },

    async gameloop({ delta, camera, elements, controls, audio }) {
      const terrain = elements.find((e) => e.def?.type === '3dtile');
      const sprite = elements.find((e) => e.def?.type === '3dimagesprite');
      const box = elements.find((e) => e.def?.id === 'bounce-box');
      if (!terrain?.tilemap || !sprite || !box) return;

      const map = terrain.tilemap;
      const body = sprite.root;
      const boxRoot = box.root;
      const { keyboard, mouse } = controls;

      // --- Music (once) ---
      if (!musicStarted && audio?.enabled) {
        musicStarted = true;
        try {
          await audio.playMusic(MUSIC, { loop: true, volume: VOL_MIN });
          console.log(`Music · ${MUSIC} (volume follows distance to blue box)`);
        } catch (err) {
          console.warn('Music failed:', err?.message || err);
        }
      }

      // --- Camera orbit ---
      if (mouse.locked || mouse.dx !== 0 || mouse.dy !== 0) {
        yaw -= mouse.dx * LOOK_SENSITIVITY;
        pitch += mouse.dy * LOOK_SENSITIVITY;
        pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
      }

      // --- Move on XZ (camera-relative) ---
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const step = MOVE_SPEED * delta;
      const move = new THREE.Vector3();

      if (keyboard.isDown('up') || keyboard.isDown('arrowup') || keyboard.isDown('w')) {
        move.addScaledVector(forward, step);
      }
      if (keyboard.isDown('down') || keyboard.isDown('arrowdown') || keyboard.isDown('s')) {
        move.addScaledVector(forward, -step);
      }
      if (keyboard.isDown('left') || keyboard.isDown('arrowleft') || keyboard.isDown('a')) {
        move.addScaledVector(right, -step);
      }
      if (keyboard.isDown('right') || keyboard.isDown('arrowright') || keyboard.isDown('d')) {
        move.addScaledVector(right, step);
      }

      const moving = move.lengthSq() > 1e-10;
      let x = body.position.x + move.x;
      let z = body.position.z + move.z;

      const margin = 0.35;
      x = Math.max(map.bounds.minX + margin, Math.min(map.bounds.maxX - margin, x));
      z = Math.max(map.bounds.minZ + margin, Math.min(map.bounds.maxZ - margin, z));

      const groundY = sampleTileHeightAt(map, x, z, 0);
      body.position.set(x, groundY + SPRITE_H * 0.5, z);

      if (moving) {
        body.rotation.y = Math.atan2(move.x, move.z);
        animTime += delta;
        const idx = Math.floor(animTime * ANIM_FPS) % WALK_FRAMES.length;
        sprite.setFrame(WALK_FRAMES[idx], SPRITE_WIDTH, SPRITE_HEIGHT);
      } else {
        animTime = 0;
        sprite.setFrame(SPRITE_WALK_START, SPRITE_WIDTH, SPRITE_HEIGHT);
      }

      // --- Bouncing blue box at map center ---
      bounceT += delta * BOUNCE_SPEED;
      const bx = 0;
      const bz = 0;
      const baseY = sampleTileHeightAt(map, bx, bz, 0);
      const bounce = Math.abs(Math.sin(bounceT)) * BOUNCE_AMP;
      boxRoot.position.set(bx, baseY + BOX_SIZE * 0.5 + bounce, bz);
      boxRoot.rotation.y += 0.8 * delta;

      // --- Music volume from distance (char → box) ---
      if (audio?.enabled && audio.musicPlaying) {
        const dx = body.position.x - boxRoot.position.x;
        const dz = body.position.z - boxRoot.position.z;
        const dist = Math.hypot(dx, dz);
        audio.setMusicVolume(volumeFromDistance(dist));
      }

      // --- Camera follow ---
      const t = body.position;
      camera.position.set(
        t.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
        t.y + Math.sin(pitch) * CAMERA_DISTANCE + 1.2,
        t.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      );
      camera.lookAt(t.x, t.y + 0.4, t.z);
    },
  },

  lights: [
    { type: 'ambient', color: 0xffffff, intensity: 0.55 },
    {
      type: 'directional',
      color: 0xfff5e0,
      intensity: 1.05,
      position: [80, 120, 50],
    },
    {
      type: 'directional',
      color: 0x8ecae6,
      intensity: 0.35,
      position: [-60, 40, -70],
    },
  ],

  elements: [
    {
      type: '3dtile',
      width: MAP_COLS,
      height: MAP_ROWS,
      // base sizes — scale applied via setTileMapScale / `scale` field
      tileSize: mapSized.baseTileSize,
      step: mapSized.baseStep,
      scale: mapSized.scale, // 10× → tileSize 10, map ~160×160
      position: [0, 0, 0],
      wireframe: true,
      material: {
        type: 'standard',
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.9,
        side: 'double',
      },
      texture: {
        image: 'assets/brick.jpeg',
        imageFill: 'tile',
        repeat: [1, 1],
      },
    },
    {
      id: 'player',
      type: '3dimagesprite',
      image: 'assets/char.png',
      size: [SPRITE_W, SPRITE_H],
      position: [-4 * MAP_SCALE, 5, -3 * MAP_SCALE],
      rotation: [0, 0.5, 0],
      crop: {
        x: SPRITE_WALK_START * SPRITE_WIDTH,
        y: 0,
        w: SPRITE_WIDTH,
        h: SPRITE_HEIGHT,
      },
    },
    {
      id: 'bounce-box',
      type: 'geometry',
      geometry: 'box',
      width: BOX_SIZE,
      height: BOX_SIZE,
      depth: BOX_SIZE,
      material: {
        type: 'standard',
        color: 0x3a86ff,
        metalness: 0.35,
        roughness: 0.25,
      },
      position: [0, 5, 0],
      edges: { color: 0x9ecbff },
    },
    {
      type: '2dtext',
      text: 'Walk toward the blue box — music gets louder',
      position: [16, 14],
      fontSize: 22,
      color: '#0b1a24',
      padding: 8,
      background: '#ffffffcc',
    },
  ],
});
