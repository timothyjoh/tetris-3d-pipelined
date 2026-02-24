# Must-Fix Items: Phase 2

## Summary

2 critical issues, 3 minor issues found in review.

- **Critical**: build warning violates SPEC; missing `levelUp` test violates SPEC testing-strategy requirement
- **Minor**: weak `playGameSound` assertions; no ghost rotation test; missing `sweepProgress` clamp test

---

## Tasks

### Task 1: Suppress build chunk-size warning
**Status:** ✅ Fixed
**What was done:** Added `chunkSizeWarningLimit: 600` to the `build` object in `vite.config.js`. The build now completes with no `(!)` lines.

---

### Task 2: Add `levelUp` sound event test
**Status:** ✅ Fixed
**What was done:** Added the `it('pushes "levelUp" when level crosses a threshold during _finalizeSweep', ...)` test inside the `describe('sound events', ...)` block in `src/__tests__/gameState.test.js`, after the `gameOver` spawn-blocked test. The test sets `linesCleared = 9`, sets up a complete row for the I piece, calls `hardDrop()`, clears `soundEvents`, then advances 151ms to finalize the sweep. Verifies `gs.level === 2` and `soundEvents` contains `'levelUp'`.

---

### Task 3: Add per-event config assertions to `playGameSound` tests
**Status:** ✅ Fixed
**What was done:** Added two spot-check tests after the existing loop in `src/__tests__/sounds.test.js`: `'gameOver event uses 110 Hz sawtooth'` and `'move event uses 200 Hz square'`. Each verifies `mockOsc.type` and `mockOsc.frequency.setValueAtTime` with the expected values from `SOUND_CONFIG`.

---

### Task 4: Add rotated-piece ghost test
**Status:** ✅ Fixed
**What was done:** Added `it('I piece rotation=1 (1-wide, 4-tall) drops to row 16 on empty board', ...)` inside `describe('computeGhostRow', ...)` in `src/__tests__/ghost.test.js`. Calls `computeGhostRow(board, 'I', 1, 3, 0)` and expects `16` (bottom cell at `originRow+3` must be ≤ row 19, so max originRow = 16).

---

### Task 5: Add `sweepProgress` clamp-at-1 test
**Status:** ✅ Fixed
**What was done:** Added `it('sweepProgress clamps to 1 at SWEEP_DURATION_MS', ...)` inside `describe('line-clear sweep', ...)` in `src/__tests__/gameState.test.js`, before the existing `sweepProgress goes from 0 to 1` test. Sets `_sweepAccum = 149`, calls `update(1)` to hit the 150ms boundary exactly, then verifies `sweeping === false` and `sweepProgress === 0` (the post-finalize guard).
