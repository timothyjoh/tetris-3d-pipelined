# AGENTS.md

READ THIS FIRST before writing any code or running any commands.

## Install

```
npm install
```

## Dev Server

```
npm run dev          # Vite dev server at localhost:5173
```

## Tests

```
npm run test         # Run all Vitest unit tests
npm run test:coverage  # Coverage report in coverage/ (engine target ≥ 80%)
```

## Build

```
npm run build        # Output to dist/
npm run preview      # Preview production build locally
```

## Architecture

```
src/
  main.js            — Entry point: RAF game loop, wires all layers
  input.js           — Keyboard event handling (including Enter/R restart)
  engine/            — Pure JS game logic (no DOM/Three.js)
    tetrominoes.js   — 7-piece shapes, SRS rotations, colors
    board.js         — Board class: 10×20 grid, line clear
    rotation.js      — SRS wall kick tables, tryRotate()
    gameState.js     — GameState: gravity, lock delay, scoring, level,
                       tilt state, sound events, flash state, sweep state
    tilt.js          — computeTiltAngle(col), stepSpring(current, velocity, target)
    ghost.js         — computeGhostRow(board, pieceType, rotation, col, startRow)
  audio/
    sounds.js        — playTone(freq, duration, type, gainEnvelope?, ctx?),
                       playGameSound(event, ctx)
  renderer/          — Three.js rendering (reads engine state, never writes)
    scene.js         — WebGLRenderer, OrthographicCamera, Scene
    blockPool.js     — Pre-allocated mesh pool (addBlock accepts emissiveIntensity)
    composer.js      — EffectComposer, UnrealBloomPass, grid LineSegments
                       (createGridLines/createBoardBackground accept any Object3D parent)
    render.js        — BoardRenderer: maps game state to block meshes,
                       ghost piece, lock flash, sweep animation
  hud/
    hud.js           — DOM updates for score/level/lines/next-piece/overlay
  __tests__/         — Vitest unit tests (engine modules only)
```

## Conventions

- ES Modules only (no CommonJS require)
- Node ≥ 18
- Three.js addons via `three/addons/` (not a separate postprocessing package)
- No E2E tests; unit tests cover engine only (renderer requires WebGL context)
- GameState constructor accepts `{firstPiece, secondPiece}` for deterministic testing

## Phase 2 Additions

### AnimationState / Tilt Contract

Tilt state lives directly on `GameState` as public fields:
- `gameState.tiltAngle` — current board tilt in degrees (updated by `main.js` RAF loop)
- `gameState.tiltVelocity` — current spring velocity (updated by `main.js` RAF loop)
- `gameState.justLocked` — one-frame boolean; set `true` in `_lockPiece()`, consumed and cleared by `main.js` to force `tiltTarget = 0`

The RAF loop in `main.js` drives tilt each frame:
```js
const tiltTarget = gameState.justLocked ? 0 : computeTiltAngle(gameState.col);
if (gameState.justLocked) gameState.justLocked = false;
const next = stepSpring(gameState.tiltAngle, gameState.tiltVelocity, tiltTarget);
gameState.tiltAngle = next.angle;
gameState.tiltVelocity = next.velocity;
boardGroup.rotation.z = THREE.MathUtils.degToRad(gameState.tiltAngle);
```

Pure tilt math functions (no Three.js, testable in Node):
- `computeTiltAngle(col)` — `src/engine/tilt.js`: clamps `(col - 4.5) / 4.5 * 7` to `[-7, 7]` degrees
- `stepSpring(current, velocity, target)` — `src/engine/tilt.js`: one spring step with constant 0.15, damping 0.75

### playTone API

```js
playTone(freq, duration, type = 'square', gainEnvelope = null, ctx = null)
```
- Lives in `src/audio/sounds.js`
- Creates `OscillatorNode` + `GainNode`, connects them, starts, stops, and disconnects via `onended`
- `ctx` is injectable for tests (pass a mock `AudioContext`); creates `new AudioContext()` if null
- `gainEnvelope(gainNode, ctx)` optional for custom ADSR; default is exponential ramp to silence

`playGameSound(event, ctx)` maps 8 named events to `playTone` calls:
- `move`, `rotate`, `softDrop`, `hardDrop`, `lineClear`, `tetris`, `levelUp`, `gameOver`

### Ghost Piece

`computeGhostRow(board, pieceType, rotation, col, startRow)` — `src/engine/ghost.js`

Returns the row where the active piece would land if hard-dropped. Used by `BoardRenderer.draw()` to render dim neon outlines at the landing position.

### Sound Event Queue

`gameState.soundEvents: string[]` — populated by engine, consumed and cleared by `main.js` each frame:
- `moveLeft/moveRight` push `'move'` on success
- `_tryRotate` pushes `'rotate'` on success
- `hardDrop` pushes `'hardDrop'` before locking
- `_lockPiece` pushes `'lineClear'` or `'tetris'` when rows complete
- `update` pushes `'softDrop'` on gravity tick while soft drop active
- `_finalizeSweep` pushes `'levelUp'` when level increases
- `_spawnPiece` pushes `'gameOver'` when spawn is blocked

### Sweep State

On line clear, `_lockPiece()` enters sweep mode instead of immediately clearing rows:
- `gameState.sweeping` — true during the 150ms sweep animation
- `gameState.sweepRows` — row indices being swept (for renderer)
- `gameState.sweepProgress` — getter, `0..1` during sweep
- Gravity does not tick while `sweeping`; `_finalizeSweep()` clears rows, updates score/level, spawns next piece

### Board Group

`boardGroup` (`THREE.Group`) in `main.js` wraps all board visuals:
- Grid lines (`createGridLines(boardGroup)`)
- Board background plane (`createBoardBackground(boardGroup)`)
- Block pool meshes (`new BlockPool(boardGroup, 220)`)

`boardGroup.rotation.z` is set each frame to the tilt angle in radians. Tilt is purely visual — game logic coordinates are unaffected.
