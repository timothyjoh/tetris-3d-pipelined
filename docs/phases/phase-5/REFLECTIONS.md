# Reflections: Phase 5

## Looking Back

### What Went Well
- **WebGL headless discovery documented cleanly**: The `--use-gl=angle` fix for SwiftShader's "BindToCurrentSequence failed" crash was a non-obvious platform issue caught during implementation and immediately recorded in memory. Future contributors won't hit the same wall.
- **Board injection via `page.evaluate()`**: The decision to inject board state synchronously through `window.__gameState` rather than simulating many keystrokes made tests fast, reliable, and deterministic. This is the right pattern for game E2E testing.
- **Research precision**: RESEARCH.md correctly identified the exact line to add `window.__gameState` (`main.js:32`), the DOM selectors (`#hud-score`, `#overlay`, etc.), and the `SWEEP_DURATION_MS = 150` timing — none of these required re-investigation during implementation.
- **All 5 spec tests delivered and passing**: Full acceptance criteria met, 206 Vitest unit tests unaffected, `.webm` video artifacts generated.
- **`page.waitForFunction()` over `waitForTimeout()`**: The spec's prohibition on timeout-based waits was honored; tests wait on real game state, making them robust to machine speed variation.

### What Didn't Work
- **`const BASE` duplication**: `tests/gameplay.spec.ts` hardcodes `const BASE = 'http://localhost:4173'` and uses `page.goto(BASE)` instead of `page.goto('/')`. This duplicates the `baseURL` already set in `playwright.config.ts` and will break if the port changes. The REVIEW.md flagged this but it was not fixed before the phase closed.
- **Stale comment in spec file**: A comment says `window.__gameState` is set "on first RAF frame" — it's set synchronously at module evaluation. Misleads anyone reading the test file.
- **Test 2 assertion is trivially weak**: `expect(page.locator('#hud-score')).toBeVisible()` after key inputs only proves the DOM element still exists, not that the inputs were processed or that the game didn't silently error out. This passed review as "not mandated by spec" but leaves a real gap.
- **Test 3 assertion is imprecise**: `not.toHaveText('0')` will pass even if score is a garbage value like `NaN` or `-100`. The correct assertion is `toHaveText('800')` — the exact Tetris score for a 4-line clear.

### Spec vs Reality
- **Delivered as spec'd**: All 5 tests (canvas, move/rotate, line clear, game-over, leaderboard flow), `playwright.config.ts` (Chromium, headless, video, retries, HTML reporter, webServer), `window.__gameState` exposure, `.gitignore`, `test:e2e` / `test:e2e:ui` scripts, documentation updates.
- **Deviated from spec**: Added `--use-gl=angle` to `launchOptions.args` — not in spec, but required for WebGL to function in headless Chromium on this platform. Correct deviation; without it nothing works.
- **Deferred**: Fixing the three REVIEW.md code-quality issues (BASE duplication, stale comment, weak assertions) was identified but not resolved within this phase.

### Review Findings Impact
- **`const BASE` duplication flagged**: Not fixed. Carry forward to Phase 6 as pre-work or opening task.
- **Stale RAF comment flagged**: Not fixed. Carry forward.
- **Weak Test 2 / imprecise Test 3 flagged**: Not fixed. Phase 6 should strengthen these before adding more tests that might mask regressions.
- **Missing boundary scenarios (4th-char rejection, backspace, non-top-10 path)**: Noted as out of spec scope, validly deferred. Good candidates for Phase 6 if initials/leaderboard logic is touched.

---

## Looking Forward

### Recommendations for Next Phase
- **Fix the three REVIEW.md issues first** before writing any new Phase 6 tests. Weak assertions are landmines — they hide regressions while appearing green. Specifically: replace `const BASE` + `page.goto(BASE)` with `page.goto('/')`, fix the stale comment, change `not.toHaveText('0')` to `toHaveText('800')`.
- **New UI flows need E2E coverage immediately**: Phase 6 adds a start screen and pause/resume. Write Playwright tests for these as part of the same phase, not as a separate cleanup phase — the pattern is now established and the infrastructure is in place.
- **Pause state needs `window.__gameState` exposure**: Ensure `gameState.paused` (or equivalent) is a readable public field so E2E tests can assert on it without scraping the DOM.
- **ESC key handling**: Make sure the existing `src/input.js` key handler pattern is extended consistently — don't introduce a second event listener system.
- **Start screen introduces a new initial app state**: Research will need to check whether `window.__gameState` is set before or after the user clicks "Start." If the game doesn't initialize until start is clicked, tests 3–5 that inject board state will need an extra step to get past the start screen.

### What Should Next Phase Build?
Phase 6 per BRIEF.md: **Start screen, pause (ESC), and resume.**

Specific scope and priorities:
1. **Start screen**: A pre-game overlay (HTML or Three.js) showing game title and a "Press Enter / Click to Start" prompt. Game loop does not begin until dismissed.
2. **Pause on ESC**: ESC key toggles `gameState.paused`; game loop halts (no gravity ticks, no input except ESC); a "PAUSED" overlay is shown.
3. **Resume on ESC**: Second ESC dismisses overlay and resumes the loop from the exact same state.
4. **E2E tests for all three**: start screen visible → dismiss → game active; ESC → paused overlay visible; ESC again → overlay gone, game ticks resume.
5. **Pre-work**: Fix the three REVIEW.md carryover issues in `tests/gameplay.spec.ts` before writing new tests.

This is the final BRIEF.md phase. After Phase 6, the Definition of Done requires a clean Vercel deploy — include `vercel.json` verification and a deploy smoke test if not already present.

### Technical Debt Noted
- **`const BASE` hardcodes port**: `tests/gameplay.spec.ts:4` — duplicates `playwright.config.ts` `baseURL`; will silently break if port changes.
- **Stale comment**: `tests/gameplay.spec.ts` — comment says `window.__gameState` set "on first RAF frame"; actually synchronous at module eval.
- **Weak Test 2 assertion**: `tests/gameplay.spec.ts` test "move and rotate inputs do not crash" — `toBeVisible()` on `#hud-score` is insufficient signal that inputs were processed.
- **Imprecise Test 3 assertion**: `tests/gameplay.spec.ts` test "line clear increases score" — `not.toHaveText('0')` should be `toHaveText('800')`.
- **`window.__gameState` ungated**: `src/main.js:35` — exposed unconditionally; BRIEF noted this should be gated behind a build flag in Phase 6. Low urgency but a production hygiene issue.
- **AGENTS.md stale snippet**: Phase 2 Z-axis rotation description survives despite Phase 4 switching to Y-axis tilt. Out of scope for Phase 5; should be corrected in Phase 6 docs pass.

### Process Improvements
- **Close REVIEW.md findings before the phase commits**: The phase shipped with three known code issues from the reviewer. Treat REVIEW.md as a blocking checklist, not advisory notes. Add an explicit "address all REVIEW findings" step at the end of the implementation plan.
- **Assertion precision is a spec requirement**: Next SPEC.md should explicitly require exact value assertions (e.g., `toHaveText('800')`) rather than leaving assertion strength to the implementer's discretion.
- **One commit per phase**: The git log shows "Phase 5 complete" is not yet committed (changes are in working tree). Establish a norm of committing at end of phase so git log accurately reflects history.
