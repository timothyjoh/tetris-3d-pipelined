# Phase 2: Board Tilt, Sound Effects, and Polish

## Objective

Elevate the playable Tetris engine from Phase 1 into a fully atmospheric Tron experience by adding the signature board tilt animation, synthesized 8-bit sound effects, and three gameplay polish features (ghost piece, lock flash, line-clear sweep animation). By the end of this phase, every player action — moving a piece, locking it, clearing lines — produces both a visual and an auditory response, and the board reacts to the player with a living, reactive tilt that snaps back on landing.

## Scope

### In Scope
- **Board tilt effect**: Board group Z-rotation tracks active piece column (±7° max); spring/damping animation drives it back to 0° on piece landing
- **Web Audio sound effects**: 8 synthesized tones via `AudioContext` — move, rotate, soft drop, hard drop, line clear, Tetris (4-line), level up, game over
- **Ghost piece**: Semi-transparent preview of where the active piece will land, rendered as dim neon outlines
- **Piece lock flash**: Brief white/bright flash on cells occupied by a just-locked piece
- **Line clear sweep animation**: Brief horizontal sweep effect across cleared rows before they are removed
- **Keyboard restart shortcut**: Enter or R key restarts the game when the game-over overlay is visible
- **Tech debt cleanup**: Remove the redundant `randomPieceType()` call in `restart()`, wire or remove the unused `onRestart` parameter in `input.js`

### Out of Scope
- Local leaderboard and initials entry (Phase 3)
- Full game-over screen redesign (Phase 3)
- Vercel deployment configuration (Phase 3)
- Mobile/touch controls (not in MVP)
- Audio file assets — all sound must be synthesized via Web Audio API (no `.mp3` / `.wav` files)
- Changes to Tetris engine game logic (rotation, collision, scoring, leveling)

## Requirements

- Board tilt angle must be computed as `clamp((col - 4.5) / 4.5 * 7, -7, 7)` degrees, where `col` is the active piece's center column (0-indexed)
- Tilt target resets to 0° the frame a piece locks; spring/damping parameters: `velocity += (target - current) * 0.15; velocity *= 0.75; current += velocity`
- Tilt is applied to the Three.js board group (Z-axis rotation) — never to hitbox or game-logic coordinates
- Tilt state (current angle + velocity) must live outside the `renderer/` module — in `GameState` or a dedicated `AnimationState` object readable by the renderer
- All 8 sound effects must be synthesized using `AudioContext` + `OscillatorNode` + `GainNode`; every oscillator must be stopped and disconnected after playback to prevent Web Audio graph leaks
- A `playTone(freq, duration, type, gainEnvelope?)` helper must encapsulate oscillator lifecycle; sound event handlers must not contain inline oscillator management
- Ghost piece must be rendered using the same mesh pool pattern as active blocks (no per-frame object allocation); it must always reflect the current hard-drop landing row
- Lock flash must be purely visual (a brief material color/emissive override on locked cells) and must not delay the game loop
- Line clear sweep must complete within 150ms; the game loop must not tick gravity during the sweep (brief pause)
- Keyboard restart (Enter / R) must only fire when the game-over overlay is visible and must not conflict with in-game controls
- All existing unit tests must continue to pass; new behavior must be covered by new tests
- `npm run build` must produce `dist/index.html` with no errors or warnings

## Acceptance Criteria

- [ ] Moving the active piece left/right visibly tilts the board toward the direction of movement (up to ±7°)
- [ ] When a piece locks, the board smoothly oscillates back to 0° via spring/damping animation (visible overshoot/settling)
- [ ] Tilt has zero effect on piece collision, wall kicks, or scoring
- [ ] A sound plays on: piece move, piece rotate, soft drop, hard drop, single line clear, 4-line Tetris clear, level up, game over
- [ ] No sound assets are fetched from the network; all audio is synthesized
- [ ] A ghost piece (dim neon outline) shows the landing position for the active piece at all times
- [ ] Locking a piece produces a visible bright flash on the locked cells that fades within ~100ms
- [ ] Clearing rows shows a brief horizontal sweep animation before the rows disappear
- [ ] Pressing Enter or R on the game-over screen restarts the game (no mouse required)
- [ ] `npm run test` passes with all existing and new tests green
- [ ] `npm run test:coverage` shows ≥ 80% line coverage on engine modules (maintained from Phase 1)
- [ ] `npm run build` completes with no errors or warnings
- [ ] All tests pass
- [ ] Code compiles without warnings

## Testing Strategy

- **Framework:** Vitest (existing), `@vitest/coverage-v8`
- **Key test scenarios:**
  - Tilt math: `computeTiltAngle(col)` returns correct clamped values at col=0 (−7°), col=4.5 (0°), col=9 (+7°), and mid values
  - Spring step: given a known current/velocity/target, one step of `stepSpring()` returns the correct next current and velocity
  - Tilt resets to 0° target when `_landed` is true (test the state transition, not Three.js render)
  - `playTone` helper: verify it creates and auto-stops an oscillator (mock `AudioContext` or verify no thrown errors)
  - Ghost piece row: `computeGhostRow(gameState)` returns the correct landing row for several piece/board configurations
  - Lock flash: after `lockPiece()`, flash state is set and cleared within the expected frame count
  - Line clear pause: `update(dt)` does not advance gravity during the sweep animation window
  - Keyboard restart: pressing Enter/R when `gameOver === true` resets game state; pressing Enter/R during active play has no effect
- **Coverage target:** ≥ 80% line coverage on engine modules (maintained); new tilt/audio/animation helpers should each have direct unit tests
- **No E2E tests required** (as stated in BRIEF.md)
- **Testability note:** Tilt math and spring step must be exported as pure functions testable in Node (no Three.js dependency). Audio helpers should accept an injectable `AudioContext` factory so tests can pass a mock.

## Documentation Updates

- **AGENTS.md**: Add a "Phase 2 additions" section noting the tilt/AnimationState contract, the `playTone` API signature, and the ghost piece computation location
- **README.md**: Update feature list to include board tilt, sound effects, ghost piece, and lock flash; note that all audio is synthesized (no audio files)
- **CLAUDE.md**: No structural changes needed; architecture decisions are in AGENTS.md

## Dependencies

- Phase 1 complete (Tetris engine, Three.js renderer, Tron aesthetic, Vitest setup — all delivered)
- No new npm packages required: Three.js `EffectComposer` already installed; Web Audio API is a browser built-in
- `_landed` flag already accurate in `GameState` (per Phase 1 fix pass) — available as landing signal for tilt reset

## Adjustments from Previous Phase

Based on Phase 1 reflections:

- **Test time-dependent logic during build, not fix**: The `update(dt)` gap from Phase 1 (gravity/lock loop untested until review) must not repeat. The line-clear pause and spring animation both accumulate time in `update()`. Tests for these must be written during the build task, not left for review.
- **Write tilt math as a pure, isolated function first**: Phase 1 reflections explicitly recommend implementing `computeTiltAngle` and `stepSpring` as pure functions, testing them, then wiring to the render loop. Do not start by editing Three.js scene code.
- **Inject `AudioContext` for testability**: Phase 1's Web Audio footgun warning (oscillator leak) is addressed by the `playTone` helper; the helper must accept an optional injected context so Vitest can mock it without a real Web Audio stack.
- **Exact test assertions, not prose intent**: Phase 1's MUST-FIX phase had ambiguous test setup descriptions. Any fix instructions for Phase 2 must include exact cell values and exact `expect(...)` calls.
- **Seed any new random systems at construction**: If sound pitch variation or any randomized effect is added, ensure it accepts an injectable seed from the start (matches the constructor-injection pattern that worked well in Phase 1).
