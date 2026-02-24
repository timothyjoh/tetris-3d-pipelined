# Must-Fix Items: Phase 5

## Summary
2 minor issues found in review. No critical issues. All 5 Playwright tests pass
and all 206 Vitest tests pass — these fixes address test assertion quality and
a code-smell redundancy that could cause silent failures on future refactors.

---

## Tasks

### Task 1: Strengthen Test 3 score assertion
**Status:** ✅ Fixed
**What was done:** Replaced `not.toHaveText('0', { timeout: 5000 })` with `toHaveText('800', { timeout: 5000 })` on line 62 of `tests/gameplay.spec.ts`. All 5 E2E tests pass with the new assertion.

**Priority:** Minor
**Files:** `tests/gameplay.spec.ts`
**Problem:** Line 64 uses a negative assertion:
```typescript
await expect(page.locator('#hud-score')).not.toHaveText('0', { timeout: 5000 });
```
This passes for any non-zero text in the score element. A scoring regression that
produced `1`, `100`, or any other wrong value would silently pass this test. The
expected score after a 4-line Tetris at level 1 is deterministically `800` —
`LINE_SCORES[4] = 800`, level multiplier = 1.

**Fix:**
Replace line 64 with a positive exact assertion:
```typescript
await expect(page.locator('#hud-score')).toHaveText('800', { timeout: 5000 });
```
No other changes needed. The injection (I-piece rot=3, col=-1, rows 16–19 prefilled)
is correct and will always produce exactly 800 points.

**Verify:** Run `npm run build && npm run test:e2e`. Test 3 ("line clear increases
score above zero") must pass with the new assertion. If it fails with a wrong score
value, that indicates a scoring bug in the engine (not this test).

---

### Task 2: Remove redundant `BASE` constant; use `baseURL` from config
**Status:** ✅ Fixed
**What was done:** Deleted `const BASE = 'http://localhost:4173';` (line 3) and replaced all 5 `page.goto(BASE)` calls with `page.goto('/')` using replace_all. All 5 E2E tests pass.

**Priority:** Minor
**Files:** `tests/gameplay.spec.ts`, `playwright.config.ts`
**Problem:** `tests/gameplay.spec.ts:3` defines:
```typescript
const BASE = 'http://localhost:4173';
```
and every test calls `page.goto(BASE)`. The playwright config already declares
`baseURL: 'http://localhost:4173'` at `playwright.config.ts:11`. There are now
two sources of truth for the server URL. If the port is changed in the future (in
`playwright.config.ts` and `webServer.url`), the `BASE` constant won't be updated
and tests will break silently — they'll still navigate to the old port while the
server runs on the new one.

**Fix:**
1. Delete line 3 (`const BASE = 'http://localhost:4173';`) from
   `tests/gameplay.spec.ts`.
2. Replace every occurrence of `page.goto(BASE)` with `page.goto('/')`.
   There are 5 occurrences — lines 10, 20, 42, 75, and 109.

After the change the top of the file should read:
```typescript
import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Canvas visible
```
And each test begins with `await page.goto('/');`.

**Verify:** Run `npm run build && npm run test:e2e`. All 5 tests must pass. The
relative `'/'` resolves against `baseURL` in playwright.config.ts, which points to
`http://localhost:4173`.
