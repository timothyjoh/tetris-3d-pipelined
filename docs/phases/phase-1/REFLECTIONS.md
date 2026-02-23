# Reflections: Phase 1

## Looking Back

### What Went Well

- **Complete feature delivery**: All 9 PLAN tasks were implemented — scaffold, engine, rotation, game state, Three.js renderer, bloom post-processing, game loop, HUD, and docs. Every spec acceptance criterion was met.
- **Architecture held up**: The strict three-layer separation (engine → renderer → orchestration, no upward imports) worked exactly as designed. Engine modules were pure JS with zero DOM or Three.js dependencies, making them easy to unit test in Node.
- **High coverage after fix pass**: Final coverage 98.54% line (vs 90.23% initial, vs 80% target). The fix phase caught and closed real gaps rather than just patching superficial issues.
- **`three/addons/` decision paid off**: Using the bundled Three.js jsm path instead of the separate `postprocessing` npm package eliminated a dependency and worked seamlessly with Vite's module resolution.
- **Block mesh pool pattern**: Pre-allocating 220 `THREE.Mesh` instances and toggling visibility each frame avoided per-frame object creation/GC pressure. The pattern is clean and correct.
- **Build output clean**: `vite build` produced `dist/index.html` with zero errors or warnings on first attempt.

### What Didn't Work

- **Lock delay bug (critical)**: `_lockAccum` was accumulated with `interval` (the gravity period) inside the gravity-tick block, not with real `dt` per frame. At level 1 (1000ms gravity), the piece locked the instant the first gravity tick fired after landing — effectively a ~1s lock delay, not 500ms, and not independent of gravity. The fix required restructuring the `update()` loop to accumulate lock time every frame when `_landed === true`. This was a conceptual error in the original implementation: conflating gravity time with lock time.
- **Test coverage for `update()` was zero initially**: The most complex method in the engine — driving gravity, lock delay, and piece locking — was entirely untested in the initial pass. Spec testing strategy explicitly called for `update(dt)` tests. This gap was caught by the review but should have been caught during implementation.
- **Incorrect bug comment left in test**: `board.test.js` contained a comment claiming `clearRows` had a "splice+unshift index shift bug." The actual implementation used a filter-based approach (not splice+unshift) and was correct. The comment referenced a draft implementation that was never written. This created false confusion and the test was left deliberately incomplete, providing false confidence.
- **Multi-line scoring untested**: Only 1-line scoring at level 1 was tested initially. 2-line (300pts), 3-line (500pts), and 4-line (800pts) cases, plus the level multiplier, were missing — despite the spec explicitly listing them as required test scenarios.
- **Dependency injection assertion was broken**: The `secondPiece` constructor injection test asserted `validTypes.toContain(gs.nextPieceType)` (any valid type) rather than `toBe('T')`. This meant the test passed even if injection was completely broken.

### Spec vs Reality

- **Delivered as spec'd**: Vite scaffold, Vitest + V8 coverage, all 7 tetrominoes + SRS wall kicks, gravity speed curve, lock delay (post-fix), keyboard controls (Left/Right/Up/X/Z/Down/Space/P), line clear + row shift, scoring × level, level progression, Three.js WebGLRenderer + OrthographicCamera, MeshStandardMaterial with emissive color, EffectComposer + UnrealBloomPass + OutputPass, grid LineSegments overlay, board background plane, HUD (score/level/lines/next-piece), game-over overlay + restart, AGENTS.md, README.md, CLAUDE.md update, dist/ build.
- **Deviated from spec**: Lock delay was initially implemented incorrectly (gravity-tick accumulation instead of per-frame); fixed during the fix pass. The `_landed` flag was initially unused (noted as dead code in review) but became load-bearing after the lock delay fix.
- **Deferred**: Nothing in Phase 1 scope was deferred. Board tilt, sound, spring animation, and leaderboard are Phase 2/3 per spec.

### Review Findings Impact

- **Lock delay timing bug**: Fixed by restructuring `update()` to accumulate `_lockAccum` every frame when `_landed` is true, independent of the gravity-tick cadence. Piece now correctly locks after 500ms of real time at all levels.
- **Incomplete 4-row clear test**: Replaced with a complete test: pre-fill rows 16–19, place sentinel at row 15, call `clearRows`, assert 4 cleared, assert sentinel shifted to row 19, assert rows 0–3 empty.
- **`update(dt)` untested**: Added 6 tests covering: pause/over guards, gravity tick, lock after 500ms, soft drop interval selection, min(50, normalInterval) behavior. All required calling the public `update()` method with controlled `dt` values.
- **Multi-line scoring**: Added tests for 2-line (300pts), 4-line (800pts), and level-2 multiplier (200pts for 1-line).
- **Rotation via GameState**: Added 4 tests for `rotateCW`/`rotateCCW` via GameState, including `_lockAccum` reset on successful rotation and no-op when paused.
- **Wall kick coverage**: Added left-wall CCW kick test (CCW 0→3 forces rightward kick) and floor kick test (J piece near floor, kick shifts upward).
- **Weak injection assertion**: Replaced with `expect(gs.nextPieceType).toBe('T')`.

---

## Looking Forward

### Recommendations for Next Phase

- **Start with the tilt math before writing any Three.js code**: The board tilt requires mapping `(col - 5) / 5 → angle_deg` (roughly) and applying it as a camera or board group rotation. The angle must be capped at ±7°, and the spring/damping math (`velocity += (target - current) * spring; velocity *= damping`) is where subtle bugs hide. Write and test this in isolation before wiring it to the render loop.
- **Web Audio API oscillator cleanup is a known footgun**: `OscillatorNode` must be stopped and disconnected after playback or the Web Audio graph leaks. Implement a tiny `playTone(freq, duration, type)` helper that auto-stops, and test it at the helper level rather than inline in game event handlers.
- **`_landed` flag is already available**: The lock delay fix left `this._landed` as an accurate "piece is resting on surface" signal updated every frame. The Phase 2 tilt should read `_landed` to trigger the spring oscillation back to 0°. No new state needed.
- **The renderer layer accepts board state reads only**: Keep to this contract. The tilt angle should live in `GameState` (or a separate `AnimationState` struct read by the renderer), never computed inside `renderer/`.
- **Avoid sound-effect file assets**: BRIEF.md explicitly specifies Web Audio API synthesis (no audio files). Stick to that — it keeps the repo clean and removes a fetch dependency.

### What Should Next Phase Build?

Phase 2 scope per BRIEF.md:

1. **Board tilt effect** — Camera or board group Z-rotation tracks active piece column: `targetAngle = clamp((col - 4.5) / 4.5 * 7, -7, 7)` degrees. On piece landing (`_landed` transition or `_lockPiece()` call), target snaps to 0. Spring/damping animation in the render loop (`velocity += (target - current) * 0.15; velocity *= 0.75; current += velocity`) runs to zero. Purely cosmetic — no hitbox changes.
2. **Web Audio sound effects** — 8 sounds: move, rotate, soft drop, hard drop, line clear (single), Tetris (4-line), level up, game over. Synthesized via `AudioContext` → `OscillatorNode` + `GainNode`. Each sound is a short tone or chord (< 250ms). Hook into GameState events (or return event flags from `update()`) rather than calling audio from inside the engine.
3. **Polish pass** — Ghost piece (semi-transparent preview of where piece will land), piece lock flash (brief white flash on locked cells), line clear animation (brief horizontal sweep before rows disappear).

Phase 2 should defer: leaderboard, initials entry, full game-over screen redesign (Phase 3).

### Technical Debt Noted

- **Redundant bounds check**: `board.js:42` — `isValid()` checks `isInBounds(c, r) && !isBlocked(c, r)`, but `isBlocked` already returns `true` for out-of-bounds cells. The `isInBounds` call is dead. Not a bug, but could confuse a reader.
- **Unused `onRestart` callback**: `input.js:1` — `setupInput(gameState, onRestart)` receives a callback but never invokes it. Restart is handled via a direct button click in `main.js`. The parameter is a dead API surface. Either wire a keyboard restart key (e.g., Enter/R on game-over) or remove the parameter.
- **No keyboard restart shortcut**: Game over requires a mouse click on "PLAY AGAIN." A keyboard shortcut (Enter when overlay visible) would complete the keyboard-only control story. Low effort, high usability.
- **Next-piece preview uses Canvas 2D API**: `hud.js` renders the next-piece preview on a small 2D canvas inline. This is inconsistent with the Three.js renderer but is a minor inconsistency — not worth changing unless a unified renderer approach is adopted.
- **`restart()` has a redundant `randomPieceType()` call**: `gameState.js:99` — `this.nextPieceType = randomPieceType()` is immediately overwritten by `_spawnPiece()`. Dead assignment. Clean up before Phase 2.

### Process Improvements

- **Test `update(dt)` as part of the build task, not as a fix-phase catch**: The gravity/lock loop is the engine's most complex path. Next phase's build agent should be instructed to test time-dependent methods (any method accumulating a timer) with explicit `dt` calls during initial implementation, not wait for review to flag it.
- **Seed random functions before writing tests**: The `randomPieceType()` seeding via constructor injection worked well. Any new random-dependent system in Phase 2 (shuffle bag, random sound pitch variation) should have injectable seeds from the start.
- **MUST-FIX instructions need testable setup**: Task 4 in MUST-FIX.md had an incorrect test setup (filling rows "except cols 3-6" to create a 2-line clear scenario, which doesn't work with how the I piece fits). The fix agent had to reinterpret the setup. Phase 2's fix instructions should include exact cell values and the exact `expect(...)` assertion, not prose descriptions of intent.
