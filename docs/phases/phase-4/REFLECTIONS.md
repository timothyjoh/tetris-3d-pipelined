# Reflections: Phase 4

## Looking Back

### What Went Well

- **Plan-to-implementation fidelity was perfect.** Every task in PLAN.md mapped exactly to the delivered code. No surprises, no scope drift. The camera math was worked out in advance (Z = 26 from FOV geometry), and the implementation matched without adjustment.
- **Race condition root cause was well-understood before coding.** RESEARCH.md traced the exact listener registration order and explained _why_ swapping the order fixes the bug (`held` Set blocks key-repeat restarts). The fix was a 1–2 line change executed with confidence.
- **Tilt sign convention resolved cleanly in research.** Negating `gameState.tiltAngle` for `rotation.y` was derived from first principles in RESEARCH.md and applied in one line at `main.js:112`. No iteration needed.
- **Review caught the false-positive test before it shipped.** The adversarial review correctly identified that Test 4 in `initials-submit.test.js` passed for the wrong reason (blocked by `stopImmediatePropagation`, not by `suppressRestart`). It was deleted, leaving 3 tight, correct tests. The mechanism itself was already correctly covered in `input.test.js:66–71`.
- **All spec acceptance criteria delivered.** PerspectiveCamera, BoxGeometry(0.85, 0.85, 0.85), DirectionalLight, Y-axis tilt, resize handler, race condition fix — all confirmed present.

### What Didn't Work

- **Test 4 was a false positive from the start.** The test was written to verify `suppressRestart` in an environment where `handleInitialsKey`'s `stopImmediatePropagation` would silently block the inner listener first. The test passed for a structural reason unrelated to the code under test. This kind of listener-ordering subtlety is easy to miss when writing integration tests for DOM event systems — the failure mode is invisible (test goes green, wrong reason).
- **Phase 4 commit was not made during the phase.** The git log shows the last commit is `950ab84 Phase 3 complete`; Phase 4 work lives only in the working tree. The pipeline's commit step must handle this, but it creates ambiguity about when the phase actually "landed."
- **SPEC said camera Z "~18 units" but plan calculated 26.** The spec value was an inherited estimate that was wrong for a 50° FOV covering a 20-row board. The plan corrected it with camera math, so no harm done — but the spec contained a stale number that could have confused an implementer who followed it literally without checking.

### Spec vs Reality

- **Delivered as spec'd:** PerspectiveCamera (FOV 50°, Z=26); BoxGeometry(0.85, 0.85, 0.85); Z center=0.425; roughness=0.4; DirectionalLight(0xffffff, 1.0) at (5,10,10); `rotation.y` tilt with negation; resize handler updated; Enter-key race condition fixed; `initials-submit.test.js` (4 tests → 3 after MUST-FIX); `vitest.config.js` updated.
- **Deviated from spec:** Camera Z = 26 rather than spec's "~18" — plan correctly overrode the spec value with derived camera math. Test count dropped from 4 → 3 in `initials-submit.test.js` after deleting the false positive; final total is 206 tests (not 207).
- **Deferred:** Nothing in scope was deferred.

### Review Findings Impact

- **False-positive Test 4 identified:** Deleted from `initials-submit.test.js`; 206 tests now pass. Coverage of `suppressRestart` is correctly delegated to `input.test.js:66–71` — no gap in actual coverage.
- **Spec Z-value discrepancy noted:** Confirmed the implementation (Z=26) is correct and the spec value ("~18") was a stale estimate. No code change required; noted for future spec hygiene.

---

## Looking Forward

### Recommendations for Next Phase

- **Playwright setup will require environment configuration decisions up front.** Headless browser, Chromium vs Firefox, video codec/format for artifacts — resolve these in the research step, not during implementation. Video capture in CI is notoriously finicky.
- **Define "gameplay recording" concretely in the spec.** The brief says "automated gameplay recording via video capture" — the spec writer must decide: scripted input sequence? Duration? What triggers start/stop of recording? What constitutes a passing visual test vs a flaky one? Ambiguity here will cause scope creep.
- **Continue the pattern of pre-derived constants.** Phase 4's camera math in PLAN.md prevented mid-implementation uncertainty. For Playwright, pre-derive expected pixel coordinates, timing windows, and acceptable visual diff thresholds before coding.
- **Watch for test flakiness in timing-dependent e2e tests.** Tetris involves gravity ticks and animations at fixed intervals. Playwright tests that depend on exact timing (e.g., "piece lands after N ms") will be brittle. Design tests to use logical game state assertions over pixel-perfect timing assertions where possible.

### What Should Next Phase Build?

**Phase 5: Playwright E2E Testing & Gameplay Video Recording**

Based on BRIEF.md, Phase 5 is the next logical step. All 7 game features are now implemented and passing unit tests. The remaining gap is automated e2e validation with video artifacts.

Scope priorities:
1. **Playwright installation and config** — add `@playwright/test`, configure `playwright.config.js` for Chromium, enable video recording on all tests.
2. **Core gameplay e2e test** — scripted input sequence: start game, move pieces, let lines clear, reach game over. Assert on DOM state (score display, game-over overlay visible).
3. **Leaderboard flow e2e test** — game over → type initials → submit → leaderboard table visible.
4. **Video artifact capture** — confirm `.webm`/`.mp4` files are written to `test-results/` directory on each run.
5. **CI integration** — if a `vercel.json` or GitHub Actions workflow exists, ensure `npx playwright test` runs and artifacts are uploaded.

Phase 6 (start screen, pause, resume) should follow Phase 5 so that e2e tests can cover those flows when they land.

### Technical Debt Noted

- **Test 4 deletion leaves a comment gap.** `initials-submit.test.js` now has 3 tests with no explanation of why `suppressRestart` is intentionally not tested here. A one-line comment pointing to `input.test.js:66–71` would prevent future contributors from adding another false-positive test to "cover" the gap.
- **`rotation.z` is never reset explicitly.** It defaults to 0, which is correct, but there's no assertion or guard ensuring it doesn't drift if future code touches it. Low risk, worth noting.
- **Board background/grid Z compatibility was verified visually only** — no automated test guards against depth-fighting regression if geometry Z values change.

### Process Improvements

- **Spec Z-values and constants should be derived, not estimated.** The "~18 units" camera Z in the spec was a guess that was silently wrong. Specs should either omit implementation constants (leaving them to the plan) or require the math to be shown inline.
- **Integration tests for DOM event systems need listener-order analysis.** Before writing any test that registers multiple `keydown` listeners, explicitly document the listener firing order and which `stopPropagation`/`stopImmediatePropagation` calls will affect other listeners. This prevents false-positive tests like Test 4.
- **Phase commit should be gated by the pipeline, not deferred.** The review noted "no Phase 4 commit yet." The pipeline should enforce a commit before the phase is marked complete — not leave it to the next step.
