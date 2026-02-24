# Must-Fix Items: Phase 6

## Summary

3 minor issues found in review. No critical issues. All are test-quality findings — the core feature implementation is complete and correct.

---

## Tasks

### Task 1: Fix Test 2 comment to reflect start-screen dismissal
**Priority:** Minor
**Files:** `tests/gameplay.spec.ts`
**Status:** ✅ Fixed
**What was done:** Replaced the comment on lines 14–15 of the test block. Old text said "Sends left ×3, right ×2, rotate ×1; asserts no crash". New text accurately states that the first ArrowLeft dismisses the start overlay (consumed by the state-machine handler before setupInput), and only the remaining 2 ArrowLefts, 2 ArrowRights, and 1 ArrowUp reach game input.

---

### Task 2: Add E2E test for R6 acceptance criterion (ESC after game-over)
**Priority:** Minor
**Files:** `tests/gameplay.spec.ts`
**Status:** ✅ Fixed
**What was done:** Added Test 9 immediately after Test 8. The test: dismisses the start overlay, injects the same O-piece game-over scenario as Tests 4 and 5, waits for `#overlay` to be visible, confirms `gameState.over === true`, presses Escape, then asserts `#pause-overlay` remains hidden and `gameState.paused === false`. All 9 E2E tests pass.

---

### Task 3: Fix `reuseExistingServer` footgun introduced by build-time `VITE_TEST_HOOKS` flag
**Priority:** Minor
**Files:** `playwright.config.ts`, `AGENTS.md`
**Status:** ✅ Fixed
**What was done:**
- **Change A** (`playwright.config.ts`): Changed `reuseExistingServer: !process.env.CI` to `reuseExistingServer: false` and added a comment explaining that the build step is now load-bearing (VITE_TEST_HOOKS must be baked in).
- **Change B** (`AGENTS.md`): Added a caveat line under the `npm run test:e2e` entry warning developers to stop any running preview server before running E2E tests, since the suite always rebuilds with the flag baked in.
