# Implementation Plan: Phase 3

## Overview

Phase 3 completes the Tron Tetris MVP by fixing two spec-deviation debts from Phase 2 (tilt column offset and sweep animation character), adding a `localStorage`-backed local leaderboard with arcade-style 3-character initials entry, redesigning the game-over overlay into a full-screen Tron-styled leaderboard screen, and validating a clean Vercel deployment.

## Current State (from Research)

- **Tilt bug** (`src/main.js:55`): `computeTiltAngle(gameState.col)` uses left-origin column → max ~2.33° instead of ±7°. `TETROMINOES` has no `width` property.
- **Sweep bug** (`src/renderer/render.js:31-34`): All cells in a cleared row fade uniformly — no column gate. Fix is one conditional in the sweep branch.
- **No jsdom environment**: `@vitest/environment-jsdom` is not installed; `vitest.config.js` is `environment: 'node'`. No `input.test.js` exists.
- **No leaderboard module**: `src/engine/leaderboard.js` does not exist. No `localStorage` key in use.
- **Overlay is minimal**: `#overlay` has title, score, and a restart button — no leaderboard table or initials entry UI.
- **Phase 2 uncommitted**: All Phase 2 work exists as unstaged modifications/untracked files.
- **163 tests, 7 files, all passing** at ~460ms; engine coverage ≥ 80%.

## Resolved Open Questions

1. **`TETROMINOES[type].width`**: Add a `width` property to each entry: `I=4`, `O=2`, `T/S/Z/J/L=3` (actual block-span at rotation 0). Call site becomes `gameState.col + TETROMINOES[gameState.pieceType].width / 2`. The O piece has a ~0.5-column center inaccuracy (blocks sit at grid-cols 1–2, not 0–1) — imperceptible for a visual tilt effect.

2. **Leaderboard module location**: Pure functions (`isTopTen`, `insertScore`, `rankEntries`) and `localStorage` wrappers (`loadLeaderboard`, `saveLeaderboard`) all in `src/engine/leaderboard.js`. DOM rendering in `src/hud/hud.js` (extended with new exports).

3. **Overlay redesign scope**: The existing `#overlay` already uses the Tron visual language (neon cyan `#00ffff`, text-shadow glow, dark background, monospace). Extending it with properly styled HTML elements IS the right approach — not Three.js canvas. "Must not be a plain `<div>` drop-in" means it must use the Tron aesthetic, which the existing CSS already provides.

4. **Initials input DOM**: New elements added inside `#overlay` in `index.html`: `#initials-prompt` (3-char slot display) and `#leaderboard-section` (ranked table). Both start hidden; shown based on game-over flow.

5. **jsdom package**: `@vitest/environment-jsdom` — the correct package for Vitest v2.x. Use `environmentMatchGlobs` in `vitest.config.js` to scope jsdom only to `input.test.js`.

6. **Sweep column-gate formula**: The SPEC test case is canonical: at `sweepProgress = 0.5`, column 4 is rendered and column 5 is not. The correct condition is `c < Math.floor(sweepProgress * board.cols)` (strict less-than matches the test; `Math.floor` gives per-column step progression).

7. **Initials entry intercept**: Modify `setupInput` to accept an optional `suppressRestart: () => boolean` option. When `suppressRestart()` is true (initials being entered), Enter/R do not trigger restart. The initials keydown handler is a separate `window.addEventListener` added in `main.js`.

## Desired End State

After Phase 3:
- `src/engine/tetrominoes.js` — each piece has a `width` property
- `src/main.js` — tilt call uses piece center; leaderboard check on game-over; initials orchestration
- `src/renderer/render.js` — column-gated sweep rendering
- `src/input.js` — `setupInput` accepts optional `suppressRestart` option
- `src/engine/leaderboard.js` — new module: `isTopTen`, `insertScore`, `rankEntries`, `loadLeaderboard`, `saveLeaderboard`
- `src/hud/hud.js` — extended with `showInitialsPrompt`, `setInitialChar`, `showLeaderboard`, `resetOverlayUI`
- `index.html` — overlay extended with initials prompt and leaderboard table elements + CSS
- `src/__tests__/leaderboard.test.js` — 100% branch coverage on pure functions
- `src/__tests__/input.test.js` — jsdom environment, covers Enter/R restart + guard
- `vitest.config.js` — `environmentMatchGlobs` added for `input.test.js`
- `package.json` — `@vitest/environment-jsdom` in devDependencies
- `vercel.json` — added if needed (or AGENTS.md documents why it's not)
- `AGENTS.md`, `README.md` — updated with leaderboard API and deploy info

**Verification**: `npm run test` → all tests green; `npm run test:coverage` → ≥ 80% engine coverage; `npm run build` → no errors/warnings; manual browser check: tilt reaches ±7°, sweep is a left-to-right wipe, game-over flow works end-to-end; localStorage entries persist across reload.

## What We're NOT Doing

- Mobile/touch controls
- Online/server-side leaderboard or any backend
- New gameplay mechanics or difficulty settings
- Audio changes
- New Three.js post-processing or canvas-rendered overlay (CSS overlay is correct approach)
- Per-rotation `width` tracking (rotation 0 width is sufficient for the tilt approximation)
- Animated transitions on the overlay (the overlay appears; no slide/fade in)
- Automated E2E tests (per BRIEF.md)

## Implementation Approach

Work proceeds in vertical slices: each slice produces passing tests and verifiable behavior before the next begins. Tech debt fixes come first (before new features), following the Phase 2 reflection directive. Pure functions are implemented and tested before DOM/localStorage wiring. The `input.js` jsdom setup is done as its own slice so the test infrastructure exists before adding initials key handling that also touches `input.js`.

---

## Task 1: Commit Phase 2 Work

### Overview

All Phase 2 files are uncommitted. Create a clean "Phase 2 complete" commit before any Phase 3 changes so `git log` context is usable for future phases.

### Changes Required

**Action**: Stage all Phase 2 modified/untracked files and commit with a descriptive message listing new modules, test count, and spec items addressed.

```bash
git add src/ index.html vitest.config.js vite.config.js package.json AGENTS.md README.md
git commit -m "Phase 2 complete: tilt, sounds, ghost, sweep, lock flash, keyboard restart

New modules: src/engine/tilt.js, src/engine/ghost.js, src/audio/sounds.js
New tests: tilt.test.js (11), ghost.test.js (6), sounds.test.js (9), plus additions
to gameState.test.js and board.test.js — 163 tests total, all passing.
Engine coverage ≥ 80%.

Spec items: board tilt spring animation, 8 synthesized sound effects,
ghost piece rendering, lock flash, line-clear sweep (150ms pause),
keyboard restart (Enter/R), redundant randomPieceType removed.

Known deviations (to be fixed in Phase 3): tilt uses left-origin column
(max ~2.33° not ±7°); sweep is uniform fade not left-to-right wipe."
```

### Success Criteria

- [ ] `git log --oneline -3` shows "Phase 2 complete" as most recent commit
- [ ] `git status` shows clean working tree before Phase 3 changes begin
- [ ] `npm run test` still passes (163 tests)

---

## Task 2: Fix Tilt Center Column

### Overview

`computeTiltAngle` is correct but called with the left-origin column. Adding `width` to `TETROMINOES` and updating the call site in `main.js` restores the spec'd ±7° range. Existing `tilt.test.js` adds a center-column assertion.

### Changes Required

**File**: `src/engine/tetrominoes.js`

Add `width` to each piece definition (actual block-span at rotation 0):

```js
I: {
  color: 0x00ffff,
  spawnCol: 3,
  width: 4,   // ← add
  shapes: [ ... ],
},
O: {
  color: 0xffff00,
  spawnCol: 3,
  width: 2,   // ← add (blocks at grid-cols 1–2)
  shapes: [ ... ],
},
// T, S, Z, J, L: all get width: 3
```

**File**: `src/main.js`

Add `TETROMINOES` import and update tilt call (line 55):

```js
// Add to existing imports:
import { TETROMINOES } from './engine/tetrominoes.js';

// Replace line 55:
// Before: computeTiltAngle(gameState.col)
// After:
const pieceHalfWidth = gameState.pieceType
  ? TETROMINOES[gameState.pieceType].width / 2
  : 0;
const tiltTarget = gameState.justLocked
  ? 0
  : (gameState.pieceType ? computeTiltAngle(gameState.col + pieceHalfWidth) : 0);
```

**File**: `src/__tests__/tilt.test.js`

Add test verifying piece-center column produces values within spec range:

```js
it('I piece at col 0 with center offset produces ~-3.89°', () => {
  // I piece width=4, halfWidth=2; col=0, center=2
  expect(computeTiltAngle(0 + 2)).toBeCloseTo(-3.889, 2);
});

it('T piece at col 0 with center offset produces ~-3.11°', () => {
  // T piece width=3, halfWidth=1.5; col=0, center=1.5
  expect(computeTiltAngle(0 + 1.5)).toBeCloseTo(-3.111, 2);
});

it('center column produces values within ±7° for all piece types', () => {
  const halfWidths = { I: 2, O: 1, T: 1.5, S: 1.5, Z: 1.5, J: 1.5, L: 1.5 };
  for (const [type, hw] of Object.entries(halfWidths)) {
    for (let col = 0; col <= 6; col++) {
      const angle = computeTiltAngle(col + hw);
      expect(Math.abs(angle)).toBeLessThanOrEqual(7);
    }
  }
});
```

### Success Criteria

- [ ] All existing tilt tests pass
- [ ] New center-column tests pass
- [ ] Manual browser check: moving piece left/right produces visibly larger tilt (up to ±7°)

---

## Task 3: Fix Sweep Column Gate

### Overview

Replace the uniform fade in swept rows with a column gate: cells are rendered only if their column index is less than the sweep progress front. Existing behavior (white color, intensity fade) is preserved for visible cells.

### Changes Required

**File**: `src/renderer/render.js` — sweep branch (lines 31–34):

```js
// Before:
} else if (isSweepRow) {
  const intensity = SWEEP_INTENSITY * (1 - gameState.sweepProgress);
  this.pool.addBlock(c, r, 0xFFFFFF, Math.max(0.01, intensity));
}

// After:
} else if (isSweepRow) {
  const sweepFront = Math.floor(gameState.sweepProgress * board.cols);
  if (c < sweepFront) {
    const intensity = SWEEP_INTENSITY * (1 - gameState.sweepProgress);
    this.pool.addBlock(c, r, 0xFFFFFF, Math.max(0.01, intensity));
  }
}
```

**File**: `src/__tests__/` — add `src/__tests__/sweep.test.js` (pure helper test):

Extract the column-gate logic as a pure helper for testability (or test via a direct formula check — no need to instantiate `BoardRenderer`):

```js
// sweep.test.js
import { describe, it, expect } from 'vitest';

// Test the column-gate formula directly (no DOM/Three.js dependency)
function isSweepCellVisible(col, sweepProgress, boardCols) {
  return col < Math.floor(sweepProgress * boardCols);
}

describe('sweep column gate', () => {
  it('at sweepProgress=0.5 column 4 is visible', () => {
    expect(isSweepCellVisible(4, 0.5, 10)).toBe(true);
  });
  it('at sweepProgress=0.5 column 5 is not visible', () => {
    expect(isSweepCellVisible(5, 0.5, 10)).toBe(false);
  });
  it('at sweepProgress=0 no columns are visible', () => {
    expect(isSweepCellVisible(0, 0, 10)).toBe(false);
  });
  it('at sweepProgress=1.0 all columns 0–9 are visible', () => {
    for (let c = 0; c < 10; c++) {
      expect(isSweepCellVisible(c, 1.0, 10)).toBe(true);
    }
  });
  it('at sweepProgress=0.1 only column 0 is visible', () => {
    expect(isSweepCellVisible(0, 0.1, 10)).toBe(true);
    expect(isSweepCellVisible(1, 0.1, 10)).toBe(false);
  });
});
```

Note: `isSweepCellVisible` is not exported from `render.js` (it's inline logic) — the test file tests the formula directly. This is acceptable since the formula is a one-liner.

### Success Criteria

- [ ] All existing tests pass (no regressions)
- [ ] New sweep column-gate tests pass
- [ ] Manual browser check: cleared rows disappear in a visible left-to-right wipe pattern (not a uniform fade)

---

## Task 4: jsdom Setup + `input.test.js`

### Overview

Install `@vitest/environment-jsdom`, configure `vitest.config.js` to use jsdom only for `input.test.js`, and write tests covering the Enter/R restart handler and its game-over guard.

### Changes Required

**Shell command**:
```bash
npm install --save-dev @vitest/environment-jsdom
```

**File**: `vitest.config.js` — add `environmentMatchGlobs`:

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/__tests__/input.test.js', 'jsdom'],
    ],
    include: ['src/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80 },
    },
  },
});
```

**File**: `src/__tests__/input.test.js` — new file:

```js
// @vitest-environment jsdom  (redundant given config, but documents intent)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupInput } from '../input.js';

function makeGameState(over = false) {
  return {
    over,
    moveLeft: vi.fn(),
    moveRight: vi.fn(),
    rotateCW: vi.fn(),
    rotateCCW: vi.fn(),
    startSoftDrop: vi.fn(),
    stopSoftDrop: vi.fn(),
    hardDrop: vi.fn(),
    togglePause: vi.fn(),
  };
}

function fireKey(code, type = 'keydown') {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

describe('setupInput — keyboard restart', () => {
  let onRestart;
  let gameState;

  beforeEach(() => {
    // Remove all listeners from previous test by re-creating the window event
    // target doesn't reset in jsdom between tests, so we track calls via fresh mocks
    onRestart = vi.fn();
    gameState = makeGameState(false);
  });

  it('Enter triggers restart when gameState.over is true', () => {
    gameState.over = true;
    setupInput(gameState, onRestart);
    fireKey('Enter');
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('KeyR triggers restart when gameState.over is true', () => {
    gameState.over = true;
    setupInput(gameState, onRestart);
    fireKey('KeyR');
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('Enter does NOT trigger restart when gameState.over is false', () => {
    gameState.over = false;
    setupInput(gameState, onRestart);
    fireKey('Enter');
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('KeyR does NOT trigger restart when gameState.over is false', () => {
    gameState.over = false;
    setupInput(gameState, onRestart);
    fireKey('KeyR');
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('suppressRestart option prevents restart when returning true', () => {
    gameState.over = true;
    setupInput(gameState, onRestart, { suppressRestart: () => true });
    fireKey('Enter');
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('suppressRestart option allows restart when returning false', () => {
    gameState.over = true;
    setupInput(gameState, onRestart, { suppressRestart: () => false });
    fireKey('Enter');
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
```

**File**: `src/input.js` — add `suppressRestart` option:

```js
export function setupInput(gameState, onRestart, options = {}) {
  const { suppressRestart = () => false } = options;
  const held = new Set();

  window.addEventListener('keydown', (e) => {
    if (held.has(e.code)) return;
    held.add(e.code);

    if ((e.code === 'Enter' || e.code === 'KeyR') && gameState.over && !suppressRestart()) {
      onRestart?.();
      return;
    }

    switch (e.code) {
      case 'ArrowLeft':            gameState.moveLeft();       break;
      case 'ArrowRight':           gameState.moveRight();      break;
      case 'ArrowUp': case 'KeyX': gameState.rotateCW();       break;
      case 'KeyZ':                 gameState.rotateCCW();      break;
      case 'ArrowDown':            gameState.startSoftDrop();  break;
      case 'Space':
        e.preventDefault();
        gameState.hardDrop();
        break;
      case 'KeyP':                 gameState.togglePause();    break;
    }
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (e.code === 'ArrowDown') gameState.stopSoftDrop();
  });
}
```

> **Testing note**: jsdom's `window` persists across tests in the same file. Each `setupInput` call adds additional listeners — tests should be aware they're stacking. Use `vi.fn()` fresh mocks per test and verify call counts. If listener accumulation causes false positives, wrap `setupInput` calls in a fresh module import via `vi.isolateModules` or accept the stacking behavior by using `.toHaveBeenCalledOnce()` with fresh mocks.

### Success Criteria

- [ ] `npm install` adds `@vitest/environment-jsdom` to `node_modules` and `package.json`
- [ ] `npm run test` — all 163+ existing tests still pass; new `input.test.js` tests pass
- [ ] `input.js` tests run in jsdom environment (confirmed by `window.dispatchEvent` working)
- [ ] `suppressRestart` option correctly gates the restart handler

---

## Task 5: Leaderboard Engine Module + Tests

### Overview

Create `src/engine/leaderboard.js` with pure functions (`isTopTen`, `insertScore`, `rankEntries`) and thin `localStorage` wrappers (`loadLeaderboard`, `saveLeaderboard`). Write `src/__tests__/leaderboard.test.js` with 100% branch coverage on pure functions.

### Changes Required

**File**: `src/engine/leaderboard.js` — new file:

```js
const LEADERBOARD_KEY = 'tron-tetris-leaderboard';

/**
 * Returns true if score qualifies for the top-10 leaderboard.
 * A score qualifies if the board has fewer than 10 entries OR it strictly
 * beats the 10th-place score (ties with 10th place do NOT qualify).
 */
export function isTopTen(score, entries) {
  if (entries.length < 10) return true;
  return score > entries[9].score;
}

/**
 * Inserts a new {initials, score} entry into the leaderboard.
 * Returns a new array sorted descending by score, capped at 10 entries.
 * Does not mutate the input array. Ties: the new entry is placed after
 * existing entries of equal score (stable insertion order is preserved).
 */
export function insertScore(initials, score, entries) {
  const updated = [...entries, { initials, score }];
  updated.sort((a, b) => b.score - a.score);
  return updated.slice(0, 10);
}

/**
 * Returns a new array of entries sorted descending by score, max 10.
 * Does not mutate the input array.
 */
export function rankEntries(entries) {
  return [...entries].sort((a, b) => b.score - a.score).slice(0, 10);
}

/** Loads leaderboard from localStorage. Returns [] on first call or parse error. */
export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Saves leaderboard array to localStorage as JSON. */
export function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}
```

**File**: `src/__tests__/leaderboard.test.js` — new file (node environment — pure functions only, no localStorage calls):

```js
import { describe, it, expect } from 'vitest';
import { isTopTen, insertScore, rankEntries } from '../engine/leaderboard.js';

describe('isTopTen', () => {
  it('returns true for empty entries', () => {
    expect(isTopTen(0, [])).toBe(true);
  });

  it('returns true when entries.length < 10', () => {
    const entries = [{ initials: 'AAA', score: 100 }];
    expect(isTopTen(50, entries)).toBe(true);
  });

  it('returns true when score strictly beats 10th place', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 100,
    }));
    // 10th place score = 100; score 101 qualifies
    expect(isTopTen(101, entries)).toBe(true);
  });

  it('returns false when score equals 10th place (tie does not qualify)', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 100,
    }));
    // 10th place score = 100; tie of 100 does not qualify
    expect(isTopTen(100, entries)).toBe(false);
  });

  it('returns false when score is below 10th place', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 100,
    }));
    expect(isTopTen(50, entries)).toBe(false);
  });
});

describe('insertScore', () => {
  it('inserts and sorts correctly into empty array', () => {
    const result = insertScore('ABC', 500, []);
    expect(result).toEqual([{ initials: 'ABC', score: 500 }]);
  });

  it('inserts in correct sorted position', () => {
    const entries = [
      { initials: 'AAA', score: 1000 },
      { initials: 'BBB', score: 500 },
    ];
    const result = insertScore('CCC', 750, entries);
    expect(result[0]).toEqual({ initials: 'AAA', score: 1000 });
    expect(result[1]).toEqual({ initials: 'CCC', score: 750 });
    expect(result[2]).toEqual({ initials: 'BBB', score: 500 });
  });

  it('caps at 10 entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 1000,
    }));
    const result = insertScore('NEW', 99999, entries);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ initials: 'NEW', score: 99999 });
  });

  it('does not mutate the input array', () => {
    const entries = [{ initials: 'AAA', score: 500 }];
    const originalLength = entries.length;
    insertScore('BBB', 600, entries);
    expect(entries).toHaveLength(originalLength);
    expect(entries[0]).toEqual({ initials: 'AAA', score: 500 });
  });

  it('tie: new entry placed after existing entry of equal score', () => {
    const entries = [{ initials: 'OLD', score: 500 }];
    const result = insertScore('NEW', 500, entries);
    expect(result[0]).toEqual({ initials: 'OLD', score: 500 });
    expect(result[1]).toEqual({ initials: 'NEW', score: 500 });
  });

  it('inserting a low score into a full board drops it off the end', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 1000,
    }));
    // This should not be called if isTopTen returns false, but defensive:
    const result = insertScore('LOW', 1, entries);
    expect(result).toHaveLength(10);
    expect(result.find((e) => e.initials === 'LOW')).toBeUndefined();
  });
});

describe('rankEntries', () => {
  it('returns sorted descending by score', () => {
    const entries = [
      { initials: 'CCC', score: 100 },
      { initials: 'AAA', score: 900 },
      { initials: 'BBB', score: 500 },
    ];
    const result = rankEntries(entries);
    expect(result[0].score).toBe(900);
    expect(result[1].score).toBe(500);
    expect(result[2].score).toBe(100);
  });

  it('caps at 10 entries', () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      initials: 'AAA',
      score: i * 100,
    }));
    expect(rankEntries(entries)).toHaveLength(10);
  });

  it('does not mutate the input array', () => {
    const entries = [
      { initials: 'B', score: 100 },
      { initials: 'A', score: 900 },
    ];
    rankEntries(entries);
    expect(entries[0].initials).toBe('B');
  });

  it('returns empty array for empty input', () => {
    expect(rankEntries([])).toEqual([]);
  });
});
```

> **Note on `loadLeaderboard`/`saveLeaderboard` testing**: These use `localStorage` (a browser API). They are NOT tested in `leaderboard.test.js` (node environment). They can be exercised via integration testing in the browser, or if a jsdom test is desired, add a second test file with `@vitest-environment jsdom`. For now, keeping them as thin, obvious wrappers with a try/catch is sufficient — 100% branch coverage on the pure functions is the requirement.

### Success Criteria

- [ ] `src/engine/leaderboard.js` created and exports all 5 functions
- [ ] `src/__tests__/leaderboard.test.js` created; all tests pass
- [ ] 100% branch coverage on `isTopTen`, `insertScore`, `rankEntries`
- [ ] No mutation of input arrays (verified by test)
- [ ] Tie-handling test passes

---

## Task 6: Overlay HTML/CSS Extension

### Overview

Extend `index.html` to add initials-entry and leaderboard-table elements inside `#overlay`. Add CSS for all new elements following the existing Tron neon aesthetic. Both new sections start hidden.

### Changes Required

**File**: `index.html` — extend `#overlay` and add CSS:

Add to the `<style>` block:

```css
/* Initials entry */
#initials-prompt { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.initials-row { display: flex; gap: 12px; }
.init-slot {
  display: inline-block;
  width: 40px;
  height: 50px;
  line-height: 50px;
  text-align: center;
  font-size: 28px;
  letter-spacing: 0;
  border: 1px solid #00ffff;
  box-shadow: 0 0 8px #00ffff44;
}
.init-slot.active {
  border-color: #00ffff;
  box-shadow: 0 0 16px #00ffff, inset 0 0 8px #00ffff22;
  animation: blink 0.8s step-end infinite;
}
@keyframes blink { 50% { border-color: transparent; box-shadow: none; } }

/* Leaderboard table */
#leaderboard-section { display: flex; flex-direction: column; align-items: center; gap: 8px; }
#leaderboard-table {
  border-collapse: collapse;
  font-size: 13px;
  letter-spacing: 0.1em;
  min-width: 240px;
}
#leaderboard-table th {
  font-size: 10px;
  letter-spacing: 0.2em;
  opacity: 0.7;
  padding: 4px 12px;
  border-bottom: 1px solid #00ffff44;
}
#leaderboard-table td {
  padding: 4px 12px;
  text-align: center;
}
.lb-highlight td {
  color: #ffffff;
  text-shadow: 0 0 8px #ffffff, 0 0 16px #00ffff;
  background: #00ffff18;
}
```

Replace the `#overlay` div content:

```html
<div id="overlay" class="hidden">
  <div id="overlay-title">GAME OVER</div>
  <div id="overlay-score"></div>

  <div id="initials-prompt" class="hidden">
    <div class="hud-label">ENTER INITIALS</div>
    <div class="initials-row">
      <span id="init-0" class="init-slot active">_</span>
      <span id="init-1" class="init-slot">_</span>
      <span id="init-2" class="init-slot">_</span>
    </div>
    <div class="hud-label" style="font-size:10px;opacity:0.5">A–Z · 0–9 · BACKSPACE · ENTER</div>
  </div>

  <div id="leaderboard-section" class="hidden">
    <div class="hud-label">TOP 10</div>
    <table id="leaderboard-table">
      <thead>
        <tr><th>#</th><th>NAME</th><th>SCORE</th></tr>
      </thead>
      <tbody id="leaderboard-body"></tbody>
    </table>
  </div>

  <button id="restart-btn">PLAY AGAIN</button>
</div>
```

### Success Criteria

- [ ] HTML is valid (no syntax errors)
- [ ] `npm run build` produces no errors
- [ ] Overlay renders correctly in browser: title + score + restart button always shown; prompt and table hidden initially
- [ ] Tron aesthetic matches existing HUD (neon cyan glow, dark background, monospace)

---

## Task 7: HUD Module — Leaderboard UI Functions

### Overview

Extend `src/hud/hud.js` with functions to drive the new overlay sections: show/update initials prompt, show leaderboard table, reset state for next game over.

### Changes Required

**File**: `src/hud/hud.js` — append new exports:

```js
// --- New leaderboard UI references ---
const initialsPrompt   = document.getElementById('initials-prompt');
const initSlots        = [
  document.getElementById('init-0'),
  document.getElementById('init-1'),
  document.getElementById('init-2'),
];
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardBody    = document.getElementById('leaderboard-body');

/**
 * Shows the initials prompt and resets all slots to '_'.
 * activeCursor: index of the active slot (0–2).
 */
export function showInitialsPrompt() {
  initialsPrompt.classList.remove('hidden');
  leaderboardSection.classList.add('hidden');
  initSlots.forEach((slot, i) => {
    slot.textContent = '_';
    slot.classList.toggle('active', i === 0);
  });
}

/**
 * Updates a single initials slot's character.
 * index: 0–2; char: single character or '_'.
 */
export function setInitialChar(index, char) {
  initSlots[index].textContent = char;
}

/**
 * Updates the active cursor indicator.
 * activeCursor: 0–2 for next-empty slot; 3 = all filled (no active slot).
 */
export function setInitialsCursor(activeCursor) {
  initSlots.forEach((slot, i) => {
    slot.classList.toggle('active', i === activeCursor);
  });
}

/**
 * Hides the initials prompt and shows the leaderboard table.
 * entries: ranked array of {initials, score}; highlightIndex: index to highlight (-1 = none).
 */
export function showLeaderboard(entries, highlightIndex = -1) {
  initialsPrompt.classList.add('hidden');
  leaderboardSection.classList.remove('hidden');
  leaderboardBody.innerHTML = '';
  entries.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('lb-highlight');
    tr.innerHTML = `<td>${i + 1}</td><td>${entry.initials}</td><td>${entry.score.toLocaleString()}</td>`;
    leaderboardBody.appendChild(tr);
  });
}

/**
 * Resets overlay UI to initial state (hides prompt and leaderboard).
 * Called on restart so the next game-over starts fresh.
 */
export function resetOverlayUI() {
  initialsPrompt.classList.add('hidden');
  leaderboardSection.classList.add('hidden');
}
```

Also update the existing `hideOverlay` to call `resetOverlayUI`:

```js
export function hideOverlay() {
  overlay.classList.add('hidden');
  resetOverlayUI();
}
```

### Success Criteria

- [ ] All new exports are accessible from `main.js`
- [ ] `showInitialsPrompt()` shows the prompt with 3 `_` slots and slot 0 active
- [ ] `setInitialChar(i, ch)` updates the correct slot
- [ ] `setInitialsCursor(n)` moves the blink animation to the correct slot
- [ ] `showLeaderboard(entries, highlightIndex)` populates the table with correct rank/name/score
- [ ] The highlighted row has distinct styling (white text, subtle background)
- [ ] `hideOverlay()` also resets prompt/table visibility

---

## Task 8: Wire Leaderboard in `main.js` + Initials Key Handler

### Overview

Replace the simple `showOverlay` call in the game-over detection block with the full leaderboard flow: check `isTopTen`, show initials prompt (if qualifying) or leaderboard directly (if not). Add a `window` keydown listener for initials entry. Update the restart callback to clear initials state.

### Changes Required

**File**: `src/main.js` — replace the import block and game-over block:

```js
// Add to imports:
import { TETROMINOES } from './engine/tetrominoes.js';
import {
  isTopTen, insertScore, rankEntries, loadLeaderboard, saveLeaderboard,
} from './engine/leaderboard.js';
import {
  updateHud, showOverlay, hideOverlay,
  showInitialsPrompt, setInitialChar, setInitialsCursor,
  showLeaderboard, resetOverlayUI,
} from './hud/hud.js';
```

Add initials state before the RAF loop:

```js
// --- Initials entry state ---
let initialsActive = false;
let initialsChars = [];

function submitInitials() {
  initialsActive = false;
  const initials = initialsChars.join('');
  const current = loadLeaderboard();
  const updated = insertScore(initials, gameState.score, current);
  saveLeaderboard(updated);
  const highlightIndex = updated.findIndex(
    (e) => e.initials === initials && e.score === gameState.score,
  );
  showLeaderboard(updated, highlightIndex);
}

function handleInitialsKey(e) {
  if (!initialsActive) return;
  const key = e.key.toUpperCase();
  if (/^[A-Z0-9]$/.test(key) && initialsChars.length < 3) {
    e.preventDefault();
    initialsChars.push(key);
    setInitialChar(initialsChars.length - 1, key);
    setInitialsCursor(initialsChars.length < 3 ? initialsChars.length : 3);
  } else if (e.code === 'Backspace' && initialsChars.length > 0) {
    e.preventDefault();
    initialsChars.pop();
    setInitialChar(initialsChars.length, '_');
    setInitialsCursor(initialsChars.length);
  } else if (e.code === 'Enter' && initialsChars.length === 3) {
    e.preventDefault();
    submitInitials();
  }
}

window.addEventListener('keydown', handleInitialsKey);
```

Update `setupInput` call to suppress restart during initials entry:

```js
setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive });
```

Add `handleRestart` function:

```js
function handleRestart() {
  initialsActive = false;
  initialsChars = [];
  gameState.restart();
  hideOverlay();
}
```

Replace game-over detection block (current lines 76–79):

```js
if (gameState.over && !prevOver) {
  showOverlay('GAME OVER', gameState.score);
  const entries = loadLeaderboard();
  if (isTopTen(gameState.score, entries)) {
    initialsChars = [];
    initialsActive = true;
    showInitialsPrompt();
  } else {
    showLeaderboard(rankEntries(entries), -1);
  }
}
```

Update `#restart-btn` click handler to use `handleRestart`:

```js
document.getElementById('restart-btn').addEventListener('click', handleRestart);
```

> **Highlight index robustness**: `findIndex` returns the FIRST matching entry. If a player has two identical (initials, score) entries, the highlight lands on the higher-ranked one. This is acceptable behavior.

### Success Criteria

- [ ] On game over with a qualifying score: overlay shows with initials prompt
- [ ] Typing A–Z / 0–9 fills slots left to right; cursor indicator moves
- [ ] Backspace deletes last character; cursor moves back
- [ ] Enter with 3 chars filled: saves to `localStorage`, shows leaderboard table with new entry highlighted
- [ ] On game over with a non-qualifying score: leaderboard table shown immediately (no initials prompt)
- [ ] Pressing R or Enter on the leaderboard screen restarts the game and clears initials state
- [ ] Restarting via button click also clears initials state
- [ ] Scores persist across page reload (verify by scoring → reloading → confirming entry)
- [ ] `npm run test` still passes all tests

---

## Task 9: Vercel Config + Documentation

### Overview

Verify whether `vercel.json` is needed for the Vite `dist/` output. Update `AGENTS.md` and `README.md` with leaderboard API docs and deploy info.

### Changes Required

**Investigation**: Run `npm run build` and inspect `dist/`. A Vite static build produces `dist/index.html` with no SPA routes — Vercel's auto-detection of Vite projects handles this correctly without `vercel.json`. Confirm by checking Vercel's default behavior for static HTML output (no rewrites needed for single-page app without client-side routing).

**Decision**: If `npm run build && npx vercel --prod` (or GitHub integration) serves `index.html` at the root URL with no errors → no `vercel.json` needed. Document this in `AGENTS.md`.

**File**: `AGENTS.md` — add "Phase 3 additions" section:

```markdown
## Phase 3 Additions

### Leaderboard Module API (`src/engine/leaderboard.js`)

- `isTopTen(score, entries)` → `boolean` — true if score qualifies for top-10 (strict `>` vs 10th place)
- `insertScore(initials, score, entries)` → `Entry[]` — inserts, sorts, caps at 10; does not mutate input
- `rankEntries(entries)` → `Entry[]` — sorts descending by score, caps at 10; does not mutate input
- `loadLeaderboard()` → `Entry[]` — reads from `localStorage` key `tron-tetris-leaderboard`; returns `[]` on error
- `saveLeaderboard(entries)` — writes JSON to same key

Entry shape: `{ initials: string, score: number }`

### Running a Local Production Build

```bash
npm run build    # produces dist/
npm run preview  # serves dist/ locally at http://localhost:4173
```

### Vercel Deployment

Vite's `dist/` output is a standard static site (single `index.html`, no SPA routing).
Vercel auto-detects Vite projects and configures the build correctly — no `vercel.json` is needed.
Connect the GitHub repository to Vercel and set build command `npm run build`, output directory `dist`.
```

**File**: `README.md` — update feature list and add Deploy section:

```markdown
## Features
- ...existing features...
- **Local leaderboard** — top 10 scores stored in `localStorage`; arcade-style 3-character initials entry (A–Z, 0–9) when score qualifies

## Deploy
The project is deployed to Vercel as a static Vite build. No `vercel.json` is needed — Vercel auto-configures for Vite. See AGENTS.md for build commands.
```

### Success Criteria

- [ ] `npm run build` completes with no errors or warnings
- [ ] `npm run preview` serves `index.html` at the root URL with no console errors
- [ ] Vercel deployment serves correctly at root URL (if a Vercel account is available for validation)
- [ ] `AGENTS.md` documents the leaderboard API and localStorage key
- [ ] `README.md` mentions local leaderboard in features and has a Deploy section

---

## Task 10: Final Build Validation

### Overview

Manual verification pass confirming all Phase 1+2+3 features work in the production build with zero console errors. This is done against `npm run preview` (the `dist/` build), not the dev server.

### Checklist

- [ ] `npm run test` → all tests green (target: 175+ tests)
- [ ] `npm run test:coverage` → ≥ 80% line coverage on engine modules
- [ ] `npm run build` → exits with code 0, no warnings
- [ ] `npm run preview`:
  - [ ] Pieces fall, move, rotate normally
  - [ ] Moving piece left/right produces visibly larger tilt (up to ±7°; use I piece for max effect)
  - [ ] Clearing a line: sweep animation is a left-to-right wipe (cells disappear column by column), not a uniform fade
  - [ ] Ghost piece renders below active piece
  - [ ] Lock flash visible on piece placement
  - [ ] Sound effects play (move, rotate, drop, clear, level up, game over)
  - [ ] HUD shows correct score, level, lines, next piece
  - [ ] Game over with qualifying score: initials prompt appears; A-Z/0-9 accepted; cursor advances; Backspace deletes; Enter submits; leaderboard shown with new entry highlighted
  - [ ] Game over with non-qualifying score: leaderboard shown immediately (no initials prompt)
  - [ ] R and Enter key restart the game from the leaderboard screen
  - [ ] PLAY AGAIN button also restarts
  - [ ] After restart, second game over shows updated leaderboard
  - [ ] Reload the page: previous leaderboard entries persist
  - [ ] Zero console errors in browser DevTools

---

## Testing Strategy

### Unit Tests

**Pure function tests (node environment)**:
- `leaderboard.test.js`: 100% branch coverage on `isTopTen`, `insertScore`, `rankEntries`
  - Key edge cases: empty list, exactly 10 entries, tie handling, cap at 10, no mutation
- `sweep.test.js`: column-gate formula at boundary values (0, 0.1, 0.5, 1.0)
- `tilt.test.js` additions: center-column assertions for I and T pieces; ±7° range for all piece types

**jsdom environment**:
- `input.test.js`: Enter/R triggers restart when `over=true`; no-op when `over=false`; `suppressRestart` option prevents restart when true, allows it when false

**No mocking** of pure functions — they're tested with real inputs/outputs.
`loadLeaderboard`/`saveLeaderboard`: Not unit-tested (thin wrappers); verified via manual browser test.

### Coverage

- Engine coverage target: ≥ 80% lines (maintained)
- `src/engine/leaderboard.js`: covered by leaderboard.test.js; coverage report includes it
- `src/input.js`: covered by input.test.js; input.js is NOT in `src/engine/**` so not counted in the coverage threshold — but it is tested

### Integration / Manual

- No automated E2E tests (per BRIEF.md)
- Manual verification in `npm run preview` (see Task 10 checklist)

---

## Risk Assessment

- **jsdom listener accumulation in tests**: Multiple `setupInput` calls add multiple `window` listeners. Tests that call `setupInput` more than once in a describe block may see unexpected call counts. Mitigation: use fresh `vi.fn()` per test and `toHaveBeenCalledOnce()`. If needed, use `vi.isolateModules()` or add a `beforeEach` cleanup with `window.removeEventListener` (requires exporting the handler reference from `input.js`). Simplest fix: ensure tests don't share state — use one `setupInput` per test via `beforeEach`.

- **`highlightIndex` for duplicate scores**: If two entries have identical `(initials, score)`, `findIndex` returns the first match. The wrong row might be highlighted. Mitigation: acceptable for MVP; full deduplication (e.g., timestamp) is out of scope.

- **`localStorage` not available in test environment**: `leaderboard.test.js` runs in node — calling `loadLeaderboard`/`saveLeaderboard` would throw. Mitigation: these functions are not called in `leaderboard.test.js`. Pure function tests only.

- **Vercel deployment config**: If Vercel doesn't auto-detect Vite correctly, a `vercel.json` with `{ "buildCommand": "npm run build", "outputDirectory": "dist" }` will fix it. Mitigation: check during Task 9; add `vercel.json` if needed.

- **Sweep visual at progress=0**: With `c < Math.floor(0 * 10)` = `c < 0`, no sweep-row cells are rendered at sweep start. The row appears to instantly clear, then cells re-appear left-to-right. Mitigation: this is the spec'd behavior per the test case. If it looks wrong in the browser during Task 3 verification, document as a known visual quirk — do not change the formula without updating the test.
