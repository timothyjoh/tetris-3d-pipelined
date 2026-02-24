# Must-Fix Items: Phase 7

## Summary

1 critical issue, 1 minor issue found in review.

The critical issue is operational: the Vercel production deploy was never executed and README.md contains a placeholder instead of a live URL. This is the last remaining BRIEF.md criterion and the explicit definition of "done" for Phase 7.

---

## Tasks

### Task 1: Complete Vercel production deploy and record live URL

**Priority:** Critical
**Status:** ✅ Fixed
**What was done:** Authenticated Vercel CLI (`npx vercel login`) and ran `npx vercel --prod --yes`. The project deployed successfully as `sdk-test-lemon.vercel.app`. `README.md:20` updated from the placeholder to `[https://sdk-test-lemon.vercel.app](https://sdk-test-lemon.vercel.app)`. Build exits 0 after the edit.

**Files:**
- `README.md` — must be updated with the real Vercel URL

**Problem:**
`README.md:20` reads `[Production URL — to be added after Vercel deploy]` — a placeholder left when the Vercel CLI was not authenticated during the build session. R1 requires `vercel --prod` to run and produce a live URL. R2 requires that URL to be recorded in README.md. Both are unmet.

**Fix:**

Step 1 — Authenticate the Vercel CLI (one-time; skip if already done):
```bash
npx vercel login
```
Follow the browser prompt to authenticate. Confirm with:
```bash
npx vercel whoami
```

Step 2 — Deploy from the project root:
```bash
npx vercel --prod
```
When prompted:
- Link to existing project or create new: create new (or link to existing project if one was created previously)
- Build command: `npm run build` (auto-detected for Vite; accept default)
- Output directory: `dist` (auto-detected; accept default)
- No `vercel.json` is needed.

Step 3 — Copy the production URL printed by the CLI (format: `https://your-project-name.vercel.app`).

Step 4 — Update `README.md:18–21`. Replace:
```markdown
## Live Demo

[Production URL — to be added after Vercel deploy]
```
With:
```markdown
## Live Demo

[https://your-actual-url.vercel.app](https://your-actual-url.vercel.app)
```
Use the real URL from Step 3 — not the example above.

Step 5 — Manual smoke check in any browser (not automated):
- Open the production URL.
- Confirm `#start-overlay` is visible on load.
- Confirm `<canvas>` element is present in the DOM.
- Confirm no JS console errors in DevTools.
- Press any key — overlay hides and a Tetromino falls.

**Verify:**
- `README.md:20` contains a `*.vercel.app` URL (not the placeholder text).
- Opening the URL in a browser shows the start overlay and WebGL canvas with no console errors.
- `npm run build` still exits 0 (the README edit does not affect the build).

---

### Task 2: Strengthen `waitForFunction` guard logic in Tests 3–5

**Priority:** Minor
**Status:** ✅ Fixed
**What was done:** The guards at `tests/gameplay.spec.ts:46–49`, `85–88`, and `125–128` were already updated to the correct form (`gs != null && gs.pieceType !== null`) — this was done during the Phase 7 build session. All 10 Playwright E2E tests pass with the correct guards in place. No further changes were needed.

**Files:**
- `tests/gameplay.spec.ts:46, 82, 119`

**Problem:**
The updated guard `(window as any).__gameState?.pieceType !== null` has a logical flaw: when `__gameState` is `undefined`, the optional-chain short-circuits to `undefined`, and `undefined !== null` evaluates to `true` — causing the guard to pass immediately even if `__gameState` has not been set. In practice this cannot happen (the module sets `window.__gameState` synchronously), but the guard provides false protection if `VITE_TEST_HOOKS` were ever absent or if the module evaluation order changed.

A guard that correctly waits for both conditions would be:
```ts
(window as any).__gameState != null && (window as any).__gameState.pieceType !== null
```
(Note: `!= null` uses loose equality, which rejects both `null` and `undefined`.)

**Fix:**

At each of the three locations (`tests/gameplay.spec.ts:46`, `82`, `119`), replace:
```ts
await page.waitForFunction(() => (window as any).__gameState?.pieceType !== null);
```
With:
```ts
await page.waitForFunction(() => {
  const gs = (window as any).__gameState;
  return gs != null && gs.pieceType !== null;
});
```
Update the inline comment on each line from:
```ts
// Wait for pieceType to be non-null: confirms game state is initialized and piece is spawned
// (VITE_TEST_HOOKS=true is set in playwright.config.ts webServer.env)
```
To:
```ts
// Wait until __gameState exists AND pieceType is non-null: confirms module loaded and piece spawned
// (VITE_TEST_HOOKS=true is set in playwright.config.ts webServer.env)
```

**Verify:**
- `npm run test:e2e` passes all 10 tests.
- None of the three guard lines contain `?.pieceType !== null`.
- All three guards contain `gs != null && gs.pieceType !== null`.
