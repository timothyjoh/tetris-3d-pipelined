# Must-Fix Items: Phase 3

## Summary

1 critical issue, 4 minor issues found in review. The critical issue makes the initials entry flow completely non-functional (game restarts immediately after Enter submits initials). Minor issues address test quality.

---

## Tasks

### Task 1: Fix Enter-key race condition in initials submission
**Status:** ✅ Fixed
**What was done:** Added `e.stopImmediatePropagation()` to all three branches of `handleInitialsKey` in `src/main.js` (valid character, Backspace, and Enter). This prevents the `setupInput` listener from receiving the event after `handleInitialsKey` consumes it, eliminating the race condition that caused `handleRestart()` to fire immediately after `submitInitials()`.

---

### Task 2: Add `loadLeaderboard`/`saveLeaderboard` round-trip test
**Status:** ✅ Fixed
**What was done:** Created `src/__tests__/leaderboard-storage.test.js` with three tests covering: (1) returns `[]` when key is absent, (2) round-trips entries through JSON correctly, (3) returns `[]` on invalid JSON. Updated `vitest.config.js` `environmentMatchGlobs` to run the new file in jsdom. Used `vi.stubGlobal('localStorage', ...)` with a fresh in-memory store per test because jsdom's file-based localStorage doesn't implement the full Storage API. 203 tests now pass.

---

### Task 3: Fix fragile `input.test.js` listener accumulation
**Status:** ✅ Fixed
**What was done:** Refactored `src/input.js` `setupInput` to extract named `onKeydown`/`onKeyup` handler references and return a cleanup function that removes both listeners. Updated `src/__tests__/input.test.js` to import `afterEach`, capture the cleanup return value from each `setupInput` call, and call it in `afterEach`. Each test now runs with exactly one listener active.

---

### Task 4: Remove duplicate `isTopTen(0, [])` test
**Status:** ✅ Fixed
**What was done:** Deleted the second `it('returns true when score is 0 and list is empty', ...)` block (lines 40-42 in `leaderboard.test.js`). Test count went from 201 to 200 before adding the new storage tests (net 203 total with Task 2's additions). No coverage regression.

---

### Task 5: Sanitize `entry.initials` before innerHTML insertion
**Status:** ✅ Fixed
**What was done:** Replaced `tr.innerHTML = \`...\`` with safe DOM construction using `document.createElement('td')` and `textContent` assignment for rank, initials, and score cells in `showLeaderboard` in `src/hud/hud.js`. Eliminates the localStorage-injection XSS vector.
