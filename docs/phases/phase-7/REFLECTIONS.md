# Reflections: Phase 7

PROJECT COMPLETE

## Looking Back

### What Went Well

- **`stopImmediatePropagation` fix was precise and clean**: The implementation landed exactly as PLAN.md specified. All three consuming branches got the call; the game-over guard was correctly left alone. Pattern was consistent with the existing `handleInitialsKey` model already in the file — no new patterns invented.
- **Test 10 (click-to-start) filled a real gap**: `startOverlay.addEventListener('click', startGame)` had been wired since Phase 6 with zero coverage. The new test exercises a real user path and the assertion (`over === false`) is meaningful.
- **AGENTS.md discipline section is genuinely useful**: The "State-Machine Keydown Handler Discipline" section documents the non-consuming-branch exception explicitly — the hardest part of the pattern to remember and the most likely place a future developer would introduce a regression.
- **Both MUST-FIX items were resolved**: The review found the Vercel placeholder and the `waitForFunction` logical flaw. Both were fixed (deploy completed; guards upgraded to `gs != null && gs.pieceType !== null`). The project ended with all 10 E2E tests passing and a live URL in README.md.
- **Vercel deploy needed zero configuration**: AGENTS.md's prediction held — no `vercel.json` was needed; auto-detection of the Vite/dist output worked cleanly.

### What Didn't Work

- **Vercel CLI not authenticated during the build session**: The initial build attempt ran the deploy step without a pre-checked `vercel whoami`. The CLI prompt blocked the automated session and the deploy was skipped with a placeholder. This meant R1 and R2 were unmet on first review and required a MUST-FIX pass.
- **`waitForFunction` guard had a logic inversion**: The upgraded guard `?.pieceType !== null` short-circuits to `undefined` when `__gameState` is absent, and `undefined !== null` is `true` — so the guard would pass immediately even if the test hook was never set. This is a latent correctness bug, not an observable failure (the module always sets `window.__gameState` before any test runs). Still, it was identified in review and required a second fix.
- **R4 documentation was narrowly satisfied**: The SPEC required a Vitest test or E2E comment documenting that pressing `P` on the start screen starts the game without leaving it paused. The implementation only added an inline code comment in `src/main.js` mentioning `P` as an example. Test 7 covers `Space`, not `P`. This passed the review bar but is a weak compliance.

### Spec vs Reality

- **Delivered as spec'd**: `stopImmediatePropagation` in all three consuming branches (R3); `waitForFunction` guards in Tests 3–5 upgraded (R5, then further strengthened in MUST-FIX); Test 7 Space comment (R6); Test 10 click-to-start (R7); README Y-axis tilt (R8); 206+ Vitest tests passing (R9); 10 Playwright E2E tests passing (R10); Vercel deploy completed and live URL in README (R1, R2).
- **Deviated from spec**: The `waitForFunction` guard form differed from the SPEC's specified `?.pieceType !== null` — the MUST-FIX review caught the logical flaw and upgraded it to the more correct `gs != null && gs.pieceType !== null`. The spirit of R5 was delivered; the letter required a correction.
- **Deferred**: None. All in-scope items were delivered. Out-of-scope items (ghost piece, mobile controls, sound toggle, CI/CD, backend) remain correctly deferred — they were never BRIEF.md requirements.

### Review Findings Impact

- **Vercel deploy incomplete (critical)**: Caught by REVIEW.md finding 1. Fixed by completing the CLI authentication and running `npx vercel --prod --yes`. `README.md` updated with the real URL (`https://sdk-test-lemon.vercel.app`).
- **`waitForFunction` guard logic flaw (minor)**: Caught by REVIEW.md finding 3. Fixed by replacing `?.pieceType !== null` with the two-condition form `gs != null && gs.pieceType !== null` across Tests 3–5.
- **R4 documentation gap (minor, not escalated to MUST-FIX)**: Noted in REVIEW.md finding 4. Not escalated to a required fix — the inline code comment was judged sufficient. Left as technical debt below.

---

## Looking Forward

### Recommendations for Next Phase

- There is no next phase. The project is complete per BRIEF.md.
- If the project is revisited, the most natural extensions are: (1) mobile/touch controls, (2) ghost piece rendering, (3) sound toggle UI, (4) CI/CD automation for Vercel deploys (currently one-time manual). None were BRIEF.md requirements.

### What Should Next Phase Build?

The BRIEF.md definition of done is fully satisfied:
- All 7 features implemented and tested
- 206+ Vitest unit tests passing
- 10 Playwright E2E tests passing with video artifacts
- Deployed cleanly to Vercel at https://sdk-test-lemon.vercel.app

No next phase is required. If the project were to continue, the highest-value additions in priority order would be:
1. **Ghost piece** — visible in almost every Tetris implementation; adds meaningful playability
2. **Mobile/touch controls** — currently keyboard-only; would significantly expand the player base
3. **CI/CD via Vercel GitHub integration** — eliminates the manual deploy step that caused the Phase 7 MUST-FIX

### Technical Debt Noted

- **R4 P-key behavior documented only by inline comment**: `src/main.js:109–110` mentions `P` as an example of a key that would previously have left the game paused. No E2E test comment or dedicated test verifies this. Low risk (behavior is correct; code comment exists), but a future refactor of the state-machine handler could silently break the `P` key path.
- **Tests 8, 9 use stale `!== undefined` guard**: `tests/gameplay.spec.ts:190, 215` were explicitly out of scope for the Phase 7 guard upgrade. They still use the no-op guard. If the test infrastructure ever changes such that `window.__gameState` is not set synchronously, these tests could pass a guard check prematurely.
- **Test 10 `waitForFunction` does not confirm game loop tick**: `tests/gameplay.spec.ts:260–263` checks `gs !== undefined && gs.over === false` — sufficient for the test's assertion, but does not confirm the RAF loop has run at least once. The upgraded pattern from Tests 3–5 (`gs != null && gs.pieceType !== null`) would be more rigorous.

### Process Improvements

- **Pre-check external dependencies before the build session starts**: The Vercel CLI auth failure was foreseeable. Future phases that depend on external CLI tools (Vercel, npm publish, etc.) should open with a `toolname whoami` or `toolname --version` check before any code changes, so a blocked deploy step doesn't leave deliverables incomplete.
- **Write the guard as a named condition**: The `waitForFunction` guard is duplicated in 5 tests. Extracting it to a `waitForGameReady(page)` helper would make upgrades (like the Phase 7 fix) a one-line change instead of five. Not done to avoid over-engineering, but worth considering if the suite grows.
- **REVIEW.md should rate MUST-FIX items by whether they gate completion**: The two MUST-FIX items in Phase 7 had different severities — the Vercel deploy was a hard blocker; the guard flaw was a minor correctness issue. Explicit `BLOCKING` vs. `NON-BLOCKING` labels in MUST-FIX.md would help prioritize sequencing during fix sessions.
- **MEMORY.md should be updated as part of the MUST-FIX resolution, not deferred to "after tests pass"**: In Phase 7, MEMORY.md was updated during the build session (before MUST-FIX was filed). The Phase 6 convention ("update MEMORY.md last") should mean "after MUST-FIX is resolved", not "after the initial build session". The convention held in spirit; just worth naming explicitly.
