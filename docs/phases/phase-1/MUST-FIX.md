# Must-Fix Items: Phase 1

## Summary

4 critical issues, 3 minor issues found in review. All 7 fixed.

---

## Tasks

### Task 1: Fix Lock Delay — Use Real Elapsed Time, Not Gravity Interval
**Status:** ✅ Fixed
**What was done:** Moved `_lockAccum` accumulation outside the gravity-tick block so it runs every frame when `_landed` is true. `_landed` is set to `true` when `_tryMoveDown()` returns false, and cleared when the piece moves. `_lockPiece()` is now called from the per-frame lock check with an early `return`. This gives a proper independent 500ms lock window at all levels.

---

### Task 2: Fix the Tetris 4-Row Clear Test
**Status:** ✅ Fixed
**What was done:** Replaced the incomplete test body with a complete test that places a sentinel value at row 15, fills rows 16-19 completely, calls `clearRows([16, 17, 18, 19])`, asserts `cleared === 4`, verifies old row 15 shifted to row 19 (`getCell(3, 19) === 99`), and verifies new rows 0-3 are empty. Removed the incorrect bug comment.

---

### Task 3: Add `update(dt)` Tests to GameState
**Status:** ✅ Fixed
**What was done:** Added a `describe('update(dt)')` block with 6 tests: does-not-advance-when-paused, does-not-advance-when-over, piece-moves-down-after-gravity, piece-locks-after-500ms, soft-drop-uses-shorter-interval, soft-drop-interval-is-min(50,normal). All pass with the Task 1 lock delay fix applied.

---

### Task 4: Add Missing Scoring Tests (2/3/4 Line Clears)
**Status:** ✅ Fixed
**What was done:** Added three tests: 300pts for 2-line clear at level 1, 800pts for 4-line Tetris clear at level 1, and 200pts for 1-line clear at level 2.

**Note:** The MUST-FIX instructions for 2-line and 4-line tests had an incorrect setup (filling rows "except cols 3-6"). The horizontal I piece (rotation 0) only occupies one row at a time and cannot clear 2 or 4 rows simultaneously that way. Fixed by pre-filling entire rows (all 10 cols) completely so `getCompletedRows()` returns the pre-filled rows after the piece locks anywhere above them. This correctly exercises the multi-row scoring path.

---

### Task 5: Fix Weak `secondPiece` Assertion in GameState Constructor Test
**Status:** ✅ Fixed
**What was done:** Replaced the vague `validTypes.toContain(gs.nextPieceType)` assertion and incorrect comment with `expect(gs.nextPieceType).toBe('T')` — a specific assertion matching the injected `secondPiece: 'T'` value.

---

### Task 6: Add `rotateCW` / `rotateCCW` Tests to GameState
**Status:** ✅ Fixed
**What was done:** Added a `describe('rotation')` block with 4 tests: rotateCW changes rotation from 0 to 1, rotateCCW wraps 0 to 3, rotation resets `_lockAccum`, rotation does nothing when paused.

---

### Task 7: Add Left-Wall and Floor Kick Tests to Rotation Suite
**Status:** ✅ Fixed
**What was done:** Added two tests to the `describe('wall kick')` block.

- **Floor kick**: J piece rotation 1→2 near the floor (row 19 filled). SRS kick `[0,-2]` shifts piece upward to avoid the floor. Test passes with conditional check (`if result !== null`) per MUST-FIX instructions.

- **Left-wall kick**: The MUST-FIX instructions used CW rotation (+1, 0→1) for the left-wall kick test, but SRS JLSTZ CW kicks `[[0,0],[-1,0],[-1,-1],[0,+2],[-1,+2]]` have no rightward offsets — so that test scenario can never produce a rightward kick. Fixed by using CCW rotation (-1, 0→3) which has `[+1,0]` as kick option 2. Test blocks cell (0,6) to prevent kick [0,0] from succeeding, forcing the [+1,0] kick at col=1. Asserts `result.col > 0` (kicked right).

All 115 tests pass after all 7 fixes.
