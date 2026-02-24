# Phase 5: Playwright E2E Testing & Gameplay Video Recording

## Objective
Install Playwright and write end-to-end tests that exercise the full game loop — launching the game, moving pieces, clearing lines, reaching game over, and submitting initials to the leaderboard — with video recording enabled so every test run produces a `.webm` artifact of real gameplay. This phase closes the testing gap between the unit-tested engine and the rendered, interactive game, giving the project automated proof that the whole stack works together.

## Scope

### In Scope
- Install `@playwright/test` and download Chromium browser binary
- `playwright.config.ts` configured to run against `npm run preview` (the Vite production build), headless by default, Chromium only, retries: 1, video: `'on'`, reporter: `html`
- `tests/gameplay.spec.ts` test suite with the scenarios listed in Requirements
- `npm run test:e2e` and `npm run test:e2e:ui` scripts added to `package.json`
- Video artifacts written to `test-results/` on every run
- All 206 existing Vitest unit tests continue to pass

### Out of Scope
- Firefox or WebKit browser coverage (Chromium only for MVP)
- GitHub Actions / CI pipeline changes (no workflow file changes this phase)
- Visual regression / pixel-diff comparisons
- Performance or load testing
- Start screen, pause, or resume UI (Phase 6)
- Any changes to game logic or rendering code

## Requirements

### Functional
- **R1** — `playwright.config.ts` must set `use: { video: 'on', headless: true }`, `retries: 1`, `reporter: 'html'`, and a `webServer` block that runs `npm run preview` before tests start
- **R2** — The webServer `url` must be `http://localhost:4173` (Vite preview default); Playwright must wait for it to be ready before launching tests
- **R3** — `tests/gameplay.spec.ts` must include these test cases:
  1. **Canvas visible** — page loads, the `<canvas>` element is visible, and a piece is active (DOM score element exists and reads `"0"`)
  2. **Move and rotate** — simulate left arrow ×3, right arrow ×2, up arrow (rotate) ×1 without crashing; score element still exists after the sequence
  3. **Line clear increases score** — inject a near-complete board state via `page.evaluate()` (9 filled cells per row for several rows, leaving column 0 open), then hard-drop a vertical I-piece into column 0; assert score increases above 0
  4. **Game over overlay** — inject a board state that is one piece away from topping out, drop that piece, wait for the game-over overlay to become visible
  5. **Leaderboard flow** — after game-over overlay is visible, type three-character initials (`"AAA"`) and press Enter; assert the leaderboard table appears with at least one row containing `"AAA"`
- **R4** — `test-results/` directory must contain at least one `.webm` file after a test run
- **R5** — `npm run test:e2e` exits 0 when all Playwright tests pass

### Non-functional
- Tests must be deterministic: use `page.evaluate()` to inject board state rather than waiting for gravity-based line clears, eliminating timing flakiness
- Playwright `timeout` per test: 30 000 ms (default); no test should require more
- `test-results/` is already in `.gitignore` (or add it); video artifacts are not committed

## Acceptance Criteria
- [ ] `npm install` (or `npm ci`) installs Playwright and downloads Chromium without error
- [ ] `npm run build && npm run test:e2e` passes all 5 test cases in a clean environment
- [ ] After a test run, `test-results/` contains at least one `.webm` file
- [ ] `npm run test:e2e:ui` launches Playwright UI mode without error (manual verification)
- [ ] `npm test` (Vitest) still reports 206 passing tests, 0 failures
- [ ] No game source files (`src/`) are modified
- [ ] `test-results/` is listed in `.gitignore`
- [ ] All tests pass
- [ ] Code compiles without warnings

## Testing Strategy

### Framework
Playwright (`@playwright/test`) for e2e; Vitest unchanged for unit tests. The two test suites are independent — `npm test` runs Vitest, `npm run test:e2e` runs Playwright.

### Key Test Scenarios
1. **Sanity / canvas visible** — confirms Vite build + Three.js boot succeeds end-to-end
2. **Input handling** — confirms keyboard events reach the game engine without throwing
3. **Line clear via injected state** — use `page.evaluate()` to call `window.__gameState.board` setters (or equivalent exposed handle) to place a near-complete board; hard-drop closes the line; score DOM element increases. This avoids waiting for real-time gravity.
4. **Game over detection** — inject a board that tops out on next piece; assert overlay `display !== 'none'`
5. **Leaderboard submission** — full flow: game-over → type initials → submit → table row visible

### Board State Injection
The game must expose a test hook. Add a single line to `main.js` (or equivalent entry):
```js
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  window.__gameState = gameState;
}
```
Playwright tests running against `npm run preview` (`MODE=production`) cannot use this hook — instead use `page.evaluate()` with `window.__gameState` exposed unconditionally in the production build for this phase (acceptable trade-off; can be gated behind a build flag in a later phase).

**Decision**: Expose `window.__gameState = gameState` unconditionally in `main.js` for Phase 5. Document the trade-off in code comments. Phase 6 can add a build-flag gate.

### Timing Strategy
- Do NOT poll on gravity ticks or animation frames
- After injecting board state and sending a hard-drop key, wait for a DOM selector assertion (score value change or overlay visibility) with `expect(locator).toBeVisible({ timeout: 5000 })`
- Use `page.keyboard.press('Space')` for hard drop (verify keybinding in `src/input.js` before implementing)

### Coverage Expectations
- E2E tests are not measured for line coverage; they are pass/fail scenario tests
- Vitest unit coverage must remain at or above the Phase 4 baseline (97%+ engine coverage)

### Flakiness Mitigation
- Inject board state rather than playing in real-time
- No `page.waitForTimeout()` calls — use assertion-based waits only
- `retries: 1` in Playwright config catches transient CI noise without hiding real failures

## Documentation Updates
- **CLAUDE.md**: Add section documenting `npm run test:e2e` and `npm run test:e2e:ui` commands; note that Playwright tests require `npm run build` first (runs against preview server)
- **README.md**: Add "E2E Tests" section explaining how to run Playwright, where video artifacts are saved, and that `npm run build` is required before `npm run test:e2e`
- **AGENTS.md**: Add `npm run test:e2e` to the "How to run tests" section with the caveat that `npm run build` must run first

## Dependencies
- Phase 4 must be complete and committed (all 206 unit tests passing, production build working)
- `npm run preview` must serve the production build at `localhost:4173`
- No external services required — Playwright downloads Chromium locally

## Adjustments from Previous Phase

From Phase 4 REFLECTIONS.md:

- **Playwright environment decisions up front (carried forward):** The spec resolves browser choice (Chromium only), video format (`.webm`), and timing strategy (inject board state, assertion-based waits) before implementation begins — rather than leaving these to the implementer.
- **No implementation constants as estimates:** Unlike Phase 4's "~18 units" camera Z, this spec does not give pixel coordinates or timing thresholds — those are derived during the plan/research step.
- **Flakiness is a first-class concern:** The spec explicitly forbids `page.waitForTimeout()` and requires board-state injection to eliminate gravity-timing dependencies.
- **Test correctness over test count:** Phase 4 deleted a false-positive test. This phase starts with 5 well-defined scenarios with explicit assertions so each test passes for the right reason.
- **`test-results/` in `.gitignore`:** Phase 4 noted that video artifacts must not be committed — this is an explicit acceptance criterion here.
