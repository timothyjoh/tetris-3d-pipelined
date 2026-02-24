# Implementation Plan: Phase 6

## Overview

Phase 6 adds a start screen overlay (shown on page load, dismissed by any key or click), ESC-triggered pause with any-key resume, and gates the `window.__gameState` test hook behind `VITE_TEST_HOOKS=true`. It also fixes one remaining test-quality regression from Phase 5 and adds three new Playwright E2E tests.

## Current State (from Research)

- `src/main.js:146` — `requestAnimationFrame(loop)` fires unconditionally on page load; no start gate exists
- `src/main.js:35` — `window.__gameState = gameState` exposed unconditionally
- `src/engine/gameState.js:131` — `togglePause()` already implemented; guards on `this.over`; `update(dt)` already no-ops when paused
- `src/input.js:25` — `KeyP` calls `togglePause()`; no `Escape` handling
- `src/hud/hud.js` — `showOverlay(title, score)` / `hideOverlay()` for game-over; coupled to score/initials/leaderboard/restart-btn children
- `index.html:148` — `#overlay` is the game-over overlay; starts hidden; has many game-over-specific children
- `playwright.config.ts:28` — `webServer` block has no `env` key
- `tests/gameplay.spec.ts:41` — stale comment "set on first RAF frame" (only remaining carryover fix; `const BASE` and weak assertion are already corrected per research)
- `AGENTS.md:123` — stale `boardGroup.rotation.z` snippet (Phase 4 changed to `rotation.y`)

## Desired End State

- Fresh page load shows `#start-overlay` (Tron-aesthetic, "TRON TETRIS" + "PRESS ANY KEY OR CLICK TO START"); score reads "0"; no gravity ticking
- Any keydown or click dismisses start overlay and begins the game loop
- `Escape` during active play shows `#pause-overlay` ("PAUSED" only; no score/leaderboard); `gameState.paused === true`
- Any key while paused hides `#pause-overlay` and resumes; `gameState.paused === false`
- `Escape` during game-over does nothing (guarded by `togglePause()` which returns early when `this.over`)
- `window.__gameState` is `undefined` in a standard production build; defined when `VITE_TEST_HOOKS=true` or `DEV`
- 8 Playwright E2E tests pass against `npm run preview` (with `VITE_TEST_HOOKS=true` set via `webServer.env`)
- 206+ Vitest unit tests pass; `npm run build` is warning-free

**Verify end state:**
```bash
npm run build && npm run preview   # manual: load page, verify start overlay visible
npm run test                       # 206+ unit tests green
VITE_TEST_HOOKS=true npm run test:e2e  # redundant — playwright.config.ts sets it via webServer.env
npm run test:e2e                   # all 8 E2E tests pass
```

## What We're NOT Doing

- Strengthening Test 2 assertion (`toBeVisible` on `#hud-score`) — not in Phase 6 spec
- Any changes to `GameState` engine logic (no new pause guards on `moveLeft`/`moveRight` etc.)
- Blocking game-control keys (ArrowLeft, etc.) while the game is paused (piece moves visually but gravity doesn't tick; spec requires no engine changes)
- Mobile/touch start or pause interactions
- Persisting paused state across page reloads
- Transition animations on overlays (instant show/hide)
- Audio events for pause/resume
- CI/CD or Vercel deployment changes
- Fixing weak Test 2 assertion or any finding beyond the three listed pre-work items

## Implementation Approach

**Two separate overlay elements** (`#start-overlay` and `#pause-overlay`) rather than reusing `#overlay`. The existing `#overlay` has tightly coupled game-over children (initials prompt, leaderboard, restart button, score). Adding start/pause logic there would require conditional child hiding and risk breaking the existing game-over flow. Separate elements are clean and surgical.

**Single state-machine keydown handler** registered in `main.js` BEFORE `setupInput`. This handler manages game-phase transitions (start → playing → paused → playing). Registering it first ensures ESC on the start screen starts the game and returns before reaching pause logic — preventing the "ESC immediately pauses a just-started game" race.

**`requestAnimationFrame(loop)` deferred** into `startGame()`. The RAF loop is never called at module evaluation — only when the user dismisses the start overlay.

**Tests 3–5 dismiss**: Use `ArrowLeft` to dismiss the start overlay in the board-injection tests. `ArrowLeft` fires through `setupInput` (moves the active piece one column left) but causes no permanent board state change — no hard-drop, no lock, no line clears. The injection code overwrites `gs.pieceType/rotation/col/row` anyway, so the leftward shift is irrelevant.

---

## Task 1: Fix Stale Comment (Pre-work)

### Overview

Fix the one remaining carryover regression from Phase 5: the stale comment "set on first RAF frame" appears on lines 41, 75, and 109 of `tests/gameplay.spec.ts`. The other two carryover issues (`const BASE` and `not.toHaveText('0')`) are confirmed already corrected and require no code change.

### Changes Required

**File**: `tests/gameplay.spec.ts`

Update the comment on line 41 (Test 3), line 75 (Test 4), and line 109 (Test 5) from:
```ts
// Wait for game state to be initialized (set on first RAF frame)
```
to:
```ts
// window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
```

This comment will be accurate after Task 2 gates the hook behind `VITE_TEST_HOOKS`.

### Success Criteria

- [ ] Comment updated in all three test stubs (lines 41, 75, 109)
- [ ] `npm run test` passes (no Vitest changes; just a comment edit)

---

## Task 2: Gate `window.__gameState` Behind Build Flag

### Overview

Move `window.__gameState = gameState` from unconditional to gated behind `import.meta.env.VITE_TEST_HOOKS === 'true' || import.meta.env.DEV`. Update `playwright.config.ts` to pass `VITE_TEST_HOOKS=true` via `webServer.env` so the preview build exposes the hook for E2E tests.

### Changes Required

**File**: `src/main.js` (lines 33–35)

Replace:
```js
// Test hook: exposed unconditionally so Playwright E2E tests can inject board state.
// Phase 6 should gate this behind a build flag (e.g. import.meta.env.VITE_TEST_HOOKS).
window.__gameState = gameState;
```
With:
```js
// Test hook: gated behind VITE_TEST_HOOKS=true (set in playwright.config.ts webServer.env)
// or DEV mode. Never set in a standard production build.
if (import.meta.env.VITE_TEST_HOOKS === 'true' || import.meta.env.DEV) {
  window.__gameState = gameState;
}
```

**File**: `playwright.config.ts` (webServer block, around line 28)

Add `env` to the `webServer` block:
```ts
webServer: {
  command: 'npm run preview',
  url: 'http://localhost:4173',
  reuseExistingServer: !process.env.CI,
  env: { VITE_TEST_HOOKS: 'true' },
},
```

### Success Criteria

- [ ] `npm run build` produces a build where `window.__gameState` is `undefined` (verify: open DevTools console on `npm run preview` WITHOUT the env var)
- [ ] `npm run test` (Vitest) still passes — no engine changes
- [ ] Existing 5 E2E tests still pass via `npm run test:e2e` (playwright.config.ts provides the env var automatically)

---

## Task 3: Start Screen — HTML, CSS, and JS

### Overview

Add `#start-overlay` to `index.html` (visible on page load; no `hidden` class). Add matching CSS. Implement `startGame()` in `main.js` and register the state-machine keydown handler BEFORE `setupInput`. Gate `requestAnimationFrame(loop)` inside `startGame()`.

### Changes Required

**File**: `index.html`

Add after the `<canvas id="game-canvas">` line and before `<div id="hud">`:
```html
<!-- Start screen overlay: visible on page load; dismissed by any key or click. -->
<!-- Separate from #overlay (game-over) to avoid hiding game-over children. -->
<div id="start-overlay">
  <div id="start-title">TRON TETRIS</div>
  <div id="start-prompt">PRESS ANY KEY OR CLICK TO START</div>
</div>
```

Add CSS after the existing `#overlay`/`#restart-btn` rules (before the `/* Initials entry */` comment):
```css
/* Start screen overlay */
#start-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 24px;
  background: rgba(0, 0, 0, 0.90);
  color: #00ffff;
  text-shadow: 0 0 12px #00ffff;
}
#start-overlay.hidden { display: none; }
#start-title { font-size: 48px; letter-spacing: 0.2em; }
#start-prompt { font-size: 16px; letter-spacing: 0.15em; opacity: 0.75; }
```

**File**: `src/main.js`

1. Add DOM references near the top (after existing imports, before `let gameState`):
```js
const startOverlay = document.getElementById('start-overlay');
```

2. Replace the unconditional `requestAnimationFrame(loop)` call at line 146 with `startGame()` logic. After the existing `setupInput` / listener registrations area, add:
```js
let gameStarted = false;

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  startOverlay.classList.add('hidden');
  requestAnimationFrame(loop);
}

// State-machine keydown handler — registered BEFORE setupInput so start-screen and
// pause transitions run before game-control keys are processed.
// Phase order: start → playing → (paused ↔ playing) → over
window.addEventListener('keydown', (e) => {
  if (!gameStarted) {
    // Any key dismisses start screen and begins the game loop.
    // Return immediately so this keydown doesn't also trigger pause logic.
    startGame();
    return;
  }
  if (gameState.over) return; // game-over: Enter/R handled by setupInput
  if (gameState.paused) {
    // Any key resumes
    gameState.togglePause();
    pauseOverlay.classList.add('hidden');
    return;
  }
  if (e.code === 'Escape') {
    // ESC pauses during active play
    gameState.togglePause();
    pauseOverlay.classList.remove('hidden');
  }
});

startOverlay.addEventListener('click', startGame);
```

3. Call `setupInput`, `handleInitialsKey`, and other listeners AFTER the state-machine handler (they already follow at lines 89–92 — no reordering needed if the state-machine block is inserted before them).

4. Remove `requestAnimationFrame(loop)` from `main.js:146` (the unconditional call at the bottom of the file).

**Registration order in `main.js` after this task:**
```
1. State-machine keydown (new — handles start/pause/resume)
2. startOverlay click listener
3. setupInput(...)  → registers game-control keydown/keyup
4. window.addEventListener('keydown', handleInitialsKey)
5. restart-btn click listener
```

### Success Criteria

- [ ] On `npm run preview`, the start overlay is visible and the score stays at "0" (game doesn't tick)
- [ ] Any key or clicking the overlay dismisses it and a piece begins falling
- [ ] `npm run build` completes without warnings
- [ ] `npm run test` (Vitest) still passes

---

## Task 4: Pause Overlay — HTML, CSS, and JS

### Overview

Add `#pause-overlay` to `index.html` (hidden by default). Add CSS. The pause/resume JS logic is already wired in Task 3's state-machine handler — this task only adds the missing DOM element and its `pauseOverlay` reference in `main.js`.

### Changes Required

**File**: `index.html`

Add after the `#start-overlay` block (and before `<div id="hud">`):
```html
<!-- Pause overlay: shown on ESC during active play; hidden on any key resume. -->
<!-- Separate from #overlay (game-over) to avoid interfering with game-over UI. -->
<div id="pause-overlay" class="hidden">
  <div id="pause-title">PAUSED</div>
</div>
```

Add CSS after the start-overlay rules:
```css
/* Pause overlay */
#pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.82);
  color: #00ffff;
  text-shadow: 0 0 12px #00ffff;
}
#pause-overlay.hidden { display: none; }
#pause-title { font-size: 48px; letter-spacing: 0.2em; }
```

**File**: `src/main.js`

Add the `pauseOverlay` DOM reference alongside `startOverlay`:
```js
const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
```

(The state-machine handler already references `pauseOverlay` — this just adds the missing declaration.)

### Success Criteria

- [ ] `#pause-overlay` does not appear on page load
- [ ] After dismissing start screen, pressing `Escape` shows the "PAUSED" overlay; pressing any key hides it and resumes
- [ ] `gameState.paused === true` while pause overlay is visible; `=== false` after resume
- [ ] Pressing `Escape` on the game-over screen does NOT show the pause overlay (guarded by `gameState.over` in state-machine handler and `togglePause()`)
- [ ] `npm run build` clean; `npm run test` passes

---

## Task 5: Update Tests 3–5 to Dismiss Start Screen

### Overview

With the start overlay gating the game loop, tests 3–5 (board injection) must dismiss the start screen before injecting board state so the RAF loop is running when `hardDrop()` is called (needed for HUD updates and overlay display).

**Why `ArrowLeft`**: It fires through `setupInput` (moves the active piece one column left) but causes no permanent board state — no hard drop, no lock, no line clear. The injection code unconditionally overwrites `gs.pieceType/rotation/col/row` before calling `gs.hardDrop()`, making the leftward shift irrelevant. Using `Space` would risk hard-dropping the initial piece and leaving board cells that conflict with the injection.

### Changes Required

**File**: `tests/gameplay.spec.ts`

For each of Tests 3, 4, and 5, insert `await page.keyboard.press('ArrowLeft')` immediately after `page.goto('/')` and update the stale comment (if not done in Task 1):

**Test 3** (around line 40–43):
```ts
await page.goto('/');
// Dismiss start overlay to start the game loop (ArrowLeft is harmless: no hard drop)
await page.keyboard.press('ArrowLeft');
// window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
await page.waitForFunction(() => (window as any).__gameState !== undefined);
```

**Test 4** (around line 73–76):
```ts
await page.goto('/');
// Dismiss start overlay to start the game loop (ArrowLeft is harmless: no hard drop)
await page.keyboard.press('ArrowLeft');
// window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
await page.waitForFunction(() => (window as any).__gameState !== undefined);
```

**Test 5** (around line 107–110):
```ts
await page.goto('/');
// Dismiss start overlay to start the game loop (ArrowLeft is harmless: no hard drop)
await page.keyboard.press('ArrowLeft');
// window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
await page.waitForFunction(() => (window as any).__gameState !== undefined);
```

### Success Criteria

- [ ] All 5 existing E2E tests pass via `npm run test:e2e`
- [ ] Tests 3, 4, 5 each send `ArrowLeft` before `waitForFunction`

---

## Task 6: New Playwright Tests 6, 7, 8

### Overview

Add 3 new E2E tests to `tests/gameplay.spec.ts` covering the start overlay, game start, and pause/resume flows.

### Changes Required

**File**: `tests/gameplay.spec.ts`

Append the following three tests after the existing Test 5:

```ts
// ──────────────────────────────────────────────────────────────────────────────
// Test 6: Start overlay visible on load
// Confirms start screen is shown before any interaction; score has not ticked.
// ──────────────────────────────────────────────────────────────────────────────
test('start overlay is visible on load', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-overlay')).toBeVisible();
  await expect(page.locator('#hud-score')).toHaveText('0');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 7: Game starts after keypress on start screen
// Pressing Space dismisses the start overlay and begins the game loop.
// ──────────────────────────────────────────────────────────────────────────────
test('game starts after keypress on start screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-overlay')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#start-overlay')).toBeHidden();
  await expect(page.locator('#game-canvas')).toBeVisible();
  // Game loop is now live — wait for gameState to confirm not over
  await page.waitForFunction(() => {
    const gs = (window as any).__gameState;
    return gs !== undefined && !gs.over;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 8: ESC pauses and any key resumes
// After dismissing start screen, ESC shows pause overlay (paused === true).
// A subsequent Space press hides the overlay (paused === false).
// ──────────────────────────────────────────────────────────────────────────────
test('ESC pauses and any key resumes', async ({ page }) => {
  await page.goto('/');
  // Dismiss start screen
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => (window as any).__gameState !== undefined);

  // ESC pauses
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  const pausedTrue = await page.evaluate(() => (window as any).__gameState.paused);
  expect(pausedTrue).toBe(true);

  // Any key resumes
  await page.keyboard.press('Space');
  await expect(page.locator('#pause-overlay')).toBeHidden();
  const pausedFalse = await page.evaluate(() => (window as any).__gameState.paused);
  expect(pausedFalse).toBe(false);
});
```

**Note on Test 7 with `Space`**: `Space` also fires through `setupInput` (calling `hardDrop()`). However, `hardDrop()` guards on `this.paused || this.over` (line 124 of gameState.js — actually looking at it: `hardDrop()` first checks `if (this.paused || this.over) return;`). Since the game just started (not paused, not over), `hardDrop()` WILL drop the initial piece. This is acceptable for Test 7 — we only assert that the start overlay is hidden and the game is live (not over), which remains true after a hard drop.

### Success Criteria

- [ ] `npm run test:e2e` reports 8 tests passing
- [ ] Test 6: `#start-overlay` visible and score is `'0'` on fresh load
- [ ] Test 7: `#start-overlay` hidden after `Space`; `window.__gameState.over === false`
- [ ] Test 8: `#pause-overlay` visible after ESC; `gameState.paused === true`; overlay hidden after resume; `gameState.paused === false`

---

## Task 7: Documentation Updates

### Overview

Update AGENTS.md (stale Y-axis tilt snippet + VITE_TEST_HOOKS), CLAUDE.md (start screen + test hook gate), and README.md (Escape control + E2E test note).

### Changes Required

**File**: `AGENTS.md`

1. Fix the stale `rotation.z` snippet in the Phase 2 section (lines 123–124):

   Replace:
   ```js
   boardGroup.rotation.z = THREE.MathUtils.degToRad(gameState.tiltAngle);
   ```
   With:
   ```js
   boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle);
   ```

   Also update the surrounding description if it says "Z-axis rotation" — change to "Y-axis rotation (negative sign: left piece → positive tiltAngle → left edge toward viewer)".

2. Add a note under the `## Tests` section:
   ```
   npm run test:e2e     # VITE_TEST_HOOKS=true is set automatically via playwright.config.ts webServer.env
   ```

**File**: `CLAUDE.md`

Add a new section after the `## E2E Tests` block:
```markdown
## Phase 6 Conventions

- **Start screen**: On page load, `#start-overlay` is shown. The game loop (`requestAnimationFrame`) does NOT start until the overlay is dismissed by any keydown or click. When writing tests that need the game loop running, dismiss the start screen first.
- **`window.__gameState` gate**: Set only when `import.meta.env.VITE_TEST_HOOKS === 'true'` or `import.meta.env.DEV`. In E2E tests, `playwright.config.ts` passes `VITE_TEST_HOOKS=true` via `webServer.env` — no manual env var needed when running `npm run test:e2e`.
- **Pause state**: `gameState.paused` is toggled by ESC (and by `KeyP` from `setupInput`). The `#pause-overlay` element shows when paused; any key resumes.
```

**File**: `README.md`

1. Add `Escape` to the controls table:
   ```markdown
   | Escape | Pause / Resume |
   ```

2. Add a note to the E2E Tests section:
   ```markdown
   The `VITE_TEST_HOOKS=true` environment variable is set automatically by `playwright.config.ts`
   via `webServer.env` — no manual configuration needed.
   ```

### Success Criteria

- [ ] AGENTS.md `rotation.z` replaced with `rotation.y` (with negative sign and updated description)
- [ ] AGENTS.md has VITE_TEST_HOOKS note
- [ ] CLAUDE.md Phase 6 Conventions section present
- [ ] README.md controls table includes Escape
- [ ] README.md E2E section notes VITE_TEST_HOOKS is auto-set

---

## Testing Strategy

### Unit Tests (Vitest)

No new unit tests required. `GameState.togglePause()` is already covered. All changes are UI/input wiring in `main.js` and `index.html`.

**Run after every task**: `npm run test` — must stay green throughout.

**Key areas where existing tests could be impacted**: None. The engine is unchanged.

### E2E Tests (Playwright)

**Pre-conditions for E2E tests to run**:
```bash
npm run build     # required — tests run against production preview
npm run test:e2e  # playwright.config.ts handles VITE_TEST_HOOKS=true automatically
```

**Test progression**:
- After Task 2: 5 tests pass (window.__gameState still set via VITE_TEST_HOOKS)
- After Task 5: 5 tests pass (start screen dismissed before board injection)
- After Task 6: 8 tests pass

**No mocking**: All tests use real game state via `window.__gameState`. Board injection via `page.evaluate()` writes directly to the live `gameState` instance.

**Assertion precision** (per Phase 5 lesson):
- Test 6: `toHaveText('0')` — exact, not `not.toHaveText('1')`
- Test 7: `toBeHidden()` — not just checking class
- Test 8: `expect(pausedTrue).toBe(true)` — not `toBeTruthy()`

---

## Risk Assessment

- **ESC-on-start-screen races with pause logic**: Mitigated by registering the state-machine handler BEFORE `setupInput` and using `return` after `startGame()`. ESC on the start screen starts the game and returns; pause logic is never reached on the same event.

- **`Space` in Test 7 triggers `hardDrop()`**: Acceptable — Test 7 only asserts the overlay is hidden and game is live (not over). A hard drop on an empty board can't cause game-over. If flaky, consider using `'F1'` or another key with no `setupInput` binding.

- **`VITE_TEST_HOOKS` env var not passed to preview build**: Mitigated by adding `env: { VITE_TEST_HOOKS: 'true' }` to `playwright.config.ts` `webServer`. Vite passes `VITE_*` env vars to the built bundle via `import.meta.env`.

- **`ArrowLeft` in Tests 3–5 moves piece before injection**: The injection code unconditionally sets `gs.col`, `gs.row`, `gs.pieceType`, `gs.rotation` before `hardDrop()`, so any prior position change is overwritten. Risk is low.

- **Pause overlay persisting after restart**: `handleRestart()` calls `gameState.restart()` (resets `paused = false`) and `hideOverlay()`. Since the game can't reach game-over while paused (both `update()` and `hardDrop()` return early when `paused`), the pause overlay will never be visible at restart time. No change to `handleRestart()` needed.

- **`held` Set in `setupInput` carrying stale keys during pause**: Keys pressed while paused are added to `held`. On resume (via the state-machine handler), the key fires its game action too. Per spec, "any key resumes" — the combined action is spec-compliant.
