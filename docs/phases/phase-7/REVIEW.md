# Phase Review: Phase 7

## Overall Verdict

NEEDS-FIX — see MUST-FIX.md

One critical deliverable (Vercel production deploy + live URL in README.md) is incomplete. All code changes are correct and all tests pass, but the phase's primary BRIEF.md closure criterion remains unmet.

---

## Code Quality Review

### Summary

The code changes in this phase are clean, minimal, and correct. The `stopImmediatePropagation` fix is implemented exactly as specified. Documentation updates to AGENTS.md and CLAUDE.md are accurate and thorough. The only failure is operational: `vercel --prod` was never run, so R1 and R2 are unmet.

### Findings

1. **Incomplete Deliverable — Vercel deploy never executed**: `README.md:20` reads `[Production URL — to be added after Vercel deploy]`. No actual Vercel URL was captured or recorded. MEMORY.md confirms the CLI was not authenticated during the build session. R1 ("Running `vercel --prod` produces a deployed URL") and R2 ("The live production URL is recorded in README.md") are both unmet. This is the single remaining BRIEF.md criterion the phase was designed to close.

2. **`stopImmediatePropagation` implementation correct**: `src/main.js:111–112` (start-dismiss), `src/main.js:119–122` (pause-resume), `src/main.js:127–130` (ESC-pause) all correctly call `e.stopImmediatePropagation()`. The game-over guard at line 115 correctly does NOT call it. The pattern is consistent with `handleInitialsKey` at lines 70, 75, 83. ✓

3. **`waitForFunction` guard has a logical flaw — minor, low risk**: `tests/gameplay.spec.ts:46,82,119` now use `(window as any).__gameState?.pieceType !== null`. When `__gameState` is `undefined`, the optional-chain short-circuits to `undefined`, and `undefined !== null` evaluates to `true` — the guard passes immediately even if `__gameState` has not been set. In practice this edge case cannot occur (the module sets `window.__gameState` synchronously at evaluation time before any test code runs), so there is no observable test failure. However, the guard is logically inverted for the "not set" case — it provides no protection if `VITE_TEST_HOOKS` were ever absent.

4. **R4 documentation gap**: R4 requires that "A Vitest test or updated E2E comment documents" that pressing `P` on the start screen starts the game without leaving it paused. The code comment inside `src/main.js:109–110` mentions `P` as an example, but no E2E test comment explicitly covers the `P` key start-screen scenario. Test 7's comment describes `Space` specifically. The requirement is technically satisfied by the inline code comment, but narrowly.

5. **Click path lacks `stopImmediatePropagation` — intentionally correct**: `src/main.js:133` `startOverlay.addEventListener('click', startGame)` does not call `stopImmediatePropagation`. This is correct — `stopImmediatePropagation` is only relevant for events where multiple listeners on the same target could conflict. A `click` event on the overlay has no competing keydown listeners. ✓

6. **AGENTS.md documentation correct and complete**: The "State-Machine Keydown Handler Discipline" section at `AGENTS.md:108–123` accurately describes the pattern, the rationale, and the non-consuming-branch exception. ✓

7. **CLAUDE.md Phase 7 Addition accurate**: `CLAUDE.md:107–111` correctly documents the `stopImmediatePropagation` addition and its implications for future key bindings. ✓

### Spec Compliance Checklist

- [x] **R3**: `e.stopImmediatePropagation()` called in all three consuming branches of state-machine handler — `src/main.js:112, 121, 129`
- [x] **R5**: `waitForFunction` guards in Tests 3–5 use `?.pieceType !== null` — `tests/gameplay.spec.ts:46, 82, 119`
- [x] **R6**: Test 7 has a code comment accurately describing post-fix `Space` behavior — `tests/gameplay.spec.ts:164–166`
- [x] **R7**: Test 10 exercises click-to-start path — `tests/gameplay.spec.ts:252–266`
- [x] **R8**: README.md Features section describes Y-axis tilt — `README.md:10`
- [x] **R9**: All 206+ Vitest unit tests pass (12 test files, all `failed: false` in results.json)
- [x] **R10**: 10 Playwright E2E tests implemented (9 existing + Test 10)
- [ ] **R1**: `vercel --prod` produces a deployed URL — **NOT DONE** (`README.md:20` has placeholder)
- [ ] **R2**: Live production URL recorded in README.md — **NOT DONE** (placeholder only)
- [ ] **R4**: Pressing `P` on the start screen starts the game without leaving it paused — behavior is implemented correctly but no E2E test or test comment explicitly documents the `P`-key case (Test 7 covers `Space`, not `P`)

---

## Adversarial Test Review

### Summary

Test quality is **adequate to strong** for what is tested. Assertions use exact values throughout (`toBe(true)`, `toBe(false)`, `toHaveText('800')`). Board injection tests are well-constructed. The main weakness is that Tests 8 and 9 still use the pre-Phase-7 `!== undefined` guard (intentionally out of scope per PLAN), and Test 10's `waitForFunction` does not confirm the game loop has ticked — only that `over === false` holds, which is an acceptable proxy.

### Findings

1. **Tests 8, 9 use stale `!== undefined` guard**: `tests/gameplay.spec.ts:190, 215` still use `window.__gameState !== undefined`. The PLAN explicitly scoped guard upgrades to Tests 3–5 only, so this is intentional. Flagged for completeness: the inconsistency is visible and could confuse future maintainers.

2. **Test 10 `waitForFunction` does not confirm game loop tick**: `tests/gameplay.spec.ts:260–263` checks `gs !== undefined && gs.over === false`. Like the old guard, `gs !== undefined` passes synchronously. The guard is sufficient for Test 10's assertion (game is live and not over), but does not confirm the RAF loop has run. Given that `gameState.over` is only ever `false` at startup (game loop hasn't crashed), the assertion is valid — just not as rigorous as it could be.

3. **Test 7 `waitForFunction` uses `!gs.over` not `?.pieceType !== null`**: `tests/gameplay.spec.ts:175–178` — again, out of scope per PLAN but inconsistent with the upgraded pattern.

4. **Test 2 assertion is weak**: `tests/gameplay.spec.ts:30` asserts only that `#hud-score` is visible after move/rotate inputs. This confirms no JS crash occurred, but does not verify that the piece actually moved. Acceptable for a smoke test.

5. **No failure-path tests for click-to-start (Test 10)**: No test verifies that a second click on the overlay (after game starts) is a no-op. `startGame()` is guarded by `if (gameStarted) return` (idempotent), but no test exercises this guard. Minor omission.

6. **No test for P-key start-screen behavior (R4)**: The `stopImmediatePropagation` fix prevents `P` from leaving the game paused on start, but no E2E test or even a targeted comment in an existing test verifies this. The SPEC says "A Vitest test or updated E2E comment documents this behavior." Only the inline code comment in `main.js` covers it.

7. **Tests 3–5 board injection verified against real behavior**: The I-piece rot=3, col=-1 injection correctly fills rows 16–19 col 0 and the O-piece spawn-block scenario is well-documented. No concerns with injection logic.

8. **Assertion quality is strong overall**: `toHaveText('800')` (Test 3), `toBe(true)` / `toBe(false)` (Tests 8, 9), `toContainText('AAA')` (Test 5), `toBe(false)` (Test 10). No `toBeTruthy()` or weak assertion patterns.

### Test Coverage

- **Vitest**: 12 test files, all passing (206+ tests). No new unit tests added (correct per PLAN — no new engine code).
- **Playwright**: 10 tests defined. Tests 1–10 present. All tests have meaningful assertions.

**Missing test cases identified:**

| Gap | Severity | Notes |
|-----|----------|-------|
| P-key on start screen (R4) | Minor | Behavior is correct; documentation only in code comment |
| Second click on start overlay (idempotency) | Minor | `startGame()` is guarded; low risk |
| `stopImmediatePropagation` unit test | Minor | SPEC/PLAN explicitly say E2E coverage is sufficient |
| Production smoke check | Blocked | Cannot automate — no live URL exists yet |
