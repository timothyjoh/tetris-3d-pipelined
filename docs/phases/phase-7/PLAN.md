# Implementation Plan: Phase 7

## Overview

Phase 7 closes the final BRIEF.md criterion ("deploys cleanly to Vercel") and resolves four technical debt items from Phase 6: missing `e.stopImmediatePropagation()` in the state-machine keydown handler, no-op `waitForFunction` guards in Tests 3–5, an undocumented `Space` side effect in Test 7, and a stale Z-axis tilt description in README.md. A new Test 10 covers the click-to-start code path, and documentation (README, AGENTS.md, CLAUDE.md) is updated.

## Current State (from Research)

- `src/main.js:106–125` — state-machine keydown handler handles 4 branches (start-dismiss, game-over guard, pause-resume, ESC-pause) but none call `e.stopImmediatePropagation()`. The existing `handleInitialsKey` at lines 65–85 already uses this pattern — we follow it.
- `tests/gameplay.spec.ts:44, 80, 116` — Tests 3–5 use `window.__gameState !== undefined`, which is a no-op (set synchronously at module evaluation). The SPEC requires upgrading to `window.__gameState?.pieceType !== null`.
- `tests/gameplay.spec.ts:163–174` — Test 7 uses `Space` to dismiss the start overlay but has no comment explaining the `hardDrop()` side effect (which disappears after the fix).
- `tests/gameplay.spec.ts:194` — Test 8 uses `Space` to resume from pause; after the fix, `hardDrop()` will no longer also fire.
- `src/main.js:127` — `startOverlay.addEventListener('click', startGame)` is wired but has no E2E coverage.
- `README.md:10` — "board Z-rotates up to ±7°" is stale; Phase 4 changed this to Y-axis.
- Vercel deploy has never been performed.

## Desired End State

After this phase:
- `src/main.js` state-machine handler calls `e.stopImmediatePropagation()` in all three consuming branches (start-dismiss, pause-resume, ESC-pause).
- `tests/gameplay.spec.ts` has 10 tests, all passing. Tests 3–5 use the strengthened guard. Test 7 has a comment describing the post-fix `Space` behavior. Test 8 has a comment on the resume Space not triggering `hardDrop()`.
- `README.md` describes Y-axis board tilt and includes a "Live Demo" section with the production Vercel URL.
- `AGENTS.md` documents the `stopImmediatePropagation` discipline.
- `CLAUDE.md` notes the Phase 7 addition.
- `npm run test` (206+ Vitest unit tests) and `npm run test:e2e` (10 Playwright tests) both pass.
- `vercel --prod` has been run and the live URL is reachable.

**Verification**: `npm run test && npm run test:e2e` — all green. Open the Vercel URL in a browser; `#start-overlay` visible, WebGL canvas present, no console errors, pressing a key starts the game.

## What We're NOT Doing

- No changes to game engine logic, scoring, or Three.js rendering.
- No new gameplay features (ghost piece, mobile controls, sound toggle, etc.).
- No CI/CD pipeline for Vercel — one-time manual deploy is sufficient.
- No new Vitest unit tests (the fix in `src/main.js` cannot be unit-tested without jsdom/event mocking; E2E coverage is sufficient per SPEC).
- No changes to test infrastructure (playwright.config.ts stays as-is).
- No backend services.
- No fixing of Tests 8 and 9's `waitForFunction` guards — only Tests 3–5 are in scope per R5.

## Implementation Approach

Work sequentially so each task is immediately verifiable:
1. Fix the core `stopImmediatePropagation` bug in `src/main.js` first — this is the change that alters runtime behavior all other tasks document or test.
2. Update E2E tests (guards, comments, new Test 10) second — these verify the fix and close the click-to-start gap.
3. Update README.md (tilt description + Vercel URL placeholder) third — documentation.
4. Run `vercel --prod` and fill in the live URL — this is the last code-visible step.
5. Update AGENTS.md and CLAUDE.md — process documentation.
6. Update MEMORY.md last — after all tests pass.

---

## Task 1: Add `e.stopImmediatePropagation()` to state-machine handler

### Overview

The state-machine keydown handler in `src/main.js` handles three consuming branches but never stops propagation. This allows overlay-dismiss keys (especially `P`) to also reach `setupInput`'s `togglePause()`, leaving the game paused with no visual feedback. The fix adds `e.stopImmediatePropagation()` to all three consuming branches, following the existing pattern in `handleInitialsKey`.

### Changes Required

**File**: `src/main.js:106–125`

Current state-machine handler:
```js
window.addEventListener('keydown', (e) => {
  if (!gameStarted) {
    startGame();
    return;
  }
  if (gameState.over) return;
  if (gameState.paused) {
    gameState.togglePause();
    pauseOverlay.classList.add('hidden');
    return;
  }
  if (e.code === 'Escape') {
    gameState.togglePause();
    pauseOverlay.classList.remove('hidden');
  }
});
```

Updated handler (add `e.stopImmediatePropagation()` to the three consuming branches):
```js
window.addEventListener('keydown', (e) => {
  if (!gameStarted) {
    // Any key dismisses start screen and begins the game loop.
    // stopImmediatePropagation prevents this key from also reaching setupInput
    // (e.g. P would otherwise call togglePause(), Space would call hardDrop()).
    startGame();
    e.stopImmediatePropagation();
    return;
  }
  if (gameState.over) return; // game-over: Enter/R handled by setupInput
  if (gameState.paused) {
    // Any key resumes; stop propagation so the same key doesn't also
    // trigger a game-control action (e.g. Space would call hardDrop()).
    gameState.togglePause();
    pauseOverlay.classList.add('hidden');
    e.stopImmediatePropagation();
    return;
  }
  if (e.code === 'Escape') {
    // ESC pauses during active play; stop propagation (ESC has no setupInput binding,
    // but the discipline is: consuming branches always call stopImmediatePropagation).
    gameState.togglePause();
    pauseOverlay.classList.remove('hidden');
    e.stopImmediatePropagation();
  }
});
```

**Note**: The `game-over` guard (`if (gameState.over) return`) is NOT a consuming branch — it returns without doing anything, so `setupInput`'s Enter/R restart handler should still receive the event. No `stopImmediatePropagation` there.

### Success Criteria

- [ ] `npm run build` completes without warnings.
- [ ] `npm run test` — all 206+ Vitest unit tests pass.
- [ ] Manual verification: navigate to `localhost:5173`, press `P` on start screen → overlay hides, game starts, game is NOT paused (`gameState.paused === false`).
- [ ] Manual verification: ESC during active play pauses; any key resumes; pressing `Space` to resume does not also drop the piece to the bottom.

---

## Task 2: Strengthen `waitForFunction` guards in Tests 3–5

### Overview

The guards at `tests/gameplay.spec.ts:44, 80, 116` use `window.__gameState !== undefined`, which is set synchronously at module evaluation and passes immediately — providing false confidence that the game loop has ticked. Upgrade to `window.__gameState?.pieceType !== null` per R5.

### Changes Required

**File**: `tests/gameplay.spec.ts`

Three identical substitutions:

- Line 45 (Test 3):
  ```ts
  // Before:
  await page.waitForFunction(() => (window as any).__gameState !== undefined);
  // After:
  await page.waitForFunction(() => (window as any).__gameState?.pieceType !== null);
  ```

- Line 80 (Test 4):
  ```ts
  // Before:
  await page.waitForFunction(() => (window as any).__gameState !== undefined);
  // After:
  await page.waitForFunction(() => (window as any).__gameState?.pieceType !== null);
  ```

- Line 116 (Test 5):
  ```ts
  // Before:
  await page.waitForFunction(() => (window as any).__gameState !== undefined);
  // After:
  await page.waitForFunction(() => (window as any).__gameState?.pieceType !== null);
  ```

Also update the inline comment on each of those lines from:
```ts
// window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
```
to:
```ts
// Wait for pieceType to be non-null: confirms game state is initialized and piece is spawned
// (VITE_TEST_HOOKS=true is set in playwright.config.ts webServer.env)
```

### Success Criteria

- [ ] `npm run test:e2e` — Tests 3, 4, 5 still pass.
- [ ] The guard lines no longer read `!== undefined`.

---

## Task 3: Update Test 7 comment and add Test 8 comment

### Overview

Test 7 uses `Space` to dismiss the start screen. Before the Task 1 fix, Space also triggered `hardDrop()` via `setupInput`. After the fix, Space only dismisses the overlay. The test comment must accurately describe the current (post-fix) behavior. Similarly, Test 8 uses `Space` to resume from pause — a comment should explain that hardDrop() no longer fires.

### Changes Required

**File**: `tests/gameplay.spec.ts`

**Test 7** — replace the header comment and add an inline note about Space:

```ts
// ──────────────────────────────────────────────────────────────────────────────
// Test 7: Game starts after keypress on start screen
// Pressing Space dismisses the start overlay and begins the game loop.
// The state-machine handler calls e.stopImmediatePropagation() after startGame(),
// so Space does NOT also trigger hardDrop() via setupInput. Key choice here is safe.
// ──────────────────────────────────────────────────────────────────────────────
```

**Test 8** — add a comment before the Space resume keypress (line ~194):
```ts
// Space resumes — state-machine handler calls stopImmediatePropagation() in the
// pause-resume branch, so Space does NOT also reach setupInput's hardDrop().
await page.keyboard.press('Space');
```

### Success Criteria

- [ ] `npm run test:e2e` — Tests 7 and 8 still pass.
- [ ] Test 7 header comment accurately describes the post-fix Space behavior.
- [ ] Test 8 has an explanatory comment before the Space keypress.

---

## Task 4: Add Test 10 — click-to-start

### Overview

`startOverlay.addEventListener('click', startGame)` has been wired since Phase 6 but has no E2E coverage. Test 10 exercises this path: click the start overlay, confirm it hides, confirm the game is live and not over.

### Changes Required

**File**: `tests/gameplay.spec.ts` — append after Test 9:

```ts
// ──────────────────────────────────────────────────────────────────────────────
// Test 10: Click on start overlay starts the game
// The #start-overlay element has a click listener → startGame(). Clicking it
// should hide the overlay and start the game loop (gameState.over === false).
// ──────────────────────────────────────────────────────────────────────────────
test('click on start overlay starts the game', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-overlay')).toBeVisible();

  await page.click('#start-overlay');

  await expect(page.locator('#start-overlay')).toBeHidden();
  // Confirm the game loop is live and not in a game-over state
  await page.waitForFunction(() => {
    const gs = (window as any).__gameState;
    return gs !== undefined && gs.over === false;
  });
  const isOver = await page.evaluate(() => (window as any).__gameState.over);
  expect(isOver).toBe(false);
});
```

### Success Criteria

- [ ] `npm run test:e2e` — 10 tests pass (Test 10 is the new one).
- [ ] Test 10 exercises the click path, not the keydown path.
- [ ] Assertions use exact values (`toBe(false)`, not `toBeFalsy()`).

---

## Task 5: Fix README.md tilt description

### Overview

`README.md:10` says "board Z-rotates up to ±7°" — this is stale from Phase 2. Phase 4 changed the tilt to Y-axis (`boardGroup.rotation.y`). Update the Features bullet to match current implementation.

### Changes Required

**File**: `README.md:10`

```markdown
# Before:
- **Board tilt effect** — board Z-rotates up to ±7° tracking the active piece center column; spring/damping animation snaps back to 0° on piece lock

# After:
- **Board tilt effect** — board Y-rotates up to ±7° tracking the active piece center column; spring/damping animation snaps back to 0° on piece lock
```

Also add a "Live Demo" section placeholder after the Features section (to be filled with the actual URL in Task 6):

```markdown
## Live Demo

[Production URL — added after Vercel deploy in Phase 7]
```

### Success Criteria

- [ ] `README.md:10` reads "Y-rotates" (not "Z-rotates").
- [ ] "Live Demo" heading exists in README.md.

---

## Task 6: Vercel Production Deploy

### Overview

Run `vercel --prod` from the project root to deploy the production build. Capture the live URL. Update README.md with the URL. Perform a manual smoke check in a browser.

### Prerequisites

- `vercel` CLI must be installed (`npm i -g vercel` or `npx vercel`).
- Vercel account must be authenticated (`vercel login`).
- No `vercel.json` is needed — Vercel auto-detects Vite projects (documented in AGENTS.md).

### Steps

1. Run `vercel --prod` from the project root.
2. When prompted for project settings, use:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Copy the production URL from the CLI output.
4. Update `README.md` Live Demo section with the actual URL.

### Changes Required

**File**: `README.md` — replace the placeholder:
```markdown
## Live Demo

[https://your-actual-vercel-url.vercel.app](https://your-actual-vercel-url.vercel.app)
```

### Manual Smoke Check

Open the production URL in any browser and confirm:
- `#start-overlay` is visible on load.
- `<canvas>` element is present in the DOM (WebGL active).
- No JS console errors on page load.
- Pressing any key dismisses the overlay and a Tetromino falls.

### Success Criteria

- [ ] `vercel --prod` exits 0 and prints a `*.vercel.app` URL.
- [ ] Browser smoke check passes (overlay visible, canvas present, no errors).
- [ ] `README.md` contains the live URL under "Live Demo".

---

## Task 7: Update AGENTS.md and CLAUDE.md

### Overview

Document the `stopImmediatePropagation` discipline as a standard pattern, per the SPEC's documentation requirements (R8 and the Documentation Updates section).

### Changes Required

**File**: `AGENTS.md` — add a new section (or append to existing Phase conventions section):

```markdown
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
```

**File**: `CLAUDE.md` — add a note in the Phase 6/7 conventions section:

```markdown
### Phase 7 Addition

- `stopImmediatePropagation` is now called in all three consuming branches of the state-machine keydown handler (`src/main.js:106–125`). Future key bindings added to `setupInput` may safely overlap with start-screen/pause/resume keys — they will be blocked when an overlay is active and allowed through during normal play.
```

### Success Criteria

- [ ] AGENTS.md has a section explaining `stopImmediatePropagation` discipline with the non-consuming branch exception.
- [ ] CLAUDE.md notes the Phase 7 fix.

---

## Task 8: Update MEMORY.md

**This is the last step — only after all tests pass and all MUST-FIX items are resolved.**

Update the project memory to reflect Phase 7 completion:
- Mark `PROJECT COMPLETE` with Vercel URL.
- Note the `stopImmediatePropagation` pattern as an established discipline.
- Update E2E test count from 9 to 10.
- Remove or update the `MUST-FIX` note from Phase 6 (now resolved).

---

## Testing Strategy

### Unit Tests (Vitest)

- No new Vitest tests required for Phase 7.
- All 206+ existing tests must continue to pass (`npm run test`).
- The `stopImmediatePropagation` fix in `src/main.js` is not unit-testable without DOM event mocking; E2E coverage is sufficient.

### E2E Tests (Playwright)

Changes to existing tests:
| Test | Change |
|------|--------|
| Test 3 | `waitForFunction` guard: `→ pieceType !== null`; update comment |
| Test 4 | `waitForFunction` guard: `→ pieceType !== null`; update comment |
| Test 5 | `waitForFunction` guard: `→ pieceType !== null`; update comment |
| Test 7 | Header comment updated to explain Space + stopImmediatePropagation post-fix |
| Test 8 | Inline comment before Space keypress explaining no hardDrop() side effect |

New test:
| # | Name | Setup | Assert |
|---|------|--------|--------|
| 10 | `click on start overlay starts the game` | `page.goto('/')`, wait for `#start-overlay` visible | `page.click('#start-overlay')` → `#start-overlay` hidden; `gameState.over === false` |

### Production Smoke Check (Manual)

After `vercel --prod`, open the live URL in a browser:
1. `#start-overlay` visible on load ✓
2. `<canvas>` present in DOM ✓
3. No JS console errors ✓
4. Pressing a key dismisses overlay and piece falls ✓

---

## Risk Assessment

- **`stopImmediatePropagation` on pause-resume branch changes Test 8 behavior**: Space resumes from pause without triggering `hardDrop()`. Test 8 only asserts `#pause-overlay` hidden and `paused === false` — no piece position assertions — so no test breakage. A comment is added to document the new behavior.

- **`waitForFunction` guard change causes Tests 3–5 to hang**: If `pieceType` were null after module evaluation (e.g., constructor doesn't call `_spawnPiece()`), the guard would hang. MEMORY.md confirms the constructor does call `_spawnPiece()` (and the bug fix ensures the initial `pieceType` is set). Guard will resolve immediately as before, but more correctly.

- **Vercel deploy requires CLI auth**: If `vercel` is not installed or not authenticated, Task 6 cannot proceed. Check with `vercel whoami` before starting. `npm i -g vercel && vercel login` is the setup path per AGENTS.md.

- **Click event and keydown event conflict (Test 10)**: `startGame()` is idempotent (`if (gameStarted) return`). If both a click and keydown fire simultaneously, only the first call to `startGame()` takes effect. No risk.

- **AGENTS.md and CLAUDE.md edits**: These are documentation files; no test coverage. Risk is low — verify by reading the updated sections after writing.
