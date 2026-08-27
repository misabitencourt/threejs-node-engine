# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-08-27

HUD 2D mirror (`mirrorX` / `mirrorY`).

### Added

- `mirrorX` and `mirrorY` on HUD elements (`2dtext`, `2dimagesprite`, `2dbitmap`). Flips the image in place; screen `position` / size stay put. Runtime: `element.mirrorX` / `element.mirrorY`.
- Shared HUD helpers in `lib/objects/hudScreen.js` (`bindMirror`, `attachHudMirrorUniforms`, `resolveBool`). UV flip in the sprite shader because `THREE.Sprite` ignores negative scale.
- Example: `npm run mirror2d` (four `2dimagesprite` copies: original, X, Y, both).

## [1.1.0] - 2026-08-25

macOS install/runtime fixes and HUD 2D API improvements.

### Added

- `zIndex` on HUD elements (`2dtext`, `2dimagesprite`, `2dbitmap`). Higher values draw in front. Defaults keep the previous stack: bitmap `0`, sprite `1`, text `2`.
- `opacity` on the same HUD types (`0`..`1`, default `1`). Runtime: `element.zIndex` and `element.opacity`.
- Shared HUD helpers in `lib/objects/hudScreen.js` (`bindHudSprite`, `bindZIndex`, `bindOpacity`, `hudRenderOrder`).
- Examples: `npm run zindex` (HUD stack) and `npm run opacity` (semi-transparent overlay).
- Bundled Darwin **arm64** `@kmamal/gl` binary for Node 24 (ABI 137) under `prebuilds/darwin-arm64-137/`.
- `postinstall` script (`scripts/ensure-gl.mjs`) that copies that prebuild when the official package has no binary.

### Changed

- `@kmamal/gl` is an optional dependency so a failed native install no longer aborts `npm install`.
- Published package now includes `prebuilds/` and `scripts/`.
- HUD `renderOrder` is `1000 + zIndex` instead of hardcoded `997` / `998` / `999`.

### Fixed

- macOS retina: camera-fixed HUD (`2dtext`, `2dimagesprite`, `2dbitmap`) was clipped off-screen when SDL reported 2× pixels but the ANGLE EGL surface was in window points. The engine now probes the GL color buffer and uses that size for the viewport (including resize and fullscreen).
- Install on macOS Node 24, where official `@kmamal/gl` has no ABI 137 binary. Intel Macs on Node 24 should still use Node 20 or 22 until a `darwin-x64-137` prebuild is added.

## [1.0.0] - 2026-08-16

Initial public release: OpenGL Three.js on Node.js (no browser).

### Added

- Declarative `engine.create()` with window, camera, lights, audio, and a per-frame `gameloop`.
- Scene element types: `geometry`, `background`, `heightmap`, `3dtile`, `gltf`/`glb`, `3dimagesprite`, `2dimagesprite`, `2dbitmap`, `text`, `2dtext`.
- Runtime helpers: collision, scale (3D and 2D), push force, heightmap sampling, tile maps, shaders, audio (wav/mp3/ogg).
- TypeScript declarations generated from JSDoc (`dist/engine.d.ts`).
- Engine-driven examples under `src/` plus raw samples under `src/raw/`.
