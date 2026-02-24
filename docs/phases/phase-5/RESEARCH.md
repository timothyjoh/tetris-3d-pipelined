# Research: Phase 5

## Phase Context

Phase 5 installs Playwright (`@playwright/test`) and writes an end-to-end test suite (`tests/gameplay.spec.ts`) that exercises the full game loop against the Vite production preview server (`npm run preview` at `localhost:4173`). All tests run headless Chromium-only with video recording enabled (`video: 'on'`), producing `.webm` artifacts in `test-results/`. Five test scenarios are required: canvas visible, move/rotate, line-clear via injected board state, game-over overlay, and leaderboard initials submission. Two new npm scripts (`test:e2e`, `test:e2e:ui`) are added to `package.json`. The 206 existing Vitest unit tests must continue to pass, and no game logic or rendering source files are changed (beyond adding `window.__gameState = gameState` to `main.js` as a test hook).

---

## Previous Phase Learnings

From `docs/phases/phase-4/REFLECTIONS.md`:

- **Environment decisions upfront** — resolve Chromium vs other browsers, video format, timing strategy in research/planning, not during implementation. The SPEC already resolves these: Chromium only, `.webm`, assertion-based waits, board-state injection.
- **Test correctness over test count** — Phase 4 deleted a false-positive test. Phase 5 starts with 5 well-defined scenarios with explicit assertions so each passes for the right reason.
- **Pre-derive constants** — for Playwright, determine selectors, inject API, and wait strategies before coding.
- **Listener-order matters for DOM event tests** — `setupInput` must be registered before `handleInitialsKey` (this is already done in main.js).
- **`test-results/` must be in `.gitignore`** — explicit acceptance criterion.
- **Phase 4 commit wasn't made during the phase** — Phase 5 branch carries all Phase 4 work too (no separate commit yet for Phase 4).

---

## Current Codebase State

### Relevant Components

**Entry Point**
- `src/main.js` — RAF game loop, wires all modules. `gameState` variable is declared at line 32 as `let gameState = new GameState()`. No `window.__gameState` exposure exists yet (must be added per SPEC). The loop detects `gameState.over && !prevOver` at line 127 and calls `showOverlay()`.

**Game State API (injectable via `window.__gameState`)**
- `src/engine/gameState.js:22` — `GameState` class. Public fields accessible for injection:
  - `gameState.board` — `Board` instance with `setCell(col, row, color)` and `cells` flat array
  - `gameState.score` — current score (number)
  - `gameState.over` — boolean game-over flag
  - `gameState.pieceType` — active piece type string ('I','O','T','S','Z','J','L') or null
  - `gameState.col` — active piece origin column
  - `gameState.row` — active piece origin row
  - `gameState.rotation` — active piece rotation index (0–3)
- `src/engine/gameState.js:124` — `hardDrop()` method: hard drops piece, calls `_lockPiece()`, triggers line-clear sweep or immediate spawn.
- `src/engine/gameState.js:170` — `_spawnPiece()`: sets `this.over = true` if spawn position is invalid (board.isValid fails). This is the game-over trigger.

**Board API**
- `src/engine/board.js:6` — `Board` class. `BOARD_COLS = 10`, `BOARD_ROWS = 20`.
- `src/engine/board.js:17` — `setCell(col, row, color)`: writes a color value to `cells[row * cols + col]`. Used for injecting pre-filled board state.
- `src/engine/board.js:10` — `cells` is a flat `Array(rows * cols)` initialized to 0 (empty). Non-zero = occupied.
- `src/engine/board.js:52` — `getCompletedRows()`: returns row indices where all 10 cols are non-zero.

**Input Handling**
- `src/input.js:1` — `setupInput(gameState, onRestart, options)` registers `window.addEventListener('keydown', onKeydown)`.
- `src/input.js:21-24` — `Space` key calls `e.preventDefault()` then `gameState.hardDrop()`. This is the hard-drop keybinding for Playwright to use.
- `src/input.js:16` — `ArrowLeft` → `gameState.moveLeft()`
- `src/input.js:17` — `ArrowRight` → `gameState.moveRight()`
- `src/input.js:18` — `ArrowUp` / `KeyX` → `gameState.rotateCW()`

**Tetromino Shapes**
- `src/engine/tetrominoes.js:3-79` — All 7 pieces. I-piece at rotation 1 (vertical): shape row cells at col+2 (`[[0,0,1,0],...]`). I-piece at rotation 3: cells at col+1 (`[[0,1,0,0],...]`). `spawnCol` for all pieces is 3.

**HUD DOM Structure**
- `index.html:133` — `<div class="hud-value" id="hud-score">0</div>` — score element; initial text is `"0"`.
- `src/hud/hud.js:15` — `elScore.textContent = gameState.score.toLocaleString()` — score is formatted via `toLocaleString()`, so score=0 → `"0"`, score=100 → `"100"`.

**Overlay DOM Structure**
- `index.html:148` — `<div id="overlay" class="hidden">` — game-over overlay; starts hidden.
- `index.html:63` — `.hidden { display: none; }` — the CSS rule.
- `src/hud/hud.js:45-49` — `showOverlay(title, score)`: removes `hidden` class from `#overlay`.
- `index.html:149` — `<div id="overlay-title">GAME OVER</div>` — title element.

**Initials Entry DOM**
- `index.html:152` — `<div id="initials-prompt" class="hidden">` — initials prompt; starts hidden.
- `src/hud/hud.js:69-76` — `showInitialsPrompt()`: removes `hidden` from `#initials-prompt`.
- `src/main.js:60-76` — `handleInitialsKey(e)`: handles A–Z / 0–9 / Backspace / Enter. Enter with 3 chars → `submitInitials()`.
- `src/main.js:45-55` — `submitInitials()`: calls `insertScore`, `saveLeaderboard`, then `showLeaderboard(updated, highlightIndex)`.

**Leaderboard DOM**
- `index.html:162` — `<div id="leaderboard-section" class="hidden">` — starts hidden.
- `index.html:164-170` — `<table id="leaderboard-table">` with `<tbody id="leaderboard-body">`.
- `src/hud/hud.js:100-122` — `showLeaderboard(entries, highlightIndex)`: removes `hidden` from `#leaderboard-section`, populates `#leaderboard-body` with `<tr>` rows containing rank, initials, score.

**Game-Over Detection Loop**
- `src/main.js:127-137` — Detected in the RAF loop:
  ```js
  if (gameState.over && !prevOver) {
    showOverlay('GAME OVER', gameState.score);
    const entries = loadLeaderboard();
    if (isTopTen(gameState.score, entries)) {
      initialsActive = true;
      showInitialsPrompt();
    } else {
      showLeaderboard(rankEntries(entries), -1);
    }
  }
  ```
  The overlay becomes visible on the next animation frame after `gameState.over` flips to true.

**Leaderboard Logic**
- `src/engine/leaderboard.js:8` — `isTopTen(score, entries)`: returns true if entries < 10 or score strictly beats 10th. Score=0 qualifies if leaderboard is empty (entries.length < 10).

**Build / Server**
- `vite.config.js:1-4` — Minimal config: `outDir: 'dist'`, `target: 'esnext'`, `chunkSizeWarningLimit: 600`.
- `package.json:9` — `"preview": "vite preview"` — serves `dist/` at `localhost:4173` by default.
- `package.json:10` — `"test": "vitest run"` — runs all Vitest unit tests.
- No `test:e2e` or `test:e2e:ui` scripts exist yet.

**Test Infrastructure**
- `vitest.config.js:1-19` — Vitest config; `include: ['src/__tests__/**/*.test.js']`; `environment: 'node'`; jsdom overrides for 3 test files; coverage on `src/engine/**`.
- No `playwright.config.ts` exists.
- No `tests/` directory exists.

**`.gitignore`**
- `.gitignore` does not exist in the project root. Must be created (or confirmed absent) — `test-results/` must be listed there per SPEC acceptance criteria.

---

### Existing Patterns to Follow

**Board state injection pattern (from unit tests)**
- `src/__tests__/gameState.test.js:53-60` — Tests fill board cells directly via `gs.board.setCell(c, row, color)` before triggering game logic. This is the same API Playwright will use via `window.__gameState.board.setCell(...)`.

**jsdom test pattern**
- `src/__tests__/initials-submit.test.js:1` — `// @vitest-environment jsdom` directive at top; uses `window.dispatchEvent(new KeyboardEvent(...))` to simulate input. Playwright uses real browser events instead.

**Vitest test structure**
- All test files use `describe` / `it` / `expect` from `vitest`. Named exports from engine modules are imported directly. Playwright will use `@playwright/test`'s `test` / `expect` instead.

**ES Modules**
- `package.json:4` — `"type": "module"`. All src files are ES modules. Playwright config should use `.ts` extension (TypeScript) per SPEC.

**Deterministic GameState construction**
- `src/engine/gameState.js:23` — `constructor({ firstPiece, secondPiece } = {})` — accepts override pieces. Used throughout unit tests to control which piece spawns. In E2E tests, piece control happens via `window.__gameState.pieceType` / `.col` / `.rotation` direct assignment after page load.

---

### Dependencies & Integration Points

- **Three.js `^0.170.0`** — runtime dependency; rendering only, no impact on Playwright tests.
- **Vite `^6.0.0`** — builds to `dist/`, serves via `npm run preview` at `localhost:4173`. Playwright's `webServer` block must start this server.
- **Vitest `^2.0.0`** — unit test runner; must remain unaffected by Playwright addition.
- **`jsdom ^28.1.0`** — used by Vitest for DOM-dependent unit tests; Playwright uses real Chromium instead.
- **`@vitest/coverage-v8 ^2.0.0`** — coverage reporter; unaffected by Phase 5.
- **`localStorage`** — leaderboard persistence. In Playwright, each test gets a fresh browser context; localStorage starts empty. A score of 0 qualifies for the top-10 leaderboard when the board has fewer than 10 entries (see `isTopTen`, leaderboard.js:9).

---

### Test Infrastructure

**Framework**: Vitest v2 for unit tests (206 tests); Playwright (`@playwright/test`) to be installed for E2E.

**Test file locations**:
- Vitest unit tests: `src/__tests__/*.test.js`
- Playwright E2E (to be created): `tests/gameplay.spec.ts`

**Playwright config (to be created)**: `playwright.config.ts` at project root.

**Test patterns in unit tests**:
- `describe` / `it` / `expect` from `vitest`
- `beforeEach` / `afterEach` for setup/teardown
- Direct import of engine modules
- jsdom `window.dispatchEvent(new KeyboardEvent(...))` for input simulation

**Coverage**: `vitest.config.js:11-17` — V8 coverage on `src/engine/**`; threshold 80% lines; reports to `coverage/`. Phase 4 achieved ~97.2% engine coverage.

**Current test count**: 206 passing (3 in `initials-submit.test.js` after deleting a false positive in Phase 4).

---

## Code References

- `src/main.js:32` — `let gameState = new GameState()` — the variable to expose as `window.__gameState`
- `src/main.js:86` — `setupInput(gameState, handleRestart, ...)` — registered first (before handleInitialsKey)
- `src/main.js:87` — `window.addEventListener('keydown', handleInitialsKey)` — initials key handler
- `src/main.js:127-137` — game-over detection and overlay display in RAF loop
- `src/input.js:21-24` — `case 'Space': e.preventDefault(); gameState.hardDrop(); break;` — hard drop keybinding
- `src/engine/board.js:17` — `setCell(col, row, color)` — board injection API
- `src/engine/board.js:4` — `BOARD_COLS = 10`, `BOARD_ROWS = 20`
- `src/engine/gameState.js:170-185` — `_spawnPiece()` — sets `over = true` when spawn blocked
- `src/engine/gameState.js:124-129` — `hardDrop()` — guard: `if (paused || over) return`
- `src/engine/leaderboard.js:8-11` — `isTopTen()` — score=0 qualifies when leaderboard has <10 entries
- `src/hud/hud.js:15` — `elScore.textContent = gameState.score.toLocaleString()` — score text format
- `src/hud/hud.js:45-49` — `showOverlay()` — removes `hidden` class from `#overlay`
- `src/hud/hud.js:100-122` — `showLeaderboard()` — populates `#leaderboard-body` tbody rows
- `index.html:129` — `<canvas id="game-canvas">` — canvas element
- `index.html:133` — `<div id="hud-score">0</div>` — initial score text is `"0"`
- `index.html:148` — `<div id="overlay" class="hidden">` — game-over overlay
- `index.html:152` — `<div id="initials-prompt" class="hidden">` — initials prompt
- `index.html:162` — `<div id="leaderboard-section" class="hidden">` — leaderboard section
- `index.html:164` — `<table id="leaderboard-table">` — leaderboard table
- `index.html:63` — `.hidden { display: none; }` — hidden class definition
- `package.json:6-12` — existing npm scripts (no `test:e2e` or `test:e2e:ui` yet)
- `vite.config.js:1-4` — minimal Vite config, no special preview port override
- `vitest.config.js:1-19` — Vitest config, `include` pattern won't pick up `tests/*.spec.ts`

---

## Open Questions

1. **SPEC contradiction on `src/` modification**: The acceptance criterion says "No game source files (`src/`) are modified," but the SPEC body explicitly directs adding `window.__gameState = gameState` to `src/main.js`. Plan must clarify which interpretation governs (the body text takes precedence; the acceptance criterion likely means no logic/rendering changes beyond the test hook line).

2. **Score element initial value**: `#hud-score` starts as `"0"` in HTML but is immediately updated by `updateHud()` on the first RAF frame. For the "canvas visible" test, the spec asserts it reads `"0"` — this should hold since score starts at 0, and `(0).toLocaleString()` = `"0"`.

3. **I-piece injection for column 0**: The SPEC describes hard-dropping a vertical I-piece into column 0. The I-piece rotation 3 shape `[[0,1,0,0],...]` places cells at `originCol + 1`. To land in col 0, `originCol` must be set to -1. `board.isValid()` checks actual cell positions (col 0 is in bounds), so origin -1 with cells at col 0 may be valid — this needs verification during planning. Alternatively, rotation 1 places cells at `originCol + 2`, requiring `originCol = -2`, which may not be valid.

4. **Game-over score and `isTopTen`**: The game-over injection test will result in a score likely at 0 (no lines cleared before injecting the topping-out board). Score 0 qualifies for top-10 if localStorage is empty (`entries.length < 10`). The leaderboard flow test follows the game-over test — if tests share browser storage, earlier scores may affect this. Playwright typically gives each `test` a fresh context by default unless configured otherwise.

5. **`test-results/` directory**: The `.gitignore` file does not currently exist. It must be created (or verified it doesn't need creating if Playwright generates it) as part of Phase 5 deliverables.

6. **TypeScript for `playwright.config.ts`**: The SPEC calls for a `.ts` config file. The project has no TypeScript setup; Playwright bundles its own TS runner so this should work without adding `tsc` or `ts-node` as dependencies — but this is worth confirming during planning.
