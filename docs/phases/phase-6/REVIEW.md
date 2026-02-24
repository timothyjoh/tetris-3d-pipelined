# Phase Review: Phase 6

## Overall Verdict

NEEDS-FIX — 3 minor issues. Core implementation is solid; all issues are in the test-quality bucket. See MUST-FIX.md.

---

## Code Quality Review

### Summary

The Phase 6 implementation is clean and well-executed. All spec requirements are met: start screen, pause overlay, ESC/resume wiring, `VITE_TEST_HOOKS` gate, and documentation updates. The two-overlay approach (separate `#start-overlay` and `#pause-overlay`) is the right call — it avoids conditional child-hiding in the existing game-over `#overlay`. The state-machine keydown handler pattern is solid and correctly registered before `setupInput`. One genuine local-dev footgun was introduced by combining `reuseExistingServer: !process.env.CI` with a build-time `VITE_TEST_HOOKS` flag.

### Findings

1. **Correctness — `reuseExistingServer` + build-time flag incompatibility**: `playwright.config.ts:33` sets `reuseExistingServer: !process.env.CI`. In non-CI environments, if any server is already listening on 4173, Playwright reuses it and skips `npm run build && npm run preview`. If that server was built without `VITE_TEST_HOOKS=true`, `window.__gameState` will be `undefined` and all board-injection tests (3–5) and Test 7 will fail silently. In CI (`CI=true`) this is fine because `reuseExistingServer` is `false`. The bug only affects local dev, but it's a silent failure with no error message pointing at the root cause.

2. **Test comment inaccuracy — Test 2**: `tests/gameplay.spec.ts:19–29` — The comment says "Sends left ×3, right ×2, rotate ×1" but the first `ArrowLeft` is consumed by the state-machine keydown handler to dismiss the start screen (returns early without `stopImmediatePropagation`, so `setupInput` never sees that first key). Only 2 ArrowLefts actually reach game input. The test still passes because the assertion (`hud-score` visible) is weak, but the comment now lies about what the test does.

3. **Missing E2E test for acceptance criterion R6**: The spec acceptance criteria explicitly requires "Pressing Escape after game-over does not show the pause overlay." No test covers this. The three new tests (6–8) test start, start→game, and pause/resume, but the game-over + ESC interaction is untested at the E2E layer. The guard exists in code (`if (gameState.over) return` at `main.js:113` and `togglePause()` at `gameState.js:132`), but the spec's own acceptance checklist lists this as a required verification.

4. **`stopImmediatePropagation` not called on start-screen dismiss** (informational — not a MUST-FIX): `main.js:106–125` — The state-machine handler calls `startGame()` and returns, but does not call `e.stopImmediatePropagation()`. This means `setupInput`'s handler runs on the same keydown event. For `KeyP`, this means pressing `P` to dismiss the start screen simultaneously sets `gameState.paused = true` via `setupInput`, leaving the game paused with no pause overlay shown. This is a narrow edge case not covered by the spec; the PLAN explicitly excludes it from scope. Informational only.

5. **AGENTS.md — missing caveat on `reuseExistingServer` in E2E note**: `AGENTS.md:23` — The new note says "VITE_TEST_HOOKS=true is set automatically via playwright.config.ts webServer.env" but doesn't warn that a locally-running preview server will be reused (skipping the build step). A developer who has `npm run preview` open will get silent test failures.

6. **README.md — pre-existing stale text not cleaned up** (out of spec scope): `README.md:11` — Features section still says "board Z-rotates" — Phase 4 changed this to Y-axis rotation. The spec's documentation scope was AGENTS.md, CLAUDE.md, and the README controls/E2E sections only. This stale text predates Phase 6 and was not in scope. Informational only.

### Spec Compliance Checklist

- [x] R1: `#start-overlay` visible on page load, game not ticking — `index.html:164`, `main.js:94–101`
- [x] R2: Any key or click dismisses start overlay and begins game loop — `main.js:106–127`
- [x] R3: ESC during active play calls `togglePause()` and shows pause overlay — `main.js:120–124`
- [x] R4: Any key while paused calls `togglePause()` and hides pause overlay — `main.js:114–118`
- [x] R5: Game loop continues calling RAF while paused; `update(dt)` is a no-op — confirmed by `gameState.js:78`
- [x] R6: ESC during game-over does not show pause overlay — guarded at `main.js:113` and `gameState.js:132`
- [x] R7: `window.__gameState` gated behind `VITE_TEST_HOOKS=true || DEV` — `main.js:38–40`; `playwright.config.ts:34`
- [x] R8: All Vitest unit tests pass (no engine changes made)
- [x] R9: AGENTS.md corrected — `rotation.z` → `rotation.y` with negative sign — `AGENTS.md:124`
- [x] Phase 5 stale comment fixed in tests 3–5 — `gameplay.spec.ts:43, 78, 114`
- [x] Tests 3–5 dismiss start screen before board injection — `gameplay.spec.ts:42, 77, 113`
- [x] 3 new E2E tests (6–8) added — `gameplay.spec.ts:152–197`
- [x] CLAUDE.md Phase 6 Conventions section added — `CLAUDE.md:101–106`
- [x] README.md Escape in controls table — `README.md:35`
- [x] README.md `VITE_TEST_HOOKS` auto-set note — `README.md:59–60`
- [ ] Test for acceptance criterion "ESC after game-over does not show pause overlay" — NOT tested by any E2E test

---

## Adversarial Test Review

### Summary

Test quality is **adequate**, with targeted weaknesses in Test 2 (comment now misleads about behavior) and a gap for the game-over + ESC acceptance criterion. The three new tests (6–8) use precise assertions (`toBe(true)`, `toBeVisible()`, `toBeHidden()`, `toHaveText('0')`) consistent with the Phase 5 lesson. Board-injection tests are structurally unchanged and still work.

### Findings

1. **Test comment lies about behavior — Test 2** (`gameplay.spec.ts:19`): Comment says "Sends left ×3, right ×2, rotate ×1." After Phase 6, the state-machine handler intercepts the first `ArrowLeft` to dismiss the start overlay (`startGame()`, then `return`) without calling `e.stopImmediatePropagation()`. Only 2 ArrowLeft presses reach `setupInput`. The assertion is `hud-score` visible — a weak check that passes regardless. The test still functions as a crash check, but the comment is factually wrong and will mislead future maintainers.

2. **Missing test for R6 acceptance criterion** (`gameplay.spec.ts`): The spec acceptance checklist at SPEC.md:59 says "Pressing Escape after game-over does not show the pause overlay." No test exercises this path. Tests 4 and 5 trigger game-over, but neither attempts an ESC after. With the current code, the guard at `main.js:113` prevents the issue, but it goes unverified.

3. **Test 7: `Space` triggers `hardDrop()` silently** (`gameplay.spec.ts:165`): `Space` is used to dismiss the start screen, but since `e.stopImmediatePropagation()` is not called, `setupInput`'s handler also sees the `Space` event and calls `hardDrop()`. The test comment does not acknowledge this. The PLAN noted it as acceptable ("A hard drop on an empty board can't cause game-over"), but the test comment should document the side effect so future readers understand why `Space` (rather than a neutral key like `F1`) was chosen here.

4. **`waitForFunction` in Tests 3–5 is now a no-op check** (`gameplay.spec.ts:44, 79, 115`): With `VITE_TEST_HOOKS=true` baked into the build, `window.__gameState` is assigned synchronously at module evaluation. By the time `page.waitForFunction(() => window.__gameState !== undefined)` executes (after the previous `page.keyboard.press` async op completes), the value is already set. The wait passes immediately and provides no real synchronization value. It's harmless but pointless. A more meaningful guard (e.g., `window.__gameState?.pieceType !== null`) would better confirm the game state is ready for injection.

5. **Test 8: `gameState.paused` checked immediately after ESC, no frame gap** (`gameplay.spec.ts:189`): `page.evaluate` reads `gameState.paused` synchronously on the next evaluation. Since `togglePause()` is synchronous and the RAF loop doesn't affect the `paused` flag, this is safe. No issue — informational only.

6. **No test for `startOverlay.addEventListener('click', startGame)`** (`main.js:127`): The click path for starting the game is wired but not E2E tested. Tests 6–8 all use keyboard. A click-to-start test would be straightforward but is not required by the spec's testing table.

### Test Coverage

- **Vitest unit tests**: 206+ passing (confirmed by MEMORY.md; no engine changes in Phase 6)
- **Engine coverage**: 97%+ maintained (no new engine code)
- **E2E tests**: 8 tests specified; implementation adds tests 6–8 correctly

**Untested scenarios (not required by testing strategy, but gaps vs. acceptance criteria):**
- ESC after game-over does not show pause overlay (R6, acceptance criterion 5)
- Click on `#start-overlay` starts the game
- `KeyP` during start-screen dismiss via `setupInput` creates hidden-paused state (informational)
- Resume key that is also a game-control key (e.g., `ArrowLeft`) fires its game action on resume
