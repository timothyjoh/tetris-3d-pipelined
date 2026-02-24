# Phase 6: Start Screen, Pause, and Resume

## Objective

Phase 6 completes the game's lifecycle UX: the game no longer starts immediately on page load, a start screen greets the player; pressing Escape mid-game pauses and shows a blackout overlay; any key resumes from the exact saved state. This is the final BRIEF.md phase, so it also cleans up three known test-quality regressions carried over from Phase 5 and gates the `window.__gameState` test hook behind a build flag.

---

## Scope

### In Scope

- **Start screen overlay**: On page load, show a full-screen overlay (Tron aesthetic, same style as game-over) with the game title ("TRON TETRIS") and a prompt ("PRESS ANY KEY OR CLICK TO START"). The game loop and gravity do **not** tick until the overlay is dismissed.
- **Dismiss start screen**: Any keydown or a click on the overlay (or a dedicated "START" button) dismisses the start screen and begins the game loop.
- **Pause on ESC**: During active play (not game-over, not start screen), pressing `Escape` calls `gameState.togglePause()` and shows a "PAUSED" blackout overlay — obscuring the board and HUD.
- **Resume on any key**: While paused, any keydown dismisses the pause overlay and resumes the game exactly where it left off (no state reset).
- **ESC disabled on game over**: `gameState.togglePause()` already guards this (`if (this.over) return`). Wiring must ensure ESC doesn't re-show a pause overlay after the game-over overlay is shown.
- **Build-flag-gated test hook**: `window.__gameState` moves from unconditional to gated behind `import.meta.env.VITE_TEST_HOOKS === 'true'` (still exposed in `import.meta.env.DEV` for convenience). `playwright.config.ts` passes `VITE_TEST_HOOKS=true` via `webServer.env` so E2E tests still work against the production build.
- **Playwright test fixes (pre-work)**: Fix the three Phase 5 carryover regressions in `tests/gameplay.spec.ts` before writing any new tests:
  1. Remove `const BASE` hardcode; use `page.goto('/')` (baseURL already set in playwright.config.ts).
  2. Fix stale comment ("set on first RAF frame" → "set synchronously at module evaluation").
  3. Strengthen Test 3 assertion from `not.toHaveText('0')` to `toHaveText('800')`.
- **New Playwright tests**: 3 new tests covering start screen, ESC pause, and resume.
- **Documentation updates**: AGENTS.md stale Y-axis tilt snippet corrected; CLAUDE.md updated with Phase 6 conventions; README updated to document Escape/pause control.

### Out of Scope

- Mobile/touch pause or start interactions (keyboard-only is the MVP constraint).
- Persisting paused state across page reloads.
- Visual animations for the pause overlay appearing/disappearing (instant show/hide is fine).
- Any changes to game logic, scoring, or rendering.
- New audio events for pause/resume.
- Vercel production deploy (smoke test verification is advisory only — no CI deploy pipeline changes).

---

## Requirements

- **R1**: On page load the `#overlay` element (or a distinct `#pause-overlay` element — see note below) is visible with the game title and a start prompt; the game loop has not yet started (no gravity, no piece movement).
- **R2**: Pressing any key or clicking the start overlay dismisses it and starts the game loop from the beginning.
- **R3**: While the game is active (not paused, not over), pressing `Escape` sets `gameState.paused = true` (via `togglePause()`) and shows a "PAUSED" overlay.
- **R4**: While paused, pressing any key sets `gameState.paused = false` (via `togglePause()` or direct) and hides the pause overlay, resuming the game loop tick.
- **R5**: While paused, the game loop continues calling `requestAnimationFrame` but `gameState.update(dt)` is a no-op when `gameState.paused === true` (this is already true — no changes to GameState logic required).
- **R6**: ESC during game-over does not show the pause overlay and does not change `gameState.paused` (`togglePause()` already returns early when `this.over`).
- **R7**: `window.__gameState` is only set when `import.meta.env.VITE_TEST_HOOKS === 'true'` or `import.meta.env.DEV` is true. `playwright.config.ts` sets `VITE_TEST_HOOKS=true` in `webServer.env` so all E2E tests continue to work.
- **R8**: All Vitest unit tests continue to pass (no game engine changes).
- **R9**: AGENTS.md is updated to correct the stale Y-axis tilt description from Phase 2.

**Implementation note on overlay elements**: The existing `#overlay` element is a general-purpose overlay used for game-over. The simplest approach is to reuse it for pause (different `#overlay-title` text, hide score/initials/leaderboard/button), but a separate `#pause-overlay` element is also acceptable. Choose whichever keeps the HTML and JS cleaner. Document the choice in a comment.

---

## Acceptance Criteria

- [ ] On fresh page load, the start overlay is visible and the score remains "0" (game has not ticked).
- [ ] After pressing any key on the start overlay, the overlay is hidden and a piece is falling (game is live).
- [ ] Pressing `Escape` during active play shows a "PAUSED" overlay and the game stops advancing (a second time check: score and board do not change while paused).
- [ ] While paused, pressing any key (including `Escape`) hides the pause overlay and the game resumes.
- [ ] Pressing `Escape` after game-over does not show the pause overlay.
- [ ] `window.__gameState` is `undefined` in a standard production build (without `VITE_TEST_HOOKS=true`).
- [ ] `window.__gameState` is accessible in a build with `VITE_TEST_HOOKS=true`; all 8 Playwright tests pass against `npm run preview` with that env var set.
- [ ] The three Phase 5 test regressions are fixed: no `const BASE`, stale comment removed, Test 3 asserts `toHaveText('800')`.
- [ ] All 206+ Vitest unit tests pass.
- [ ] `npm run build` completes without warnings.

---

## Testing Strategy

### Unit tests (Vitest)
- No new unit tests required — `GameState.togglePause()` is already covered by existing tests.
- Confirm all existing tests still pass after any source changes.

### E2E tests (Playwright — `tests/gameplay.spec.ts`)

**Pre-work fixes** (fix before writing new tests):
- Remove `const BASE` and `page.goto(BASE)` → use `page.goto('/')`.
- Update stale RAF comment to reflect synchronous `window.__gameState` assignment.
- Change Test 3 assertion to `toHaveText('800')`.

**New tests** (add to `tests/gameplay.spec.ts`):

| # | Name | Setup | Assert |
|---|------|--------|--------|
| 6 | `start overlay is visible on load` | `page.goto('/')` | `#overlay` (or `#start-overlay`) is visible; `#hud-score` has text `'0'` |
| 7 | `game starts after keypress on start screen` | `page.goto('/')`, wait for start overlay; press `Space` | Start overlay hidden; canvas visible; game is live (a further `waitForFunction` confirming `!window.__gameState.over`) |
| 8 | `ESC pauses and any key resumes` | `page.goto('/')`, dismiss start screen, wait for game tick; press `Escape` | Pause overlay visible; `window.__gameState.paused === true`; then press `Space`; pause overlay hidden; `window.__gameState.paused === false` |

**Key assertions must use exact values, not weakened checks** (per Phase 5 process fix).

Tests 3–5 (board injection) must first dismiss the start screen before injecting board state. Update them to include a keypress to dismiss the start overlay before calling `waitForFunction(() => window.__gameState !== undefined)`.

### Coverage
- Existing Vitest coverage target (97%+ engine) must be maintained.
- No new engine code means no new coverage requirements.

---

## Documentation Updates

- **AGENTS.md**: Correct the stale Phase 2 Z-axis tilt description to reflect Y-axis tilt (Phase 4 change). Add note about `VITE_TEST_HOOKS=true` env var for E2E tests.
- **CLAUDE.md**: Add note that Phase 6 introduces a start screen; the game loop does not begin until the overlay is dismissed. Document that `window.__gameState` is gated behind `VITE_TEST_HOOKS`.
- **README.md**: Add `Escape` to the controls list with description "Pause / Resume". Add note that `npm run test:e2e` requires `VITE_TEST_HOOKS=true` (already handled by `playwright.config.ts` — just document it).

Documentation is part of "done" — code without updated docs is incomplete.

---

## Dependencies

- Phases 1–5 complete (Tetris engine, Three.js rendering, leaderboard, 3D blocks, Playwright E2E).
- `GameState.togglePause()` must exist and guard on `this.over` (confirmed in `src/engine/gameState.js:131`).
- `window.__gameState` currently exposed unconditionally in `src/main.js:35` — Phase 6 gates it.
- Playwright infrastructure from Phase 5 (`playwright.config.ts`, `webServer` pointing at `npm run preview`, Chromium + `--use-gl=angle`) is assumed present and working.

---

## Adjustments from Previous Phase

Based on REFLECTIONS.md from Phase 5:

1. **Fix carryover issues first**: REFLECTIONS explicitly called out three code-quality regressions that were shipped but not fixed. This spec makes fixing them the **first deliverable** of Phase 6 — before any new feature code is written. Treat REVIEW findings as blocking.

2. **Assertion precision is explicit spec language**: This spec uses exact assertion values (e.g., `toHaveText('800')`, `window.__gameState.paused === true`) rather than leaving assertion strength to the implementer. The Phase 5 lesson: weak assertions hide regressions.

3. **Start screen affects test setup**: REFLECTIONS warned that if `window.__gameState` is not set until after start is clicked, tests 3–5 need an extra dismiss step. This spec explicitly requires updating tests 3–5 to dismiss the start screen before injecting board state.

4. **`window.__gameState` build flag**: REFLECTIONS flagged this as deferred technical debt. This spec makes it a required deliverable, not optional polish.

5. **One commit per phase**: Per REFLECTIONS process note, the implementer should commit at the end of this phase so git log accurately records "Phase 6 complete."
