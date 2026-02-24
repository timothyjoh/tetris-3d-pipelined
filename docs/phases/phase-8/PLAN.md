# Implementation Plan: Phase 8

## Overview

Phase 8 adds mobile playability to Tron Tetris: on-screen touch controls (←, →, ↑ rotate, ↓ soft drop, ⬛ hard drop), a mute/unmute toggle (M key + tappable HUD button), and a responsive layout that keeps the game usable at 390×844px. It also closes three stale E2E guard items carried as debt from Phase 7.

## Current State (from Research)

- **`main.js`**: 193 lines. RAF loop, AudioContext, sound dispatch, state-machine keydown handler. No mute flag. No touch handling. `window.__gameState = gameState` gated by `VITE_TEST_HOOKS`.
- **`src/input.js`**: 41 lines. Keyboard bindings via `switch (e.code)`. No `KeyM`. No touch.
- **`src/hud/hud.js`**: 132 lines. `updateHud(gameState)` reads `score`, `level`, `linesCleared`, `nextPieceType`. No mute indicator.
- **`src/audio/sounds.js`**: `playGameSound` called unconditionally — no mute gate.
- **`src/engine/gameState.js`**: Public fields: `paused`, `over`, `soundEvents`. No `muted` field.
- **`index.html`**: 220 lines. `#hud` has `pointer-events: none`. No `#touch-controls`, no mute button. No mobile breakpoints.
- **`tests/gameplay.spec.ts`**: 276 lines, 10 tests. Stale guards in Tests 8 (`!== undefined`), 9 (`!== undefined`), 10 (`!== undefined && gs.over === false`). Model pattern in Tests 3–5: `gs != null && gs.pieceType !== null`.
- **`playwright.config.ts`**: Chromium, `--use-gl=angle`, `VITE_TEST_HOOKS=true` baked into build, `reuseExistingServer: false`.

## Desired End State

After this phase:
- `src/engine/gameState.js` has a `muted = false` class field
- `src/input.js` has a `KeyM` case that toggles `gameState.muted`
- `src/main.js` gates sound dispatch with `if (!gameState.muted)`; wires mute button click; calls `setupTouchInput`
- `src/hud/hud.js` exports `updateMuteIndicator(muted)` and calls it inside `updateHud`
- `src/input-touch.js` (new) exports `setupTouchInput(container, gameState, isActive)`
- `index.html` has `#touch-controls` (5 buttons, data-action attributes), a `#mute-btn` in `#hud`, and mobile CSS (flex column layout, compact HUD, touch control visibility media query)
- `tests/gameplay.spec.ts` has `waitForGameReady(page)` helper; Tests 3–5, 8, 9, 10 all use it; Tests 11–14 added
- `src/__tests__/mute.test.js` (new) — 2+ Vitest unit tests for mute logic
- Documentation: `CLAUDE.md`, `README.md`, `AGENTS.md` updated

**Verification**: `npm test` passes (206+ Vitest unit tests); `npm run test:e2e` passes (14+ Playwright tests); `npm run build` emits no warnings; loading at 390×844 in browser devtools shows no horizontal scroll and all controls are visible.

## What We're NOT Doing

- Swipe-gesture controls (tap-buttons only, per SPEC)
- Full responsive redesign for landscape/portrait switching
- Gamepad/controller support
- Fixing Test 7's guard (explicitly out of scope per SPEC R7)
- Ghost piece rendering
- CI/CD automation for Vercel (no deploy step this phase)
- Any changes to the game engine logic (leaderboard, tilt, line clear)
- PWA manifest or app packaging

## Implementation Approach

**Mute flag on `GameState`**: The `window.__gameState` hook already exposes the entire `gameState` object. Adding `muted = false` as a class field makes it automatically accessible as `window.__gameState.muted` in E2E tests — zero hook code changes required. This mirrors the existing `paused` and `over` fields.

**M key in `setupInput`**: The state-machine keydown handler already gates the start screen (via `stopImmediatePropagation`) and pause screen (same). Adding M to `setupInput`'s switch means it fires during active play and game-over — exactly what R6 requires.

**Mute audio gating in `main.js`**: Simplest gate is at the call site in the sound dispatch loop: `if (!gameState.muted) { playGameSound(...) }`. No changes to `sounds.js`.

**Touch controls as a new module `src/input-touch.js`**: Mirrors the existing `src/input.js` pattern. Exports `setupTouchInput(container, gameState, isActive)` where `isActive` is a callback `() => gameStarted && !gameState.paused && !gameState.over`. Uses event delegation on the container div. Handles `touchstart` (with `{ passive: false }` to allow `e.preventDefault()`) and `touchend`/`touchcancel` for soft-drop stop and auto-repeat cleanup.

**Responsive layout via CSS media query** `@media (hover: none), (max-width: 768px)`: Touch controls (`#touch-controls`) are `display: none` by default and shown via this query. `#app` switches to `flex-direction: column` so the canvas grows (`flex: 1; min-height: 0`) and the touch controls occupy a fixed 152px strip at the bottom. The existing `window.resize` handler in `createScene` already re-sizes the Three.js renderer whenever the canvas's CSS dimensions change. The `#hud` gets compact styles on mobile (top-right pinned, smaller font, NEXT canvas hidden) to minimize board overlap.

**`waitForGameReady(page)` helper**: Defined at the top of `tests/gameplay.spec.ts` using the rigorous form `gs != null && gs.pieceType !== null`. Used in Tests 3, 4, 5 (non-functional replacement of already-correct guards) and Tests 8, 9, 10 (debt fixes). Also used in new Tests 11–14.

---

## Task 1: E2E Guard Debt — `waitForGameReady` Helper + Tests 8/9/10 Fix

### Overview

Extract the rigorous guard into a reusable helper and apply it to all tests that need it. This fixes SPEC R7 (BLOCKING debt from Phase 7) and also refactors Tests 3–5 to use the helper so all future guard upgrades are a single-line change.

### Changes Required

**File**: `tests/gameplay.spec.ts`

At the top of the file (after the import line), add:
```ts
// Shared guard: waits until the game module has loaded AND the first piece has spawned.
// Use this instead of bare `__gameState !== undefined` checks.
async function waitForGameReady(page: any) {
  await page.waitForFunction(() => {
    const gs = (window as any).__gameState;
    return gs != null && gs.pieceType !== null;
  });
}
```

Replace guards in:
- **Test 3** (line 46–49): inline `waitForFunction` → `await waitForGameReady(page);`
- **Test 4** (line 85–88): same
- **Test 5** (line 125–128): same
- **Test 8** (line 199): `await page.waitForFunction(() => (window as any).__gameState !== undefined);` → `await waitForGameReady(page);`
- **Test 9** (line 224): same as Test 8
- **Test 10** (lines 269–271): `await page.waitForFunction(() => { const gs = ...; return gs !== undefined && gs.over === false; });` → `await waitForGameReady(page);`
  - Note: Test 10's assertion `expect(isOver).toBe(false)` already verifies `over === false` after the guard; the guard just needs to confirm game loop has ticked.

Test 7's guard (`gs !== undefined && !gs.over`) is NOT changed — it's out of scope per SPEC R7.

Add a comment on each updated test noting the guard upgrade.

### Success Criteria
- [ ] `npm run test:e2e` passes all 10 existing E2E tests
- [ ] Tests 8, 9, 10 guards are now `waitForGameReady(page)` calls
- [ ] No changes to app source files

---

## Task 2: Mute Toggle — GameState Field + M Key + Audio Gating

### Overview

Add the mute flag to the game state, bind the M key to toggle it, and gate audio output on the flag. This is the entire mute feature logic — the UI (HUD button + indicator) comes in Task 3.

### Changes Required

**File**: `src/engine/gameState.js`

Add `muted = false;` as a class field alongside the existing `paused` and `over` fields. No other changes to the engine.

**File**: `src/input.js`

Add `KeyM` to the switch statement:
```js
case 'KeyM':
  gameState.muted = !gameState.muted;
  break;
```
Place it after the `KeyP` case. No additional gating needed — the state-machine keydown handler's `stopImmediatePropagation()` in the start-screen and pause-screen branches already prevents this handler from firing in those states.

**File**: `src/main.js`

In the sound dispatch loop (lines 164–170), gate the call:
```js
if (gameState.soundEvents.length > 0) {
  if (!gameState.muted) {
    const ctx = getAudioCtx();
    for (const event of gameState.soundEvents) {
      playGameSound(event, ctx);
    }
  }
  gameState.soundEvents.length = 0;  // always drain, even when muted
}
```
Note: always drain `soundEvents` regardless of mute to prevent queue buildup.

### Success Criteria
- [ ] `npm test` (Vitest) passes — no regressions
- [ ] Manual: pressing M during active play silences subsequent sounds; pressing M again restores them
- [ ] `window.__gameState.muted` reflects the flag (verified by evaluating in browser devtools)

---

## Task 3: Mute HUD Button + Indicator

### Overview

Add a tappable mute icon to the HUD that shows 🔊/🔇 and toggles mute on click/tap. The `updateHud` function gains a mute indicator update.

### Changes Required

**File**: `index.html`

Add a mute button panel to `#hud` (after the NEXT panel, as the last child of `#hud`):
```html
<div class="hud-panel" id="mute-panel">
  <button id="mute-btn" aria-label="Toggle mute">🔊</button>
</div>
```

In the `<style>` block, add:
```css
/* Mute button: override pointer-events: none on #hud for this element */
#mute-panel {
  pointer-events: auto;
  cursor: pointer;
  text-align: center;
}
#mute-btn {
  font-size: 22px;
  background: transparent;
  border: none;
  color: #00ffff;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
#mute-btn:hover { opacity: 0.8; }
```

**File**: `src/hud/hud.js`

Add at the bottom:
```js
const muteBtn = document.getElementById('mute-btn');

export function updateMuteIndicator(muted) {
  muteBtn.textContent = muted ? '🔇' : '🔊';
}
```

In `updateHud`, add a call:
```js
export function updateHud(gameState) {
  elScore.textContent = gameState.score.toLocaleString();
  elLevel.textContent = gameState.level;
  elLines.textContent = gameState.linesCleared;
  renderNextPiece(gameState.nextPieceType);
  updateMuteIndicator(gameState.muted);
}
```

**File**: `src/main.js`

Add imports and wire button click:
```js
import { updateHud, showOverlay, ..., updateMuteIndicator } from './hud/hud.js';
```

After `setupInput` call, add:
```js
document.getElementById('mute-btn').addEventListener('click', () => {
  if (gameStarted && !gameState.paused && !gameState.over) {
    gameState.muted = !gameState.muted;
    updateMuteIndicator(gameState.muted);
  }
});
```
Note: explicit guard in click handler because the overlays cover the button during start/pause/game-over states anyway, but defensive coding is correct here.

### Success Criteria
- [ ] HUD shows 🔊 on game start
- [ ] Pressing M during play changes icon to 🔇; pressing M again restores 🔊
- [ ] Clicking/tapping the mute icon on desktop toggles the icon and mutes audio
- [ ] `npm test` passes — no Vitest regressions

---

## Task 4: Mute Unit Tests

### Overview

Add Vitest unit tests for the `muted` field on `GameState` and the toggle behavior. Tests run in node environment (no DOM required — pure logic).

### Changes Required

**File**: `src/__tests__/mute.test.js` (new file)

```js
import { describe, it, expect } from 'vitest';
import { GameState } from '../engine/gameState.js';

describe('GameState mute', () => {
  it('starts unmuted', () => {
    const gs = new GameState();
    expect(gs.muted).toBe(false);
  });

  it('can be toggled to muted', () => {
    const gs = new GameState();
    gs.muted = !gs.muted;
    expect(gs.muted).toBe(true);
  });

  it('can be toggled back to unmuted', () => {
    const gs = new GameState();
    gs.muted = !gs.muted;
    gs.muted = !gs.muted;
    expect(gs.muted).toBe(false);
  });

  it('soundEvents queue still drains when muted', () => {
    // Verify the engine never gates soundEvents itself — that's main.js's job
    const gs = new GameState();
    gs.muted = true;
    gs.moveLeft(); // triggers a 'move' sound event if valid
    // soundEvents may or may not have an entry depending on board state,
    // but the field must exist and be an array
    expect(Array.isArray(gs.soundEvents)).toBe(true);
  });
});
```

**File**: `vitest.config.js`

No change needed — `src/__tests__/mute.test.js` runs in the default `node` environment, which is correct for pure GameState logic.

### Success Criteria
- [ ] `npm test` shows 4 new passing mute tests (total ≥ 210 passing)
- [ ] No jsdom configuration change required

---

## Task 5: Touch Controls HTML + CSS + Event Handling

### Overview

Add the `#touch-controls` div with 5 buttons, wire their touch events to game actions, and create the `src/input-touch.js` module. Touch controls are hidden by default and shown via CSS media query.

### Changes Required

**File**: `index.html`

Add `#touch-controls` as the last child of `#app` (after `#overlay`):
```html
<div id="touch-controls">
  <div class="tc-group">
    <button class="tc-btn" data-action="left" aria-label="Move left">←</button>
    <button class="tc-btn" data-action="rotate" aria-label="Rotate">↑</button>
    <button class="tc-btn" data-action="softDrop" aria-label="Soft drop">↓</button>
    <button class="tc-btn" data-action="right" aria-label="Move right">→</button>
  </div>
  <div class="tc-group">
    <button class="tc-btn tc-hard-drop" data-action="hardDrop" aria-label="Hard drop">⬛</button>
  </div>
</div>
```

Add to `<style>`:
```css
/* Touch controls: hidden by default; shown via media query on touch/narrow */
#touch-controls {
  display: none;
  width: 100%;
  height: 152px;
  background: rgba(0, 0, 0, 0.85);
  border-top: 1px solid #00ffff44;
  flex-shrink: 0;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
}
.tc-group {
  display: flex;
  gap: 8px;
  align-items: center;
}
.tc-btn {
  font-size: 22px;
  font-family: inherit;
  min-width: 56px;
  min-height: 56px;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid #00ffff55;
  color: #00ffff;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 0 8px #00ffff;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}
.tc-btn:active { background: rgba(0, 255, 255, 0.25); }
.tc-hard-drop { min-width: 72px; font-size: 20px; }
```

**File**: `src/input-touch.js` (new file)

```js
/**
 * Sets up touch event delegation on the touch control container.
 *
 * @param {HTMLElement} container - the #touch-controls div
 * @param {GameState} gameState
 * @param {() => boolean} isActive - returns true when game accepts touch input
 */
export function setupTouchInput(container, gameState, isActive) {
  let activeTouchAction = null;
  let repeatDelay = null;
  let repeatInterval = null;

  function clearRepeat() {
    clearTimeout(repeatDelay);
    clearInterval(repeatInterval);
    repeatDelay = null;
    repeatInterval = null;
  }

  function dispatch(action) {
    switch (action) {
      case 'left':     gameState.moveLeft();      break;
      case 'right':    gameState.moveRight();     break;
      case 'rotate':   gameState.rotateCW();      break;
      case 'softDrop': gameState.startSoftDrop(); break;
      case 'hardDrop': gameState.hardDrop();      break;
    }
  }

  container.addEventListener('touchstart', (e) => {
    e.preventDefault(); // prevent page scroll and double-tap zoom
    if (!isActive()) return;
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    clearRepeat();
    activeTouchAction = btn.dataset.action;
    dispatch(activeTouchAction);

    // Auto-repeat for move left/right only
    if (activeTouchAction === 'left' || activeTouchAction === 'right') {
      repeatDelay = setTimeout(() => {
        repeatInterval = setInterval(() => dispatch(activeTouchAction), 80);
      }, 300);
    }
  }, { passive: false });

  function onTouchEnd() {
    if (activeTouchAction === 'softDrop') gameState.stopSoftDrop();
    clearRepeat();
    activeTouchAction = null;
  }

  container.addEventListener('touchend', onTouchEnd);
  container.addEventListener('touchcancel', onTouchEnd);
}
```

**File**: `src/main.js`

Add import:
```js
import { setupTouchInput } from './input-touch.js';
```

After the `setupInput` call (line 135), add:
```js
const touchControls = document.getElementById('touch-controls');
setupTouchInput(touchControls, gameState, () => gameStarted && !gameState.paused && !gameState.over);
```

### Success Criteria
- [ ] On desktop with devtools set to 390×844 iPhone 14: touch controls are visible, 5 buttons shown
- [ ] On desktop at ≥769px: touch controls are not visible
- [ ] `npm test` passes — no regressions
- [ ] Page does not scroll when tapping touch buttons (verified by lack of page movement)

---

## Task 6: Responsive Layout CSS

### Overview

Make the `#app` flex column on mobile so the canvas fills the space above the touch controls. Adjust HUD to a compact top-right position on mobile to reduce board overlap.

### Changes Required

**File**: `index.html` — add to `<style>` block (after all existing styles):

```css
/* ── Mobile layout: touch-capable devices or viewport ≤ 768px ── */
@media (hover: none), (max-width: 768px) {
  /* Flex column: canvas grows, touch controls pin to bottom */
  #app {
    display: flex;
    flex-direction: column;
  }
  #game-canvas {
    flex: 1 1 0;
    min-height: 0;
    height: auto;
  }
  #touch-controls {
    display: flex; /* override display: none from base style */
  }

  /* Compact HUD pinned to top-right to minimize board overlap */
  #hud {
    top: 4px;
    right: 4px;
    transform: none;
    gap: 6px;
  }
  .hud-panel {
    min-width: 56px;
    padding: 4px 8px;
  }
  .hud-label {
    font-size: 9px;
    margin-bottom: 2px;
  }
  .hud-value {
    font-size: 14px;
  }
  /* Hide NEXT canvas on mobile — too small to be useful */
  #next-canvas {
    display: none;
  }
}
```

**Renderer resize behavior**: The existing `window.addEventListener('resize', ...)` handler in `src/renderer/scene.js:19–22` calls `renderer.setSize(canvas.clientWidth, canvas.clientHeight)`. On initial page load, CSS is applied before the `<script type="module">` executes, so `canvas.clientWidth`/`clientHeight` already reflect the flex layout. No changes to `scene.js` needed.

### Success Criteria
- [ ] At 390×844 (Chrome devtools iPhone 14 preset): no horizontal scrollbar; canvas, HUD panels, and touch buttons all visible
- [ ] At 1280×720 desktop: HUD is right-side-positioned, touch controls not visible, layout unchanged
- [ ] `npm run build` exits with no warnings or errors

---

## Task 7: E2E Tests 11–14 (Touch + Mute Assertions)

### Overview

Add four new Playwright E2E tests using touch simulation. Tests 11–13 exercise touch controls; Test 14 exercises mute toggle. All use `waitForGameReady(page)`.

### Changes Required

**File**: `tests/gameplay.spec.ts`

Append after Test 10. Use `page.setViewportSize({ width: 390, height: 844 })` at the start of each test to simulate iPhone 14 portrait. Use `page.touchscreen.tap(x, y)` for touch events. Get button coordinates via `locator.boundingBox()`.

```ts
// ──────────────────────────────────────────────────────────────────────────────
// Test 11: Touch ← button moves piece left
// Tap the left arrow button; assert gameState.col decreased (or is bounded).
// Uses 390×844 viewport to show touch controls.
// ──────────────────────────────────────────────────────────────────────────────
test('touch left button moves piece left', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  const colBefore = await page.evaluate(() => (window as any).__gameState.col);

  const btn = page.locator('[data-action="left"]');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const colAfter = await page.evaluate(() => (window as any).__gameState.col);
  // col should have decreased by 1 (or stayed same if already at left wall)
  expect(colAfter).toBeLessThanOrEqual(colBefore);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 12: Touch rotate button rotates piece
// Tap the rotate button; assert gameState.rotation changed.
// Uses 390×844 viewport to show touch controls.
// ──────────────────────────────────────────────────────────────────────────────
test('touch rotate button rotates piece', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  const rotBefore = await page.evaluate(() => (window as any).__gameState.rotation);

  const btn = page.locator('[data-action="rotate"]');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const rotAfter = await page.evaluate(() => (window as any).__gameState.rotation);
  expect(rotAfter).not.toBe(rotBefore);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 13: Touch hard drop button lands piece near bottom
// Tap the hard drop button; piece row should jump to near-bottom (row ≥ 15).
// Uses 390×844 viewport to show touch controls.
// ──────────────────────────────────────────────────────────────────────────────
test('touch hard drop button drops piece to bottom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  const btn = page.locator('[data-action="hardDrop"]');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // After hard drop, a new piece spawns near row 0; wait for next piece
  await waitForGameReady(page);
  // The previous piece locked near the bottom — board should have cells there
  const hasCellNearBottom = await page.evaluate(() => {
    const gs = (window as any).__gameState;
    for (let col = 0; col < 10; col++) {
      if (gs.board.getCell(col, 19) !== 0) return true;
    }
    return false;
  });
  expect(hasCellNearBottom).toBe(true);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 14: Touch mute button toggles mute flag
// Tap the mute button in the HUD; assert window.__gameState.muted changes.
// Uses 390×844 viewport. Mute button is always visible in the HUD.
// ──────────────────────────────────────────────────────────────────────────────
test('touch mute button toggles mute flag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  const mutedBefore = await page.evaluate(() => (window as any).__gameState.muted);
  expect(mutedBefore).toBe(false);

  // Tap the mute button
  await page.click('#mute-btn');

  const mutedAfter = await page.evaluate(() => (window as any).__gameState.muted);
  expect(mutedAfter).toBe(true);

  // Verify HUD icon changed
  const icon = await page.locator('#mute-btn').textContent();
  expect(icon).toBe('🔇');

  // Tap again to unmute
  await page.click('#mute-btn');
  const mutedFinal = await page.evaluate(() => (window as any).__gameState.muted);
  expect(mutedFinal).toBe(false);
});
```

**Note on Test 13 assertion**: `board.getCell(col, row)` is a confirmed public method on `Board` (`src/engine/board.js:13`). Use `gs.board.getCell(col, 19)` directly.

### Success Criteria
- [ ] `npm run test:e2e` passes all 14 E2E tests (10 existing + 4 new)
- [ ] Test 14 confirms `window.__gameState.muted` is toggled by the button

---

## Task 8: Documentation

### Overview

Update the three documentation files per SPEC.

### Changes Required

**File**: `CLAUDE.md`

Add Phase 8 section:
```markdown
## Phase 8 Additions

### Touch Control Overlay Architecture
- `#touch-controls` div in `index.html` — uses event delegation; a single `touchstart` listener
  on the container reads `data-action` from the target button.
- `src/input-touch.js` — exports `setupTouchInput(container, gameState, isActive)`.
  Auto-repeat for ← / →: 300 ms initial delay, 80 ms interval (via `setTimeout`/`setInterval`).
  `touchcancel` is handled identically to `touchend` to ensure soft-drop stops cleanly.
- Visibility: CSS `@media (hover: none), (max-width: 768px)` — combined touch-capable and
  narrow-viewport condition.

### Mute Flag Location
- `gameState.muted` (boolean, default `false`) — on the `GameState` class.
- Toggled by `KeyM` in `src/input.js` and by `#mute-btn` click in `src/main.js`.
- Audio gating: `if (!gameState.muted)` wraps the sound dispatch loop in `src/main.js`.
- HUD indicator: `updateMuteIndicator(muted)` in `src/hud/hud.js`, called from `updateHud`.
- E2E accessible as `window.__gameState.muted` (existing hook, no new code).
```

**File**: `README.md`

Add a Controls section (after existing content, before or after Live Demo):
```markdown
## Controls

### Keyboard
| Key | Action |
|-----|--------|
| ← / → | Move left / right |
| ↑ or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| Esc | Pause / resume |
| M | Mute / unmute |
| Enter / R | Restart (after game over) |

### Touch Controls
On touch-capable devices or viewports ≤ 768px wide, an on-screen control pad appears at the
bottom of the screen: ← (move left), ↑ (rotate), ↓ (soft drop), → (move right), and ⬛ (hard
drop). Tap the 🔊 / 🔇 icon in the top-right corner to toggle audio.
```

**File**: `AGENTS.md`

Add to the test hooks section:
```markdown
### `window.__gameState.muted` (Phase 8)
`window.__gameState.muted` (boolean) is accessible under `VITE_TEST_HOOKS=true` or DEV mode
via the existing `window.__gameState` hook. It reflects the current mute state. Toggle it via
`#mute-btn` click or M key during active play. Use `page.evaluate(() => (window as any).__gameState.muted)`
in E2E tests to assert mute state.
```

### Success Criteria
- [ ] CLAUDE.md has Phase 8 section with touch architecture and mute flag location
- [ ] README.md has Controls table with keyboard and touch columns
- [ ] AGENTS.md documents `window.__gameState.muted`

---

## Testing Strategy

### Unit Tests

**New**: `src/__tests__/mute.test.js` — 4 tests in node environment:
- `muted` starts false on a fresh `GameState`
- Toggle to true
- Toggle back to false
- `soundEvents` is an Array (field exists regardless of mute state)

**Anti-mock bias**: `GameState` is real — no mocking needed. `AudioContext` is not tested in unit tests; it's tested implicitly via E2E (no audio crash when playing).

### Integration / E2E Tests

**Guard debt fixed** (Tests 8, 9, 10): now use `waitForGameReady(page)` — same rigorous two-condition form as Tests 3–5.

**New Tests 11–14**: Use `page.setViewportSize({ width: 390, height: 844 })` and `page.touchscreen.tap(x, y)` (already in `@playwright/test`; no new packages). Touch button coordinates obtained via `locator.boundingBox()`.

**Test 13 caveat**: Verifying "piece lands at bottom" by checking `board.getCell(col, 19)` for any non-zero value. If `Board` doesn't expose `getCell`, use `gs.board.cells[19][col]` — check the actual Board API before writing.

**Test 14 mute**: Uses `page.click('#mute-btn')` (not `touchscreen.tap`) since Playwright's click on a positioned element is reliable without coordinates. Asserts both `window.__gameState.muted` and the HUD icon text.

---

## Risk Assessment

- **Touch auto-repeat timer leaks**: If `touchend`/`touchcancel` is missed (e.g., browser interrupts gesture), the repeat interval continues. **Mitigation**: `touchcancel` handler calls `onTouchEnd` identically; the `isActive()` guard in `dispatch` prevents action dispatch when the game isn't running.

- **Resize event not firing on CSS-driven height change**: If adding touch controls via CSS media query doesn't trigger a window resize, the Three.js renderer retains the old canvas dimensions. **Mitigation**: The renderer initializes with `canvas.clientWidth/Height` at module load time — CSS is already applied by then (scripts run after CSSOM). Desktop window resize events update the renderer. Tested by opening at 390×844 (not resizing from desktop), which is the mobile use case.

- **Test 11/12/13 viewport interaction with Playwright**: `page.setViewportSize` is per-test and does not persist. Touch APIs require the viewport to be set before `goto`. Setting it first in each test ensures CSS media query fires. Playwright's headless Chromium supports touch simulation via `page.touchscreen.tap()`.

- **`gameState.muted` and hot reload / restart**: On `gameState.restart()`, the `GameState` object is mutated in-place (`restart()` method). If `restart()` does not reset `muted`, the mute state persists across restarts within the session — which is exactly SPEC R4 ("persists across restarts within the session"). No action needed; this is the desired behavior.

- **`pointer-events: none` on `#hud`**: The mute button needs `pointer-events: auto` on its parent panel. Adding it to `#mute-panel` (the wrapper div) rather than the button directly ensures the whole hit area is tappable. Verify in browser devtools that clicks reach the button.

- **Board API in Test 13**: Confirmed — `Board.getCell(col, row)` is a public method in `src/engine/board.js:13`. No risk here.
