# Research: Phase 3

## Phase Context

Phase 3 completes the Tron Tetris MVP by: (1) fixing two spec-deviation debts from Phase 2 — the tilt calculation uses the piece's left-origin column instead of its center column, and the line-clear sweep is a uniform fade rather than a left-to-right wipe; (2) adding a local leaderboard (top 10 scores in `localStorage`, arcade-style 3-character initials entry triggered only when a score qualifies); (3) redesigning the game-over overlay into a full-screen Tron-styled screen showing final score, initials input (when qualifying), a ranked top-10 table with the new entry highlighted, and a restart button; (4) adding `input.js` unit tests via a jsdom environment; and (5) configuring and validating a Vercel deployment.

## Previous Phase Learnings

From `docs/phases/phase-2/REFLECTIONS.md`:

- **Tilt column bug is documented and located**: `src/main.js:55` calls `computeTiltAngle(gameState.col)` (left-origin). The fix is to pass `gameState.col + pieceHalfWidth`. The SPEC references `TETROMINOES[gameState.type].width / 2` for `pieceHalfWidth`, but the current TETROMINOES object has no `width` property — it must be computed from the shape or added to the definition.
- **Sweep fade is documented and located**: `src/renderer/render.js:31-34` applies a uniform emissive intensity fade on sweep rows. The fix adds a column gate: a cell at column `c` is visible only while `c <= Math.floor(sweepProgress * board.cols)`.
- **`input.js` keyboard restart is completely untested**: `src/input.js:9-11`. No jsdom or DOM environment is set up in Vitest; `@vitest/environment-jsdom` (or equivalent) is not installed.
- **Pure-function-first pattern worked well**: `computeTiltAngle`, `stepSpring`, `computeGhostRow` are all DOM/Three.js-free pure functions with full test coverage. The same approach should be applied to leaderboard logic (`isTopTen`, `insertScore`, `rankEntries`).
- **Sound event queue decoupling is the right model**: Engine pushes string names to `gameState.soundEvents`; `main.js` consumes and clears each frame. Any new game-over/leaderboard events should follow the same pattern.
- **Phase 2 work is uncommitted**: All Phase 2 files exist as unstaged modifications/untracked files on `master`. A "Phase 2 complete" commit should be created before Phase 3 work begins.

## Current Codebase State

### Relevant Components

- **Entry point / RAF loop**: `src/main.js` — wires all layers; drives tilt animation, sound event consumption, HUD updates, and game-over overlay trigger. `showOverlay` is called at line 77 when `gameState.over` transitions to `true`. This is where leaderboard-check logic and the new overlay flow will be integrated.
- **Game state engine**: `src/engine/gameState.js` — `GameState` class holds all game state including `score`, `over`, `restart()`. The `restart()` method at line 136 resets all fields and calls `_spawnPiece()`. Phase 3 needs `restart()` to also clear initials input state (likely via a callback or by the caller clearing it).
- **Board**: `src/engine/board.js` — 10×20 grid backed by flat `Uint8` array. `BOARD_COLS = 10`, `BOARD_ROWS = 20`. No changes needed.
- **Tetrominoes**: `src/engine/tetrominoes.js` — 7 pieces (`I`, `O`, `T`, `S`, `Z`, `J`, `L`), each with `color`, `spawnCol`, and `shapes` (4 rotation states of 4×4 grids). No `width` property exists on any piece. All pieces spawn at `spawnCol: 3`.
- **Tilt math**: `src/engine/tilt.js` — `computeTiltAngle(col)` formula: `clamp((col - 4.5) / 4.5 * 7, -7, 7)`. Currently called with left-origin `gameState.col` in `main.js:55`. The function itself is correct; the call site needs updating.
- **Renderer (sweep bug)**: `src/renderer/render.js:31-34` — sweep row cells are rendered with `intensity = SWEEP_INTENSITY * (1 - gameState.sweepProgress)` applied uniformly to all columns. Column gating (`c <= Math.floor(sweepProgress * board.cols)`) is absent. The fix is a conditional in this branch.
- **Block pool**: `src/renderer/blockPool.js` — pre-allocated 220-mesh pool. `addBlock(col, row, color, emissiveIntensity = 0.6)` maps game-grid coordinates to world space. No changes needed.
- **Keyboard input**: `src/input.js` — `setupInput(gameState, onRestart)` installs `keydown`/`keyup` listeners on `window`. Enter/R restart handler is at lines 9-11, guarded by `gameState.over`. Phase 3 needs this handler to also clear initials input state; the `onRestart` callback pattern is the right place for this.
- **HUD / overlay**: `src/hud/hud.js` — `showOverlay(title, score)` (line 45) sets `#overlay-title` and `#overlay-score` text and removes `hidden` class from `#overlay`. `hideOverlay()` (line 51) adds `hidden` back. Phase 3 replaces/extends the overlay with leaderboard and initials-entry UI.
- **Sound system**: `src/audio/sounds.js` — `playGameSound(event, ctx)` and `playTone(freq, duration, type, gainEnvelope, ctx)`. No changes needed for Phase 3.
- **Ghost piece**: `src/engine/ghost.js` — `computeGhostRow(board, pieceType, rotation, col, startRow)`. No changes needed.
- **Composer / scene**: `src/renderer/scene.js`, `src/renderer/composer.js` — WebGLRenderer, OrthographicCamera, UnrealBloom post-processing. No changes needed.

### Existing Patterns to Follow

- **Pure function modules**: `src/engine/tilt.js`, `src/engine/ghost.js` — zero DOM/Three.js dependency, fully testable in Node. New leaderboard functions (`isTopTen`, `insertScore`, `rankEntries`) must follow this pattern. `localStorage` I/O must be isolated in thin wrappers (`loadLeaderboard`, `saveLeaderboard`) that are independently mockable.
- **Injectable context for testability**: `playTone(freq, duration, type, gainEnvelope, ctx)` accepts an injectable `AudioContext`. Same principle applies to leaderboard I/O — functions accept arrays, not `localStorage` directly.
- **GameState deterministic seeding**: `new GameState({ firstPiece, secondPiece })` for reproducible test setups — `src/engine/gameState.js:23`.
- **Sound event queue**: Engine pushes strings to `gameState.soundEvents[]`; `main.js` loop consumes and clears. No browser API calls in engine layer.
- **Vitest test file location**: `src/__tests__/*.test.js` — matched by `vitest.config.js` glob `src/__tests__/**/*.test.js`.
- **ES Modules only**: All files use `import`/`export`. No CommonJS `require`.
- **Test structure**: `describe` + `it` + `expect`, using `vitest`. Tests use arithmetic exactness (`toBeCloseTo`, `toBe`) and state inspection by direct field access.

### Dependencies & Integration Points

- **`main.js` → `hud.js`**: `showOverlay(title, score)` called at `main.js:77` when `gameState.over && !prevOver`. Phase 3 replaces this with a leaderboard-aware flow: check `isTopTen`, show initials prompt or leaderboard table directly.
- **`main.js` → `input.js`**: `setupInput(gameState, onRestart)` at `main.js:33`. The `onRestart` callback currently calls `gameState.restart()` and `hideOverlay()`. Phase 3 needs this callback to also reset initials input state and re-hide/reset any leaderboard UI.
- **`main.js` → `gameState`**: Tilt call at `main.js:55`: `computeTiltAngle(gameState.col)` — needs `+ pieceHalfWidth`. Piece type available as `gameState.pieceType`; `TETROMINOES[gameState.pieceType]` needed to compute half-width.
- **`render.js` → `gameState.sweepProgress` / `gameState.sweepRows`**: Renderer reads sweep state; column-gate fix lives entirely in `render.js:31-34`.
- **`index.html` overlay DOM**: `#overlay` (line 102), `#overlay-title` (line 103), `#overlay-score` (line 104), `#restart-btn` (line 105) are the current game-over overlay elements. Phase 3 will add new elements for initials input (`#initials-input` or similar) and a leaderboard table.
- **`localStorage`**: No leaderboard key exists yet. The stable key `tron-tetris-leaderboard` will be introduced by Phase 3.
- **Vercel / `dist/`**: `vite.config.js` builds to `dist/` with `outDir: 'dist'`. No `vercel.json` file exists. Vite builds produce a single `dist/index.html` with no SPA routing — standard Vercel static deployment should work without config.

### Test Infrastructure

- **Framework**: Vitest v2.1.9 (`package.json` devDependencies: `"vitest": "^2.0.0"`)
- **Environment**: `node` (set in `vitest.config.js:4`); no DOM APIs available. `jsdom` is **not installed** — `ls node_modules | grep jsdom` returns nothing.
- **Coverage**: Provider `v8`; includes `src/engine/**`; threshold: 80% lines; reporter: text, lcov, html; output to `coverage/`.
- **Test file pattern**: `src/__tests__/**/*.test.js`
- **Current test count**: 163 tests across 7 files, all passing (runtime ~460ms).
  - `tilt.test.js`: 11 tests
  - `ghost.test.js`: 6 tests
  - `tetrominoes.test.js`: 32 tests
  - `gameState.test.js`: 58 tests
  - `board.test.js`: 28 tests
  - `rotation.test.js`: 19 tests
  - `sounds.test.js`: 9 tests
- **No `input.test.js`** exists; keyboard restart logic in `src/input.js` has zero test coverage.
- **Vitest jsdom setup**: Phase 3 needs `@vitest/environment-jsdom` installed (not yet present). The `vitest.config.js` `environmentMatchGlobs` option can target jsdom only for `input.test.js`, leaving all other tests in `node` environment.
- **Test pattern for pure functions**: Direct import + arithmetic assertion (see `tilt.test.js` for model). Leaderboard pure function tests will follow the same pattern.

## Code References

- `src/main.js:33` — `setupInput(gameState, onRestart)` — restart callback wires `gameState.restart()` + `hideOverlay()`
- `src/main.js:38-41` — `#restart-btn` click handler calling `gameState.restart()` + `hideOverlay()`
- `src/main.js:53-61` — tilt animation loop; line 55 is the bug site: `computeTiltAngle(gameState.col)`
- `src/main.js:76-79` — game-over detection: `if (gameState.over && !prevOver) showOverlay('GAME OVER', gameState.score)`
- `src/engine/gameState.js:29` — `this.over = false` initial state; set `true` in `_spawnPiece` (line 182) when spawn blocked
- `src/engine/gameState.js:136-159` — `restart()` method resets all state; Phase 3 may need to hook into this or handle leaderboard reset in the `onRestart` callback
- `src/engine/gameState.js:170-185` — `_spawnPiece()` — pushes `'gameOver'` sound event when spawn is blocked
- `src/engine/tetrominoes.js:2-73` — `TETROMINOES` object; no `width` property on any piece; piece widths from shapes: I=4, O/T/S/Z/J/L=3 columns at rotation 0
- `src/engine/tilt.js:7-10` — `computeTiltAngle(col)`: accepts any numeric column, clamps result to ±7°
- `src/renderer/render.js:24-38` — board cell rendering loop; sweep branch at lines 31-34 needs column gate
- `src/renderer/render.js:31-33` — sweep intensity: `SWEEP_INTENSITY * (1 - gameState.sweepProgress)` applied to all columns in the row
- `src/hud/hud.js:45-53` — `showOverlay(title, score)` and `hideOverlay()`; sets text content on `#overlay-title` and `#overlay-score`
- `src/input.js:9-11` — Enter/R restart handler: `if ((e.code === 'Enter' || e.code === 'KeyR') && gameState.over) { onRestart?.(); return; }`
- `index.html:51-79` — overlay CSS: full-screen `position: absolute; inset: 0`, dark background, neon cyan text/shadow, monospace font
- `index.html:102-106` — overlay DOM: `#overlay`, `#overlay-title`, `#overlay-score`, `#restart-btn`
- `vitest.config.js:4` — `environment: 'node'` — blocks DOM APIs in all tests
- `package.json:16-19` — devDependencies: only `vite`, `vitest`, `@vitest/coverage-v8`; no jsdom package

## Open Questions

1. **`TETROMINOES[type].width`**: The SPEC says `pieceHalfWidth = TETROMINOES[gameState.type].width / 2`, but no `width` field exists on TETROMINOES entries. The plan needs to decide: add a `width` property to each TETROMINOES entry, or compute piece width inline in `main.js` from the shape grid.
2. **Leaderboard module location**: Should the new module live at `src/engine/leaderboard.js` (pure functions alongside other engine modules) or `src/leaderboard/leaderboard.js` (its own directory)? The existing `hud/` directory precedent suggests a `src/leaderboard/` folder could be used if DOM interaction is also included.
3. **Overlay redesign scope**: The SPEC says the game-over overlay "must not be a plain HTML `<div>` drop-in — it should match the visual language of the existing Three.js scene." This could mean adding DOM elements with the existing Tron CSS aesthetic (already present in `index.html` with neon cyan, monospace, glowing borders) or rendering something in Three.js itself. The existing overlay is already a styled `div` with neon CSS — clarification on whether CSS styling is sufficient or Three.js canvas rendering is required would affect implementation complexity.
4. **Initials input DOM**: Where in `index.html`/`hud.js` do the new initials input and leaderboard table elements live? They will need to be inside `#overlay` or replace it entirely.
5. **`jsdom` version compatibility**: Vitest v2.x typically requires `@vitest/environment-jsdom` (not the standalone `jsdom` package). Confirmation of the exact package name needed before installing.
