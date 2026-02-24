# Phase Review: Phase 2

## Overall Verdict

NEEDS-FIX — see MUST-FIX.md

2 critical issues (build warning violates spec, missing levelUp sound test) and several minor test-quality findings.

---

## Code Quality Review

### Summary

The Phase 2 implementation is architecturally clean and largely correct. All six new modules (`tilt.js`, `ghost.js`, `sounds.js`, and the GameState/renderer/input changes) follow existing patterns faithfully: pure engine functions, pool-based rendering, no Three.js in engine layer, injectable AudioContext. The sweep/flash/ghost pipeline is logically sound. Documentation updates are thorough.

Three issues are worth calling out: the build emits a chunk-size warning that violates the SPEC's "no warnings" requirement; the tilt formula receives the piece's left-origin column rather than its center column as the SPEC requires; and the sweep animation is a uniform emissive fade rather than a left-to-right "horizontal sweep."

### Findings

1. **Build warning — SPEC violation**: `npm run build` emits "(!) Some chunks are larger than 500 kB after minification." The SPEC acceptance criterion states "`npm run build` must produce `dist/index.html` with no errors or warnings." `vite.config.js` has no `build.chunkSizeWarningLimit` setting. — `vite.config.js:3`

2. **Tilt column: left-origin vs. center column**: The SPEC says the formula's `col` parameter is "the active piece's center column." `main.js` passes `gameState.col` (the left-origin column) to `computeTiltAngle`. An I piece spawning at `col=3` tilts the board `(3-4.5)/4.5*7 = -2.33°` immediately on spawn rather than 0°. The practical maximum achievable tilt for a 4-wide piece (left-origin col up to 6) is `(6-4.5)/4.5*7 ≈ 2.33°`, not the spec'd ±7°. This was an explicit PLAN decision that silently contradicts the SPEC. — `src/main.js:55`

3. **Sweep animation is uniform fade, not horizontal sweep**: The SPEC calls for a "horizontal sweep effect across cleared rows." The implementation overrides all cells in a completed row to white at the same time and fades their emissive intensity uniformly over 150ms. There is no left-to-right column propagation. The 150ms timing requirement is met, but the visual character differs from the spec description. — `src/renderer/render.js:31-34`

4. **`playTone` creates an untracked `AudioContext` when `ctx=null`**: When `ctx` is not supplied, a new `AudioContext()` is created inline and never closed, resumed, or stored. In production (via `main.js`), `ctx` is always passed, so this path is dead code in the running game. But any direct call to `playTone` without a context leaks an audio context. — `src/audio/sounds.js:24`

5. **`sweepRows.includes(r)` called inside double loop**: In `render.js:24`, `gameState.sweepRows.includes(r)` is inside the outer loop over all 20 rows. The inner array is at most 4 elements so the cost is negligible, but a `Set` lookup would be O(1) vs O(4). Not a correctness issue. — `src/renderer/render.js:24`

### Spec Compliance Checklist

- [x] Board tilt angle computed as `clamp((col - 4.5) / 4.5 * 7, -7, 7)`
- [ ] Tilt formula's `col` is the active piece's **center** column — implementation uses left-origin column, max achievable tilt is ~±2.33° for 4-wide pieces (not ±7°)
- [x] Tilt target resets to 0° on piece lock (`justLocked` flag)
- [x] Spring/damping parameters: velocity += (target-current)*0.15; velocity *= 0.75; current += velocity
- [x] Tilt applied to Three.js board group Z-rotation, never to game logic
- [x] Tilt state (`tiltAngle`, `tiltVelocity`, `justLocked`) lives on `GameState`, not in `renderer/`
- [x] All 8 sound effects present: move, rotate, softDrop, hardDrop, lineClear, tetris, levelUp, gameOver
- [x] All audio synthesized via `AudioContext` + `OscillatorNode` + `GainNode`
- [x] Every oscillator stopped and disconnected via `onended`
- [x] `playTone` helper encapsulates oscillator lifecycle with injectable context
- [x] Ghost piece rendered using pool (no per-frame allocation); reflects hard-drop landing row
- [x] Lock flash is purely visual; does not delay game loop
- [x] Flash timer runs before `paused || over` guard (works even on game-over frame)
- [x] Line-clear sweep completes within 150ms
- [x] Game loop does not tick gravity during sweep (`_sweeping` guard)
- [x] Keyboard restart (Enter / R) only fires when `gameState.over === true`
- [x] Enter/R does not conflict with in-game controls (falls through switch only when not game-over)
- [x] Redundant `randomPieceType()` call removed from `restart()`
- [x] `onRestart` callback wired in `input.js`
- [x] All existing tests pass (158 tests green)
- [ ] `npm run build` no errors or **warnings** — chunk-size warning present
- [x] `npm run test:coverage` ≥ 80% on engine modules (97.8% achieved)
- [x] AGENTS.md updated with Phase 2 additions section
- [x] README.md feature list updated with all Phase 2 features

---

## Adversarial Test Review

### Summary

Test quality is **adequate**. The engine is well covered (97.8% statements). The new `tilt.test.js` tests are strong — exact arithmetic assertions with hand-verified calculations. The `ghost.test.js` tests use real `Board` instances (no mocking), matching the PLAN's anti-mock bias. The `sounds.test.js` is weak on assertion depth: it confirms that oscillators are created and the lifecycle runs, but never verifies that events play with the correct frequency, waveform, or duration. A critical scenario — the `levelUp` sound event — has no test at all.

### Findings

1. **Missing test case — `levelUp` sound event**: The `gameState.test.js` sound-events suite covers `move`, `rotate`, `hardDrop`, `lineClear`, `tetris`, `gameOver`, and `softDrop`. There is no test verifying that `soundEvents` contains `'levelUp'` after `_finalizeSweep()` crosses a level boundary. The `levelUp` push path exists at `gameState.js:259` but is not directly tested. — `src/__tests__/gameState.test.js` (absent), `src/engine/gameState.js:259`

2. **Weak assertions — `playGameSound` event dispatch**: The `playGameSound` test loops over all 8 event names and asserts only `not.toThrow()` and `createOscillator` called. This passes even if all 8 events triggered the same frequency/type/duration. There is no per-event assertion on `osc.frequency.setValueAtTime`, `mockOsc.type`, or `mockOsc.stop` call argument. — `src/__tests__/sounds.test.js:76-89`

3. **Happy-path only — ghost piece rotation coverage**: All 5 `ghost.test.js` tests use `rotation=0`. The `computeGhostRow` function delegates to `board.isValid()` which calls `board.getPieceCells()` — both of which are already tested for rotations in `board.test.js`. However, a rotated-piece ghost test (e.g., I piece `rotation=1`, 1-wide/4-tall) would confirm that `computeGhostRow` works end-to-end for non-horizontal pieces. No such test exists. — `src/__tests__/ghost.test.js`

4. **Missing boundary — `sweepProgress` clamped at 1.0**: `sweepProgress` getter clamps to `Math.min(1, ...)`. Tests verify `sweepProgress ≈ 0` at t=0 and `≈ 0.5` at t=75ms, but there is no test confirming that `sweepProgress` returns exactly 1 when `_sweepAccum >= SWEEP_DURATION_MS` (the clamp edge). — `src/__tests__/gameState.test.js:497-507`

5. **No tests for `input.js` keyboard restart**: The Enter/R handler in `input.js:9-12` is completely untested. The `node` Vitest environment cannot dispatch DOM `keydown` events without a mock, and no such mock is set up. This means the conditional restart path (`gameState.over === true`) and the no-op path (game active) are both untested. — `src/__tests__/` (absent), `src/input.js:9-12`

6. **Mock setup concentration in `sounds.test.js`**: `makeMockCtx()` creates 6 mock objects (ctx, mockOsc, mockGain, disconnectOsc, disconnectGain, and implicit destination). This is necessary given the Web Audio API shape and is the right approach — the mock accurately mirrors the real interface. The mocking is not abusive (it replaces the external API, not the system under test). Acceptable as-is but noted. — `src/__tests__/sounds.test.js:4-31`

7. **Test independence — shared `GameState` instances**: Each test in `gameState.test.js` constructs a fresh `GameState({ firstPiece, secondPiece })`. No shared state between tests. Test independence is strong.

### Test Coverage

```
gameState.js  : 97.8% stmts | 95.16% branch | 86.95% funcs | uncovered: lines 162-164, 167-168
ghost.js      : 100%
tilt.js       : 100%
board.js      : 100%
rotation.js   : 100%  (branches 27,29 uncovered — wall-kick edge cases)
tetrominoes.js: 100%
```

**Coverage above 80% threshold on all engine modules.** Uncovered lines in `gameState.js` are `getActivePieceCells()` (lines 162-164) and `getActivePieceColor()` (lines 167-168) — renderer-facing methods not called by unit tests. These are exercised by the integration path in `render.js`.

**Missing test cases identified:**
- `levelUp` sound event in `_finalizeSweep()`
- `sweepProgress` clamp at 1.0
- Rotated ghost piece (rotation != 0)
- Per-event frequency/duration/type assertion in `playGameSound`
- Keyboard restart behavior (`input.js` Enter/R handler)
