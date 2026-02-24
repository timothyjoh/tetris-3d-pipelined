# Phase 7: Production Deploy & Final Polish

## Objective

Phase 7 closes the one remaining BRIEF.md criterion — "deploys cleanly to Vercel" — and resolves the technical debt itemized in the Phase 6 REFLECTIONS. After this phase the project is fully done: the game runs in production, the E2E suite passes against the live build, three silent-bug risks are eliminated, and documentation accurately reflects the implemented code.

---

## Scope

### In Scope

- **Vercel production deploy**: Run `vercel --prod`, capture the live URL, and confirm the deployed build renders correctly (start overlay visible, WebGL canvas active, sound events fire).
- **Fix `stopImmediatePropagation` edge case**: The state-machine keydown handler in `src/main.js` must call `e.stopImmediatePropagation()` after handling start-screen dismiss, pause, and resume transitions — preventing game-control side effects when the dismissal key is also bound in `setupInput` (e.g., `P` key leaving the game in a hidden-paused state).
- **Fix stale README tilt description**: `README.md:11` still describes Z-axis board tilt from Phase 2; update to Y-axis (Phase 4 change).
- **Strengthen `waitForFunction` guards (Tests 3–5)**: Replace the no-op `window.__gameState !== undefined` guard with `window.__gameState?.pieceType !== null` to confirm the game loop has ticked at least once before board injection.
- **Document Test 7 `Space` side effect**: Add a comment in `tests/gameplay.spec.ts` at the Test 7 `Space` keypress explaining that `Space` triggers `hardDrop()` via `setupInput` because `stopImmediatePropagation` was not previously called — and update the comment to reflect whether this is still true after the `stopImmediatePropagation` fix.
- **Add click-to-start E2E test**: `startOverlay.addEventListener('click', startGame)` is wired but untested. Add Test 10: `page.click('#start-overlay')` dismisses the overlay and the game goes live.
- **Live URL in README.md**: After successful Vercel deploy, add the production URL to README.md.

### Out of Scope

- Mobile/touch controls.
- Sound toggle UI or mute control.
- Ghost piece rendering.
- Any changes to game engine logic, scoring, or Three.js rendering.
- Backend services or server-side state.
- CI/CD pipeline automation for Vercel (one-time manual deploy is sufficient).
- New gameplay features of any kind.

---

## Requirements

- **R1**: Running `vercel --prod` from the project root produces a deployed URL. A browser opened to that URL shows: the `#start-overlay` is visible; the WebGL `<canvas>` is present in the DOM; no JS console errors on page load.
- **R2**: The live production URL is recorded in `README.md` under a "Live Demo" or equivalent heading.
- **R3**: The state-machine keydown handler calls `e.stopImmediatePropagation()` immediately after invoking `startGame()` (start-screen dismiss), `gameState.togglePause()` (pause), and the resume branch — so the same event does not propagate to `setupInput`'s listeners.
- **R4**: After the `stopImmediatePropagation` fix, pressing `P` on the start screen starts the game without leaving it paused. A Vitest test or updated E2E comment documents this behavior.
- **R5**: `waitForFunction` guards in Tests 3–5 check `window.__gameState?.pieceType !== null` (or an equivalent that confirms the game loop has ticked) rather than the synchronous `window.__gameState !== undefined`.
- **R6**: Test 7 has a code comment that accurately states whether `Space` also fires `hardDrop()` after the `stopImmediatePropagation` fix, and why the key choice matters for test correctness.
- **R7**: A new Playwright Test 10 exercises the click-to-start path: `page.click('#start-overlay')` → `#start-overlay` is hidden → `window.__gameState.over === false`.
- **R8**: README.md Features section describes Y-axis board tilt (not Z-axis).
- **R9**: All 206+ Vitest unit tests continue to pass.
- **R10**: All 10 Playwright E2E tests pass against `npm run preview` (with `VITE_TEST_HOOKS=true`).

---

## Acceptance Criteria

- [ ] `vercel --prod` succeeds; the live URL is reachable in a browser and renders the start overlay with no console errors.
- [ ] README.md contains the production URL.
- [ ] Pressing `P` on the start screen starts the game and does NOT leave it in a paused state (`gameState.paused === false` immediately after).
- [ ] Pressing `Space` on the start screen starts the game; the comment in Test 7 accurately describes whether `hardDrop()` fires on that same event.
- [ ] Tests 3–5 `waitForFunction` guards check `window.__gameState?.pieceType !== null` (or equivalent post-tick condition).
- [ ] Test 10 passes: clicking `#start-overlay` starts the game (overlay hidden, game not over).
- [ ] README.md tilt description says Y-axis (not Z-axis).
- [ ] All 206+ Vitest unit tests pass.
- [ ] All 10 Playwright E2E tests pass.
- [ ] `npm run build` completes without warnings.

---

## Testing Strategy

### Unit tests (Vitest)
- No new engine unit tests required.
- If the `stopImmediatePropagation` fix touches `src/main.js` in a way that can be unit-tested (e.g., a spy on `e.stopImmediatePropagation`), add a test to `src/__tests__/`. Otherwise, coverage via E2E is sufficient.
- All existing 206+ tests must continue to pass.

### E2E tests (Playwright — `tests/gameplay.spec.ts`)

**Updates to existing tests:**

| Test | Change |
|------|--------|
| Tests 3–5 | Replace `window.__gameState !== undefined` with `window.__gameState?.pieceType !== null` |
| Test 7 | Update or add comment explaining `Space` and `hardDrop()` interaction post-fix |

**New test:**

| # | Name | Setup | Assert |
|---|------|--------|--------|
| 10 | `click on start overlay starts the game` | `page.goto('/')`, wait for `#start-overlay` to be visible | `page.click('#start-overlay')` → `#start-overlay` hidden; `window.__gameState.over === false` |

**Key assertions must use exact values, not weakened checks** (established pattern from Phase 5/6).

### Production smoke check
- After `vercel --prod`, open the live URL in Chromium (or any browser).
- Confirm: `#start-overlay` visible on load; `<canvas>` present; no JS errors in DevTools console; pressing a key dismisses the overlay and a piece falls.
- This is a manual verification step — not automated in the Playwright suite (Playwright runs against `localhost`, not the production URL).

### Coverage
- Existing Vitest coverage target (97%+ engine) must be maintained.
- No new engine code, so no new coverage requirements.

---

## Documentation Updates

- **README.md**:
  - Add "Live Demo" section with the production Vercel URL.
  - Update Features section: change "board Z-rotates" to Y-axis tilt description.
  - Document that pressing `P` (or `Space`, `Escape`, etc.) on the start screen starts the game without side effects.
- **AGENTS.md**:
  - Add `stopImmediatePropagation` discipline as a standard pattern: any state-machine keydown handler that handles a key and returns early MUST call `e.stopImmediatePropagation()`. This prevents action-on-dismiss side effects.
- **CLAUDE.md**:
  - Note that Phase 7 added `stopImmediatePropagation` to the state-machine handler — future key bindings in `setupInput` are now safe to overlap with overlay-dismiss keys.

Documentation is part of "done" — code without updated docs is incomplete.

---

## Dependencies

- Phases 1–6 complete (all 7 BRIEF.md features implemented and tested).
- A Vercel account and `vercel` CLI installed (or Vercel GitHub integration configured).
- Playwright infrastructure from Phase 5 (`playwright.config.ts`, `webServer`, Chromium + `--use-gl=angle`) present and working.
- The 9 existing Playwright tests passing before this phase begins.

---

## Adjustments from Previous Phase

Based on REFLECTIONS.md from Phase 6:

1. **`stopImmediatePropagation` is the primary code fix**: REFLECTIONS called this out explicitly — the missing call creates a "hidden-paused" state footgun that is invisible to players but silently breaks the game state machine. This spec makes it a required deliverable, not optional polish. R3 and R4 both gate on it.

2. **`waitForFunction` guards are no-ops — fix them**: REFLECTIONS identified that `window.__gameState !== undefined` passes synchronously and provides false confidence. This spec requires upgrading to a post-tick guard (`pieceType !== null`) so the guard actually validates game loop execution.

3. **Click-to-start path was untested**: REFLECTIONS noted `startOverlay.addEventListener('click', startGame)` was wired but unverified in the E2E suite. Test 10 closes this gap.

4. **Document Test 7 `Space` side effect**: REFLECTIONS flagged the undocumented assumption. After the `stopImmediatePropagation` fix, this comment must be updated to reflect whether the side effect still exists.

5. **MEMORY.md update last**: Per the Phase 6 process note, MEMORY.md should be updated as the final step — after all tests pass and all MUST-FIX items are resolved.

6. **Vercel deploy is the true "done"**: The BRIEF.md definition of done explicitly includes "deploys cleanly to Vercel." REFLECTIONS confirmed this was the one outstanding criterion. Phase 7 does not end until the live URL is reachable and recorded.
