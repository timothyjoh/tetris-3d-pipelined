# Research: Phase 2

## Phase Context

Phase 2 elevates the Phase 1 Tron Tetris engine into a fully atmospheric experience by adding: a board tilt effect (Z-rotation of the Three.js board group tracking the active piece column, ±7° max, spring/damping settling on landing); eight synthesized Web Audio sound effects (move, rotate, soft drop, hard drop, single line clear, Tetris, level up, game over); and three gameplay polish features — ghost piece (dim neon outline showing hard-drop landing row), piece lock flash (brief bright material override on locked cells), and line-clear sweep animation (150ms horizontal sweep before rows are removed). Two tech-debt items are also in scope: removing the redundant `randomPieceType()` call in `restart()` and wiring the currently-unused `onRestart` callback in `input.js` to support an Enter/R keyboard restart.

## Previous Phase Learnings

Key points from Phase 1 REFLECTIONS.md that directly affect Phase 2:

- **Write tilt math as pure isolated functions first** — implement `computeTiltAngle` and `stepSpring` as pure functions, test them in Node, then wire to the render loop. Do not start by editing Three.js scene code.
- **Test time-dependent logic during build, not fix** — `update(dt)` was entirely untested initially in Phase 1. The line-clear pause and spring animation both accumulate time in `update()`. These must be tested as part of the build task.
- **Inject `AudioContext` for testability** — audio helpers must accept an optional injected context so Vitest can mock it without a real Web Audio stack.
- **`_landed` flag is accurate and available** — the Phase 1 lock-delay fix left `this._landed` as a per-frame "piece resting on surface" signal. Phase 2 reads it as the tilt-reset trigger.
- **Tilt state must live outside `renderer/`** — in `GameState` or a dedicated `AnimationState` readable by the renderer.
- **Exact test assertions, not prose intent** — MUST-FIX instructions need testable exact `expect(...)` calls, not descriptive prose.
- **Seed any new random systems at construction** — injectable seeds from the start.
- **`_lockPiece()` is the landing event** — the lock event happens synchronously inside `_lockPiece()`, which is the point to emit sound, flash state, and begin the line-clear sweep.

## Current Codebase State

### Relevant Components

- **`GameState` class** — Central game state; drives gravity, lock delay, scoring, level. All Phase 2 new state (tilt target/current/velocity, flash state, sweep state) must live here or in a companion object read by the renderer. — `src/engine/gameState.js:20`
- **`GameState._landed`** — Per-frame boolean; `true` when the active piece is resting on a surface and cannot move down. Set to `true` at gravity tick when `_tryMoveDown()` returns false; reset to `false` when piece successfully drops. Used in Phase 2 as the tilt-reset trigger. — `src/engine/gameState.js:55-70`
- **`GameState._lockPiece()`** — Called by `hardDrop()` or when `_lockAccum >= 500ms`. Calls `board.lockPiece()`, then `getCompletedRows()`, then `clearRows()`, then `_spawnPiece()`. This is the primary hook point for: lock flash state, sound trigger (hard drop/line clear/Tetris/level up), and line-clear sweep initiation. — `src/engine/gameState.js:169`
- **`GameState.restart()`** — Contains a redundant `this.nextPieceType = randomPieceType()` at line 105 that is immediately overwritten by the subsequent `_spawnPiece()` call (tech debt to remove). — `src/engine/gameState.js:93-107`
- **`BoardRenderer`** — Reads `gameState.board` and `gameState.getActivePieceCells()` / `getActivePieceColor()` each frame; calls `pool.begin()`, iterates board cells and active cells, calls `pool.end()`. Phase 2 ghost piece rendering and lock flash rendering extend this method. — `src/renderer/render.js:1`
- **`BlockPool`** — Pre-allocates 220 `THREE.Mesh` instances; `addBlock(col, row, color)` assigns position and sets `mat.color` / `mat.emissive` to `color`. Pool size 220 = 200 board cells + 20 active piece cells. Ghost piece adds up to 4 more cells; lock flash requires per-entry emissive override. — `src/renderer/blockPool.js:1`
- **`BlockPool` material structure** — Each entry has `{ mesh, mat }` where `mat` is a `THREE.MeshStandardMaterial` with `emissiveIntensity: 0.6`. Flash effect would override `mat.emissive` / `mat.emissiveIntensity` temporarily. — `src/renderer/blockPool.js:18-28`
- **`createScene()`** — Returns `{ renderer, scene, camera }`. The `scene` object is what Phase 2's board group would be added to (a `THREE.Group` containing all board meshes would be added to scene and rotated). — `src/renderer/scene.js:4`
- **`createComposer()`** — `EffectComposer` with `UnrealBloomPass` (strength 1.2, radius 0.4, threshold 0.82) and `OutputPass`. Called via `composer.render()` in the RAF loop. No changes expected here. — `src/renderer/composer.js:8`
- **`createGridLines()`** — Creates `THREE.LineSegments` on the scene (not on a board group). If a board group is introduced for tilt, grid lines and background plane may need to be added to that group, or left at the scene level. — `src/renderer/composer.js:24`
- **`createBoardBackground()`** — Creates a `THREE.PlaneGeometry` background mesh at `z = -0.05`. Same grouping concern as grid lines. — `src/renderer/composer.js:52`
- **`setupInput(gameState, onRestart)`** — Handles keyboard events for Left/Right/Up/X/Z/Down/Space/P. The `onRestart` parameter is accepted but **never called** (tech debt). Phase 2 adds Enter/R handling that calls `onRestart` when `gameState.over === true`. — `src/input.js:1`
- **`main.js` RAF loop** — Calls `gameState.update(dt)`, `boardRenderer.draw(gameState)`, `composer.render()`, `updateHud(gameState)` in that order each frame. Also detects `gameState.over` transition and calls `showOverlay()`. Phase 2 tilt animation step and sound trigger calls integrate here. — `src/main.js:31`
- **`main.js` onRestart callback** — Currently passed as `() => { gameState.restart(); hideOverlay(); }` to `setupInput`. Already correct for wiring Enter/R restart. — `src/main.js:18-21`
- **`hud.js`** — DOM-based HUD updates and overlay show/hide. Uses Canvas 2D API for next-piece preview. No changes expected for Phase 2. — `src/hud/hud.js:1`
- **`Board.getCompletedRows()`** — Returns array of completed row indices (0-indexed). Called inside `_lockPiece()`. The returned array is the sweep animation target. — `src/engine/board.js:52`
- **`Board.lockPiece()`** — Writes piece color to all piece cells. After this call, the locked cells are in `board.cells`. — `src/engine/board.js:46`
- **`TETROMINOES[type].spawnCol`** — All 7 pieces have `spawnCol: 3`. The active piece column (`gameState.col`) is 0-indexed left-to-right. Tilt formula: `clamp((col - 4.5) / 4.5 * 7, -7, 7)`. — `src/engine/tetrominoes.js:6`

### Existing Patterns to Follow

- **Block mesh pool pattern** — `BlockPool` pre-allocates all meshes at construction; `begin()` resets an index; `addBlock()` assigns the next entry and sets visibility true; `end()` hides remaining entries. Ghost piece rendering and lock flash must follow this same pattern (no per-frame `new THREE.Mesh()`). — `src/renderer/blockPool.js`
- **Engine/renderer separation** — Engine modules (`engine/`) export pure JS with zero DOM or Three.js imports. Renderer (`renderer/`) reads engine state but never writes to it. All new state (tilt angle, flash state, sweep state) must live in engine-layer objects, not computed inside renderer functions.
- **Constructor injection for deterministic testing** — `GameState` accepts `{ firstPiece, secondPiece }` override. Any new randomized system (e.g., tilt, audio pitch) must similarly accept an injectable parameter. — `src/engine/gameState.js:21`
- **Guard pattern in `update(dt)`** — Early return on `paused || over` at the top of `update()`. The line-clear pause (where gravity is paused during sweep animation) follows this existing guard pattern by adding a new guard condition. — `src/engine/gameState.js:46`
- **Exported pure functions for testability** — `gravityInterval(level)` is exported and directly testable in Node. `computeTiltAngle(col)` and `stepSpring(current, velocity, target)` must follow the same pattern: exported pure functions, no Three.js dependency. — `src/engine/gameState.js:10`
- **`three/addons/` import path** — Three.js addon imports use `'three/addons/postprocessing/...'` not a separate npm package. Any Three.js Group usage follows standard `import * as THREE from 'three'`. — `src/renderer/composer.js:2-5`
- **ES Modules only** — All files use `import`/`export`. No `require()`. — per AGENTS.md conventions
- **Event detection in main.js** — `gameState.over` transition detected as `prevOver` flag. Sound events and animation triggers will follow the same "detect state change in the loop" pattern. — `src/main.js:29-43`

### Dependencies & Integration Points

- **Three.js `^0.170.0`** — Installed; `EffectComposer`, `UnrealBloomPass`, `OutputPass`, `RenderPass` all via `three/addons/`. No additional Three.js packages needed for tilt (just `THREE.Group`). — `package.json:14`
- **Web Audio API** — Browser built-in; no npm package. `AudioContext`, `OscillatorNode`, `GainNode` are the three interfaces needed. Must accept injectable context for tests.
- **Vite `^6.0.0`** — Build target `esnext`. Build output to `dist/`. — `vite.config.js`
- **Vitest `^2.0.0` + `@vitest/coverage-v8`** — Test environment is `node`. Tests at `src/__tests__/**/*.test.js`. Coverage only on `src/engine/**`. — `vitest.config.js`
- **`gameState.col`** — The active piece's left-origin column (0-indexed). Tilt formula uses this as `col` plus the piece's center offset. The I/O/T/S/Z/J/L pieces all use `spawnCol: 3`; during play, `col` ranges 0–9 depending on horizontal movement.
- **`gameState._landed`** — Used by Phase 2 tilt reset: when `_landed` transitions from false to true (or when `_lockPiece()` fires), tilt target resets to 0°.
- **`gameState.over`** — Used by Phase 2 keyboard restart: Enter/R fires only when `gameState.over === true`.
- **`overlay` DOM element** — Managed by `hud.js`; visibility controlled by `showOverlay()` / `hideOverlay()`. The keyboard restart check aligns with overlay visibility (`gameState.over === true`). — `src/hud/hud.js:45-53`

### Test Infrastructure

- **Test framework**: Vitest `^2.0.0` with `@vitest/coverage-v8`
- **Test environment**: `node` (no DOM, no WebGL — renderer untestable; engine fully testable)
- **Test file location**: `src/__tests__/**/*.test.js` — 4 files currently
- **Coverage scope**: `src/engine/**` only (renderer/hud excluded from coverage)
- **Coverage threshold**: 80% line coverage; Phase 1 achieved 98.54%
- **Test patterns**:
  - `describe`/`it`/`expect` from Vitest — no `beforeAll`/`afterAll` except `beforeEach` in `board.test.js` and `rotation.test.js`
  - Constructor injection (`{ firstPiece: 'I', secondPiece: 'O' }`) for deterministic piece sequences
  - Direct property manipulation to set up pre-conditions (e.g., `gs.level = 2`, `gs.row = 18`, `gs.board.setCell(...)`)
  - No mocking framework used yet; Phase 2 will need mock `AudioContext` pattern
- **Current test files**:
  - `src/__tests__/board.test.js` — Board class (constructor, getCell/setCell, isInBounds, isBlocked, getPieceCells, isValid, lockPiece, getCompletedRows, clearRows, clear)
  - `src/__tests__/gameState.test.js` — GameState (gravityInterval, constructor, scoring, level progression, game over, restart, hardDrop, update, movement, rotation, togglePause)
  - `src/__tests__/rotation.test.js` — tryRotate (CW rotations, full cycle, wall kicks, null return)
  - `src/__tests__/tetrominoes.test.js` — PIECE_TYPES, TETROMINOES shape/color/spawnCol, randomPieceType

## Code References

- `src/engine/gameState.js:20` — `GameState` class definition; public fields that Phase 2 reads
- `src/engine/gameState.js:40` — `_landed` field initialized `false`; updated in `update()`
- `src/engine/gameState.js:45-73` — `update(dt)` method: guard, gravity accumulation, per-frame lock accumulation when `_landed`
- `src/engine/gameState.js:55-60` — Lock accumulation block: Phase 2 line-clear pause inserts a sweep guard here
- `src/engine/gameState.js:93-107` — `restart()` method with the redundant `this.nextPieceType = randomPieceType()` at line 105 (tech debt)
- `src/engine/gameState.js:169-180` — `_lockPiece()`: board lock → getCompletedRows → clearRows → addScore → linesCleared → level → spawn. Phase 2 adds: lock flash state, completedRows for sweep, sound event flags
- `src/engine/board.js:46-49` — `lockPiece()`: iterates piece cells and sets color into `board.cells`
- `src/engine/board.js:52-62` — `getCompletedRows()`: returns array of full row indices
- `src/engine/board.js:64-76` — `clearRows()`: filter-based approach; removes rows and prepends empty rows
- `src/engine/tetrominoes.js:3-73` — All 7 piece definitions with `color`, `spawnCol`, and `shapes[4][4][4]`
- `src/renderer/blockPool.js:12-50` — `BlockPool`: pre-allocated mesh pool; `{ mesh, mat }` entries; `MeshStandardMaterial` with `emissiveIntensity: 0.6`
- `src/renderer/blockPool.js:35-43` — `addBlock()`: assigns next pool entry, sets `mat.color` and `mat.emissive` to the provided hex color
- `src/renderer/render.js:3-24` — `BoardRenderer.draw()`: iterates board cells and active piece cells; calls `pool.addBlock(c, r, color)`
- `src/renderer/scene.js:4-21` — `createScene()`: returns `{ renderer, scene, camera }` — the `scene` is where a tilt board group would be inserted
- `src/renderer/composer.js:24-49` — `createGridLines()`: creates `LineSegments` added directly to scene (not a group)
- `src/renderer/composer.js:52-59` — `createBoardBackground()`: plane mesh added directly to scene
- `src/input.js:1` — `setupInput(gameState, onRestart)` — `onRestart` received but never called (line 1 signature; switch block lines 8-19 has no Enter/R case)
- `src/main.js:18-21` — `onRestart` lambda passed to `setupInput`: `() => { gameState.restart(); hideOverlay(); }` — correct and ready to be invoked
- `src/main.js:31-46` — RAF loop: `update → draw → composer.render → updateHud → overlay check`
- `src/hud/hud.js:45-53` — `showOverlay()` / `hideOverlay()` — toggle `overlay.classList`

## Open Questions

1. **Board group vs. individual mesh tilt**: The SPEC says tilt applies to "the Three.js board group." Currently, `createGridLines()` and `createBoardBackground()` add directly to `scene`, and `BlockPool` also adds meshes directly to `scene`. Phase 2 must decide whether to create a `THREE.Group` that wraps all board meshes (blocks, grid, background) for unified tilt, or tilt only the block meshes via `BlockPool`. The former approach requires refactoring how `BlockPool`, `createGridLines`, and `createBoardBackground` are initialized — they currently accept/reference `scene` directly.

2. **Pool size for ghost piece**: Current pool is 220. Ghost piece adds up to 4 cells. Sufficient if ghost reuses from the pool (active count stays within 200 board + 4 active + 4 ghost = 208), but needs explicit accounting.

3. **Lock flash timing**: The SPEC says "purely visual, must not delay the game loop." The flash state needs to be set at lock time and cleared within ~100ms without any `setTimeout`. Mechanism (frame counter vs. `dt` accumulation) is not yet specified in code.

4. **Line-clear sweep pause scope**: The SPEC says "the game loop must not tick gravity during the sweep." The existing `update()` guard on `paused || over` provides a pattern; Phase 2 needs a third guard flag (e.g., `_sweeping`) to pause gravity without affecting `paused` semantics.

5. **Tilt state location**: SPEC says tilt must live "in `GameState` or a dedicated `AnimationState`." The codebase has no `AnimationState` concept yet. A decision is needed on whether to add fields to `GameState` directly or create a new module.

6. **Sound event signaling**: `_lockPiece()` and `moveLeft()`/`moveRight()` are engine-layer methods; `AudioContext` is a browser API. The engine cannot call audio directly. The pattern for surfacing sound events (return flags from `update()`, expose event properties on `GameState`, or detect changes in `main.js`) is not yet established.
