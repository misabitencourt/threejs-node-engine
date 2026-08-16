import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sdl from '@kmamal/sdl';

/**
 * Engine audio: SFX + music via @kmamal/sdl playback.
 * Formats: wav (PCM native parse, else ffmpeg), mp3 / ogg (ffmpeg → s16le PCM).
 *
 * Requires `ffmpeg` on PATH for mp3/ogg (and non-PCM wav).
 *
 * ```js
 * const audio = await createAudio();
 * await audio.playMusic('assets/music.ogg', { loop: true, volume: 0.4 });
 * await audio.playSfx('assets/sfx.mp3');
 * audio.update(); // each frame
 * audio.close();
 * ```
 */

const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const BYTES_PER_FRAME = CHANNELS * BYTES_PER_SAMPLE;
const QUEUE_TARGET_FRAMES = Math.floor(SAMPLE_RATE * 0.3);
const QUEUE_CHUNK_FRAMES = Math.floor(SAMPLE_RATE * 0.05);

/**
 * @typedef {object} DecodedAudio
 * @property {Int16Array} samples  interleaved stereo s16
 * @property {number} sampleRate
 * @property {number} channels
 */

/**
 * @typedef {object} PlayOptions
 * @property {number} [volume=1]
 * @property {boolean} [loop]  music defaults true; sfx defaults false
 */

/**
 * @param {string} filePath
 */
function resolveAudioPath(filePath) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

/**
 * @param {string} filePath
 */
function extOf(filePath) {
  return path.extname(filePath).toLowerCase().replace('.', '');
}

/**
 * @param {number} v
 */
function clampVol(v) {
  if (v == null || Number.isNaN(Number(v))) return 1;
  return Math.max(0, Math.min(1, Number(v)));
}

/**
 * Parse PCM WAV (16-bit) → stereo s16 @ 44100.
 * @param {Buffer} buf
 * @returns {DecodedAudio|null}
 */
function tryParseWav(buf) {
  if (buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  /** @type {Buffer|null} */
  let data = null;

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      const audioFormat = buf.readUInt16LE(start);
      channels = buf.readUInt16LE(start + 2);
      sampleRate = buf.readUInt32LE(start + 4);
      bitsPerSample = buf.readUInt16LE(start + 14);
      if (audioFormat !== 1) return null;
    } else if (id === 'data') {
      data = buf.subarray(start, Math.min(buf.length, start + size));
      break;
    }
    offset = start + size + (size % 2);
  }

  if (!data || !channels || !sampleRate || bitsPerSample !== 16) return null;

  const src = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
  const samples = resampleToStereoS16(src, channels, sampleRate, SAMPLE_RATE);
  return { samples, sampleRate: SAMPLE_RATE, channels: CHANNELS };
}

/**
 * @param {Int16Array} src
 * @param {number} srcCh
 * @param {number} srcRate
 * @param {number} dstRate
 * @returns {Int16Array}
 */
function resampleToStereoS16(src, srcCh, srcRate, dstRate) {
  const srcFrames = Math.floor(src.length / srcCh);
  if (srcRate === dstRate && srcCh === 2) {
    return src.slice();
  }

  const dstFrames = Math.max(1, Math.round((srcFrames * dstRate) / srcRate));
  const out = new Int16Array(dstFrames * 2);

  for (let i = 0; i < dstFrames; i++) {
    const srcPos = (i * srcRate) / dstRate;
    const i0 = Math.min(srcFrames - 1, Math.floor(srcPos));
    const i1 = Math.min(srcFrames - 1, i0 + 1);
    const t = srcPos - i0;

    let l0;
    let r0;
    let l1;
    let r1;
    if (srcCh === 1) {
      l0 = r0 = src[i0];
      l1 = r1 = src[i1];
    } else {
      l0 = src[i0 * srcCh];
      r0 = src[i0 * srcCh + 1];
      l1 = src[i1 * srcCh];
      r1 = src[i1 * srcCh + 1];
    }

    out[i * 2] = (l0 * (1 - t) + l1 * t) | 0;
    out[i * 2 + 1] = (r0 * (1 - t) + r1 * t) | 0;
  }

  return out;
}

/**
 * @param {string} fullPath
 * @returns {Promise<DecodedAudio>}
 */
function decodeWithFfmpeg(fullPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      fullPath,
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      '-ac',
      String(CHANNELS),
      '-ar',
      String(SAMPLE_RATE),
      'pipe:1',
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    /** @type {Buffer[]} */
    const chunks = [];
    /** @type {Buffer[]} */
    const errChunks = [];

    proc.stdout.on('data', (c) => chunks.push(c));
    proc.stderr.on('data', (c) => errChunks.push(c));
    proc.on('error', (err) => {
      reject(
        new Error(
          `ffmpeg failed to start (install ffmpeg for mp3/ogg/wav): ${err.message}`,
        ),
      );
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        const errText = Buffer.concat(errChunks).toString('utf8').trim();
        reject(new Error(`ffmpeg decode failed (${code}): ${errText || fullPath}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      // Copy into a new ArrayBuffer so Int16Array is independent of Buffer pool
      const copy = Buffer.from(buf);
      const samples = new Int16Array(
        copy.buffer,
        copy.byteOffset,
        Math.floor(copy.byteLength / 2),
      );
      resolve({ samples, sampleRate: SAMPLE_RATE, channels: CHANNELS });
    });
  });
}

/**
 * Decode wav / mp3 / ogg to stereo s16 @ 44100.
 * @param {string} filePath
 * @returns {Promise<DecodedAudio>}
 */
export async function decodeAudioFile(filePath) {
  const full = resolveAudioPath(filePath);
  if (!fs.existsSync(full)) {
    throw new Error(`Audio file not found: ${full}`);
  }

  const ext = extOf(full);
  if (!['wav', 'mp3', 'ogg', 'oga', 'mpeg', 'mpga'].includes(ext)) {
    throw new Error(`Unsupported audio format ".${ext}" (use wav, mp3, or ogg)`);
  }

  if (ext === 'wav') {
    const raw = fs.readFileSync(full);
    const parsed = tryParseWav(raw);
    if (parsed) return parsed;
  }

  return decodeWithFfmpeg(full);
}

/**
 * Create the engine audio system (SDL playback + soft mixer).
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true]
 */
export async function createAudio(opts = {}) {
  const enabled = opts.enabled !== false;

  /** @type {Map<string, DecodedAudio>} */
  const cache = new Map();

  /** @type {any} */
  let device = null;

  /** @type {{ samples: Int16Array, offset: number, volume: number, loop: boolean }|null} */
  let music = null;
  let musicPaused = false;
  let musicVolume = 1;
  let sfxVolume = 1;

  /** @type {{ samples: Int16Array, offset: number, volume: number }[]} */
  let sfxList = [];

  if (enabled) {
    const devices = sdl.audio.devices.filter((d) => d.type === 'playback');
    const dev = devices[0] ?? { type: 'playback' };
    try {
      device = sdl.audio.openDevice(dev, {
        channels: CHANNELS,
        frequency: SAMPLE_RATE,
        format: 's16', // s16le PCM (SDL alias)
        buffered: 4096, // power of 2 (driver buffer frames)
      });
      device.play();
    } catch (err) {
      console.warn('[audio] could not open playback device:', err?.message || err);
      device = null;
    }
  }

  /**
   * @param {string} filePath
   */
  async function loadCached(filePath) {
    const full = resolveAudioPath(filePath);
    if (cache.has(full)) return /** @type {DecodedAudio} */ (cache.get(full));
    const decoded = await decodeAudioFile(full);
    cache.set(full, decoded);
    return decoded;
  }

  /**
   * @param {number} frames
   */
  function renderAndEnqueue(frames) {
    if (!device || device.closed) return;

    const mix = new Float64Array(frames * CHANNELS);

    if (music && !musicPaused) {
      const src = music.samples;
      const vol = music.volume * musicVolume;
      for (let i = 0; i < frames; i++) {
        if (music.offset + 1 >= src.length) {
          if (music.loop) music.offset = 0;
          else {
            music = null;
            break;
          }
        }
        if (!music) break;
        mix[i * 2] += src[music.offset] * vol;
        mix[i * 2 + 1] += src[music.offset + 1] * vol;
        music.offset += 2;
      }
    }

    if (sfxList.length) {
      const next = [];
      for (const s of sfxList) {
        const src = s.samples;
        const vol = s.volume * sfxVolume;
        let alive = true;
        for (let i = 0; i < frames; i++) {
          if (s.offset + 1 >= src.length) {
            alive = false;
            break;
          }
          mix[i * 2] += src[s.offset] * vol;
          mix[i * 2 + 1] += src[s.offset + 1] * vol;
          s.offset += 2;
        }
        if (alive) next.push(s);
      }
      sfxList = next;
    }

    const out = Buffer.alloc(frames * BYTES_PER_FRAME);
    for (let i = 0; i < mix.length; i++) {
      let v = Math.round(mix[i]);
      if (v > 32767) v = 32767;
      if (v < -32768) v = -32768;
      out.writeInt16LE(v, i * 2);
    }

    try {
      device.enqueue(out);
      if (!device.playing) device.play();
    } catch {
      /* drop if queue rejects */
    }
  }

  function update() {
    if (!device || device.closed) return;
    let guard = 0;
    while (guard++ < 24) {
      const q = Math.floor((device.queued || 0) / BYTES_PER_FRAME);
      if (q >= QUEUE_TARGET_FRAMES) break;
      renderAndEnqueue(QUEUE_CHUNK_FRAMES);
    }
  }

  return {
    enabled: !!device,
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,

    /**
     * @param {string} filePath
     */
    async preload(filePath) {
      await loadCached(filePath);
    },

    /**
     * One-shot SFX (wav / mp3 / ogg).
     * @param {string} filePath
     * @param {PlayOptions} [options]
     */
    async playSfx(filePath, options = {}) {
      if (!device) return;
      const decoded = await loadCached(filePath);
      sfxList.push({
        samples: decoded.samples,
        offset: 0,
        volume: clampVol(options.volume ?? 1),
      });
      update();
    },

    /**
     * Background music. Loops by default.
     * @param {string} filePath
     * @param {PlayOptions} [options]
     */
    async playMusic(filePath, options = {}) {
      if (!device) return;
      const decoded = await loadCached(filePath);
      music = {
        samples: decoded.samples,
        offset: 0,
        volume: clampVol(options.volume ?? 1),
        loop: options.loop !== false,
      };
      musicPaused = false;
      update();
    },

    stopMusic() {
      music = null;
      musicPaused = false;
    },

    pauseMusic() {
      musicPaused = true;
    },

    resumeMusic() {
      musicPaused = false;
    },

    stopAll() {
      music = null;
      sfxList = [];
      musicPaused = false;
      try {
        device?.clearQueue?.();
      } catch {
        /* ignore */
      }
    },

    setMusicVolume(v) {
      musicVolume = clampVol(v);
    },

    setSfxVolume(v) {
      sfxVolume = clampVol(v);
    },

    get musicPlaying() {
      return !!music && !musicPaused;
    },

    update,

    close() {
      music = null;
      sfxList = [];
      try {
        device?.pause?.();
        device?.close?.();
      } catch {
        /* ignore */
      }
      device = null;
    },

    decodeAudioFile,
  };
}

export default createAudio;
