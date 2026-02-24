# Must-Fix Items: Phase 4

## Summary

1 minor issue found in review. No critical issues. All spec requirements are met and all tests
pass. The single fix is a test quality issue: Test 4 in `initials-submit.test.js` passes for
the wrong reason and does not verify what it claims to test.

---

## Tasks

### Task 1: Rewrite Test 4 in initials-submit.test.js

**Status:** ✅ Fixed
**What was done:** Deleted test 4 entirely from `src/__tests__/initials-submit.test.js` (the false-positive `suppressRestart` test). The file now has 3 tests. All 206 remaining tests pass (12/12 files).

**Priority:** Minor
**File:** `src/__tests__/initials-submit.test.js`

**Problem:**

Test 4 (`'Enter does NOT trigger restart when initialsActive=true (suppressRestart works)'`,
lines 68–77) creates a fresh inner `setupInput` listener (C) inside a test where `beforeEach`
has already registered `setupInput` (A) and `handleInitialsKey` (B). Listener order when
Enter fires:

1. Listener A (`setupInput` outer) — suppressed by `suppressRestart()=true`.
2. Listener B (`handleInitialsKey`) — fires, calls `e.stopImmediatePropagation()`.
3. Listener C (inner `setupInput`) — **never fires** due to `stopImmediatePropagation` from B.

`innerOnRestart` is not called because the event is blocked before it reaches listener C, not
because `suppressRestart` works. If `suppressRestart` were broken, the test would still pass.
This is a false positive.

The `suppressRestart` mechanism is correctly covered in isolation by `input.test.js:66–71`,
so this test is also redundant. The fix: replace the test body with one that actually
demonstrates what the comment describes, or delete it if redundant coverage isn't needed.

**Fix:**

Replace the body of test 4 in `src/__tests__/initials-submit.test.js` (lines 68–77) with a
version that tests suppressRestart WITHOUT `handleInitialsKey` interfering. The simplest
correct approach is to set `initialsActive = false` first (so `handleInitialsKey` exits
early), then verify the inner listener's `suppressRestart` blocks restart:

```js
it('suppressRestart blocks restart even after initials are submitted', () => {
  // After submit, initialsActive=false, so handleInitialsKey is a no-op.
  // A fresh Enter (after key release) should trigger the outer onRestart.
  // But if we add a second setupInput with its OWN suppression, verify it
  // is independently suppressed.
  //
  // Register inner BEFORE handleInitialsKey can block it:
  // (handleInitialsKey is already registered in beforeEach AFTER setupInput,
  //  so we need a fresh scenario without handleInitialsKey in the way)
  //
  // Simplest: verify suppressRestart in isolation — document that
  // input.test.js:66–71 already covers this, so remove this test.
  //
  // The three tests above (tests 1–3) fully cover the race condition.
  // This test is redundant. Safe to delete.
});
```

Since `input.test.js:66–71` already covers `suppressRestart` in isolation cleanly, the
recommended fix is to **delete** test 4 entirely and leave only the 3 meaningful tests. If
the team prefers to keep 4 tests, replace the body as follows:

```js
it('suppressRestart independently verified in input.test.js', () => {
  // Covered by input.test.js:66–71 in isolation.
  // This file focuses on the two-listener race condition; tests 1–3 above
  // are the regression suite. This placeholder documents the coverage gap
  // was a deliberate delegation to input.test.js.
  expect(true).toBe(true); // placeholder — see input.test.js:66–71
});
```

Preferred recommendation: **delete test 4**. Three focused, correct tests are better than
three good tests plus one misleading one.

**Exact edit:**

Remove lines 68–77 from `src/__tests__/initials-submit.test.js`:

```js
// DELETE THIS ENTIRE TEST:
it('Enter does NOT trigger restart when initialsActive=true (suppressRestart works)', () => {
  let innerInitialsActive = true;
  const innerOnRestart = vi.fn();
  const innerCleanup = setupInput({ over: true }, innerOnRestart, {
    suppressRestart: () => innerInitialsActive,
  });
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
  expect(innerOnRestart).not.toHaveBeenCalled();
  innerCleanup();
});
```

After deletion, the describe block has 3 tests (lines 49–66).

**Verify:**

```bash
npm test
```

All remaining tests (now 3 in this file, down from 4) must pass. `input.test.js` must also
still pass, confirming `suppressRestart` coverage is unaffected. Total test count decreases
by 1 from the Phase 4 build total.
