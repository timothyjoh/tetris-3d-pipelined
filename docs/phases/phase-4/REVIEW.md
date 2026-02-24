# Phase Review: Phase 4

## Overall Verdict

NEEDS-FIX — see MUST-FIX.md (1 minor issue)

---

## Code Quality Review

### Summary

Phase 4 is largely clean and well-executed. The Enter-key race condition is fixed correctly,
the rendering upgrade (PerspectiveCamera, 3D cube geometry, DirectionalLight, Y-axis tilt)
matches the spec and plan exactly, and CLAUDE.md documentation is complete. All 12 test files
pass with no failures. One minor test logic flaw is documented below.

### Findings

1. **Spec Compliance — Camera Z**: SPEC says "positioned ~18 units back on Z" but the PLAN
   calculates Z = 26 (correct math for FOV 50°, 24-unit board height). Implementation uses
   Z = 26, matching the PLAN. The SPEC text was a rough estimate superseded by the PLAN
   calculation. No action needed — implementation is correct.

2. **Race Condition Fix — correct**: `src/main.js:86–87` registers `setupInput` before
   `window.addEventListener('keydown', handleInitialsKey)`. This is exactly the fix described
   in the PLAN. The `stopImmediatePropagation` in `handleInitialsKey` is now harmless (no
   subsequent listeners to block) — correctly noted in the PLAN as a no-op.

3. **Tilt sign convention — correct**: `main.js:112` uses
   `boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle)`. The negation is
   required because `computeTiltAngle` returns negative for left-of-center, but Three.js
   positive Y rotation brings the left edge toward the viewer. Sign derivation matches the
   PLAN's explicit verification.

4. **No stale `rotation.z` residual**: `boardGroup.rotation.z` is never written in Phase 4
   code. Three.js defaults rotation components to 0. No explicit reset needed.

5. **Grid/background Z positions unchanged**: Grid lines remain at Z = 0.02, background plane
   at Z = -0.05. With 3D blocks (back face at Z = 0.000, front face at Z = 0.850), the grid
   sits inside the block volume — hidden by block front faces in occupied cells, visible in
   empty cells. No depth-fighting between grid (Z = 0.02) and block back face (Z = 0.000)
   because they are at distinct Z values. No change needed — matches PLAN's expectation.

6. **Git commit missing**: The SPEC and PLAN (Task 7) require a `"Phase 4 complete"` commit.
   Git status shows all Phase 4 files as modified/untracked with no commit beyond
   `950ab84 Phase 3 complete`. The pipeline's dedicated commit step (step 9) will handle this,
   so it is not blocking, but the build agent did not complete Task 7.

### Spec Compliance Checklist

- [x] Enter-key race condition fixed — `setupInput` registered before `handleInitialsKey` (`main.js:86–87`)
- [x] Leaderboard table shown after Enter with three initials (race fix enables this)
- [x] `PerspectiveCamera` replaces `OrthographicCamera` — `scene.js:29`
- [x] `OrthographicCamera` removed — no reference remains in `scene.js`
- [x] `BoxGeometry(0.85, 0.85, 0.85)` present — `blockPool.js:14`
- [x] `BoxGeometry(0.95, 0.95, 0.1)` removed — not found in codebase
- [x] Block Z center = 0.425 — `blockPool.js:8` (flush with board plane)
- [x] `DirectionalLight(0xffffff, 1.0)` at `(5, 10, 10)` added — `scene.js:13–15`
- [x] `AmbientLight` remains for fill — `scene.js:11`
- [x] `roughness: 0.4` on `MeshStandardMaterial` — `blockPool.js:22`
- [x] `boardGroup.rotation.y` drives tilt — `main.js:112`
- [x] `boardGroup.rotation.z` not written anywhere in game loop — verified
- [x] Tilt negated correctly — `degToRad(-gameState.tiltAngle)` — `main.js:112`
- [x] Resize handler updates `camera.aspect` and calls `updateProjectionMatrix()` — `scene.js:34–37`
- [x] `initials-submit.test.js` created — `src/__tests__/initials-submit.test.js`
- [x] `vitest.config.js` updated with new jsdom entry — `vitest.config.js:8`
- [x] All test files pass (12/12 files, 0 failures)
- [x] CLAUDE.md documents PerspectiveCamera and `rotation.y` tilt — `CLAUDE.md:76–84`
- [ ] `"Phase 4 complete"` git commit — NOT present; pipeline commit step will handle it

---

## Adversarial Test Review

### Summary

Test quality is **adequate** for tests 1–3, which correctly exercise the two-listener
registration pattern and validate the race condition fix. Test 4 is **weak** — it passes for
the wrong reason and does not verify the mechanism it claims to test. The `suppressRestart`
mechanism itself is correctly and independently verified in `input.test.js:66–71`.

### Findings

1. **Test 4 — False positive via stopImmediatePropagation** (`initials-submit.test.js:68–77`):
   The test `'Enter does NOT trigger restart when initialsActive=true (suppressRestart works)'`
   registers a fresh inner `setupInput` (listener C) INSIDE a test that already has
   `setupInput` (listener A) and `handleInitialsKey` (listener B) registered from `beforeEach`.
   Listener registration order when the Enter event fires:
   - A (`setupInput` outer): suppressed; adds 'Enter' to held.
   - B (`handleInitialsKey`): `initialsActive=true`, calls `e.stopImmediatePropagation()`,
     then `submitInitials()`.
   - C (inner `setupInput`): **NEVER FIRES** — blocked by B's `stopImmediatePropagation`.

   `innerOnRestart` is not called because the event never reaches listener C, not because
   `suppressRestart` works. If `suppressRestart` was broken in `setupInput`, this test would
   still pass. The test creates false confidence in the `suppressRestart` mechanism.

   **Mitigating factor**: `input.test.js:66–71` correctly tests `suppressRestart` in isolation
   (no `handleInitialsKey` registered), so the actual mechanism IS covered — just not by this
   test.

2. **Test 3 — Correct and meaningful** (`initials-submit.test.js:61–66`): The
   "fresh Enter after release" scenario correctly verifies that once initials are submitted and
   Enter is released, a new Enter press triggers `onRestart`. This is the positive-path
   regression proof. ✅

3. **Test 2 — Correct regression test** (`initials-submit.test.js:55–59`): The key-repeat
   scenario (`held.has('Enter') = true` blocks repeat) is the critical regression test for the
   Phase 3 bug. Mechanics verified to be correct. ✅

4. **Test 1 — Correct** (`initials-submit.test.js:49–53`): Single Enter press during initials
   calls submit, not restart. The outer `suppressRestart()` blocks restart while
   `handleInitialsKey` submits. Both asserted. ✅

5. **Missing: Enter with fewer than 3 chars** — The test simulation of `handleInitialsKey`
   omits the `initialsChars.length === 3` guard present in the real `main.js:72`. Tests don't
   verify that Enter is a no-op when fewer than 3 chars are entered. This is a gap in the
   integration test's realism, though the real code has the guard. Minor — out of Phase 4's
   stated scope.

6. **Happy-path bias**: All 4 tests assume `gameState.over = true`. No test fires Enter
   during active gameplay (`gameState.over = false`) to verify it is a no-op in that context.
   Covered by `input.test.js:52–57`. Minor — not a gap in coverage, just a gap in this file.

### Test Coverage

- All 12 test files pass, 0 failures (from `node_modules/.vite/vitest/results.json`)
- Engine coverage: 97.2% (unchanged from Phase 3 — no engine code modified)
- `input.test.js`: correctly covers `suppressRestart` mechanism in isolation (`input.test.js:66–71`)
- `initials-submit.test.js`: 4 tests covering the two-listener interaction; test 4 is
  misleading but the critical scenarios (tests 1–3) are sound

---

## Files Reviewed

| File | Status |
|---|---|
| `src/main.js` | ✅ Correct — race fix, Y-axis tilt, clean |
| `src/renderer/scene.js` | ✅ Correct — PerspectiveCamera, DirectionalLight, resize handler |
| `src/renderer/blockPool.js` | ✅ Correct — 0.85³ geometry, Z=0.425, roughness=0.4 |
| `src/renderer/composer.js` | ✅ Unchanged — no depth-fighting changes needed |
| `src/__tests__/initials-submit.test.js` | ⚠️ Tests 1–3 solid; Test 4 misleading |
| `vitest.config.js` | ✅ New jsdom entry added |
| `CLAUDE.md` | ✅ Rendering section complete and accurate |
