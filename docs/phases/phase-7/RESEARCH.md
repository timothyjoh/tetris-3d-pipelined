# Research: Phase 7

## Phase Context

Phase 7 closes the final BRIEF.md criterion ("deploys cleanly to Vercel") and resolves four technical debt items identified in Phase 6 REFLECTIONS: (1) missing `e.stopImmediatePropagation()` in the state-machine keydown handler that allows overlay-dismiss keys to also trigger game-control actions; (2) no-op `waitForFunction` guards in Tests 3–5; (3) undocumented `Space` side effect in Test 7; (4) stale "Z-axis" tilt description in README.md. Additionally, a new Test 10 exercises the click-to-start code path and documentation (README, AGENTS.md, CLAUDE.md) must be updated.

---

## Previous Phase Learnings

From `docs/phases/phase-6/REFLECTIONS.md`:

- **`stopImmediatePropagation` omission is confirmed**: The state-machine handler calls `startGame()` and `return`s but does NOT call `e.stopImmediatePropagation()`. A `KeyP` keydown on the start screen fires `startGame()` through the state-machine handler, then the same event reaches `setupInput`'s `onKeydown` which calls `gameState.togglePause()` — leaving the game paused with no pause overlay visible.
- **`waitForFunction` guards in Tests 3–5 are no-ops**: `window.__gameState !== undefined` is set synchronously at module evaluation and passes before the game loop ticks even once.
- **`Space` side effect in Test 7 undocumented**: `Space` used to dismiss the start overlay also triggers `hardDrop()` via `setupInput` because `stopImmediatePropagation` is not called. No comment in the test explains this.
- **Click-to-start wired but untested**: `startOverlay.addEventListener('click', startGame)` exists in `src/main.js:127` but no E2E test exercises it.
- **Vercel deploy never verified**: `AGENTS.md` contains Vercel instructions and confirms no `vercel.json` is needed; the deploy itself was deferred from Phase 6.
- **MEMORY.md update last**: update only after all tests pass and MUST-FIX items are resolved.

---

## Current Codebase State

### Relevant Components

- **State-machine keydown handler**: `src/main.js:106–125` — `window.addEventListener('keydown', ...)` registered before `setupInput`. Handles: start-screen dismiss (`!gameStarted` branch, lines 107–112), game-over guard (line 113), pause resume (lines 114–119), ESC pause (lines 120–124). None of the four branches call `e.stopImmediatePropagation()`.

- **`startGame()` function**: `src/main.js:96–101` — sets `gameStarted = true`, adds `hidden` class to `#start-overlay`, and calls `requestAnimationFrame(loop)`. Guarded by `if (gameStarted) return` to be idempotent.

- **Click-to-start listener**: `src/main.js:127` — `startOverlay.addEventListener('click', startGame)`. Already wired. No E2E test covers it.

- **`setupInput` function**: `src/input.js:1–41` — registered via `window.addEventListener('keydown', onKeydown)` at line 34, AFTER the state-machine handler. Key bindings that overlap with overlay-dismiss keys:
  - `KeyP` (line 25) → `gameState.togglePause()` — conflicts with start-screen P-key dismiss
  - `Space` (lines 21–24) → `e.preventDefault()` + `gameState.hardDrop()` — conflicts with start-screen Space dismiss
  - `ArrowLeft`/`ArrowRight`/`ArrowUp` — called during active play, non-overlapping with pause/resume behavior

- **`handleInitialsKey` handler**: `src/main.js:65–85` — already calls `e.stopImmediatePropagation()` on lines 70, 75, 83 when it consumes a key. Pattern exists in the file already.

- **`window.__gameState` gate**: `src/main.js:38–40` — exposed only when `import.meta.env.VITE_TEST_HOOKS === 'true'` or `import.meta.env.DEV`. Set synchronously at module evaluation (before the game loop ticks).

- **E2E test file**: `tests/gameplay.spec.ts:1–239` — 9 tests total. Tests 3–5 use the no-op guard at lines 45, 80, 116. Test 7 uses `Space` without a comment at lines 163–174. Test 8 uses `Space` to resume from pause at line 194 (this behavior will be affected by the `stopImmediatePropagation` fix). Tests use `window.__gameState` for state injection/inspection.

- **Playwright config**: `playwright.config.ts:1–38` — Chromium-only, headless, `video: 'on'`, `retries: 1`, `html` reporter. `webServer.command: 'npm run build && npm run preview'`, `reuseExistingServer: false`, `env: { VITE_TEST_HOOKS: 'true' }`. WebGL flags: `--enable-webgl`, `--ignore-gpu-blacklist`, `--use-gl=angle`.

- **README.md**: `README.md:10` — "board Z-rotates up to ±7°" is stale from Phase 2. Phase 4 changed this to Y-axis (`boardGroup.rotation.y`). CLAUDE.md:80 correctly documents Y-axis. AGENTS.md:127 correctly documents Y-axis. README.md alone is wrong.

- **`index.html` overlays**:
  - `#start-overlay` (line 164): no `hidden` class initially — visible on page load
  - `#pause-overlay` (line 170): has `hidden` class initially — hidden on load
  - `#overlay` (line 191): has `hidden` class initially — hidden on load (game-over)

- **AGENTS.md**: `AGENTS.md:71–98` — Phase 3 additions section includes Vercel deployment instructions. No section about `stopImmediatePropagation` discipline.

- **CLAUDE.md**: `CLAUDE.md:76–84` — "Rendering (as of Phase 4)" correctly documents Y-axis tilt. Phase 6 conventions at lines 101–106. No mention of `stopImmediatePropagation`.

---

### Existing Patterns to Follow

- **`stopImmediatePropagation` pattern in `handleInitialsKey`**: `src/main.js:70, 75, 83` — when a handler consumes a key and wants to prevent downstream handlers from seeing it, it calls both `e.preventDefault()` and `e.stopImmediatePropagation()`. The state-machine handler does not yet follow this pattern.

- **E2E test structure**: `tests/gameplay.spec.ts` — each test has a header comment block (lines 3–6, 13–17, etc.) with test number, name, setup description, and assertion description. New Test 10 should follow this format.

- **`waitForFunction` with exact post-tick condition**: SPEC requires `window.__gameState?.pieceType !== null` — `pieceType` is set by `_spawnPiece()` which is called during the first game tick. `null` is the value when `pieceType` is unset; it's a non-null string (e.g. `'I'`) after the first spawn.

- **Exact assertion values**: established pattern — `toBe(true)`, `toBe(false)`, `toHaveText('800')` etc., not weakened checks.

- **Board injection pattern** (Tests 3–5, 9): `page.evaluate()` directly mutates `window.__gameState` fields and calls methods like `gs.hardDrop()`.

- **Vercel deploy (no config needed)**: `AGENTS.md:95–97` — "Vite's `dist/` output is a standard static site. Vercel auto-detects Vite projects — no `vercel.json` is needed. Connect the GitHub repository to Vercel; set build command `npm run build`, output directory `dist`."

---

### Dependencies & Integration Points

- **`e.stopImmediatePropagation()` scope**: All `keydown` listeners are on `window`. The state-machine handler is registered first (line 106), `setupInput`'s `onKeydown` second (via `setupInput` call at line 129), `handleInitialsKey` third (line 130). `stopImmediatePropagation` prevents listeners registered after the calling listener from receiving the event. This is distinct from `stopPropagation` (which stops bubbling) — here all listeners are on the same target.

- **`gameState.togglePause()` called from two places**: `setupInput` (`KeyP`, `src/input.js:25`) and the state-machine handler (ESC/resume). After adding `stopImmediatePropagation`, a `P` keypress on the start screen will reach the state-machine handler (calls `startGame()`), then stop — `setupInput`'s `togglePause()` will not fire. A `P` keypress during active play will still reach `setupInput` unchanged (only start/pause/resume branches call `stopImmediatePropagation`).

- **Test 8 `Space` keypress (resume from pause)**: `tests/gameplay.spec.ts:194` — currently, the `Space` resume keypress reaches the state-machine handler (resumes), then propagates to `setupInput` which calls `hardDrop()`. After the `stopImmediatePropagation` fix (pause-resume branch), `Space` will NOT reach `setupInput` — `hardDrop()` will not fire. Test 8 asserts only `#pause-overlay` hidden and `gameState.paused === false`; it does not assert piece position, so this behavioral change does not break the test assertion.

- **`startGame()` idempotency**: `src/main.js:97` — `if (gameStarted) return`. Click event + keydown event firing simultaneously would not double-start. Test 10's click path goes through the same `startGame()` function.

- **Vercel CLI**: `vercel --prod` command to deploy. Requires `vercel` CLI installed and account authenticated. No `vercel.json` is needed per AGENTS.md.

---

### Test Infrastructure

- **Test framework**: Vitest v2 (`vitest: "^2.0.0"`) for unit tests; `@playwright/test: "^1.58.2"` for E2E.
- **Unit test location**: `src/__tests__/` — engine modules only (no DOM or WebGL).
- **E2E test location**: `tests/gameplay.spec.ts` — 9 tests currently.
- **E2E run command**: `npm run test:e2e` → `playwright test` (defined in `package.json:13`).
- **Unit test run command**: `npm run test` → `vitest run` (defined in `package.json:10`).
- **jsdom**: Installed as direct devDependency (`jsdom: "^28.1.0"`); used via `environmentMatchGlobs` in `vitest.config.js` for DOM-dependent unit tests.
- **Current passing counts**: 206+ Vitest unit tests, 9 Playwright E2E tests.
- **Coverage**: 97%+ engine coverage target; no new engine code in Phase 7.
- **WebGL in headless**: `--use-gl=angle` flag required in `launchOptions.args` (playwright.config.ts:22); without it, WebGL fails in headless Chromium.

---

## Code References

- `src/main.js:96–101` — `startGame()`: sets `gameStarted`, hides `#start-overlay`, starts RAF
- `src/main.js:106–125` — state-machine keydown handler: start-dismiss (107–112), game-over guard (113), pause-resume (114–119), ESC-pause (120–124) — none call `stopImmediatePropagation`
- `src/main.js:127` — `startOverlay.addEventListener('click', startGame)` — click-to-start wiring
- `src/main.js:129` — `setupInput(gameState, handleRestart, ...)` — registered AFTER state-machine handler
- `src/main.js:65–85` — `handleInitialsKey` — existing example of `stopImmediatePropagation` pattern
- `src/main.js:38–40` — `window.__gameState` gate (VITE_TEST_HOOKS or DEV)
- `src/input.js:21–26` — `Space` → `hardDrop()` and `KeyP` → `togglePause()` in `setupInput`
- `tests/gameplay.spec.ts:44` — Test 3 no-op guard: `window.__gameState !== undefined`
- `tests/gameplay.spec.ts:80` — Test 4 no-op guard: `window.__gameState !== undefined`
- `tests/gameplay.spec.ts:116` — Test 5 no-op guard: `window.__gameState !== undefined`
- `tests/gameplay.spec.ts:163–174` — Test 7: `Space` dismiss with no comment about `hardDrop()` side effect
- `tests/gameplay.spec.ts:194` — Test 8: `Space` used to resume from pause (behavior changes post-fix)
- `README.md:10` — "board Z-rotates up to ±7°" — stale Z-axis description from Phase 2
- `playwright.config.ts:28–37` — `webServer` config: build+preview command, `VITE_TEST_HOOKS`, `reuseExistingServer: false`
- `index.html:164` — `#start-overlay` element (no `hidden` class — visible on load)
- `index.html:170` — `#pause-overlay` element (has `hidden` class — hidden on load)
- `AGENTS.md:71–98` — Phase 3 additions: Vercel deployment instructions
- `CLAUDE.md:78–84` — Rendering (as of Phase 4): Y-axis tilt documentation

---

## Open Questions

1. **Test 8 behavioral change after fix**: After `stopImmediatePropagation` in the pause-resume branch, the `Space` keypress at `tests/gameplay.spec.ts:194` will no longer trigger `hardDrop()`. The test asserts only `#pause-overlay` hidden and `gameState.paused === false` — does it need a comment explaining this is now the correct behavior?

2. **`P` key on start screen post-fix behavior**: After `stopImmediatePropagation` is added to the start-dismiss branch, pressing `P` on the start screen will call `startGame()` and stop — `setupInput`'s `togglePause()` will NOT fire. R4 requires this is verified. The SPEC says "A Vitest test or updated E2E comment documents this behavior" — which form is preferred? (Likely an E2E test or comment since the `P` key dismiss path is purely behavioral.)

3. **Vercel account/CLI availability**: Needs confirmation that `vercel` CLI is installed and authenticated before the deploy step can proceed.
