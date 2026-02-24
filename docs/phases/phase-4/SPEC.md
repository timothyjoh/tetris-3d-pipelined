# Phase 4: True 3D Blocks and Y-Axis Tilt

## Objective

This phase delivers the signature visual upgrade described in the brief: true 3D cube geometry for every block, a perspective camera so depth foreshortening is visible, directional lighting to show face shading, and corrected Y-axis board tilt so the side the active piece is on leans toward the viewer. The result is a board that feels like a physical slab in 3D space rather than a flat 2D grid. Before any new rendering work begins, the Phase 3 Enter-key race condition must be resolved so the leaderboard flow works correctly.

## Scope

### In Scope

- **Bug fix (Phase 3 carryover)**: Fix the Enter-key race condition in `src/main.js` where `handleInitialsKey` is registered before `setupInput`, causing game restart to fire on initials submission. The leaderboard table must be visible after pressing Enter with three initials.
- **PerspectiveCamera**: Replace the existing `OrthographicCamera` in `src/renderer/scene.js` with a `PerspectiveCamera` (FOV ~50°, positioned ~18 units back on Z) sized to frame the 10×20 board with comfortable margins.
- **True 3D cube geometry**: Change block geometry in `src/renderer/blockPool.js` from `BoxGeometry(0.95, 0.95, 0.1)` to `BoxGeometry(0.85, 0.85, 0.85)`; update the block's Z position in `cellToWorld` so blocks sit flush with the board plane (Z = 0.425, half the depth).
- **Directional key light**: Add a `DirectionalLight` (white or slight cyan tint, intensity ~1.0) aimed from front-top toward the board so cube faces show visible shading. Adjust `MeshStandardMaterial` roughness to ~0.4. Ambient light remains for fill.
- **Y-axis tilt**: Change `boardGroup.rotation.z` → `boardGroup.rotation.y` in `src/main.js`. Sign convention: piece left of center → positive Y angle (left edge toward viewer); piece right of center → negative Y angle (right edge toward viewer). The `computeTiltAngle` function and spring physics in `src/engine/tilt.js` are unchanged.
- **Resize handler update**: Ensure the `window resize` listener in `src/renderer/scene.js` updates the `PerspectiveCamera`'s aspect ratio correctly.
- **Board background/grid compatibility**: Verify `createBoardBackground` and `createGridLines` in `src/renderer/composer.js` render correctly under perspective projection; adjust Z positions if depth-fighting is visible.

### Out of Scope

- Game logic changes of any kind (engine, scoring, leaderboard, input)
- New sound effects or audio changes
- Post-processing changes (bloom parameters, render pipeline)
- Ghost piece or sweep animation changes
- Playwright e2e tests (Phase 5)
- Start screen or pause screen (Phase 6)
- Any mobile or touch input
- Fixing the `loadLeaderboard`/`saveLeaderboard` test coverage gap or XSS in `showLeaderboard` (noted as debt; not Phase 4 scope)

## Requirements

- The board must be framed fully in the viewport at the default canvas size with no clipping.
- Each locked block must visibly have three visible faces (top, front, side) when the board is at neutral tilt, confirming depth is perceptible.
- Directional lighting must produce face shading contrast — top face brighter than front face — without washing out Tron neon colors.
- The tilt direction must match the brief: active piece on the left → left edge of board comes forward (toward viewer); active piece on the right → right edge comes forward. Neutral at center.
- The tilt spring behavior (speed, overshoot, settle-to-zero on lock) must be unchanged from Phase 3.
- All 201 existing Vitest unit tests must pass with no changes to engine or test files.
- The Enter-key race condition must be fixed: submitting three initials and pressing Enter must show the leaderboard table and must NOT restart the game.

## Acceptance Criteria

- [ ] Entering three initials and pressing Enter shows the leaderboard table; the game does not restart.
- [ ] The Three.js camera is a `PerspectiveCamera`; `OrthographicCamera` is removed.
- [ ] Block geometry is `BoxGeometry(0.85, 0.85, 0.85)`; the old `BoxGeometry(0.95, 0.95, 0.1)` is gone.
- [ ] When the board is at neutral tilt, blocks appear as visibly 3D cubes with face shading — not flat squares.
- [ ] A `DirectionalLight` is present in the scene; ambient remains.
- [ ] Moving the active piece left causes the left edge of the board to lean toward the viewer (`rotation.y > 0`); moving right causes `rotation.y < 0`; landing resets toward 0.
- [ ] `boardGroup.rotation.z` is no longer written during the game loop; tilt is applied exclusively via `rotation.y`.
- [ ] Board background and grid lines render without visible depth-fighting artifacts.
- [ ] Resizing the browser window does not distort or clip the board.
- [ ] All 201 unit tests pass (`npm test`).
- [ ] `npm run build` completes without errors or warnings.

## Testing Strategy

- **Unit tests (Vitest)**: No changes to engine or HUD tests — all 201 must pass unmodified. Run `npm test` to verify.
- **Enter-key race fix verification**: Add or update a test in `src/__tests__/input.test.js` (or a new `initials-submit.test.js`) using jsdom that simulates the full sequence — game-over state → `initialsActive = true` → three character keydowns → Enter — and asserts `initialsActive` is `false` after Enter and that restart was not triggered. This is the test that would have caught the Phase 3 regression.
- **Rendering (visual/manual)**: Three.js rendering cannot be meaningfully unit-tested in jsdom. Acceptance for all rendering criteria is via manual inspection in the browser (`npm run dev`). The Phase 4 implementer must verify each rendering criterion by eye and sign off in the phase reflection.
- **No new Playwright tests**: E2e tests are Phase 5. Rendering correctness is confirmed manually this phase.
- **Coverage**: Engine coverage must remain ≥ 97%; the Enter-key integration test brings input coverage up, not down.

## Documentation Updates

- **CLAUDE.md**: Add a note that `boardGroup.rotation.y` (not `.z`) drives board tilt as of Phase 4; note that `PerspectiveCamera` is in use and `OrthographicCamera` has been removed.
- **README.md**: No user-facing changes required this phase; optionally note the 3D visual upgrade in the feature list.

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies

- Phase 3 must be complete and merged (all engine, leaderboard, HUD, and overlay features present).
- Three.js already installed; `PerspectiveCamera` is part of the standard Three.js export — no new packages needed.
- `MeshStandardMaterial` is already in use in `blockPool.js`; directional lighting requires no new dependencies.

## Adjustments from Previous Phase

Based on Phase 3 reflections:

- **Fix the Enter-key race first.** Phase 3's critical broken flow — initials submit triggers restart — must be repaired before any new work. The fix: ensure `handleInitialsKey`'s Enter branch calls `e.stopImmediatePropagation()` before `setupInput`'s listener can fire, or restructure so only one listener handles the initials flow. Verify with a new integration test before touching renderer code.
- **Test the event listener interaction, not just individual handlers.** The new initials-submit test must fire both listeners in registration order to confirm no race survives.
- **Don't change game logic.** Phase 4 is rendering-only. The temptation to "clean up" tilt math or event handling while touching `main.js` must be resisted — scope it to the exact lines that need changing.
- **Research before replacing the camera.** The camera position and FOV need calculation against the actual board dimensions (10 cols × 20 rows world units) — do the math first, confirm in-browser, then commit.
- **Commit at phase boundary.** Phase 3 work was not committed at completion. Phase 4 must end with a commit tagged "Phase 4 complete" so future phases bisect cleanly.
