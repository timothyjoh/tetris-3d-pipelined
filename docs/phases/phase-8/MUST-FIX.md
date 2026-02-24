# Must-Fix Items: Phase 8

## Summary

2 issues found: 1 BLOCKING, 1 NON-BLOCKING.

---

## Tasks

### Task 1: Fix Test 11 — touch-left assertion can false-positive on a broken implementation

**Priority:** BLOCKING
**Status:** ✅ Fixed
**What was done:** Added two `ArrowRight` keypresses after `waitForGameReady` to move the piece away from the left wall, then changed the assertion from `toBeLessThanOrEqual(colBefore)` to strict `toBe(colBefore - 1)`. All 14 E2E tests pass.

**Files:** `tests/gameplay.spec.ts` (lines 288–303)

**Problem:**
Test 11 asserts `expect(colAfter).toBeLessThanOrEqual(colBefore)`. This passes when
`colAfter === colBefore`, which happens both when the piece is already at the left wall
AND when the touch event fires but has no effect (broken registration, passive listener,
`isActive()` mismatch, etc.). A completely non-functional touch-left button would cause
this test to pass, defeating its purpose.

**Fix:**

Step 1 — After `waitForGameReady(page)`, press `ArrowRight` twice via keyboard to move
the active piece away from any possible left-wall boundary before reading `colBefore`.

Step 2 — Change the assertion from `LessThanOrEqual` to strict `toBe(colBefore - 1)`.

Replace the body of `test('touch left button moves piece left', ...)` with:

```ts
test('touch left button moves piece left', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  // Move right twice to ensure piece is not against the left wall,
  // so a successful touch-left will always decrease col by exactly 1.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  const colBefore = await page.evaluate(() => (window as any).__gameState.col);

  const btn = page.locator('[data-action="left"]');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const colAfter = await page.evaluate(() => (window as any).__gameState.col);
  // Strict equality: touch-left must decrease col by exactly 1.
  // Moving right twice before ensures the piece is not at the left wall.
  expect(colAfter).toBe(colBefore - 1);
});
```

**Verify:**
1. Run `npm run test:e2e` — all 14 tests must pass.
2. Manually break the feature: in `src/input-touch.js` comment out the `dispatch(activeTouchAction)` call. Run `npm run test:e2e` — Test 11 must now FAIL (not pass). Restore the line.

---

### Task 2: Fix R6 gap — mute button click is blocked during game-over state

**Priority:** NON-BLOCKING
**Status:** ✅ Fixed
**What was done:** Removed `&& !gameState.over` from the `#mute-btn` click handler guard in `src/main.js:140`. The guard is now `gameStarted && !gameState.paused`, allowing mute toggling during game-over to match M-key behaviour. All 14 E2E tests pass.

**Files:** `src/main.js` (lines 139–144)

**Problem:**
The `#mute-btn` click handler guards with `gameStarted && !gameState.paused && !gameState.over`.
This silently ignores mute-button clicks while the game-over overlay is showing.
SPEC R6 says audio toggling is permitted "during active play **or game over**". The M key
correctly works during game-over (the state-machine handler doesn't suppress `setupInput`
on the `over` branch). The button click does not — an inconsistency between the two input
paths for the same feature.

**Fix:**

Change the guard in the `mute-btn` click handler from:

```js
if (gameStarted && !gameState.paused && !gameState.over) {
```

to:

```js
if (gameStarted && !gameState.paused) {
```

This allows mute toggling during game-over (matching M key behaviour) while still blocking
it on the start screen (not `gameStarted`) and pause overlay (`gameState.paused`).

**Verify:**
1. Run `npm run test:e2e` — all 14 tests must still pass (Test 14 already exercises the
   active-play mute path; no existing test covers the game-over click case, so no test
   changes are required).
2. Manual check: trigger game-over in the browser, confirm the 🔊 button in the HUD
   responds to clicks (icon flips to 🔇 and back to 🔊).
