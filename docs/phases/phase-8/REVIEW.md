# Phase Review: Phase 8

## Overall Verdict

**NEEDS-FIX** — see MUST-FIX.md

Two issues require attention: one BLOCKING (Test 11 false-positive risk) and one
NON-BLOCKING (R6 mute-button inconsistency). Everything else is solid.

---

## Code Quality Review

### Summary

The Phase 8 implementation is well-structured and closely follows the PLAN. All
major features are present: mute flag on `GameState`, M-key binding, audio gating,
HUD button, `src/input-touch.js` module, responsive CSS, and documentation updates.
The code reads cleanly and mirrors existing patterns.

### Findings

1. **R6 inconsistency — mute button blocked during game-over but M key is not**:
   `src/main.js:139–144` gates the `#mute-btn` click handler with
   `gameStarted && !gameState.paused && !gameState.over`. This means clicking the
   mute icon while the game-over overlay is showing is a silent no-op. The M key,
   however, reaches `setupInput`'s switch (the state-machine handler does NOT call
   `stopImmediatePropagation()` on the `gameState.over` branch — correctly per the
   discipline). SPEC R6 permits toggling audio "during active play **or game over**",
   so the button click behaviour diverges from both the spec and the keyboard
   behaviour. `src/main.js:140`

2. **Redundant `updateMuteIndicator` call on button click**: The click handler
   (`src/main.js:142`) calls `updateMuteIndicator(gameState.muted)` directly, but
   `updateHud(gameState)` (called every RAF frame, `src/main.js:187`) already calls
   `updateMuteIndicator` unconditionally. On the very next frame after a click the
   indicator would update even without the direct call. Harmless double-update on
   the click frame only. `src/main.js:142`, `src/hud/hud.js:25`

3. **Auto-repeat dispatch does not check `isActive()`**: In `src/input-touch.js`,
   the `setInterval` callback (`line 42`) calls `dispatch(activeTouchAction)` without
   the `isActive()` guard. Protection comes from `gameState._tryMove()` / `hardDrop()`
   / etc. guarding on `paused`/`over` internally — so there are no correctness bugs.
   But the interval keeps firing until `touchend`/`touchcancel` even after game-over
   or pause. The PLAN comment said `isActive()` protects dispatch in the interval; that
   comment was inaccurate (the protection is at the engine level, not the module level).
   Minor resource concern only. `src/input-touch.js:42`

### Spec Compliance Checklist

- [x] **R1** — `#touch-controls` with 5 buttons (←, ↑, ↓, →, ⬛) in `index.html`; CSS media query shows on touch/≤768px
- [x] **R2** — Touch buttons dispatch game actions via `setupTouchInput`; auto-repeat on ← / → (300ms delay, 80ms interval); `{ passive: false }` + `preventDefault()` prevents scroll
- [x] **R3** — `setupInput` (keyboard) and `setupTouchInput` (touch) registered independently; keyboard unaffected
- [ ] **R4** — `gameState.muted = false` class field; M-key toggles it; HUD shows 🔊/🔇; `restart()` does not reset `muted`. **Partial gap**: see R5 note — muted persists ✅, flag exists ✅, M-key works during active play and game-over ✅
- [x] **R5** — `#mute-btn` in HUD is tappable; `#mute-panel` has `pointer-events: auto`; min 44×44px tap target
- [ ] **R6** — Audio blocked on start screen ✅ and pause overlay ✅. **Gap**: mute button click is also blocked during `gameState.over` (`src/main.js:140`), though R6 explicitly permits toggling during game-over. M-key path is correct. See Finding #1.
- [x] **R7** — Tests 8, 9, 10 now use `waitForGameReady(page)` (rigorous two-condition form)
- [x] **R8** — Mobile CSS at 390×844 present; `#app` flex-column; canvas fills remaining height; HUD compact top-right; `#next-canvas` hidden
- [x] **WCAG 2.5.5** — `.tc-btn` min 56×56px; `#mute-btn` min 44×44px
- [x] **Documentation** — CLAUDE.md, README.md (Controls table), AGENTS.md all updated per SPEC
- [x] **Mute unit tests** — 5 tests in `src/__tests__/mute.test.js` (4 from PLAN + 1 bonus R4 persistence test)
- [x] **`hasTouch: true`** in `playwright.config.ts` — required for `page.touchscreen.tap()`
- [x] **`waitForGameReady` helper** — defined at top of `tests/gameplay.spec.ts`; used in Tests 3–5, 8–14

---

## Adversarial Test Review

### Summary

Test coverage is **adequate but has one structural weakness**. The mute unit tests
are minimal (they test a boolean flag, which is all there is to test at the unit
level — acceptable). The E2E tests are mostly well-written, but Test 11 has a
false-positive path: the assertion can pass even when the touch-left feature is
completely non-functional.

### Findings

1. **BLOCKING — Test 11 false-positive on broken touch**: `tests/gameplay.spec.ts:302`
   asserts `expect(colAfter).toBeLessThanOrEqual(colBefore)`. If the touch event never
   fires (broken registration, `isActive()` returning false, `passive: true` preventing
   the event, etc.), `colAfter === colBefore` and `colBefore <= colBefore` is trivially
   true — the test passes. The assertion cannot distinguish "touch worked, piece was at
   wall" from "touch did nothing at all." This is the only automated coverage of the
   touch-left feature. `tests/gameplay.spec.ts:296–303`

2. **NON-BLOCKING — Test 12 non-deterministic piece type**: `tests/gameplay.spec.ts:316–323`
   asserts `expect(rotAfter).not.toBe(rotBefore)`. For any piece type spawned at the
   top-center position, rotation from state 0 should succeed (wall kicks have room at
   spawn). In practice this is reliable, but rotation is random-piece-dependent. If a
   future game variant spawns pieces at extreme columns, this could flake. Low risk with
   the current spawn positions.

3. **NON-BLOCKING — No E2E test for touch soft-drop (↓ button)**: SPEC AC states "Tapping ↓
   triggers soft drop (piece moves down faster)" as an acceptance criterion. The PLAN's
   Task 7 testing list (Tests 11–14) does not include a soft-drop E2E test, but the AC
   is unverified by automation. `SPEC.md:41` acceptance criterion vs `tests/gameplay.spec.ts`
   (no test for `data-action="softDrop"`).

4. **NON-BLOCKING — Mute unit tests are logic-only (no gating behavior coverage)**: The
   4 mute unit tests verify the boolean flag on `GameState`. They correctly do not test
   `main.js`'s audio gating (requires `AudioContext`, DOM). The R4-persistence test is a
   good addition. The "soundEvents queue still exists when muted" test (`mute.test.js:23`)
   tests that `soundEvents` is an Array — a type assertion that would pass even on
   a fresh instance without any muting. Not wrong, but its value is marginal.
   `src/__tests__/mute.test.js:23–30`

5. **NON-BLOCKING — Test 7 guard not upgraded (by design)**: `tests/gameplay.spec.ts:189–192`
   uses `gs !== undefined && !gs.over` — the partially-stale form. SPEC R7 explicitly
   excludes Test 7 from the debt fix, and the PLAN confirms this. No action required.

### Test Coverage

- **Vitest unit tests**: 211 passing (5 new mute tests added to prior 206 baseline)
- **Playwright E2E**: 14 passing (4 new touch/mute tests; Tests 8, 9, 10 guards upgraded)
- **Engine coverage**: unchanged from Phase 7 (mute is a class field, not engine logic)

### Missing Test Cases (from SPEC AC)

| SPEC AC | Tested? |
|---------|---------|
| Touch ← moves piece left | Yes — but assertion is weak (see Finding #1) |
| Touch ↑ rotates piece | Yes — strong assertion |
| Touch ⬛ hard drops piece | Yes — strong assertion |
| Touch mute icon toggles audio | Yes — strong assertion |
| Touch ↓ triggers soft drop | **NO** — gap in automated coverage |
| Page does not scroll on touch | No — requires manual or layout test |
| No horizontal overflow at 390×844 | No — requires visual regression |
| Keyboard works with touch overlay visible | No dedicated test (covered implicitly by Tests 1–10 running at default viewport, but not at mobile viewport) |
