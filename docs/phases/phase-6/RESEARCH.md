# Research: Phase 6

## Phase Context

Phase 6 completes the game lifecycle UX by adding a start screen overlay (shown on page load, dismissable by any key or click), an ESC-triggered pause overlay (with any-key resume), and proper build-flag gating of the `window.__gameState` test hook behind `VITE_TEST_HOOKS=true`. It also fixes three Phase 5 test-quality regressions in `tests/gameplay.spec.ts` and updates AGENTS.md, CLAUDE.md, and README.md documentation. No game-engine logic changes are required.

---

## Previous Phase Learnings

From `docs/phases/phase-5/REFLECTIONS.md`:

1. **Three carryover issues must be fixed first** — before writing any new tests:
   - `const BASE = 'http://localhost:4173'` in `tests/gameplay.spec.ts:4` (line actually uses `page.goto('/')` already for tests 1–2 but `BASE` itself is NOT present — see current state below).
   - Stale comment on line 41: "set on first RAF frame" — `window.__gameState` is set synchronously at module evaluation, not in a RAF callback.
   - Test 3 assertion `not.toHaveText('0')` — currently the file shows `toHaveText('800', { timeout: 5000 })` already (see below).

2. **Assertion precision matters**: Use exact values (`toHaveText('800')`) rather than weak negations.

3. **Start screen creates a new initial app state**: Tests 3–5 that inject board state need an extra keypress to dismiss the start overlay before `window.__gameState` is ready to manipulate.

4. **`window.__gameState` must be gated**: Currently unconditional in `src/main.js:35` — Phase 6 gates it behind `import.meta.env.VITE_TEST_HOOKS`.

5. **`playwright.config.ts` needs `webServer.env`**: To pass `VITE_TEST_HOOKS=true` so E2E tests work against the preview build.

---

## Current Codebase State

### Relevant Components

- **Entry point / game loop**: `src/main.js` — wires all layers, runs `requestAnimationFrame(loop)` starting at line 146. The `loop()` function is called unconditionally on page load with no start-screen gate.
- **Game state**: `src/engine/gameState.js` — `GameState` class with `paused`, `over` fields; `togglePause()` at line 131 (guards on `this.over`); `update(dt)` returns early when `this.paused || this.over` at line 78.
- **Input handling**: `src/input.js` — `setupInput(gameState, onRestart, options)` registers `keydown`/`keyup` listeners. `KeyP` already calls `gameState.togglePause()` (line 25). No `Escape` handling exists yet.
- **HUD / overlay**: `src/hud/hud.js` — `showOverlay(title, score)`, `hideOverlay()`, `resetOverlayUI()`. `showOverlay` sets `overlayTitle.textContent` and removes `hidden` class (lines 45–49). `hideOverlay` adds `hidden` class and calls `resetOverlayUI()` (lines 51–54).
- **HTML overlay element**: `index.html:148` — `<div id="overlay" class="hidden">` starts hidden. Contains `#overlay-title` (default text "GAME OVER"), `#overlay-score`, `#initials-prompt`, `#leaderboard-section`, and `#restart-btn`.
- **Playwright config**: `playwright.config.ts` — Chromium-only, headless, `baseURL: 'http://localhost:4173'`, `webServer` runs `npm run preview`. No `env` key present on `webServer` yet (needed for `VITE_TEST_HOOKS=true`).
- **E2E tests**: `tests/gameplay.spec.ts` — 5 tests. Note: current file at line 8 uses `page.goto('/')` (no `const BASE`), and Test 3 already uses `toHaveText('800', { timeout: 5000 })`. However, the stale comment at line 41 ("set on first RAF frame") is still present.
- **Vite config**: `vite.config.js` — minimal config, no `define` block or env variable handling yet.
- **Vitest config**: `vitest.config.js` — `environment: 'node'`, jsdom overrides for 3 test files, coverage targeting `src/engine/**`.

### Existing Patterns to Follow

- **Overlay show/hide pattern**: `showOverlay(title, score)` + `hideOverlay()` in `src/hud/hud.js`. The overlay element (`#overlay`) uses a `hidden` CSS class (`display: none` when present). `showOverlay` removes the class; `hideOverlay` adds it.
  - `hud.js:45–54` — `showOverlay`, `hideOverlay`
  - `index.html:63` — `#overlay.hidden { display: none; }`
  - `index.html:148` — `<div id="overlay" class="hidden">`

- **Key handler pattern**: `src/input.js` — single `window.addEventListener('keydown', onKeydown)` with a `held` Set to debounce key repeat. Additional listeners are added separately in `main.js` (`window.addEventListener('keydown', handleInitialsKey)` at line 90).

- **`import.meta.env` usage**: Vite exposes `import.meta.env.DEV` (true in dev server), `import.meta.env.PROD`, and custom env vars prefixed with `VITE_`. Custom vars set in `webServer.env` in `playwright.config.ts` are accessible as `import.meta.env.VITE_*` in source code built by Vite.

- **Game loop gate pattern**: Currently no gate — `requestAnimationFrame(loop)` is called unconditionally at `main.js:146`. The loop calls `gameState.update(dt)` which returns early if `paused || over` (line 78 of gameState.js), but gravity and RAF ticking begin immediately.

- **`prevOver` pattern**: `main.js:95` — `let prevOver = false;` tracks previous frame's `gameState.over` to detect game-over transition and call `showOverlay` only once.

- **`suppressRestart` option**: `setupInput` accepts `options.suppressRestart` callback (line 2 of input.js) — used to block restart key when initials entry is active.

### Dependencies & Integration Points

- **`GameState.togglePause()`**: Already implemented at `src/engine/gameState.js:131`. Returns early if `this.over`. Sets `this.paused = !this.paused`. The `update(dt)` method respects `this.paused` at line 78.
- **`GameState.paused` field**: Set to `false` in constructor (line 28) and `restart()` (line 142). Public field readable from `window.__gameState.paused` in tests.
- **`window.__gameState`**: Set unconditionally at `src/main.js:35`. Phase 6 must gate this behind `import.meta.env.VITE_TEST_HOOKS === 'true' || import.meta.env.DEV`.
- **`playwright.config.ts` `webServer`**: Currently no `env` property. Phase 6 adds `env: { VITE_TEST_HOOKS: 'true' }` so the preview build exposes the game state hook.
- **`#overlay` element reuse vs separate `#pause-overlay`**: SPEC allows either. The existing `#overlay` has child elements (`#overlay-title`, `#overlay-score`, game-over-specific UI). A pause overlay would need to hide those children or use a separate element.
- **`#restart-btn` click handler**: Registered in `main.js:92` — calls `handleRestart()`. This must remain functional; ESC/pause handling should not interfere.

### Test Infrastructure

- **Unit tests**: Vitest v2, `src/__tests__/**/*.test.js`. Node environment by default; jsdom for 3 specific files. Coverage via `@vitest/coverage-v8`. Run with `npm run test`.
- **E2E tests**: Playwright `@playwright/test ^1.58.2`, `tests/gameplay.spec.ts`. Chromium headless with `--use-gl=angle` (required for WebGL/SwiftShader). Run with `npm run test:e2e` after `npm run build`.
- **`page.waitForFunction()`**: Used in tests 3–5 to wait for `window.__gameState !== undefined` before board injection. With start screen added, tests 3–5 will need a keypress to dismiss the start overlay before this wait.
- **`page.goto('/')`**: baseURL already set to `http://localhost:4173` in `playwright.config.ts:11`. All tests use `page.goto('/')`.
- **Video artifacts**: `test-results/` directory (gitignored). `video: 'on'` in playwright config.

---

## Code References

- `src/main.js:32–35` — `let gameState = new GameState()` + unconditional `window.__gameState = gameState`
- `src/main.js:89` — `setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive })`
- `src/main.js:90` — `window.addEventListener('keydown', handleInitialsKey)` — second keydown listener
- `src/main.js:92` — `document.getElementById('restart-btn').addEventListener('click', handleRestart)`
- `src/main.js:97–144` — `function loop(ts)` — the RAF loop body
- `src/main.js:146` — `requestAnimationFrame(loop)` — unconditional game start
- `src/engine/gameState.js:28` — `this.paused = false` in constructor
- `src/engine/gameState.js:78` — `if (this.paused || this.over) return;` in `update(dt)`
- `src/engine/gameState.js:131–134` — `togglePause()`: guards on `this.over`, flips `this.paused`
- `src/input.js:1–41` — `setupInput()`: `held` Set, `keydown`/`keyup` listeners, `KeyP` → `togglePause()`
- `src/input.js:25` — `case 'KeyP': gameState.togglePause(); break;` — existing pause key (not Escape)
- `src/hud/hud.js:45–54` — `showOverlay(title, score)` and `hideOverlay()`
- `src/hud/hud.js:7–9` — `overlay`, `overlayTitle`, `overlayScore` DOM references
- `index.html:148` — `<div id="overlay" class="hidden">` — starts hidden
- `index.html:63` — `.hidden { display: none; }`
- `index.html:149` — `<div id="overlay-title">GAME OVER</div>` — default text, overwritten by `showOverlay`
- `index.html:172` — `<button id="restart-btn">PLAY AGAIN</button>`
- `playwright.config.ts:11` — `baseURL: 'http://localhost:4173'`
- `playwright.config.ts:28–32` — `webServer` block (no `env` key yet)
- `tests/gameplay.spec.ts:41` — stale comment: "set on first RAF frame" (needs fix)
- `tests/gameplay.spec.ts:7–11` — Test 1: canvas visible, score "0"
- `tests/gameplay.spec.ts:42` — `page.waitForFunction(() => window.__gameState !== undefined)` used in tests 3–5
- `vite.config.js:1–4` — minimal config, no `define` block
- `vitest.config.js:1–19` — Vitest config with jsdom env overrides

---

## Open Questions

1. **Start overlay: reuse `#overlay` or separate `#start-overlay`?** The SPEC permits either. Reusing `#overlay` means calling `showOverlay('TRON TETRIS', ...)` but `showOverlay` also sets `#overlay-score` — the start screen doesn't need a score display. A separate `#start-overlay` element would be cleaner. Implementer must document choice.

2. **Pause overlay: reuse `#overlay` or separate `#pause-overlay`?** Same trade-off. Reusing `#overlay` for pause means hiding game-over children (`#initials-prompt`, `#leaderboard-section`, `#restart-btn`) or conditionally showing them. A separate `#pause-overlay` avoids that complexity.

3. **Exact stale comment location**: `tests/gameplay.spec.ts:41` has the comment. The SPEC says "set synchronously at module evaluation" is correct — not on first RAF frame. The fix is a one-line comment edit.

4. **Tests 3–5 start screen dismiss**: After Phase 6 adds the start overlay, Tests 3–5 must send a keypress to dismiss it before calling `waitForFunction`. The start overlay gates `window.__gameState` availability only if `window.__gameState` is set after start is clicked — but per current code `window.__gameState` is set synchronously at module evaluation (line 35 of main.js), so `waitForFunction` may still work. However, the game loop won't tick until start is dismissed, which may affect board injection behavior. Needs care.

5. **`window.__gameState` timing with build flag**: With the flag gate, `window.__gameState` is only set when `VITE_TEST_HOOKS=true`. The `waitForFunction` in tests 3–5 already waits for it, so this should work — but `playwright.config.ts` must pass `VITE_TEST_HOOKS=true` in `webServer.env` for the preview build.
