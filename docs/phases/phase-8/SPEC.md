# Phase 8: Mobile Touch Controls & Sound Toggle

## Objective

Phase 8 adds mobile playability to Tron Tetris. The game currently requires a keyboard, locking out every phone and tablet user. This phase adds on-screen touch controls (a D-pad + rotate/drop buttons) and a mute toggle so players on any device can enjoy the full game. It also fixes the three stale E2E test guards identified as technical debt in Phase 7.

## Scope

### In Scope
- On-screen touch control overlay (move left, move right, rotate, soft drop, hard drop)
- Mute/unmute toggle accessible via `M` key and a touch-friendly HUD button
- Touch-target sizing and layout that works on small screens (≥375px wide)
- Responsive layout: HUD and board remain usable at mobile viewport widths
- Stale `waitForFunction` guard fixes in E2E Tests 8, 9, and 10 (technical debt from Phase 7)
- E2E tests covering: touch controls trigger game actions, mute button toggles audio

### Out of Scope
- Swipe-gesture controls (tap-buttons are more reliable and discoverable for a Tetris game)
- Full responsive redesign for landscape/portrait mode switching
- Physical gamepad / controller support
- Online multiplayer or backend services
- Android/iOS app packaging (PWA or native)

## Requirements

- **R1 Touch Controls**: An always-visible touch overlay appears on touch-capable devices (or when viewport width ≤ 768px). It provides buttons: ←, →, ↑ (rotate), ↓ (soft drop), and ⬛ (hard drop).
- **R2 Touch → Game Actions**: Each touch button fires the same game action as its keyboard equivalent. Holding ← or → auto-repeats at the same rate as keyboard held-key repeat. Touch events must not scroll the page.
- **R3 Touch & Keyboard Coexist**: Keyboard controls must remain fully functional when touch controls are visible. A physical keyboard user is not degraded.
- **R4 Mute Toggle**: Pressing `M` during active play toggles all game audio on/off. State persists across restarts within the session. A visible `🔊` / `🔇` indicator in the HUD reflects current state.
- **R5 Touch Mute**: The mute indicator is tappable on touch devices and toggles audio the same as `M`.
- **R6 Mute Respects Overlays**: Audio cannot be toggled from the start screen or pause overlay (only during active play or game over).
- **R7 E2E Guard Fixes**: `waitForFunction` guards in Tests 8, 9, and 10 upgraded to the rigorous two-condition form `gs != null && gs.pieceType !== null` (matching Tests 3–5 pattern from Phase 7 MUST-FIX).
- **R8 Responsive Layout**: At 390×844px (iPhone 14 portrait) the game canvas, HUD, and touch overlay are all visible without horizontal scroll. The canvas fills the remaining vertical space after the touch overlay.
- **Non-functional**: Touch buttons must have a minimum tap target of 44×44px (WCAG 2.5.5).

## Acceptance Criteria

- [ ] On a touch-capable viewport, touch control buttons are visible during active play
- [ ] Tapping ← / → moves the active piece left / right (verified by `gameState.col` change)
- [ ] Tapping ↑ rotates the active piece (verified by `gameState.rotation` change)
- [ ] Tapping ↓ triggers soft drop (piece moves down faster)
- [ ] Tapping ⬛ triggers hard drop (piece lands immediately)
- [ ] Keyboard controls still work with touch overlay visible
- [ ] Pressing `M` toggles mute; HUD icon changes between `🔊` and `🔇`
- [ ] Tapping the mute icon on a touch device toggles mute
- [ ] Page does not scroll when touch control buttons are pressed
- [ ] Layout is usable at 390×844 viewport (no horizontal overflow)
- [ ] E2E Tests 8, 9, 10 `waitForFunction` guards upgraded to two-condition form
- [ ] All existing 206+ Vitest unit tests pass
- [ ] All 10+ Playwright E2E tests pass
- [ ] Code compiles without warnings

## Testing Strategy

- **Vitest unit tests**: Add tests for mute toggle logic (a simple boolean flag on a new `AudioManager` or in `main.js`). No new engine logic — existing sound infrastructure needs only a gating condition.
- **Playwright E2E — touch simulation**: Use Playwright's `page.touchscreen.tap()` and `page.setViewportSize({ width: 390, height: 844 })` to simulate a phone. New E2E tests (Tests 11–14):
  - **Test 11**: Touch ← button → `gameState.col` decreases
  - **Test 12**: Touch ↑ button → `gameState.rotation` changes
  - **Test 13**: Touch ⬛ button → piece lands instantly (row jumps to near-bottom)
  - **Test 14**: Touch mute icon → mute flag toggles (via `window.__gameState.muted` hook)
- **E2E guard fixes** (Tests 8, 9, 10): Replace stale `!== undefined` guards with `gs != null && gs.pieceType !== null`.
- **Manual verification**: Load the live Vercel URL on an actual mobile browser to confirm touch responsiveness.
- Coverage expectation: existing engine coverage unchanged; new mute logic covered by unit test.

## Documentation Updates

- **CLAUDE.md**: Add Phase 8 section noting touch control overlay architecture (event delegation on `#touch-controls` div) and mute flag location.
- **README.md**: Add "Controls" section listing both keyboard shortcuts and touch controls; note that touch controls appear automatically on touch devices.
- **AGENTS.md**: Add note that `window.__gameState.muted` is exposed under `VITE_TEST_HOOKS` for E2E mute assertions.

## Dependencies

- All Phase 7 deliverables must be in place (10 passing E2E tests, live Vercel deploy)
- No new npm packages required — Playwright touch APIs are already available in `@playwright/test`
- No backend or external services needed

## Adjustments from Previous Phase

**From Phase 7 REFLECTIONS:**

- **Pre-check CLI tools before the session**: Phase 7 MUST-FIX was partly caused by Vercel CLI not being authenticated. Phase 8 has no CLI deploy step — the Vercel GitHub integration is not in scope here — but the lesson applies: verify `npx playwright --version` and confirm the preview server starts cleanly before writing any code.
- **Write `waitForFunction` as a named helper**: Phase 7 noted that the guard is duplicated across 5 tests and a one-line upgrade required five edits. Phase 8 should extract a `waitForGameReady(page)` helper in `tests/gameplay.spec.ts` and use it everywhere, so future guard changes are a single-line fix.
- **R4 documentation pattern**: Phase 7's narrow compliance (inline comment only) is not acceptable here. Mute toggle behavior must be covered by at least one Vitest unit test and one E2E assertion — not just a comment.
- **REVIEW.md BLOCKING labels**: Apply explicit `BLOCKING` / `NON-BLOCKING` labels to any MUST-FIX items, so phase completion is unambiguous.
