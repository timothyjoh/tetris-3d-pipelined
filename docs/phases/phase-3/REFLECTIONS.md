# Reflections: Phase 3

## Looking Back

### What Went Well

- **All five spec features delivered structurally**: Tilt fix, sweep fix, leaderboard engine, initials UI, and overlay redesign were all present and functionally correct in isolation. The reviewer confirmed the build was clean and all 201 tests passed.
- **Coverage exceeded the bar**: 97.2% engine coverage — well above the 80% acceptance criterion — indicating the pure-function leaderboard module was thoroughly tested.
- **Scope discipline on the overlay**: The decision to use CSS for the game-over/leaderboard overlay (rather than Three.js canvas) was correct. It kept the implementation simple, testable, and visually consistent with the Tron aesthetic without introducing rendering complexity.
- **jsdom package resolution**: The plan specified `@vitest/environment-jsdom`, but that package returned 404 on npm. Pivoting to installing `jsdom` directly and relying on Vitest v2's native jsdom support was a good in-the-moment fix. The `environmentMatchGlobs` config worked as intended.
- **Leaderboard pure functions**: `isTopTen`, `insertScore`, `rankEntries` were written as side-effect-free pure functions, making them trivially testable at 100% branch coverage and easy to reason about.

### What Didn't Work

- **Enter key race condition (critical)**: `handleInitialsKey` was registered on `window` *before* `setupInput`, so when a user presses Enter to submit their initials, both listeners fire in registration order. `handleInitialsKey` sets `initialsActive = false`, then `setupInput`'s listener evaluates `suppressRestart()` as `false` and immediately restarts the game. The leaderboard table is never visible. This was a classic event-listener ordering bug — the interaction between the two listeners was not modeled or tested end-to-end.
- **`loadLeaderboard`/`saveLeaderboard` left untested**: These were noted in the plan as "thin wrappers, manually verified." The review correctly flagged this as 0% coverage on 12 lines including a try/catch that could silently swallow errors. "Thin wrapper" is not a justification for skipping tests on localStorage boundary code.
- **`isTopTen` assumes sorted input**: The function accesses `entries[9].score` without verifying the array is sorted. If `loadLeaderboard` ever returns unsorted data (e.g., after a manual localStorage edit), `isTopTen` gives wrong answers. This assumption was never documented or enforced.
- **Duplicate test case**: `isTopTen(0, [])` was asserted twice in `leaderboard.test.js`. This suggests the test file was written quickly without a review pass.
- **Potential XSS in `showLeaderboard`**: `tr.innerHTML` concatenates raw `entry.initials` and `entry.score` strings loaded from localStorage JSON. Input validation at entry time makes the normal path safe, but a hand-edited localStorage value could inject HTML. This is a minor risk in a local-only app but is a bad pattern to carry forward.

### Spec vs Reality

- **Delivered as spec'd**: Tilt center-column fix, sweep column-gate fix, `isTopTen`/`insertScore`/`rankEntries` pure functions, `loadLeaderboard`/`saveLeaderboard`, initials entry UI (3 slots, auto-advance, Backspace, Enter on 3 chars), overlay Tron neon redesign with leaderboard table, jsdom environment for `input.test.js`, `suppressRestart` option in `setupInput`, Vercel deploy readiness (no `vercel.json` needed), `AGENTS.md` and `README.md` updated.
- **Deviated from spec**: jsdom was installed as the `jsdom` package directly rather than `@vitest/environment-jsdom` (which 404'd on npm). Functionally equivalent; config difference noted in memory.
- **Deferred / broken**: The Enter-to-submit flow is broken at runtime due to the event listener race. 13 of 14 acceptance criteria pass; the one failure is the leaderboard confirmation being invisible to the user. `loadLeaderboard`/`saveLeaderboard` are also untested.

### Review Findings Impact

- **Enter key race condition**: Not yet fixed — the review identified this after implementation was "complete." The fix is clear: register `handleInitialsKey` *after* `setupInput`, or restructure so the initials key handler is integrated into `setupInput`'s existing `suppressRestart` guard rather than being a separate listener on `window`.
- **Untested localStorage wrappers**: Not addressed. Should be fixed with a mock-localStorage test covering the round-trip and the try/catch error branch.
- **XSS in `showLeaderboard`**: Not addressed. Should sanitize `entry.initials` and `entry.score` before `innerHTML` assignment, or switch to `textContent` / DOM node creation.
- **Listener accumulation in `input.test.js`**: Not addressed. Tests pass but are fragile; each `setupInput` call should remove the previous listener before adding a new one, or tests should clean up via `afterEach`.
- **Duplicate test / unsorted `isTopTen` assumption**: Not addressed. Minor cleanup items.

---

## Looking Forward

### Recommendations for Next Phase

- **Fix the Phase 3 critical bug before building on top of it.** The Enter-key race in `main.js` means the leaderboard UI is broken at runtime. Phase 4 should begin with this fix as a precondition, not carry broken UX forward. The fix is small: change listener registration order or consolidate the initials key handler into `setupInput`.
- **Add a test for the full game-over → initials → leaderboard flow.** This interaction was the hardest part to get right and the only one that broke. A test that simulates: game over → score qualifies → character input → Enter submit → leaderboard visible would have caught the race condition. Consider a lightweight integration test (not Playwright, just jsdom) for this flow.
- **Test localStorage boundary code.** Any function that touches `localStorage` should have a test that mocks `localStorage` and exercises both the happy path and the error branch. "Thin wrapper" is not a skip justification.
- **Phase 4 is a rendering overhaul** (PerspectiveCamera, `rotation.y`, true 3D cubes). Research should verify: what exactly is the current camera setup, what is `rotation.y` currently doing, and what mesh geometry is being used. Don't assume the current renderer is a placeholder — it may have non-obvious dependencies.
- **Keep the event listener pattern clean.** The Phase 3 race condition arose from two separate `window.addEventListener('keydown', ...)` calls that interacted in an unexpected order. Going into Phase 4+, consolidate input handling into a single, ordered dispatch rather than stacking independent listeners.

### What Should Next Phase Build?

Per `BRIEF.md`, Phase 4 is: **3D block geometry and corrected Y-axis tilt** — `PerspectiveCamera`, `rotation.y` for the tilt, and true 3D cube geometry (~0.85 units deep) with directional lighting.

This is a pure rendering/visual overhaul. Scope and priorities:

1. **Switch camera**: Replace whatever current camera is in use with `PerspectiveCamera`. Determine correct FOV and position for the 10×20 board.
2. **True 3D cubes**: Change block geometry from flat quads (or thin boxes) to `BoxGeometry(1, 1, 0.85)`. Verify UV/material setup still looks correct.
3. **Directional lighting**: Add a `DirectionalLight` to give the cubes visible depth. Confirm ambient light doesn't wash out the Tron neon colors.
4. **Y-axis tilt via `rotation.y`**: The Phase 2/3 tilt was implemented at the `computeTiltAngle` level — Phase 4 should wire this to the scene or board mesh's `rotation.y` for a true 3D lean effect.
5. **Regression check**: After the rendering overhaul, all existing engine and HUD tests should still pass (they don't touch Three.js). Manually verify: tilt, sweep, leaderboard, initials, scoring, sound.

Phase 5 is Playwright e2e + video recording — likely after Phase 4 stabilizes the visual output.

### Technical Debt Noted

- **Enter key race condition**: `src/main.js` lines 57–85 — `handleInitialsKey` registered before `setupInput` causes restart on initials submit. Must fix before Phase 4 ships.
- **Untested localStorage wrappers**: `src/engine/leaderboard.js:35–46` — `loadLeaderboard`/`saveLeaderboard` have 0% test coverage including a silent try/catch.
- **XSS via innerHTML**: `src/hud/hud.js:107` — raw localStorage values concatenated into `tr.innerHTML`. Low risk for a local app but bad pattern.
- **`isTopTen` sorted-input assumption**: `src/engine/leaderboard.js` — undocumented precondition; will silently misbehave on unsorted input from `loadLeaderboard`.
- **`input.test.js` listener accumulation**: `src/__tests__/input.test.js` — stacking keydown listeners per test call; fragile test isolation.

### Process Improvements

- **Test the event listener interaction, not just individual handlers.** The Phase 3 critical bug was undetectable from unit tests of `handleInitialsKey` and `setupInput` in isolation. When two listeners interact on the same event, write at least one test that fires both.
- **Don't skip testing of I/O boundary functions.** If a function touches `localStorage`, filesystem, or network — even as a "thin wrapper" — test it. The savings in test time are not worth the coverage gap.
- **Review pass before declaring "complete."** Phase 3 was marked complete with a known-untested critical user flow (the submit path). The review caught it, but that added a round-trip. A self-review checklist item — "manually exercise every user-facing state transition end-to-end" — would catch this class of bug earlier.
- **Commit Phase N work before starting Phase N+1.** The git log shows all Phase 3 work is uncommitted (`f5311fc` is "Phase 2 complete"). Committing at phase boundaries makes it easier to bisect regressions and gives the reflection a clear before/after in history.
