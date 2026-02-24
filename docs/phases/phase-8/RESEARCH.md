# Research: Phase 8

## Phase Context

Phase 8 adds mobile playability to Tron Tetris by introducing on-screen touch controls (← / → / ↑ rotate / ↓ soft drop / ⬛ hard drop), a mute/unmute toggle (M key + tappable HUD button), and responsive layout so the game works at 390×844 px. It also closes three pieces of technical debt from Phase 7: the stale `!== undefined` guards in E2E Tests 8, 9, and 10, and the lack of a `waitForGameReady(page)` helper that would make future guard changes a one-line fix.

---

## Previous Phase Learnings

From `docs/phases/phase-7/REFLECTIONS.md`:

- **Tests 8, 9 stale guards (BLOCKING debt)**: `tests/gameplay.spec.ts:199` and `:224` both use `(window as any).__gameState !== undefined` — the no-op form that passes immediately even before the module sets the hook. Phase 7 explicitly deferred fixing these. Phase 8 SPEC requires R7 upgrade.
- **Test 10 stale guard (BLOCKING debt)**: `tests/gameplay.spec.ts:269–271` uses `gs !== undefined && gs.over === false` — does not confirm the RAF loop has ticked at least once (no `pieceType !== null` check). Phase 7 noted this was less rigorous than Tests 3–5.
- **Extract `waitForGameReady(page)` helper**: Phase 7 noted the guard was duplicated across 5 tests and a one-line upgrade required five edits. SPEC explicitly requires extraction to a named helper this phase.
- **R4 documentation weakness**: Phase 7 compliance for audio documentation was "inline comment only". Phase 8 requires at least one Vitest unit test and one E2E assertion for mute logic (not just a comment).
- **REVIEW.md BLOCKING labels**: Any MUST-FIX items must be labelled `BLOCKING` or `NON-BLOCKING`.

---

## Current Codebase State

### Relevant Components

**Entry point / game loop**
- `src/main.js` — RAF loop, state-machine keydown handler, AudioContext, sound dispatch. Full file: 193 lines.
  - `getAudioCtx()` (`main.js:44–47`): lazily creates one `AudioContext` on first use. No mute flag exists.
  - Sound dispatch loop (`main.js:163–170`): iterates `gameState.soundEvents`, calls `playGameSound(event, ctx)`, clears queue. No gating condition.
  - `window.__gameState = gameState` hook (`main.js:38–40`): gated behind `VITE_TEST_HOOKS === 'true' || DEV`. No `muted` field exposed.
  - State-machine keydown handler (`main.js:106–131`): four branches — `!gameStarted`, `gameState.over`, `gameState.paused`, `e.code === 'Escape'`. No `M` key / mute branch.
  - `startOverlay.addEventListener('click', startGame)` (`main.js:133`): click-to-start path.
  - `setupInput` called at `main.js:135` — after the state-machine handler registration.

**Keyboard input**
- `src/input.js` — `setupInput(gameState, onRestart, options)` function, 41 lines.
  - Bindings: ArrowLeft/Right (move), ArrowUp/X (rotateCW), Z (rotateCCW), ArrowDown (soft drop), Space (hard drop with `preventDefault`), P (togglePause), Enter/R (restart when over).
  - Uses a `held: Set` to suppress key-repeat restarts.
  - Returns a cleanup function (removes both event listeners).
  - No `M` key binding. No touch event handling.

**HUD**
- `src/hud/hud.js` — `updateHud`, `showOverlay`, `hideOverlay`, `showInitialsPrompt`, `setInitialChar`, `setInitialsCursor`, `showLeaderboard`, `resetOverlayUI`. 132 lines.
  - No mute indicator element or function.
  - `pointer-events: none` on `#hud` (set in `index.html` CSS) — the mute button will need `pointer-events: auto` to be tappable.

**Audio**
- `src/audio/sounds.js` — `playTone(freq, duration, type, gainEnvelope, ctx)` and `playGameSound(event, ctx)`. 59 lines.
  - `playGameSound` calls `playTone` unconditionally — no mute gating.
  - Eight named events in `SOUND_CONFIG`: move, rotate, softDrop, hardDrop, lineClear, tetris, levelUp, gameOver.

**HTML structure**
- `index.html` — 220 lines. Relevant structure:
  - `#app` (`div`, `position: relative; width: 100vw; height: 100vh`) wraps everything.
  - `#game-canvas` (`canvas`, `width: 100%; height: 100%`) — fills full app area.
  - `#start-overlay` — full-screen overlay, visible on load; `.hidden` → `display: none`.
  - `#pause-overlay` — full-screen overlay, `.hidden` by default.
  - `#hud` — positioned `absolute; top: 50%; right: clamp(16px, 4vw, 48px); transform: translateY(-50%)`. `pointer-events: none`. Contains SCORE, LEVEL, LINES, NEXT panels.
  - `#overlay` — game-over overlay with initials prompt and leaderboard section.
  - No `#touch-controls` div exists yet.
  - No mute button or icon anywhere.
  - Viewport meta: `width=device-width, initial-scale=1.0`.
  - Body: `display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden`. No mobile breakpoints.

**Game engine**
- `src/engine/gameState.js` — `GameState` class. Public fields relevant to Phase 8:
  - `gameState.paused` (`boolean`) — toggled by `togglePause()`.
  - `gameState.over` (`boolean`) — set true when spawn is blocked.
  - `gameState.soundEvents` (`string[]`) — queue consumed by `main.js` each frame.
  - No `muted` field.
- `src/engine/tetrominoes.js` — piece definitions; not touched by Phase 8.

**E2E test file**
- `tests/gameplay.spec.ts` — 10 tests, 276 lines. Stale guards:
  - **Test 7** (`game starts after keypress`, `line 184–187`): guard is `gs !== undefined && !gs.over` — two-condition but uses `!== undefined`, not `gs != null && gs.pieceType !== null`. (Test 7 is NOT in Phase 8 scope per SPEC.)
  - **Test 8** (`ESC pauses and any key resumes`, `line 199`): guard is `(window as any).__gameState !== undefined` — single-condition stale form. **Phase 8 MUST fix.**
  - **Test 9** (`ESC during game-over does not show pause overlay`, `line 224`): guard is `(window as any).__gameState !== undefined` — single-condition stale form. **Phase 8 MUST fix.**
  - **Test 10** (`click on start overlay starts the game`, `lines 269–271`): guard is `gs !== undefined && gs.over === false` — does not confirm `pieceType !== null`. **Phase 8 MUST fix.**
  - Tests 3, 4, 5 (`line 46–49`, `85–88`, `125–128`) already use the rigorous `gs != null && gs.pieceType !== null` two-condition form — these are the model pattern.

**Playwright config**
- `playwright.config.ts` — 38 lines.
  - `baseURL: 'http://localhost:4173'` (preview build port).
  - `webServer.command: 'npm run build && npm run preview'`.
  - `webServer.env: { VITE_TEST_HOOKS: 'true' }` — bakes the test hook into the bundle.
  - `reuseExistingServer: false` — always rebuilds.
  - `launchOptions.args`: `['--enable-webgl', '--ignore-gpu-blacklist', '--use-gl=angle']` — required for WebGL in headless Chromium.
  - Touch APIs (`page.touchscreen.tap()`, `page.setViewportSize()`) are already available in `@playwright/test` — no new packages needed.

**Vitest config**
- `vitest.config.js` — 19 lines.
  - `environment: 'node'` default.
  - `environmentMatchGlobs`: jsdom for `input.test.js`, `leaderboard-storage.test.js`, `initials-submit.test.js`.
  - New mute unit tests will need jsdom if they test DOM interactions, or node if pure logic.
  - Coverage targets `src/engine/**` at ≥ 80% lines threshold.

---

### Existing Patterns to Follow

**`stopImmediatePropagation` discipline** (`AGENTS.md:108–123`, `src/main.js:106–131`):
All consuming branches in state-machine keydown handlers call `e.stopImmediatePropagation()`. Non-consuming guard returns do NOT call it. The `M` key mute branch added to the state-machine handler should follow this pattern only if it consumes the event (i.e., it only fires during active play per R6).

**`window.__gameState` test hook** (`src/main.js:37–40`):
Gated behind `VITE_TEST_HOOKS === 'true' || DEV`. To expose `muted` for E2E tests (SPEC docs update for AGENTS.md), the same `window.__gameState` reference is used — adding a `muted` field to `gameState` would automatically expose it via the existing hook.

**Overlay show/hide pattern** (`index.html`, `src/main.js`):
Overlays use `classList.add('hidden')` / `classList.remove('hidden')`. The CSS rule `.hidden { display: none; }` is defined per-overlay ID. New touch controls div would follow the same show/hide approach (add/remove `hidden` class or use CSS media queries for visibility).

**Sound event queue** (`src/audio/sounds.js`, `src/main.js:163–170`):
Sounds are fired synchronously in the RAF loop by iterating `gameState.soundEvents`. Mute gating can be applied in `main.js` before calling `playGameSound`, or inside `playGameSound` itself. The SPEC suggests a boolean flag on a new `AudioManager` or in `main.js`.

**Touch actions dispatching game events**:
The existing `setupInput` model dispatches game actions by calling `gameState.moveLeft()`, `gameState.moveRight()`, etc. Touch buttons should call the same methods. `held` set in `setupInput` is for keyboard key-repeat suppression — touch auto-repeat would need its own timer (`setInterval` or `setTimeout` loop on `touchstart`/`touchend`).

**jsdom test pattern** (`vitest.config.js:5–8`):
Tests needing DOM use jsdom via `environmentMatchGlobs`. A new mute unit test file would be added to `environmentMatchGlobs` if it needs DOM, or kept in node environment if it tests only logic.

**E2E test comments** (`tests/gameplay.spec.ts`):
Each test has a block comment with test number, title, and explanation of the test logic. New tests (11–14) and modified guards should follow this format.

---

### Dependencies & Integration Points

- **`main.js` ↔ `sounds.js`**: `main.js` holds the single `AudioContext` (`audioCtx`) and calls `playGameSound(event, ctx)`. Mute gating sits at this boundary — either `main.js` skips the call, or `sounds.js` accepts a `muted` parameter.
- **`main.js` ↔ `hud.js`**: `updateHud(gameState)` is called each RAF frame. A mute indicator update can be called here (or separately on toggle events) by adding a new `hud.js` export.
- **`main.js` ↔ `input.js`**: `setupInput` registers keyboard listeners. `M` key could be handled in `setupInput` (adding it to the switch), or in the state-machine handler in `main.js`. Given R6 (only during active play, not start/pause screens), adding it in `setupInput`'s `onKeydown` switch makes sense — `setupInput` already guards against game-over state for restart.
- **`index.html` ↔ `main.js`**: New DOM elements (`#touch-controls`, mute button) will be retrieved via `document.getElementById()` in `main.js` or in a new module. The SPEC says event delegation on `#touch-controls` div.
- **`playwright.config.ts` ↔ test hooks**: `VITE_TEST_HOOKS=true` environment variable is baked in at build time. `window.__gameState.muted` would be accessible via the same existing hook.

---

### Test Infrastructure

- **Test framework**: Vitest (v2) for unit tests; `@playwright/test` for E2E.
- **Unit test location**: `src/__tests__/*.test.js` (node environment by default; jsdom for DOM-dependent files).
- **E2E test location**: `tests/gameplay.spec.ts` — single file with all 10 current tests.
- **E2E run command**: `npm run test:e2e` (runs `npm run build && npm run preview` via `playwright.config.ts`).
- **E2E guard pattern** (rigorous form, used in Tests 3–5):
  ```ts
  await page.waitForFunction(() => {
    const gs = (window as any).__gameState;
    return gs != null && gs.pieceType !== null;
  });
  ```
- **E2E guard pattern** (stale form, used in Tests 8, 9):
  ```ts
  await page.waitForFunction(() => (window as any).__gameState !== undefined);
  ```
- **E2E guard pattern** (partially stale, used in Test 10):
  ```ts
  await page.waitForFunction(() => {
    const gs = (window as any).__gameState;
    return gs !== undefined && gs.over === false;
  });
  ```
- **Current passing count**: 206 Vitest unit tests; 10 Playwright E2E tests.
- **Coverage**: Engine coverage ≥ 80% (threshold in `vitest.config.js:15`); new mute logic should be covered by unit test.
- **Video artifacts**: `test-results/` (gitignored), recorded for every E2E test run.

---

## Code References

- `src/main.js:38–40` — `window.__gameState` test hook (gated by `VITE_TEST_HOOKS`/`DEV`)
- `src/main.js:43–47` — `getAudioCtx()` lazy AudioContext creation
- `src/main.js:163–170` — sound event queue dispatch loop (mute gate goes here or in sounds.js)
- `src/main.js:106–131` — state-machine keydown handler (M key / mute branch would be added here or in setupInput)
- `src/main.js:133` — `startOverlay.addEventListener('click', startGame)` — click path for start
- `src/main.js:135` — `setupInput(gameState, handleRestart, ...)` call
- `src/input.js:15–26` — switch-case for keyboard bindings (no M key yet)
- `src/input.js:3` — `held: Set` for key-repeat suppression
- `src/hud/hud.js:14–19` — `updateHud(gameState)` — called every RAF frame
- `src/hud/hud.js:128–131` — `resetOverlayUI()` — clears overlay state on restart
- `src/audio/sounds.js:54–58` — `playGameSound(event, ctx)` — called unconditionally (no mute check)
- `index.html:18` — `#app` container (`position: relative; width: 100vw; height: 100vh`)
- `index.html:19` — `#game-canvas` (`display: block; width: 100%; height: 100%`)
- `index.html:20–31` — `#hud` styles (`pointer-events: none`, right-positioned, `clamp` responsive)
- `index.html:80–95` — `#start-overlay` styles
- `index.html:97–110` — `#pause-overlay` styles (`.hidden` by default)
- `index.html:162–168` — `#start-overlay` DOM element
- `index.html:169–172` — `#pause-overlay` DOM element
- `index.html:173–190` — `#hud` DOM element (no mute indicator)
- `tests/gameplay.spec.ts:199` — Test 8 stale guard (`!== undefined`)
- `tests/gameplay.spec.ts:224` — Test 9 stale guard (`!== undefined`)
- `tests/gameplay.spec.ts:269–271` — Test 10 stale guard (`!== undefined && gs.over === false`)
- `tests/gameplay.spec.ts:46–49` — Model guard pattern (Tests 3–5, `gs != null && gs.pieceType !== null`)
- `playwright.config.ts:28–37` — webServer build command and `VITE_TEST_HOOKS` env
- `playwright.config.ts:18–24` — Chromium launch args (`--use-gl=angle` required for WebGL headless)
- `vitest.config.js:5–8` — `environmentMatchGlobs` (jsdom tests listed here)

---

## Open Questions

1. **Mute flag location**: Should `muted` be a field on `GameState`, a module-level variable in `main.js`, or a new `AudioManager` object? The SPEC says "a new `AudioManager` or in `main.js`". Placing it in `main.js` avoids touching the engine; placing it on `GameState` makes it automatically visible via `window.__gameState.muted` for E2E assertions without extra hook code. (SPEC and AGENTS.md update both reference `window.__gameState.muted`.)

2. **Touch controls visibility trigger**: SPEC says visible "on touch-capable devices or when viewport width ≤ 768px". CSS `@media (hover: none)` detects touch capability; `@media (max-width: 768px)` handles the width condition. These two conditions need to be combined via `@media (hover: none), (max-width: 768px)`.

3. **Touch auto-repeat for ← / →**: The SPEC says "holding ← or → auto-repeats at the same rate as keyboard held-key repeat." This requires a `setInterval`/`setTimeout` loop triggered on `touchstart` and cleared on `touchend` for those two buttons. The rate to match is the browser's key-repeat rate (typically ~500ms delay, ~33ms interval), but a fixed interval (e.g., 100ms) matching the keyboard experience is likely acceptable.

4. **R6 mute gating**: "Audio cannot be toggled from the start screen or pause overlay." The state-machine keydown handler already gates actions by `!gameStarted` and `gameState.paused`. The M key should similarly be blocked in those states. Does the mute HUD button also need to be non-interactive during paused/start states, or only the keyboard?

5. **`waitForGameReady` helper scope**: SPEC says to extract the helper in `tests/gameplay.spec.ts`. Should it also replace the guard in Tests 3, 4, 5 (already correct but verbose), or only fix Tests 8, 9, 10 (the debt items)?
