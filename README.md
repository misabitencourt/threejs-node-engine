# threejs-node-engine

OpenGL **Three.js** on **Node.js** — no browser. Declarative **engine** core plus raw examples.

## Layout

```text
lib/
  engine.js              Public API (engine.create)
  core/                  create() + FPS loop
  platform/              SDL window + WebGL renderer
  scene/                 camera
  graphics/              geometry, material, shader, transform, lights
  objects/               object type factories (geometry, …)
  utils/                 math helpers
src/cube.js              Engine-driven example (auto-spin cube)
src/controls.js          Cube + keyboard via window.gameloop
src/raw/                 Original hand-written examples
assets/
```

## Engine examples

```bash
npm install
npm run cube       # spinning cube
npm run controls   # first-person camera
npm run visible    # two boxes; hold F to show the second
npm run texture    # brick textures (fill + tile)
npm run materials  # many cubes: texture, raw color, glare, transparent blue
npm run audio      # music.ogg + press F for sfx.mp3
npm run duplicate  # press F to clone the blue cube (+x)
npm run push       # pushForce cube; arrows move, mouse orbits cam
npm run sprite     # 3dimagesprite walk cycle (char.png frames 2–3)
npm run sprite-tile # char sprite on 3dtile map + music by distance
npm run sprite2d   # 2dimagesprite walk on screen pixels (char.png)
npm run text       # extruded 3D text (FontLoader + TextGeometry)
npm run text2d     # camera-fixed 2D HUD text (Sprite + canvas)
npm run prompt     # name prompt UI (2dtext input + OK/Cancel)
npm run collision  # drive a cube; solid sphere/box/cylinder/cone
npm run scale      # cube; hold F scale up, Q scale down
npm run scale2d    # 2dimagesprite HUD; F/Q scale screen size
npm run heightmap  # terrain + cube; Y from heightmap sample
npm run tile3d     # 3D tile terrain + cube walk (sample height)
npm run background # cube walks on 3dtile + assets/cloud.jpg backdrop
npm run bitmap     # cube walks on 3dtile + 2dbitmap worldmap (top-right)
npm run gltf       # GLB character; WASD walk + animation when moving
npm run loading    # "Loading..." 2dtext, then cube after 5s
npm run shader     # many cubes, ShaderMaterial self-illumination
npm run fullscreen # cube in fullscreen (`window.fullscreen`)
```

```js
import { engine } from '../lib/engine.js'

engine.create({
  fps: 60,
  window: {
    title: 'my app',
    width: 800,
    height: 600,
    background: 0x0b0f14,
    camera: {           // camera is a window property, not an object
      fov: 50,
      position: [2.4, 1.8, 2.8],
      lookAt: [0, 0, 0],
    },
  },
  lights: [
    { type: 'ambient', intensity: 0.4 },
    { type: 'directional', intensity: 1.2, position: [4, 6, 3] },
  ],
  elements: [
    {
      type: 'geometry',
      geometry: 'box',
      width: 1, height: 1, depth: 1,
      material: { type: 'standard', color: 0x4f8cff },
      rotationSpeed: [0.5, 0.75, 0],
      edges: true,
    },
  ],
})
```

### Config notes

| Field | Role |
| ----- | ---- |
| `fps` | Target frame rate (delta-timed loop) |
| `window` | Title, size, **`fullscreen`**, clear color, optional **`backgroundImage`**, **camera**, optional **`gameloop`** |
| `window.fullscreen` | `true` → desktop-size exclusive window (alias `fullScreen`). Runtime: `window.fullscreen` / `window.setFullscreen(bool)` |
| `window.camera` | Main camera (not listed under `elements`) |
| `window.gameloop` | Optional per-frame `(ctx) => {}` — scene, window, controls, **audio** |
| `audio` | `true`/omit enable sound; `false` disable. Needs **ffmpeg** for mp3/ogg |
| `lights` | Ambient / directional / hemisphere |
| `elements[]` | Scene content: **`background`**, **`geometry`**, **`heightmap`**, **`3dtile`**, **`gltf`/`glb`**, **`3dimagesprite`**, **`2dimagesprite`**, **`2dbitmap`**, **`text`**, **`2dtext`**. Spawn more later with `addElement(def)` (see `npm run loading`) |
| `elements[].visible` | Default `true`; if `false`, element is not rendered |
| `elements[].texture` | `{ color\|raw?, image?, imageFill?, repeat? }` |
| `elements[].shader` | Shortcut for `material: { type: 'shader', ... }` on 3D meshes |
| `elements[].pushForce` | `undefined` or `[x,y,z]` / `{x,y,z}` — continuous push (units/s); **not** on `2dtext` / `2dimagesprite` / `2dbitmap` |

**Helper:** `pushForceFromRotation(object, localForce)` — object needs `position` + `rotation` (or `quaternion`); `localForce` is local space (`-Z` = forward); returns world `[x,y,z]` or `null`.

**Helper:** `scale3d(object, scale)` / `scaleBy(object, factor, { min?, max? })` — set or multiply scale on a mesh / runtime element (`.root.scale`). `getScale(object)` → `[x,y,z]`.

**Helper:** `scale2d(object, size)` / `scaleBy2d(object, factor, { min?, max? })` — set or multiply **screen pixel** size on HUD sprites (`2dimagesprite.size`, `2dbitmap.size`). `getScale2d(object)` → `[w,h]` px.

**Helper:** `createBitmap({ width, height, pixels?, fill? })` — CPU pixel buffer (Cartesian, origin top-left, y down). `setPixel(x, y, color)`, `getPixel`, `fill`, `setPixels`. Colors: `0xrrggbb`, `'#rrggbb'`, `[r,g,b,a?]`. Also `engine.createBitmap`.

**Helper:** `createHeightmap({ image, size, scale, maxHeight, position, material?, texture? })` → mesh + `sampleHeight(x,z)`. World footprint = `size * scale`. `sampleHeightAt(hm, x, z, mapScale, fallback?)` bilinear elevation. Element type **`heightmap`**: `image` is the **height** PNG; optional **`material`** / **`texture`** match geometry (surface look). With material/texture, height vertex-colors default off.

**Audio** (`lib/platform/audio.js`, on `ctx.audio` / `app.audio`) — **wav**, **mp3**, **ogg** via SDL playback (ffmpeg decodes mp3/ogg):

```js
await audio.playMusic('assets/music.ogg', { loop: true, volume: 0.4 })
await audio.playSfx('assets/sfx.mp3', { volume: 0.85 })
audio.pauseMusic() / resumeMusic() / stopMusic() / stopAll()
audio.setMusicVolume(0.5)
audio.setSfxVolume(1)
// also: engine.createAudio(), engine.decodeAudioFile(path)
```

**`background` / `backgroundImage`** — 2D picture behind the world (`scene.background`). Not a mesh; hide with `visible: false` to show the window clear color. Same resource via `window.backgroundImage`.

```js
{
  type: 'background',
  image: 'assets/cloud.jpg',
  imageFill: 'cover',   // cover | stretch | fit
  intensity: 1,
}
// or window.backgroundImage: 'assets/cloud.jpg'
// runtime: element.setImage(path), .imageFill, .visible, .intensity
```

**`3dtile` / `tile3d` / `tilemap`** — ramp tile grid (rotations 0–4), shared height corners, bilinear `sampleHeight(x,z)`:

```js
import { setTileMapScale } from '../lib/utils/tile3d.js'
// or engine.setTileMapScale({ tileSize: 1, step: 1 }, 10)
const sized = setTileMapScale({ tileSize: 1, step: 1 }, 10)
// sized.tileSize === 10, sized.step === 10, sized.scale === 10

{
  type: '3dtile',
  width: 16, height: 16,
  tileSize: 1, step: 1, scale: 10,  // world cell = tileSize * scale
  rotations: [/* 0 flat, 1 left, 2 top, 3 right, 4 bottom */],
  position: [0, 0, 0],
  material: { type: 'standard', roughness: 0.9 },
  texture: { image: 'assets/brick.jpeg', imageFill: 'tile' },
}
// runtime: element.sampleHeight(x, z), element.tilemap.scale
```

**`gltf` / `glb` / `model`** — load a GLB via Three.js `GLTFLoader` (Node polyfills + WebGL1 CPU skin bake):

```js
{
  type: 'gltf',
  model: 'assets/char.glb',
  animation: 'ArmatureAction', // clip name or index
  animationPlaying: true,
  center: true,
  position: [0, 0, 0],
}
// runtime: element.setAnimation(name|index), .playAnimation(), .pauseAnimation(),
//          .stopAnimation(), .animations, .currentAnimation, .animationPlaying
```

**Collision helpers** (`lib/utils/collision.js`, also on `engine.collision`):

```js
import {
  collide, intersects,
  collideBoxBox, collideSphereSphere,
  collideBoxSphere, collideBoxCylinder, collideBoxCone,
  collideCylinderCylinder, collideConeCone,
  moveBoxWithCollisions, shapeFromGeometryDef, boxFromSize,
} from '../lib/utils/collision.js'

// Shapes: { type:'box'|'sphere'|'cylinder'|'cone', center:[x,y,z], ... }
// collide(a,b) → null | { normal:[nx,ny,nz], depth }  (normal pushes A out of B)
moveBoxWithCollisions(playerBox, [dx,0,dz], obstacles, { lockY: true })
```

**Texture options**

| Field | Meaning |
| ----- | ------- |
| `color` / `raw` | Tint / solid raw color (hex number or `#rrggbb`) |
| `image` | Path to image (e.g. `assets/brick.jpeg`) |
| `imageFill` | `stretch` / `fill` / `fit` / `cover` / `tile` |
| `repeat` | UV repeat when `imageFill` is `tile` (number or `[u,v]`) |

**`shader` / `material.type: 'shader'`** — Three.js `ShaderMaterial` (GLSL1 / WebGL1) on 3D meshes (`geometry`, `text`, `heightmap`, `3dtile`). Unlit by default (self-illumination; scene lights are ignored). `time` / `uTime` advance automatically each frame.

```js
{
  type: 'geometry',
  geometry: 'box',
  material: {
    type: 'shader',          // aliases: shadermaterial, glsl
    color: 0xff4d6d,         // → uniform uColor
    intensity: 1.2,          // → uniform uIntensity
    uniforms: { uPhase: 0.4 },
    // vertexShader / fragmentShader optional (inline GLSL or .vert/.frag path)
  },
  // or shader: { color: 0xff4d6d, intensity: 1.2 }
}
// runtime: element.setUniform('uColor', 0x56cfe1), element.uniforms.time.value
// helpers: engine.createShaderMaterial(def), engine.setShaderUniform(mat, name, value)
```

Default fragment is self-lit color + facing/rim + a time pulse. Omit custom GLSL to use it.

`window.gameloop` context:

```js
{
  delta,           // seconds
  scene,
  camera,          // main THREE.Camera from window.camera
  renderer,
  window,          // { title, width, height, native }
  elements,        // runtime entries with .root / .def / .visible
  addElement(def), // spawn a new element at runtime (Promise)
  audio,           // playSfx / playMusic / stopMusic / …
  controls: {
    keyboard: {
      keys,        // { a: true, arrowleft: true, ... }
      pressed,     // ['a', 'arrowleft', ...]
      isDown(key), // boolean
    },
    mouse: {
      x, y,        // position in window
      dx, dy,      // movement this frame (pixels)
      buttons,     // { left, middle, right }
      isDown(btn), // 'left' | 'middle' | 'right'
      locked,      // pointer capture for FPS look
      lock(), unlock(),
    },
  },
}
```

`npm run controls` — first person: **arrows/WASD** move the camera, **mouse** looks (click to capture, Esc to release).

Geometry kinds: `box`, `sphere`, `plane`, `cylinder`, `cone`.

**`3dimagesprite`** — transparent PNG plane (sprite sheet friendly):

```js
{
  type: '3dimagesprite',
  image: 'assets/char.png',
  size: [1.2, 0.85],          // plane width / height
  position: [0, 0.5, 0],
  rotation: [0, 0, 0],
  pushForce: null,            // same as geometry
  crop: { x: 48, y: 0, w: 24, h: 17 },  // pixel region on the sheet
}
// runtime: element.setFrame(2, 24, 17)  or  element.crop = { x, y, w, h }
```

**`text`** — extruded mesh via Three.js `FontLoader` + `TextGeometry` (default Helvetiker):

```js
{
  type: 'text',
  text: 'Hello Three',
  size: 0.45,
  height: 0.12,          // extrusion depth
  bevelEnabled: true,
  center: true,
  material: { type: 'standard', color: 0xffc857 },
  position: [0, 1.6, 0], // 3D world vector
}
// runtime: element.setText('New label')
```

**`2dtext`** — camera-fixed HUD label (Three.js `Sprite` + canvas texture). Parent is the main camera, so it stays on screen while the world moves. **2D position only** — no 3D vector, no `pushForce`. Coordinates are **screen pixels** (Cartesian): origin top-left, `x` right, `y` down — the engine converts them to camera space.

```js
{
  type: '2dtext',
  text: 'Score: 0',
  position: [24, 20],    // screen px from top-left (not scene floats)
  fontSize: 40,
  color: '#7ee787',
  visible: true,
}
// runtime: element.setText('Score: 1'), element.position = [x, y], element.visible = false
```

**`2dbitmap` / `bitmap`** — camera-fixed pixel buffer (HUD). You build a color array and it draws in **screen pixels** (same Cartesian model as `2dtext`: origin top-left, `x` right, `y` down). No world transform / `pushForce`.

```js
{
  type: '2dbitmap',
  width: 16,
  height: 16,
  pixels: [0x40916c, 0x2a9d8f, /* row-major */],
  // or a 2D array: [[0xff0000, 0x00ff00], ...]
  fill: 0x1b4332,          // used when pixels omitted
  position: [784, 16],     // screen px from top-left
  pixelScale: 8,           // or size: [128, 128]
}
// runtime: element.setPixel(x, y, 0x4f8cff), .fill(color),
//          .setPixels(arr), .pixels, .position, .size, .visible
// helper:  const bmp = engine.createBitmap({ width: 16, height: 16 })
//          { type: '2dbitmap', bitmap: bmp, position: [784, 16], pixelScale: 8 }
```

**`2dimagesprite`** — camera-fixed PNG (same sheet/crop API as `3dimagesprite`, but HUD). Composes shared sheet + screen helpers — same Cartesian pixel `position` as `2dtext`. No world transform / `pushForce`.

```js
{
  type: '2dimagesprite',
  image: 'assets/char.png',
  position: [120, 280],  // screen px (top-left origin, y down)
  pixelScale: 4,         // or size: [w, h] in screen px
  crop: { x: 48, y: 0, w: 24, h: 17 },
  visible: true,
}
// runtime: element.position = [x, y], element.setFrame(i, fw, fh), element.visible
```

## Raw examples

| Command | File |
| ------- | ---- |
| `npm run raw:cube` | `src/raw/cube.js` |
| `npm run raw:char` | `src/raw/char.js` |
| `npm run raw:heightmap` | `src/raw/heightmap.js` |
| `npm run raw:tilemap` | `src/raw/tilemap.js` |

Aliases `npm run char|tilemap` still work. Engine terrain demo: `npm run heightmap`.

## Stack

| Package | Role |
| ------- | ---- |
| `@kmamal/sdl` | Native window |
| `@kmamal/gl` | WebGL1 / OpenGL context |
| `three@0.162` | Scene API (WebGL1-compatible) |
