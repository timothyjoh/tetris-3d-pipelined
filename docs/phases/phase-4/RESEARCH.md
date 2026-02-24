# Research: Phase 4

## Phase Context

Phase 4 delivers two categories of work on top of the complete Phase 3 leaderboard/overlay system: (1) a critical bug fix for the Enter-key race condition that prevents the leaderboard table from appearing after initials submission, and (2) a full 3D rendering upgrade — replacing the existing `OrthographicCamera` with a `PerspectiveCamera`, upgrading block geometry from a thin `BoxGeometry(0.95, 0.95, 0.1)` slab to a true `BoxGeometry(0.85, 0.85, 0.85)` cube, adding a `DirectionalLight` for face shading, and re-wiring the board tilt from `boardGroup.rotation.z` to `boardGroup.rotation.y`. All 201 existing Vitest unit tests must remain green; rendering acceptance is via manual browser inspection.

---

## Previous Phase Learnings

From `docs/phases/phase-3/REFLECTIONS.md`:

- **Enter-key race condition (critical, still broken)**: `handleInitialsKey` is registered on `window` at `src/main.js:79`, before `setupInput` is called at line 88. When Enter is pressed to submit initials, `handleInitialsKey` fires first and calls `e.stopImmediatePropagation()` (line 74) before `submitInitials()` (line 75). However the SPEC and REFLECTIONS confirm the game still restarts on Enter — the leaderboard table is never shown. The combined listener interaction has not been integration-tested. Phase 4 must fix this and add a test that fires both listeners in registration order.
- **`loadLeaderboard`/`saveLeaderboard` untested**: Phase 3 explicitly left these uncovered; a `leaderboard-storage.test.js` now exists (3 tests) that uses `vi.stubGlobal('localStorage', ...)`. The gap is addressed.
- **Commit at phase boundary**: Phase 3 work was never committed. Phase 4 must end with `git commit` tagged "Phase 4 complete".
- **Research camera before replacing**: The SPEC explicitly warns to calculate correct PerspectiveCamera FOV and position against the 10×20 board world dimensions before committing.
- **`boardGroup.rotation.z` is the current tilt mechanism**: Changing to `.rotation.y` changes the axis of board lean — a 3D visual effect only; tilt math and spring physics are unchanged.
- **jsdom package**: Installed as `jsdom` (not `@vitest/environment-jsdom`). New jsdom test files require an entry in `vitest.config.js` `environmentMatchGlobs`.

---

## Current Codebase State

### Relevant Components

**Camera & Scene** — `src/renderer/scene.js`
- `createScene(canvas)` `:4`: Creates `WebGLRenderer`, `Scene`, adds `AmbientLight(0xffffff, 0.3)`, calls `buildCamera(canvas)`.
- `buildCamera(canvas)` `:23`: Creates `THREE.OrthographicCamera`. `vHeight = BOARD_ROWS + 4 = 24`; `vWidth = vHeight * aspect`. Camera placed at `z = 10`. Near=0.1, far=100.
- `updateCamera(camera, canvas)` `:36`: Updates ortho camera `left/right/top/bottom` on resize; calls `camera.updateProjectionMatrix()`.
- Resize listener `:15`: `window.addEventListener('resize', () => { renderer.setSize(...); updateCamera(camera, canvas); })`.
- Phase 4 change target: replace `buildCamera`/`updateCamera` to use `PerspectiveCamera` and update aspect ratio (not the ortho bounds) on resize.

**Block Geometry & Material** — `src/renderer/blockPool.js`
- `cellToWorld(col, row)` `:4`: Returns `[-BOARD_COLS/2 + col + 0.5, BOARD_ROWS/2 - row - 0.5, 0.1]`. Z is hardcoded to `0.1`.
- `BlockPool` constructor `:13`: Single shared `BoxGeometry(0.95, 0.95, 0.1)` for all blocks.
- Each block gets its own `MeshStandardMaterial` `:18`: `color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.0`.
- `addBlock(col, row, color, emissiveIntensity)` `:35`: Sets material color/emissive/intensity, calls `cellToWorld`, positions mesh.
- Phase 4 change targets: geometry `BoxGeometry(0.85, 0.85, 0.85)`; `cellToWorld` Z from `0.1` → `0.425` (half of 0.85 depth, flush with board plane at Z=0); roughness from `0.2` → `~0.4`.

**Tilt Application** — `src/main.js:113`
- Current: `boardGroup.rotation.z = THREE.MathUtils.degToRad(gameState.tiltAngle);`
- Phase 4 change target: `boardGroup.rotation.y = THREE.MathUtils.degToRad(gameState.tiltAngle);` (sign convention: left-of-center → positive Y → left edge toward viewer).

**Enter-Key Race Condition** — `src/main.js`
- `handleInitialsKey` `:57`: Checks `initialsActive`; on Enter with 3 chars calls `e.preventDefault()` + `e.stopImmediatePropagation()` (line 74) then `submitInitials()` (line 75). `submitInitials()` sets `initialsActive = false`.
- Listener registration order:
  - Line 79: `window.addEventListener('keydown', handleInitialsKey)` — first
  - Line 88: `setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive })` — second
- `setupInput` `:1` in `src/input.js`: Registers `onKeydown` on `window`; checks `suppressRestart()` which reads `initialsActive` at call time.
- No existing integration test exercises both listeners firing on the same Enter event.

**Tilt Engine (unchanged)** — `src/engine/tilt.js`
- `computeTiltAngle(col)` `:7`: `(col - 4.5) / 4.5 * 7`, clamped `[-7, 7]` degrees.
- `stepSpring(current, velocity, target)` `:20`: `newVelocity = (velocity + (target - current) * 0.15) * 0.75; newAngle = current + newVelocity`.
- These are pure functions; no changes in Phase 4.

**Tilt Drive Loop** — `src/main.js:100–113`
- Reads `gameState.pieceType` and `TETROMINOES[pieceType].width` to compute piece center column.
- Calls `computeTiltAngle(gameState.col + pieceHalfWidth)`, then `stepSpring(...)`.
- Stores result back on `gameState.tiltAngle`/`gameState.tiltVelocity`.
- Applies via `boardGroup.rotation.z` (Phase 4: changes to `.rotation.y`).

**Board Group** — `src/main.js:23–31`
- `boardGroup = new THREE.Group()` `:23`, added to scene.
- `createGridLines(boardGroup)` `:26`, `createBoardBackground(boardGroup)` `:27` — grid and background are children of boardGroup, so they tilt with it.
- `new BlockPool(boardGroup, 220)` inside `BoardRenderer` `:10` — block meshes also children of boardGroup.

**Board Background & Grid** — `src/renderer/composer.js`
- `createBoardBackground(parent)` `:52`: `PlaneGeometry(10, 20)`, `MeshBasicMaterial({ color: 0x050505 })`, `position.z = -0.05`.
- `createGridLines(parent)` `:24`: `LineSegments` with positions at `z = 0.02`. Vertical and horizontal grid lines at each cell boundary.
- Current Z-ordering: background at -0.05, grid lines at 0.02, block centers at 0.1 (with 0.1 depth, so front face at 0.15).
- Phase 4 Z-ordering: blocks center at 0.425 (front face at 0.85). Background at -0.05, grid at 0.02 — both well behind the front face of 3D cubes. Grid lines may need adjustment to be visible (e.g., at Z=0.86 or above the block faces), or left below for a recessed look.

**Bloom Post-Processing** — `src/renderer/composer.js:8–22`
- `EffectComposer` with `RenderPass`, `UnrealBloomPass(size, 1.2, 0.4, 0.82)`, `OutputPass`.
- No changes needed for Phase 4.

**HUD & Overlay** — `src/hud/hud.js`
- `showLeaderboard(entries, highlightIndex)` `:100`: Hides `#initials-prompt`, unhides `#leaderboard-section`, populates `#leaderboard-body` via `textContent` (no XSS risk in current Phase 4 scope — noted as debt).
- `showInitialsPrompt()` `:69`: Shows `#initials-prompt`, hides `#leaderboard-section`.
- `resetOverlayUI()` `:128`: Hides both; called by `hideOverlay()`.

**Input Handler** — `src/input.js`
- `setupInput(gameState, onRestart, options)` `:1`: Uses `held` Set for keydown dedup. Returns cleanup function `() => { removeEventListener x2 }`.
- `suppressRestart` option `:2`: Evaluated at keydown time (`!suppressRestart()`).

**Board Dimensions** — `src/engine/board.js:3–4`
- `BOARD_COLS = 10`, `BOARD_ROWS = 20` — used by `scene.js`, `blockPool.js`, `composer.js`.
- World space: board spans X ∈ [-5, 5], Y ∈ [-10, 10] (in local boardGroup coordinates).

**HTML Structure** — `index.html`
- `#game-canvas` `:129`: `width: 100%; height: 100%` — full viewport canvas.
- `#overlay` `:148`: Contains `#initials-prompt` (`.hidden` by default) and `#leaderboard-section` (`.hidden` by default).
- `#restart-btn` `:172`: Click calls `handleRestart`.

### Existing Patterns to Follow

- **Renderer reads engine state, never writes** (`AGENTS.md`): All Phase 4 renderer changes must remain read-only consumers of engine state.
- **MeshStandardMaterial per block**: Each block in the pool has its own material instance (line 18 in blockPool.js), allowing per-block color/emissive changes. A shared geometry is updated per-draw.
- **boardGroup as parent**: All visuals (grid, background, blocks) are children of `boardGroup`. Tilt is applied once on `boardGroup.rotation` — all children tilt together.
- **Pure engine functions, testable in Node**: `tilt.js`, `leaderboard.js`, `board.js`, etc. are side-effect free. Phase 4 adds no new engine functions.
- **ES Modules only**: No CommonJS. All imports use `.js` extensions.
- **`environmentMatchGlobs` for jsdom tests**: Any new test file using jsdom must be added to `vitest.config.js:5–8`.

### Dependencies & Integration Points

- **Three.js `^0.170.0`** (`package.json:17`): `PerspectiveCamera` is a standard Three.js export — no new package needed. `THREE.MathUtils.degToRad` used in `main.js:113`.
- **Vite `^6.0.0`**: Dev server and build. No changes.
- **Vitest `^2.0.0`** + **`jsdom ^28.1.0`**: Test runner. New jsdom test file needs `environmentMatchGlobs` entry in `vitest.config.js`.
- **`EffectComposer`** (`composer.js:1–4`): Imports from `three/addons/postprocessing/`. Receives `camera` reference at creation; camera swap must update the `RenderPass` or recreate the composer.
  - Specifically: `composer.addPass(new RenderPass(scene, camera))` at line 10 — if camera is replaced, a new `RenderPass` or composer is needed, or the `RenderPass` camera reference must be updated.
- **`BOARD_COLS`/`BOARD_ROWS`** imported in `scene.js:2`, `blockPool.js:2`, `composer.js:6`: Central constants; Phase 4 does not change them.

### Test Infrastructure

- **Framework**: Vitest v2 (`npm test` = `vitest run`)
- **Environment**: Node by default; jsdom for `input.test.js` and `leaderboard-storage.test.js` via `environmentMatchGlobs`.
- **Coverage**: `v8` provider, covers `src/engine/**`, threshold ≥ 80% lines. Phase 3 achieved 97.2%.
- **Test pattern — jsdom tests**: `// @vitest-environment jsdom` at top of file; `vi.fn()` mocks; `window.dispatchEvent(new KeyboardEvent(...))` for input; `vi.stubGlobal` for globals; `beforeEach`/`afterEach` for cleanup.
- **Test pattern — engine tests**: Pure Node, no DOM, no Three.js. Import engine function, assert over inputs/outputs.
- **Existing test files** (11 total, 201 tests):
  - `board.test.js`, `gameState.test.js`, `ghost.test.js` — engine
  - `rotation.test.js`, `tetrominoes.test.js`, `tilt.test.js` — engine
  - `sounds.test.js`, `sweep.test.js` — engine
  - `leaderboard.test.js` — pure functions (isTopTen, insertScore, rankEntries)
  - `leaderboard-storage.test.js` — jsdom, localStorage wrappers
  - `input.test.js` — jsdom, setupInput restart/suppress behavior
- **Gap for Phase 4**: No test covering combined `handleInitialsKey` + `setupInput` interaction on Enter.

---

## Code References

- `src/renderer/scene.js:27` — `new THREE.OrthographicCamera(...)` — replace with PerspectiveCamera
- `src/renderer/scene.js:32` — `camera.position.z = 10` — update to ~18 for perspective
- `src/renderer/scene.js:36–45` — `updateCamera` — rewrite for PerspectiveCamera aspect update
- `src/renderer/scene.js:11` — `AmbientLight(0xffffff, 0.3)` — stays; DirectionalLight to be added
- `src/renderer/blockPool.js:8` — `z: 0.1` in `cellToWorld` — update to 0.425
- `src/renderer/blockPool.js:14` — `BoxGeometry(0.95, 0.95, 0.1)` — replace with `BoxGeometry(0.85, 0.85, 0.85)`
- `src/renderer/blockPool.js:22` — `roughness: 0.2` — update to ~0.4
- `src/renderer/composer.js:31,35` — grid lines at `z = 0.02` — may need Z adjustment under perspective
- `src/renderer/composer.js:56` — background plane at `z = -0.05` — may need Z adjustment
- `src/main.js:79` — `window.addEventListener('keydown', handleInitialsKey)` — registration order fix target
- `src/main.js:88` — `setupInput(...)` — second listener
- `src/main.js:113` — `boardGroup.rotation.z = ...` — change to `boardGroup.rotation.y`
- `src/engine/tilt.js:7–9` — `computeTiltAngle` — unchanged
- `src/engine/tilt.js:20–23` — `stepSpring` — unchanged
- `src/input.js:10` — `suppressRestart` check — unchanged
- `vitest.config.js:5–8` — `environmentMatchGlobs` — add entry for new initials-submit test file

---

## Open Questions

1. **EffectComposer camera reference**: `createComposer(renderer, scene, camera)` in `composer.js:8` passes `camera` into `new RenderPass(scene, camera)`. If `scene.js` swaps the camera to a `PerspectiveCamera` and returns a new reference, `main.js` must also pass the new camera to `createComposer`. Is the `camera` reference passed by value (object reference) — i.e., does the existing `RenderPass` hold a stale reference if camera is reconstructed, or does the composer already hold the same object? This affects whether `createComposer` needs to be called after `createScene`.

2. **Grid/background Z positions under perspective**: With blocks now at Z=0.425 (front face at Z=0.85), grid lines at Z=0.02 will be behind the front face of all blocks. The SPEC says to verify and adjust if depth-fighting is visible. The background at Z=-0.05 is clearly behind everything. The decision on whether grid lines should appear in-front of or behind block faces is a visual one to verify in-browser.

3. **`boardGroup.rotation.y` sign convention**: The SPEC is explicit — piece left of center → positive Y → left edge toward viewer. `computeTiltAngle` returns positive for right-of-center, negative for left-of-center (formula: `(col - 4.5) / 4.5 * 7`). In Three.js, `rotation.y > 0` rotates the board so the right face comes toward the viewer. The SPEC's sign convention may require negating the tilt angle when applying to `rotation.y`. This needs to be verified against the Three.js coordinate system and tested visually.

4. **Race condition mechanism**: The existing code has `e.stopImmediatePropagation()` at `main.js:74` called before `submitInitials()` at line 75. The SPEC and REFLECTIONS both describe the race as broken, but the mechanism is not documented. The integration test (new `initials-submit.test.js`) will reveal whether `stopImmediatePropagation` actually prevents the second listener from firing in jsdom, confirming or disproving the current code's correctness.
