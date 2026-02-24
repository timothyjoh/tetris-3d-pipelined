# Implementation Plan: Phase 5

## Overview
Install Playwright (`@playwright/test`), configure it for Chromium-only headless runs with video recording, and write five end-to-end tests that exercise the full game loop against the Vite production preview server — producing `.webm` video artifacts on every run.

## Current State (from Research)

- **207 Vitest unit tests passing** (MEMORY.md says 207; RESEARCH says 206 — trust the actual count from `npm test`)
- `package.json` has no `test:e2e` or `test:e2e:ui` scripts
- No `playwright.config.ts` exists; no `tests/` directory exists
- No `.gitignore` exists — must create it
- `src/main.js:32` — `let gameState = new GameState()` — no `window.__gameState` exposure yet
- `window.__gameState` is the ONLY required change to `src/`
- All DOM selectors verified: `#game-canvas`, `#hud-score`, `#overlay`, `#initials-prompt`, `#leaderboard-section`, `#leaderboard-body`
- Score starts at `"0"` (via `(0).toLocaleString()`)
- Hard-drop keybinding: `Space` (from `src/input.js:21`)
- `handleInitialsKey` at `src/main.js:59` calls `e.key.toUpperCase()` then tests `/^[A-Z0-9]$/` — lowercase keyboard events are accepted
- Enter key check uses `e.code === 'Enter'` (not `e.key`)

## Resolved Open Questions

**Q1 — `src/` modification contradiction**: The SPEC body takes precedence. Adding `window.__gameState = gameState` to `src/main.js` is the only required source change. "No game source files modified" in the acceptance criteria means no logic or rendering changes.

**Q2 — Score initial value**: `(0).toLocaleString()` = `"0"`. The `#hud-score` reads `"0"` on load. ✓

**Q3 — I-piece vertical in column 0 (line-clear test)**:
I-piece rotation 3 shape: `[[0,1,0,0],...]` — cells at `originCol+1` for all 4 rows.
Set `col = -1`, `rotation = 3` → actual cells land at column 0.
`board.isValid()` checks actual cell positions (col 0 is in bounds); origin -1 is never checked directly. ✓
Board injection: fill rows 16–19, cols 1–9 (36 cells). I-piece falls freely through col 0 (empty), locking at `originRow = 16`, cells at `(0,16)`, `(0,17)`, `(0,18)`, `(0,19)`. All 4 rows become complete (col 0 from piece + cols 1–9 from injection = 10 per row). 4 lines clear → score = `LINE_SCORES[4] × level 1 = 800`. ✓

**Q4 — Game-over injection**:
O-piece spawn shape: `[[0,1,1,0],[0,1,1,0],...]` — cells at `originCol+1` and `originCol+2`.
O-piece `spawnCol = 3` → spawn cells at `(4,0)`, `(5,0)`, `(4,1)`, `(5,1)`.
Strategy: pre-fill exactly those 4 board cells; set `nextPieceType = 'O'`; set active piece (O) at `col=0, row=0, rotation=0`. The active piece occupies `(1,0),(2,0),(1,1),(2,1)` — no overlap with pre-filled cells. Hard-drop sends O to `row=18`, locking at `(1,18),(2,18),(1,19),(2,19)`. No rows are complete. `_spawnPiece()` runs immediately and tries to place O at col 3 → cell `(4,0)` is occupied → `board.isValid()` fails → `this.over = true`. On next RAF frame: `showOverlay()` is called → `#overlay` becomes visible. ✓

**Q5 — `.gitignore`**: Does not exist. Must create with `test-results/` and `playwright-report/` entries.

**Q6 — TypeScript config file**: Playwright bundles its own esbuild runner for `.ts` config files. No additional `tsc` or `ts-node` dependency is needed. Works with `"type": "module"` in `package.json`. ✓

**Q7 — Sweep animation timing**: Line clears trigger a 150 ms sweep animation (`SWEEP_DURATION_MS = 150`). Score is NOT updated synchronously with `hardDrop()` — it's updated in `_finalizeSweep()` after the animation. Use assertion-based wait (`expect(locator).not.toHaveText('0', { timeout: 5000 })`) to handle this. ✓

**Q8 — `page.evaluate()` atomicity**: All board injection + `hardDrop()` runs inside a single `page.evaluate()` call, which is synchronous from the browser's perspective. The RAF loop cannot interleave. No race condition is possible. ✓

## Desired End State

After Phase 5 is complete:
- `npm install` installs `@playwright/test` and downloads Chromium without error
- `npm run build && npm run test:e2e` exits 0, all 5 Playwright tests pass
- `test-results/` contains at least one `.webm` file after a run
- `npm run test:e2e:ui` launches Playwright UI mode (manual check)
- `npm test` (Vitest) still reports the same number of passing unit tests, 0 failures
- No game logic or rendering code has changed (only one line added to `src/main.js`)

New files created: `playwright.config.ts`, `tests/gameplay.spec.ts`, `.gitignore`
Modified files: `src/main.js` (1 line), `package.json` (2 scripts), `CLAUDE.md`, `README.md`, `AGENTS.md`

## What We're NOT Doing

- No Firefox or WebKit tests — Chromium only
- No GitHub Actions / CI pipeline changes
- No visual regression / pixel-diff comparisons
- No performance or load testing
- No start screen, pause, or resume UI (Phase 6)
- No changes to game logic, rendering, or audio code (beyond the `window.__gameState` hook)
- No TypeScript compilation setup (`tsc`, `ts-node`) — Playwright handles `.ts` config internally
- No separate Playwright browser project for mobile or HiDPI viewports
- `node_modules/`, `dist/`, `coverage/` are already excluded from git (or if not, leave them — only `test-results/` and `playwright-report/` are required by SPEC)

## Implementation Approach

Tasks proceed in a strict order of dependencies:
1. **Install and configure Playwright** (Tasks 1–3) — creates the infrastructure
2. **Expose the test hook** (Task 4) — enables board-state injection
3. **Write `.gitignore`** (Task 5) — prevents artifact commits before any test run
4. **Write E2E tests** (Task 6) — the actual test suite
5. **Update documentation** (Task 7) — CLAUDE.md, README.md, AGENTS.md
6. **Verify Vitest still passes** (Task 8) — regression check

No task is optional. Tests are written after the infrastructure is in place so they can be run immediately after authoring.

---

## Task 1: Install `@playwright/test` and Download Chromium

### Overview
Add the Playwright package as a dev dependency and download the Chromium browser binary.

### Changes Required

**Run in terminal:**
```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

**File**: `package.json`
**Changes**: `@playwright/test` will be added to `devDependencies` by the install command. Verify the entry appears.

### Success Criteria
- [ ] `npm install` completes without error
- [ ] `npx playwright install chromium` completes without error
- [ ] `node_modules/@playwright/test` directory exists
- [ ] `ls ~/.cache/ms-playwright/chromium-*` (or equivalent) shows the Chromium binary downloaded

---

## Task 2: Add `test:e2e` and `test:e2e:ui` Scripts to `package.json`

### Overview
Add the two npm scripts required by the SPEC.

### Changes Required

**File**: `package.json`
**Changes** (add to `"scripts"` block):
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

Final scripts block:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

### Success Criteria
- [ ] `npm run test:e2e -- --help` prints Playwright CLI help (verifies the script is wired)
- [ ] `package.json` parses as valid JSON (`node -e "require('./package.json')"`)

---

## Task 3: Create `playwright.config.ts`

### Overview
Configure Playwright: Chromium only, headless, video on, retries 1, HTML reporter, and a `webServer` block that starts `npm run preview` before tests.

### Changes Required

**File**: `playwright.config.ts` (new file, project root)
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'html',
  use: {
    headless: true,
    video: 'on',
    baseURL: 'http://localhost:4173',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
```

Key decisions:
- `timeout: 30_000` — matches SPEC requirement
- `video: 'on'` — records every test
- `retries: 1` — catches transient noise without hiding real failures
- `reporter: 'html'` — produces `playwright-report/`
- `webServer.reuseExistingServer: !process.env.CI` — in dev, reuse any already-running preview server (avoids double-starting); in CI, always start fresh

### Success Criteria
- [ ] `npx playwright test --list` lists tests (even if 0 tests exist yet — no syntax error)
- [ ] Config file is valid TypeScript (Playwright will report errors on parse failure)

---

## Task 4: Expose `window.__gameState` in `src/main.js`

### Overview
Add a single-line test hook so Playwright tests can access and mutate game state via `page.evaluate()`. This is the only `src/` modification in Phase 5.

### Changes Required

**File**: `src/main.js`
**After line 32** (`let gameState = new GameState();`), add:
```js
// Test hook: exposed unconditionally so Playwright E2E tests can inject board state.
// Phase 6 should gate this behind a build flag (e.g. import.meta.env.VITE_TEST_HOOKS).
window.__gameState = gameState;
```

### Success Criteria
- [ ] `npm run build` completes without warnings or errors
- [ ] `npm run preview` serves at `localhost:4173` and the game loads
- [ ] In a browser console: `window.__gameState.score` returns `0` on fresh load
- [ ] `npm test` (Vitest) still reports all unit tests passing

---

## Task 5: Create `.gitignore`

### Overview
Prevent Playwright video artifacts and the HTML report directory from being committed to git.

### Changes Required

**File**: `.gitignore` (new file, project root)
```
# Playwright E2E artifacts
test-results/
playwright-report/

# Build output
dist/

# Dependencies
node_modules/

# Test coverage
coverage/
```

### Success Criteria
- [ ] `git status` does not show `test-results/` or `playwright-report/` as untracked after a test run
- [ ] `git check-ignore test-results/` outputs `test-results/`

---

## Task 6: Write `tests/gameplay.spec.ts`

### Overview
The core deliverable: five E2E test cases covering the full game loop.

### Changes Required

**File**: `tests/gameplay.spec.ts` (new file)

```typescript
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4173';

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Canvas visible
// Confirms Vite build + Three.js boot succeeds; score starts at "0".
// ──────────────────────────────────────────────────────────────────────────────
test('canvas is visible and score starts at zero', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.locator('#hud-score')).toHaveText('0');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Move and rotate
// Sends left ×3, right ×2, rotate ×1; asserts no crash (score element persists).
// ──────────────────────────────────────────────────────────────────────────────
test('move and rotate inputs do not crash the game', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#game-canvas')).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');

  // Game is still running — score element is present
  await expect(page.locator('#hud-score')).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: Line clear increases score
// Inject a near-complete board (rows 16–19, cols 1–9 filled; col 0 open).
// Place a vertical I-piece (rotation 3) at col=-1 so it occupies col 0.
// Hard-drop → 4 complete rows → score goes from "0" to "800" (level 1).
// NOTE: Line clears trigger a 150 ms sweep animation; score updates after it.
// ──────────────────────────────────────────────────────────────────────────────
test('line clear increases score above zero', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#game-canvas')).toBeVisible();

  await page.evaluate(() => {
    const gs = window.__gameState;
    // Fill rows 16–19, cols 1–9 (leaving col 0 open)
    for (let row = 16; row <= 19; row++) {
      for (let col = 1; col <= 9; col++) {
        gs.board.setCell(col, row, 1);
      }
    }
    // I-piece rotation 3: cells at originCol+1 for each of 4 rows
    // originCol=-1 → actual col 0; drops to rows 16–19 → 4 complete lines
    gs.pieceType = 'I';
    gs.rotation = 3;
    gs.col = -1;
    gs.row = 0;
    gs.hardDrop();
  });

  // Wait for sweep animation (150 ms) + RAF frame to update DOM
  await expect(page.locator('#hud-score')).not.toHaveText('0', { timeout: 5000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 4: Game-over overlay appears
// Pre-fill the O-piece spawn cells (4,0),(5,0),(4,1),(5,1).
// Set nextPieceType='O' so _spawnPiece() tries O at spawnCol=3 → invalid → over.
// Active O-piece is placed at col=0 (safe area) and hard-dropped (no line clears).
// On next RAF frame: showOverlay() fires → #overlay becomes visible.
// ──────────────────────────────────────────────────────────────────────────────
test('game-over overlay becomes visible after topping out', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#game-canvas')).toBeVisible();

  await page.evaluate(() => {
    const gs = window.__gameState;
    // Block the O-piece spawn area: cells at (originCol+1, 0–1) with spawnCol=3
    // O-piece rotation 0 shape: [[0,1,1,0],[0,1,1,0],...] → cells at col+1, col+2
    gs.board.setCell(4, 0, 1);
    gs.board.setCell(5, 0, 1);
    gs.board.setCell(4, 1, 1);
    gs.board.setCell(5, 1, 1);
    // Force the next piece to be O so we know exactly what spawns
    gs.nextPieceType = 'O';
    // Place active O-piece at col=0 (occupies cols 1–2, rows 0–1 — no overlap)
    gs.pieceType = 'O';
    gs.col = 0;
    gs.row = 0;
    gs.rotation = 0;
    // Hard-drop: O falls to rows 18–19, no line clears, then _spawnPiece() fails
    gs.hardDrop();
  });

  await expect(page.locator('#overlay')).toBeVisible({ timeout: 5000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 5: Leaderboard flow — game-over → initials → table row
// Same game-over injection as Test 4. Score=0 qualifies for top-10 on a fresh
// localStorage (isTopTen(0, []) → true). Type "AAA", press Enter, assert row.
// handleInitialsKey calls e.key.toUpperCase(), so lowercase 'KeyA' events work.
// Enter check uses e.code === 'Enter'.
// ──────────────────────────────────────────────────────────────────────────────
test('submitting initials shows leaderboard row with entered initials', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Trigger game over (same injection as Test 4)
  await page.evaluate(() => {
    const gs = window.__gameState;
    gs.board.setCell(4, 0, 1);
    gs.board.setCell(5, 0, 1);
    gs.board.setCell(4, 1, 1);
    gs.board.setCell(5, 1, 1);
    gs.nextPieceType = 'O';
    gs.pieceType = 'O';
    gs.col = 0;
    gs.row = 0;
    gs.rotation = 0;
    gs.hardDrop();
  });

  // Wait for overlay AND initials prompt (both shown in the same RAF frame)
  await expect(page.locator('#overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#initials-prompt')).toBeVisible({ timeout: 5000 });

  // Type three-character initials using logical key names
  // e.key.toUpperCase() in handleInitialsKey accepts lowercase 'a' from KeyA
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('Enter'); // e.code === 'Enter' triggers submitInitials()

  // Leaderboard section becomes visible with a row containing "AAA"
  await expect(page.locator('#leaderboard-section')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#leaderboard-body')).toContainText('AAA');
});
```

### Board-State Injection Reference

| Test | Injection | Expected result |
|------|-----------|-----------------|
| 3 | Rows 16–19 cols 1–9; I rot=3 col=-1 | 4 lines cleared → score = 800 |
| 4 | Cells (4,0)(5,0)(4,1)(5,1); nextPiece=O; active O at col=0 | `over = true` → overlay visible |
| 5 | Same as Test 4 | overlay → initials prompt → leaderboard row |

### Success Criteria
- [ ] All 5 tests pass with `npm run build && npm run test:e2e`
- [ ] `test-results/` contains at least one `.webm` file
- [ ] No `page.waitForTimeout()` calls anywhere in the spec
- [ ] Tests are deterministic — no flakiness on repeated runs

---

## Task 7: Update Documentation

### Overview
Add E2E test instructions to CLAUDE.md, README.md, and AGENTS.md per SPEC requirements.

### Changes Required

**File**: `CLAUDE.md`
**Add section** (append or insert into relevant section):
```markdown
## E2E Tests (Playwright)

Run against the production preview build (must build first):
```bash
npm run build        # required before e2e tests
npm run test:e2e     # headless Chromium, video recording on
npm run test:e2e:ui  # Playwright UI mode (manual verification)
```
Video artifacts are written to `test-results/` (gitignored).
```

**File**: `README.md`
**Add section** (E2E Tests):
```markdown
## E2E Tests

End-to-end tests run against the Vite production preview server using Playwright.

```bash
npm run build       # build production bundle first
npm run test:e2e    # run all E2E tests (headless Chromium)
```

Video recordings of each test run are saved to `test-results/` (excluded from git).

To open the HTML report after a run:
```bash
npx playwright show-report
```
```

**File**: `AGENTS.md`
**Add to "How to run tests" section**:
```markdown
- `npm run test:e2e` — Playwright E2E tests (requires `npm run build` first; runs headless Chromium)
```

### Success Criteria
- [ ] Each of the three files mentions `npm run test:e2e`
- [ ] Each mentions that `npm run build` must run first
- [ ] No broken markdown syntax

---

## Task 8: Verify Vitest Unit Tests Still Pass

### Overview
Regression check — confirm that adding `@playwright/test` and the `window.__gameState` hook have not broken any unit tests.

### Changes Required
None — this is a verification-only task.

### Verification Steps
```bash
npm test
```

### Success Criteria
- [ ] Same number of unit tests pass as before Phase 5 (zero failures)
- [ ] No new warnings in the Vitest output
- [ ] Coverage thresholds still satisfied (97%+ engine coverage from Phase 4)

---

## Testing Strategy

### Unit Tests (Vitest)
- No new unit tests are written in Phase 5 — the E2E suite covers the integration layer
- All existing 206+ unit tests must continue to pass
- Coverage must remain at or above Phase 4 baseline (97%+ engine)

### E2E Tests (Playwright)
- **Framework**: `@playwright/test`, Chromium only, headless
- **Server**: `npm run preview` at `localhost:4173` (must build first)
- **Video**: `video: 'on'` — every test generates a `.webm` in `test-results/`
- **Anti-flakiness**:
  - Board state injected via `page.evaluate()` (synchronous — no RAF interleave)
  - No `page.waitForTimeout()` — all waits are assertion-based
  - Gravity timing is bypassed entirely by directly setting `col/row/pieceType/rotation`
  - `retries: 1` catches transient noise
- **Mocking**: None — real Chromium browser, real production build, real localStorage

### Key Timing Notes
| Action | Mechanism | Wait strategy |
|--------|-----------|---------------|
| Score after line clear | 150 ms sweep animation | `not.toHaveText('0', { timeout: 5000 })` |
| Overlay after game over | Next RAF frame (~16 ms) | `toBeVisible({ timeout: 5000 })` |
| Initials prompt | Same RAF frame as overlay | `toBeVisible({ timeout: 5000 })` |
| Leaderboard section | Synchronous after Enter press | `toBeVisible({ timeout: 5000 })` |

---

## Risk Assessment

- **`window.__gameState` not available in production build**: Mitigated — the line is added unconditionally, not behind `import.meta.env.DEV`. The production Vite build will include it.

- **O-piece spawn coords assumption wrong**: Verified from `tetrominoes.js`: O shape is `[[0,1,1,0],[0,1,1,0],...]` so cells at `spawnCol+1=4` and `spawnCol+2=5`, rows 0–1. Pre-filling (4,0),(5,0),(4,1),(5,1) guarantees spawn failure.

- **I-piece col=-1 rejected by `board.isValid()`**: Verified — `isValid()` checks actual cell positions (col 0) not origin. Col 0 is in bounds. ✓

- **Sweep animation delay causes Test 3 to time out**: `SWEEP_DURATION_MS = 150`. The wait uses `timeout: 5000`. 150 ms + a few RAF frames << 5000 ms. Not a real risk.

- **`handleInitialsKey` rejects `KeyA` press event**: Mitigated — `e.key.toUpperCase()` is called first; `page.keyboard.press('KeyA')` sends `{key: 'a', code: 'KeyA'}`, which uppercases to `'A'` and matches `/^[A-Z0-9]$/`. ✓

- **`Enter` key not recognized by `handleInitialsKey`**: The handler checks `e.code === 'Enter'`. `page.keyboard.press('Enter')` sends `{code: 'Enter'}`. ✓

- **`"type": "module"` causes TypeScript config issues**: Playwright's built-in esbuild handles `.ts` config files independently of Node.js module resolution. Confirmed compatible with `"type": "module"`.

- **`test-results/` committed to git**: Mitigated by Task 5 (`.gitignore`). Run `.gitignore` creation before any test run.

- **Playwright `webServer` starts before `dist/` exists**: The `webServer` command is `npm run preview` which fails if `dist/` doesn't exist. The SPEC and README document that `npm run build` must run first. `reuseExistingServer: !process.env.CI` makes dev iteration faster.

- **Score of 0 does not qualify for leaderboard (Test 5)**: From `src/engine/leaderboard.js`: `isTopTen(score, entries)` returns true when `entries.length < 10`. Each Playwright test gets a fresh browser context, so localStorage is empty. `isTopTen(0, [])` → `[].length < 10` → `true`. ✓
