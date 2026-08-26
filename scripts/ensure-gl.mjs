import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))

if (process.env.THREEJS_ENSURE_GL === '1') process.exit(0)

function glDir() {
  try {
    return path.dirname(require.resolve('@kmamal/gl'))
  } catch {
    const dir = path.join(root, 'node_modules', '@kmamal', 'gl')
    return existsSync(path.join(dir, 'index.js')) ? dir : null
  }
}

function glLoaded() {
  try {
    require('@kmamal/gl')
    return true
  } catch {
    return false
  }
}

if (glLoaded()) process.exit(0)

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const spec = pkg.optionalDependencies?.['@kmamal/gl']
if (!spec) {
  console.error('threejs-node-engine: @kmamal/gl is missing from optionalDependencies')
  process.exit(1)
}

if (process.platform !== 'darwin') {
  console.error(
    'threejs-node-engine: @kmamal/gl failed to install. Linux/Windows use the stock package (prebuild or source build).',
  )
  process.exit(1)
}

const abi = process.versions.modules
const prebuild = path.join(root, 'prebuilds', `darwin-${process.arch}-${abi}`, 'webgl.node')
if (!existsSync(prebuild)) {
  console.error(
    `threejs-node-engine: no macOS prebuild for darwin-${process.arch} Node ABI ${abi} (${process.version}). Official @kmamal/gl binaries cover Node 18–23; this repo currently ships darwin-arm64 ABI 137 (Node 24). Use Node 20 or 22, or add prebuilds/darwin-${process.arch}-${abi}/webgl.node.`,
  )
  process.exit(1)
}

function ensurePackage() {
  const existing = glDir()
  if (existing) return existing

  const result = spawnSync(
    'npm',
    ['install', `@kmamal/gl@${spec}`, '--ignore-scripts', '--no-save', '--no-audit', '--no-fund'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, THREEJS_ENSURE_GL: '1' },
    },
  )
  if (result.status !== 0) {
    console.error('threejs-node-engine: failed to unpack @kmamal/gl')
    process.exit(1)
  }

  const dir = glDir()
  if (!dir) {
    console.error('threejs-node-engine: @kmamal/gl is still missing after unpack')
    process.exit(1)
  }
  return dir
}

const destDir = path.join(ensurePackage(), 'dist')
mkdirSync(destDir, { recursive: true })
copyFileSync(prebuild, path.join(destDir, 'webgl.node'))

if (!glLoaded()) {
  console.error('threejs-node-engine: copied the macOS @kmamal/gl prebuild but it failed to load')
  process.exit(1)
}

console.log(
  `threejs-node-engine: installed macOS @kmamal/gl prebuild (darwin-${process.arch} ABI ${abi})`,
)
