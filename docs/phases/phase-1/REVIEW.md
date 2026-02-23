# Phase Review: Phase 1

## Overall Verdict

NEEDS-FIX — see MUST-FIX.md

---

## Code Quality Review

### Summary

The implementation is structurally excellent. All required files exist, all 100 unit tests pass, engine line coverage is 90.23% (target ≥ 80%), and the architecture cleanly separates engine/renderer/orchestration with no upward imports. The build scaffold, Three.js renderer pipeline, and HUD are all correct. Two substantive bugs were found: a lock delay timing issue in GameState and an unused internal state flag `_landed`.

### Findings

1. **Lock Delay Bug — Critical**: `_lockAccum` is accumulated with `interval` (the gravity period) rather than real elapsed time `dt`. Because lock accumulation only happens inside the gravity-tick block, at level 1 (interval = 1000ms) the piece locks on the very first gravity tick after landing — `_lockAccum += 1000 >= 500` — rather than after an independently-running 500ms window. The spec requires "piece locks 0.5 s after landing (resets on move/rotate, max 15 resets)." At level 20 (interval = 17ms) the effective delay is ~510ms (close to spec), but at level 1 it is up to ~1000ms and fires the moment gravity ticks, not after 500ms. — `src/engine/gameState.js:57-60`

2. **Unused Field**: `this._landed` is set in `_spawnPiece` (line 120) and in `update()` (line 64) but is never read anywhere. It appears to be a leftover from an earlier draft. — `src/engine/gameState.js:40,64,120`

3. **Redundant Bounds Check**: `isValid()` checks `isInBounds(c, r) && !isBlocked(c, r)`. Since `isBlocked` already returns `true` for out-of-bounds cells, `isInBounds` is a no-op here. Not a bug, but dead logic. — `src/engine/board.js:42`

4. **Redundant Assignment in `restart()`**: Line 99 sets `this.nextPieceType = randomPieceType()` immediately before calling `_spawnPiece()` on line 100, which unconditionally overwrites `nextPieceType` again. The first assignment is never read. — `src/engine/gameState.js:99-100`

5. **`main.js` imports `createBoardBackground` and calls it** (line 3, line 11). The PLAN listed this as an optional commented-out call; the implementation correctly uncommented and used it. This is fine — the board background plane is a PLAN "Task 6" requirement. Minor divergence from PLAN stub text but matches spec. No issue.

6. **Input: no `onRestart` callback wiring**: `setupInput(gameState, onRestart)` receives an `onRestart` callback but never calls it from within the input handler. The only key that could restart is not present in the switch statement. `main.js` handles restart directly on the button click. This means there is no keyboard restart shortcut (only mouse click). The SPEC does not require a keyboard restart, so this is not a defect — just a minor coupling observation. — `src/input.js:1`

### Spec Compliance Checklist

- [x] Vite project scaffold (Vanilla JS / ES Modules)
- [x] Vitest test framework with V8 coverage
- [x] 10×20 grid, all 7 tetrominoes, SRS wall kicks
- [x] Gravity / gravity speed curve per Guideline
- [ ] Lock delay: piece locks 0.5s after landing — **implementation ties lock timer to gravity ticks, not real-time** (see Finding 1)
- [x] Lock resets on move/rotate, max 15 resets
- [x] Keyboard controls: Left/Right/Up/X/Z/Down/Space/P all wired
- [x] Line clear: correct rows removed, rows above shift down
- [x] Scoring: LINE_SCORES = [0, 100, 300, 500, 800] × level (code correct)
- [x] Level progression: `Math.floor(linesCleared / 10) + 1`
- [x] Three.js `WebGLRenderer`, `OrthographicCamera`
- [x] `MeshStandardMaterial` with `emissive` color
- [x] `EffectComposer` + `UnrealBloomPass` + `OutputPass`
- [x] Grid-line overlay (`LineSegments`)
- [x] Board background plane
- [x] HUD: score, level, lines, next-piece preview (2D canvas)
- [x] Game-over detection + restart prompt
- [x] `AGENTS.md` — new, correct
- [x] `README.md` — new, correct
- [x] `CLAUDE.md` — updated, cc-pipeline section preserved
- [x] `vite build` — produces `dist/index.html` (confirmed by dist/ directory existing)
- [x] All unit tests pass (`npm run test`: 100/100)
- [x] Engine line coverage ≥ 80% (actual: 90.23%)

---

## Adversarial Test Review

### Summary

Test quality is **weak for GameState**. The engine has strong coverage for Board and Tetrominoes, adequate coverage for rotation, but GameState tests are hobbled by two major omissions: `update(dt)` is never called (leaving gravity, lock delay, and soft drop entirely untested), and multi-line scoring (2/3/4 lines) has no test at all. There is also one deliberately incomplete test with a wrong comment that implies the implementation is buggy when it is actually correct.

### Findings

1. **Deliberately Incomplete Test with Incorrect Bug Comment**: The "clears 4 rows (Tetris)" test in `board.test.js` only asserts `expect(cleared).toBe(4)` and then skips all row-shift verification with the comment: `// BUG: clearRows has a splice+unshift index shift bug`. The actual `clearRows` implementation is a Set-based filter (not the PLAN's `splice+unshift` approach) and is **correct**. The comment references a bug from the PLAN's draft code that was never actually written. The test should assert that rows 0-3 are empty and rows 16-19 contain the pre-existing data from rows 12-15. As-written, this test provides false confidence. — `src/__tests__/board.test.js:167-181`

2. **`update(dt)` Completely Untested**: The `update()` method — which drives gravity accumulation, gravity ticks, lock delay, and piece locking — is never called in any test. SPEC testing strategy explicitly lists "Lock: piece locks after lock delay; lock resets on move/rotate up to 15 times" and "Gravity interval: returns correct drop interval for each level." Function coverage for `update` is 0%. — `src/__tests__/gameState.test.js`

3. **`_tryRotate` Completely Untested in GameState**: `rotateCW()` and `rotateCCW()` on `GameState` are never called in any test. The rotation logic itself is tested via `tryRotate` in `rotation.test.js`, but GameState's wiring of it (including the `_resetLock()` call on successful rotation) is unverified. — `src/__tests__/gameState.test.js`, `src/engine/gameState.js:145-154`

4. **Missing Multi-Line Score Tests**: Scoring is only tested for a 1-line clear at level 1 (100pts). The spec requires 100/300/500/800 × level for 1/2/3/4 line clears. No test verifies 300, 500, or 800 point awards, and no test verifies the level multiplier (e.g., 200pts for 1-line at level 2). — `src/__tests__/gameState.test.js:55-68`

5. **`startSoftDrop` / `stopSoftDrop` Not Tested**: Neither method is called in any test. They are simple setters but are the entry points to the soft-drop interval logic that the spec requires. — `src/__tests__/gameState.test.js`

6. **Incorrect Comment on `secondPiece` Behavior**: The test at line 48 has a comment saying "secondPiece is not preserved" and then asserts `expect(validTypes).toContain(gs.nextPieceType)` (any valid type). In fact `secondPiece` IS passed through to `_spawnPiece(firstPiece, secondPiece)` as `nextOverride`, so `gs.nextPieceType` will be `'T'` (the value passed). The assertion should be `expect(gs.nextPieceType).toBe('T')`. As written, this test passes even if dependency injection is broken. — `src/__tests__/gameState.test.js:46-52`

7. **Wall Kick Coverage Too Narrow**: Only one wall kick scenario is tested: I piece at right wall, CW rotation. Missing: left-wall kick, floor kick (upward dRow offset), CCW wall kicks, and JLSTZ pieces needing kicks. The spec testing strategy requires "wall kick test: place piece adjacent to right wall" AND "floor kick test: piece in bottom rows." — `src/__tests__/rotation.test.js:65-76`

8. **Level Progression Test Manipulates Internal State**: The level-progression test sets `gs.linesCleared = 9` and `gs.pieceType = 'I'` directly rather than using the public API. This bypasses validation and is fragile; it also doesn't test that `update()` + `_lockPiece()` correctly increments the level. — `src/__tests__/gameState.test.js:76-96`

9. **`getActivePieceCells` Null Branch Untested**: When `pieceType` is null (between piece lock and next spawn), `getActivePieceCells()` returns `[]`. This path is not covered by any test. — `src/engine/gameState.js:103-106`

### Test Coverage

```
File            | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
board.js        |     100 |      100 |     100 |     100
gameState.js    |   78.28 |    93.10 |   61.90 |   78.28   ← uncovered: update(), _tryRotate()
rotation.js     |     100 |    81.81 |     100 |     100
tetrominoes.js  |     100 |      100 |     100 |     100
ALL FILES       |   90.23 |    94.28 |   77.14 |   90.23
```

**Missing test cases per SPEC testing strategy:**
- Lock delay behavior (update calls with dt values)
- Soft drop: effective interval = min(50, normalInterval)
- Max lock resets (15 cap)
- Multi-line clear scores: 2-line (300), 3-line (500), 4-line/Tetris (800)
- Level multiplier (e.g., 1-line at level 2 = 200pts)
- Rotation via GameState.rotateCW / rotateCCW
- Wall kick via left wall and floor
