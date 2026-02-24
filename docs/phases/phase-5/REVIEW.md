# Phase Review: Phase 5

## Overall Verdict
NEEDS-FIX — see MUST-FIX.md (2 minor issues)

---

## Code Quality Review

### Summary
The implementation is clean and correct. All five spec requirements are delivered.
The only unplanned deviation from the PLAN is the addition of `--use-gl=angle` to
Playwright's launch args (required for WebGL in headless Chromium — without it
SwiftShader fails and `window.__gameState` is never set). That's a legitimate
discovery fix, not a quality problem. No game logic or rendering code was modified
beyond the single `window.__gameState` hook line in `src/main.js`.

### Findings

1. **Redundant URL constant**: `const BASE = 'http://localhost:4173'` is defined at
   `tests/gameplay.spec.ts:3` and used in every `page.goto(BASE)` call. The
   playwright config already sets `baseURL: 'http://localhost:4173'` at
   `playwright.config.ts:11`. Tests should call `page.goto('/')` and let the
   framework resolve the base, so there is a single source of truth for the URL.
   Currently harmless but will silently break if `baseURL` is ever changed in
   config without updating the constant.

2. **Inaccurate comment**: Comments in `tests/gameplay.spec.ts:43`, `77`, and `111`
   read `"Wait for game state to be initialized (set on first RAF frame)"`.
   `window.__gameState` is assigned at `src/main.js:35`, which is synchronous
   module-evaluation code — not inside the RAF callback. The wait guard is correct
   and harmless, but the explanation is wrong. Future maintainers might remove it
   based on the wrong reasoning, or misunderstand the lifecycle.

3. **AGENTS.md stale Phase 2 snippet** (pre-Phase-5 carry-over): `AGENTS.md:123`
   shows `boardGroup.rotation.z = THREE.MathUtils.degToRad(gameState.tiltAngle)` in
   the Phase 2 Additions section. This was superseded in Phase 4 by
   `boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle)`. The
   SPEC did not require updating this stale snippet, but it is misleading
   documentation present in the file that was modified by Phase 5. Flagged here for
   awareness; it is a pre-existing issue outside Phase 5 scope and not included in
   MUST-FIX.

### Spec Compliance Checklist

- [x] **R1** — `playwright.config.ts` sets `use: { video: 'on', headless: true }`,
  `retries: 1`, `reporter: 'html'`, and a `webServer` block
- [x] **R2** — `webServer.url = 'http://localhost:4173'`; Playwright waits for it
  before launching tests
- [x] **R3-1** — Canvas visible + score reads `"0"` on load (`tests/gameplay.spec.ts:9-13`)
- [x] **R3-2** — Move/rotate inputs do not crash the game (`tests/gameplay.spec.ts:19-32`)
- [x] **R3-3** — Line-clear via `page.evaluate()` board injection + score increases
  (`tests/gameplay.spec.ts:41-65`)
- [x] **R3-4** — Game-over overlay becomes visible after topping out
  (`tests/gameplay.spec.ts:74-99`)
- [x] **R3-5** — Leaderboard flow: game-over → "AAA" initials → row visible
  (`tests/gameplay.spec.ts:108-142`)
- [x] **R4** — `test-results/` gitignored; video on for every test
- [x] **R5** — All 5 Playwright tests pass (confirmed in MEMORY.md)
- [x] `npm test` (Vitest) — all 12 test files passing, 0 failures (results.json verified)
- [x] `test:e2e` and `test:e2e:ui` scripts in `package.json`
- [x] `test-results/` listed in `.gitignore`
- [x] `window.__gameState = gameState` added to `src/main.js:35` with Phase 6
  gate comment
- [x] No `page.waitForTimeout()` calls anywhere in spec
- [x] CLAUDE.md, README.md, AGENTS.md all updated with E2E test instructions
- [x] No game logic or rendering files modified beyond `src/main.js`

---

## Adversarial Test Review

### Summary
Test quality is **adequate** — the five scenarios are genuinely integration-level
and not mock-heavy. But two tests have assertion problems: one is so weak it only
proves DOM presence, and one uses a negative assertion that won't catch future
scoring regressions. The injection strategy is sound and deterministic.

### Findings

1. **Trivially weak assertion — Test 2** (`tests/gameplay.spec.ts:31`):
   `await expect(page.locator('#hud-score')).toBeVisible()` proves that the
   `#hud-score` element is present in the DOM — which it always is, regardless of
   whether the keyboard events had any effect on the game. This test passes even if
   `setupInput` was never called or if all three arrow presses were silently dropped.
   The spec says "asserts no crash," which is correct intent, but a trivial DOM
   presence check does not satisfy that — a JS exception could have been thrown and
   caught in the RAF loop without crashing the page. A better assertion would
   verify game state is still live (e.g., `gameState.over === false`).

2. **Weak negative assertion — Test 3** (`tests/gameplay.spec.ts:64`):
   `await expect(page.locator('#hud-score')).not.toHaveText('0', { timeout: 5000 })`
   passes for **any non-zero text** in the score element. If a line-clear bug
   produced a score of `1` instead of `800` (e.g., wrong `LINE_SCORES` lookup), this
   test would still pass. The expected score after a 4-line Tetris at level 1 is
   deterministically `800`. The assertion should be
   `toHaveText('800')` to catch scoring regressions.

3. **Missing boundary scenarios** — No tests cover:
   - Typing a fourth character after 3 initials are entered (character should be
     rejected; the handler enforces `initialsChars.length < 3`)
   - Backspace to delete an initials character
   - A score that does NOT qualify for the leaderboard (the leaderboard section
     should NOT appear; only the base game-over overlay should show)
   These are gaps against the spec's leaderboard flow, but the spec only required
   the happy-path, so they are noted rather than mandated.

4. **Test independence** — Each test navigates via `page.goto(BASE)`, getting a
   fresh browser page with clean localStorage. Tests are fully independent. ✓

5. **No `page.waitForTimeout()` calls** — All waits are assertion-based. ✓

6. **Board injection correctness** — Verified against engine source:
   - Test 3: I-piece rot=3 col=-1 → cells at col 0 for rows 16–19; combined with
     pre-filled cols 1–9, all four rows complete → score 800. ✓
   - Tests 4/5: O-piece spawn blocked at (4,0)(5,0)(4,1)(5,1) →
     `_spawnPiece()` sets `over=true` → overlay appears on next RAF. ✓

### Test Coverage

- E2E tests: 5 scenarios (pass/fail only — no line coverage measured)
- Vitest unit: 12 test files, all passing — 0 failures (per `results.json`)
- Phase 4 engine coverage baseline (97.2%+) preserved — no engine code changed

**Missing test cases identified** (beyond spec minimum):
- Backspace in initials entry
- 4th-character-entry rejection
- Non-top-10 game-over path (leaderboard suppressed)
- Input delivered while `over = true` (hardDrop guard)
