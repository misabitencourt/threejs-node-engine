import * as THREE from 'three';

/**
 * Start a fixed-target FPS loop with delta time.
 *
 * @param {object} options
 * @param {number} options.fps
 * @param {() => boolean} options.shouldContinue  return false to stop
 * @param {(delta: number) => void} options.onFrame
 * @returns {{ stop: () => void }}
 */
export function startLoop({ fps, shouldContinue, onFrame }) {
  const frameMs = 1000 / (fps ?? 60);
  const clock = new THREE.Clock();
  let running = true;
  let frameTimer = null;

  function stop() {
    running = false;
    if (frameTimer !== null) {
      clearTimeout(frameTimer);
      frameTimer = null;
    }
  }

  function frame() {
    if (!running || !shouldContinue()) return;

    const tickStart = performance.now();
    const delta = clock.getDelta();
    onFrame(delta);

    const spent = performance.now() - tickStart;
    frameTimer = setTimeout(frame, Math.max(0, frameMs - spent));
  }

  frame();
  return { stop };
}
