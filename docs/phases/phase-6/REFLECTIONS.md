# Reflections: Phase 6

PROJECT COMPLETE

---

## Looking Back

### What Went Well

- **Two-overlay approach was correct**: Choosing `#start-overlay` and `#pause-overlay` as separate elements (rather than reusing `#overlay`) avoided all the conditional child-hiding complexity around the game-over `#overlay`'s initials/leaderboard/restart children. The PLAN made this call early and it paid off — zero regressions in the existing game-over flow.

- **State-machine keydown handler pattern worked cleanly**: Registering the single handler BEFORE `setupInput` ensured correct event priority. The phase-sequencing (`start → playing → paused ↔ playing → over`) is a self-describing, linear pattern that didn't require any flag gymnastics to prevent ESC from immediately pausing a just-started game.

- **`VITE_TEST_HOOKS` build-flag approach was correct**: Baking the flag into the preview build at `webServer.command` time (rather than runtime injection) is the right architecture for a Vite app — `import.meta.env` variables are replaced at build time, not served dynamically. The key insight (now in MEMORY.md) is that the build step is *load-bearing*, not cosmetic.

- **REVIEW + MUST-FIX pipeline caught all real issues**: The three MUST-FIX items were genuine gaps — one correctness footgun (`reuseExistingServer` + build-time flag), one test comment that misled about test behavior, one missing E2E test for a spec acceptance criterion. All three were fixed. Test 9 (ESC-after-game-over) was added cleanly. The adversarial review caught issues the implementation step missed.

- **Spec respected its own lesson from Phase 5**: Forcing exact assertion values into the spec language (`toBe(true)`, `toHaveText('0')` rather than `toBeTruthy()`, `not.toHaveText('0')`) meant the implementer couldn't quietly write weak assertions. This is a process win worth preserving.

- **All 7 BRIEF.md features delivered**: Classic engine, board tilt, Tron aesthetic, 3D block geometry, scoring/leveling, retro sounds, and local leaderboard — all implemented and tested across 6 phases. 206+ Vitest unit tests, 9 Playwright E2E tests. Clean build.

### What Didn't Work

- **`stopImmediatePropagation` omission creates hidden-paused edge case**: The state-machine handler calls `startGame()` and `return`s, but does NOT call `e.stopImmediatePropagation()`. Pressing `KeyP` to dismiss the start screen simultaneously fires `gameState.togglePause()` via `setupInput`, leaving the game paused with no pause overlay visible. This is a narrow edge case (only affects `KeyP`, not `Escape` or arrow keys), not covered by any test, and explicitly deferred from scope — but it's a silent state inconsistency that could confuse a player who uses `P` instead of any other key.

- **`reuseExistingServer` + build-time flag was a silent footgun**: The original implementation set `reuseExistingServer: !process.env.CI`. A developer with a running `npm run preview` instance would silently run tests against a stale build missing `VITE_TEST_HOOKS=true`, causing all board-injection tests to fail with a cryptic `undefined` reference rather than a clear "server already running" message. The REVIEW caught it; the fix (`reuseExistingServer: false`) is correct but slightly heavy-handed. The right fix might have been a `command` that only runs `npm run preview` (assuming the build already exists), with the build step separated. However, `reuseExistingServer: false` is simpler and correct for CI.

- **Test 7 silently hard-drops the piece**: Using `Space` to dismiss the start screen also fires `hardDrop()` via `setupInput` (since `stopImmediatePropagation` isn't called). The PLAN acknowledged this as acceptable, but the test comment doesn't document the side effect. A future maintainer changing `Space` to `Enter` (which also triggers `hardDrop`) or `ArrowLeft` (which moves the piece) would not understand why the key choice matters.

### Spec vs Reality

- **Delivered as spec'd**: R1–R9 all satisfied. Start overlay (`#start-overlay`) visible on load, game doesn't tick until dismissed (R1, R2). ESC pauses and shows `#pause-overlay` (R3). Any key resumes (R4). RAF continues while paused; `update(dt)` no-ops (R5). ESC on game-over does nothing (R6). `window.__gameState` gated (R7). All 206+ Vitest tests pass (R8). AGENTS.md corrected (R9). Three Phase 5 regressions fixed. Three new E2E tests (6–8) added. Documentation (AGENTS.md, CLAUDE.md, README.md) updated.

- **Deviated from spec**: None significant. The MUST-FIX process added Test 9 (ESC-after-game-over E2E test) which was an acceptance criterion gap the spec missed during authoring. `reuseExistingServer` was changed from `!process.env.CI` to `false` — a tighter constraint than spec'd but correctly motivated.

- **Deferred**:
  - Vercel production smoke test — explicitly out of scope per SPEC.md. Vercel deploy *config* was established in Phase 3. A live deploy verification was never performed in the automated pipeline.
  - `stopImmediatePropagation` on the state-machine handler — deferred as out-of-scope per PLAN.md. The narrow `KeyP`-on-start-screen edge case is undocumented and untested.
  - Click-to-start E2E test — `startOverlay.addEventListener('click', startGame)` is wired but no E2E test exercises the click path.

### Review Findings Impact

- **`reuseExistingServer` footgun**: Fixed in MUST-FIX Task 3 — changed to `false` with an explanatory comment; AGENTS.md warning added for developers.
- **Test 2 comment lies about ArrowLeft count**: Fixed in MUST-FIX Task 1 — comment now accurately documents that the first ArrowLeft is consumed by the state-machine handler.
- **Missing R6 E2E test**: Fixed in MUST-FIX Task 2 — Test 9 added, confirms ESC after game-over leaves `#pause-overlay` hidden and `gameState.paused === false`. 9 total E2E tests now pass.

---

## Looking Forward

### Recommendations for Next Phase

There is no next phase — Phase 6 was the final BRIEF.md phase. However, if the project were to continue, the following are the most actionable items:

- **Verify Vercel deploy**: The one BRIEF.md criterion never confirmed in the automated pipeline. A one-time `vercel --prod` smoke test with a check that the start overlay and WebGL canvas render in production is the only outstanding deliverable.

- **Fix `stopImmediatePropagation`**: The state-machine handler should call `e.stopImmediatePropagation()` after `startGame()` (and after `gameState.togglePause()` for pause/resume). This prevents game-control side effects when keys used to dismiss overlays happen to be also bound in `setupInput`. It's a 2-line fix.

- **Add click-to-start E2E test**: `startOverlay.addEventListener('click', startGame)` is tested manually but not in the E2E suite. A simple `page.click('#start-overlay')` + `expect(locator).toBeHidden()` test would close this gap.

- **Strengthen `waitForFunction` in Tests 3–5**: The current guard `window.__gameState !== undefined` is a no-op (it's set synchronously at module evaluation). A guard like `window.__gameState?.pieceType !== null` would better confirm the game loop has ticked at least once before board injection.

### What Should Next Phase Build?

The project is feature-complete per BRIEF.md. If a Phase 7 were scoped:

**Vercel Production Verification** (small, true "done is done"):
- Run `vercel --prod` and confirm the live URL renders the start overlay, WebGL canvas, and sound effects
- Add the live URL to README.md
- This is the last unchecked BRIEF.md criterion ("deploys cleanly to Vercel")

If the project were to grow beyond the brief, candidates are:
- Mobile/touch controls (swipe left/right/down, tap to rotate) — the BRIEF deferred this explicitly
- Sound toggle UI (currently no mute control; Web Audio is always on)
- Ghost piece rendering (standard Tetris UX, not in the BRIEF)

### Technical Debt Noted

- **`stopImmediatePropagation` missing**: `src/main.js` state-machine keydown handler — `KeyP` on start screen creates hidden-paused state (game paused, no overlay shown, no visual feedback). Minor but invisible to the player.

- **`waitForFunction` guards are no-ops in Tests 3–5**: `tests/gameplay.spec.ts:44, 79, 115` — `window.__gameState !== undefined` passes immediately since the value is set synchronously. Survives because board injection works regardless, but the guard provides false confidence.

- **Test 7 `Space` side effect undocumented**: `tests/gameplay.spec.ts:165` — the comment should note that `Space` triggers `hardDrop()` via `setupInput` on the same event. Without documentation, a future refactor to use `stopImmediatePropagation` would break this test's assumption.

- **README.md "board Z-rotates" stale text**: `README.md:11` — the Features section still describes Z-axis tilt from Phase 2. Phase 4 changed this to Y-axis. Was explicitly out of scope for Phase 6's doc updates.

### Process Improvements

- **`stopImmediatePropagation` discipline**: Any time a state-machine handler intercepts a key and returns early, explicitly call `e.stopImmediatePropagation()`. Make this a standard pattern in AGENTS.md. Failure to do so creates invisible action-on-dismiss side effects that are hard to debug.

- **MUST-FIX items should be tracked as acceptance criteria in the next SPEC**: Two of the three MUST-FIX items (missing Test 9 for R6, `reuseExistingServer` footgun) should have been caught in the SPEC or PLAN phase, not the REVIEW. The pattern: any time a `playwright.config.ts` env var or build flag is introduced, the spec should explicitly require a test that verifies the feature *fails without the flag* (or at minimum a local-dev footgun warning).

- **The pipeline worked well**: Research → Spec → Plan → Implement → Review → MUST-FIX produced a high-quality final deliverable. The adversarial review step caught real issues. The MUST-FIX step was small (3 items, all minor). This process should be the default for all future projects.

- **MEMORY.md lag**: The MEMORY.md was updated to reflect "8 E2E tests passing" before MUST-FIX Task 2 added Test 9. Update MEMORY.md as the *last* step, after all MUST-FIX items are resolved, not after the initial implementation.
