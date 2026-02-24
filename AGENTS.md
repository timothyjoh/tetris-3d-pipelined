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
npm run test:e2e     # Playwright E2E tests (requires npm run build first; runs headless Chromium)
                     # VITE_TEST_HOOKS=true is set automatically via playwright.config.ts webServer.env
                     # Stop any running preview server first — E2E always rebuilds with the flag baked in
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
- Playwright E2E tests in `tests/gameplay.spec.ts` (run against production preview build); unit tests cover engine only (renderer requires WebGL context)
- GameState constructor accepts `{firstPiece, secondPiece}` for deterministic testing

## Phase 3 Additions

### Leaderboard Module API (`src/engine/leaderboard.js`)

Pure functions (node-testable, no DOM/localStorage dependency):
- `isTopTen(score, entries)` → `boolean` — true if score qualifies for top-10 (strict `>` vs 10th place; ties do NOT qualify)
- `insertScore(initials, score, entries)` → `Entry[]` — inserts, sorts descending, caps at 10; does not mutate input
- `rankEntries(entries)` → `Entry[]` — sorts descending by score, caps at 10; does not mutate input

localStorage wrappers (browser-only, not unit-tested):
- `loadLeaderboard()` → `Entry[]` — reads from `localStorage` key `tron-tetris-leaderboard`; returns `[]` on error or first call
- `saveLeaderboard(entries)` — writes JSON to same key

Entry shape: `{ initials: string, score: number }`

### Running a Local Production Build

```bash
npm run build    # produces dist/
npm run preview  # serves dist/ locally at http://localhost:4173
```

### Vercel Deployment

Vite's `dist/` output is a standard static site (single `index.html`, no SPA routing).
Vercel auto-detects Vite projects — no `vercel.json` is needed.
Connect the GitHub repository to Vercel; set build command `npm run build`, output directory `dist`.

### Phase 3 Spec Fixes

- **Tilt column fix**: `computeTiltAngle` now called with piece center column (`gameState.col + TETROMINOES[pieceType].width / 2`) instead of left-origin column. All TETROMINOES entries now have a `width` property (I=4, O=2, T/S/Z/J/L=3).
- **Sweep animation fix**: `render.js` now gates sweep cells by column (`c < Math.floor(sweepProgress * board.cols)`), producing a true left-to-right wipe instead of a uniform fade.

### jsdom for `input.test.js`

The `jsdom` package (installed as devDependency) is used via Vitest's built-in jsdom environment, configured via `environmentMatchGlobs` in `vitest.config.js`. The `@vitest/environment-jsdom` package is NOT needed — Vitest v2 uses `jsdom` directly.

## State-Machine Keydown Handler Discipline

Any state-machine `keydown` handler registered on `window` that intercepts a key and returns early (consuming the event) MUST call `e.stopImmediatePropagation()` immediately after the consuming action. This prevents the same event from reaching listeners registered later on `window` (e.g., `setupInput`'s `onKeydown`).

**Pattern** (from `src/main.js`):
```js
if (!gameStarted) {
  startGame();
  e.stopImmediatePropagation(); // ← required: prevents P→togglePause, Space→hardDrop
  return;
}
```

**Why**: All `keydown` listeners are on `window`. The state-machine handler is registered first (before `setupInput`). Without `stopImmediatePropagation`, a key pressed to dismiss an overlay also fires any matching `setupInput` binding — creating invisible state bugs (e.g., game starts but is immediately paused).

**Exception**: Non-consuming branches (guard returns that do nothing, like `if (gameState.over) return`) must NOT call `stopImmediatePropagation`, so downstream handlers (Enter/R for restart) still receive the event.

## Phase 2 Additions

### AnimationState / Tilt Contract

Tilt state lives directly on `GameState` as public fields:
- `gameState.tiltAngle` — current board tilt in degrees (updated by `main.js` RAF loop)
- `gameState.tiltVelocity` — current spring velocity (updated by `main.js` RAF loop)
- `gameState.justLocked` — one-frame boolean; set `true` in `_lockPiece()`, consumed and cleared by `main.js` to force `tiltTarget = 0`

The RAF loop in `main.js` drives tilt each frame:
```js
const pieceHalfWidth = gameState.pieceType ? TETROMINOES[gameState.pieceType].width / 2 : 0;
const tiltTarget = gameState.justLocked ? 0 : (gameState.pieceType ? computeTiltAngle(gameState.col + pieceHalfWidth) : 0);
if (gameState.justLocked) gameState.justLocked = false;
const next = stepSpring(gameState.tiltAngle, gameState.tiltVelocity, tiltTarget);
gameState.tiltAngle = next.angle;
gameState.tiltVelocity = next.velocity;
boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle);
```
Y-axis rotation (negative sign: left piece → positive tiltAngle → left edge toward viewer). Updated in Phase 4.

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

`boardGroup.rotation.y` is set each frame to the tilt angle in radians (negated). Tilt is purely visual — game logic coordinates are unaffected.
