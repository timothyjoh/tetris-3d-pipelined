# Phase Review: Phase 3

## Overall Verdict

NEEDS-FIX — 1 critical issue, 5 minor issues. See MUST-FIX.md.

---

## Code Quality Review

### Summary

The implementation is largely solid. All five spec features (tilt fix, sweep fix, leaderboard engine, overlay redesign, jsdom test setup) are present and structurally correct. The build is clean, 201 tests pass, and engine coverage is 97.2%. One critical runtime bug exists in `main.js`: pressing Enter to submit initials also immediately triggers a game restart, making the leaderboard confirmation screen invisible to the user.

### Findings

1. **Critical — Enter key race condition**: `main.js` registers `handleInitialsKey` (line 76) before `setupInput` (line 85). When all 3 initials are typed and Enter is pressed, `handleInitialsKey` fires first and calls `submitInitials()`, which sets `initialsActive = false`. The `setupInput` listener fires immediately after in the same event dispatch — it evaluates `!suppressRestart()` as `!initialsActive` = `!false` = `true`, and calls `handleRestart()`. The game restarts before the user can read the leaderboard table. — `src/main.js:57-85`

2. **Minor — `loadLeaderboard`/`saveLeaderboard` are completely untested**: The coverage report confirms 0% line coverage on lines 35–46 of `leaderboard.js` (78.04% file-level). The PLAN deliberately excludes these from unit tests ("thin wrappers, verified manually"), but the SPEC requires "all new leaderboard pure functions at 100% branch coverage" — that requirement is met. The untested lines represent real logic (JSON parse, try/catch) that could fail silently if `localStorage` is unavailable or corrupted. — `src/engine/leaderboard.js:34-46`

3. **Minor — Potential XSS in `showLeaderboard`**: `tr.innerHTML` concatenates `entry.initials` and `entry.score` directly. Initials are validated to `/^[A-Z0-9]$/` at input time, so the normal insertion path is safe. However, `loadLeaderboard()` reads raw JSON from `localStorage` with no re-validation — a user who manually edits their localStorage could inject HTML. Severity is low for a local game, but the pattern is worth flagging. — `src/hud/hud.js:107`

4. **Minor — `input.test.js` relies on emergent behavior for isolation**: Each test calls `setupInput`, stacking another `keydown` listener on jsdom's shared `window`. Tests pass because the `held` Set inside each closure silences keys already seen by that listener. Specifically, after test 1 fires `Enter`, listener 1's `held` contains `Enter`; in test 6, listener 1 early-returns without calling test 1's stale mock — so test 6's `toHaveBeenCalledOnce()` sees exactly 1 call. This is correct but fragile: if test execution order changes or a test fires a key not previously seen by an older listener, a stale mock could receive an unexpected call. — `src/__tests__/input.test.js:28-78`

5. **Minor — Duplicate test case**: `isTopTen(0, [])` is asserted twice with identical inputs/expectation. — `src/__tests__/leaderboard.test.js:5-7` and `40-42`

6. **Minor — `isTopTen` silently assumes sorted input**: The function accesses `entries[9].score` to compare against the 10th-place entry. If `entries` is not sorted descending, the result is incorrect. In practice, `saveLeaderboard` always writes sorted data, but this assumption is undocumented and untested. — `src/engine/leaderboard.js:8-11`

### Spec Compliance Checklist

- [x] `computeTiltAngle` called with piece center column (`col + width/2`); `TETROMINOES` entries have `width`
- [x] Sweep gates cells by column (`c < Math.floor(sweepProgress * board.cols)`)
- [x] `isTopTen`, `insertScore`, `rankEntries` are pure functions; `loadLeaderboard`/`saveLeaderboard` are thin wrappers
- [x] Leaderboard stored under `tron-tetris-leaderboard` key as JSON array of `{initials, score}`
- [x] `isTopTen` returns `true` when `entries.length < 10`; `true` when score strictly beats 10th; `false` on tie
- [x] `insertScore` returns new sorted array, capped at 10, does not mutate input
- [x] Initials input accepts A–Z / 0–9; auto-advances cursor; Backspace deletes; Enter submits on 3 chars
- [ ] **FAILS** — Initials entry prompt appears only on qualifying score, then transitions to leaderboard after Enter — the Enter key also triggers restart, so the leaderboard is never visible
- [x] New entry highlighted in ranked table
- [x] Game-over overlay full-screen, Tron aesthetic maintained
- [x] `suppressRestart` option added to `setupInput`; restart correctly blocked during initials entry (unit tested)
- [x] `vercel.json` not needed; documented in `AGENTS.md`
- [x] `npm run build` — no errors or warnings
- [x] All existing tests pass; 201 tests total, all green
- [x] `npm run test:coverage` — 97.2% line coverage on engine modules (≥ 80% threshold passes)
- [x] `AGENTS.md` documents leaderboard API and localStorage key
- [x] `README.md` mentions local leaderboard in features; Deploy section added

---

## Adversarial Test Review

### Summary

Test coverage is strong overall. Pure-function tests for `leaderboard.js` have genuine 100% branch coverage and test all specified edge cases. Sweep and tilt tests are thorough and directly verify spec requirements. The `input.test.js` tests are correctly structured conceptually but have a fragility around listener accumulation (see finding 4 above). The critical race condition in `main.js` is entirely invisible to the test suite — there are no integration tests for the initials→Enter→leaderboard flow.

### Findings

1. **Happy-Path Gap — Enter-to-submit flow not tested**: No test covers the interaction between `handleInitialsKey`'s Enter handling and `setupInput`'s restart handler. The critical bug (finding 1 above) is invisible to the suite. — `src/__tests__/input.test.js` (missing test)

2. **Mock Abuse — None**: Pure function tests use real inputs/outputs. `input.test.js` mocks only the `onRestart` callback, which is appropriate. No over-mocking found.

3. **Boundary Conditions — `isTopTen` edge cases well covered**: Empty list, exactly 9, exactly 10, tie, below threshold — all tested. Good.

4. **Weak assertion — `rankEntries` large-input test checks only first and last**: When `entries.length > 10`, the test verifies index 0 and index 9 but does not verify that the intermediate entries are in descending order. Low priority since the implementation is `[...entries].sort(...).slice(0,10)` which is trivially correct. — `src/__tests__/leaderboard.test.js:159-168`

5. **Integration Gap — `loadLeaderboard`/`saveLeaderboard` round-trip untested**: The SPEC explicitly requires "loadLeaderboard() returns [] on first call (no key); saveLeaderboard(entries) round-trips through JSON correctly." Neither is covered by any automated test. Manual verification is the stated substitute, but this means the try/catch in `loadLeaderboard` is never exercised by the test suite. — `src/engine/leaderboard.js:34-46`

6. **Test Independence — `input.test.js` listeners accumulate across tests**: Covered in Code Quality finding 4. Not a current failure but a maintenance risk.

7. **Duplicate assertion**: `isTopTen(0, [])` appears in two separate `it` blocks with identical content, adding noise without coverage benefit. — `src/__tests__/leaderboard.test.js:5-7, 40-42`

### Test Coverage

```
leaderboard.js  |  78.04%  Stmts  |  100%  Branch  |  60%  Funcs
gameState.js    |  97.80%  Stmts  |  95.31% Branch  |  86.95% Funcs
All engine      |  97.20%  Stmts  |  95.68% Branch  |  88.88% Funcs
```

- 80% line threshold: PASSES (97.2% aggregate)
- `leaderboard.js` branch coverage: 100% (pure functions fully covered)
- `leaderboard.js` function coverage: 60% (`loadLeaderboard`/`saveLeaderboard` never called)

**Missing test cases identified:**
- Full Enter-to-submit flow: `handleInitialsKey` sets `initialsActive=false` then `setupInput` listener fires (the critical bug)
- `loadLeaderboard()` returns `[]` on missing key (SPEC requirement, not tested)
- `saveLeaderboard()` → `loadLeaderboard()` round-trip (SPEC requirement, not tested)
- `isTopTen` with unsorted input (assumption violation)
