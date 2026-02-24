# Implementation Plan: Phase 2

## Overview

Phase 2 elevates the Tron Tetris engine into a fully atmospheric experience: board tilt animation (±7° Z-rotation with spring/damping), eight synthesized Web Audio sound effects, ghost piece rendering, piece lock flash, line-clear sweep animation, and keyboard restart (Enter/R). Two tech-debt items are also addressed: the redundant `randomPieceType()` call in `restart()` and the unwired `onRestart` callback in `input.js`.

## Current State (from Research)

- **Engine**: `GameState` drives gravity, lock delay, scoring, leveling. `_lockPiece()` is the primary hook for all landing events. `_landed` is an accurate per-frame landing signal. `restart()` has a redundant `randomPieceType()` call (line 105).
- **Renderer**: `BoardRenderer.draw()` iterates board cells and active piece cells via `BlockPool` (220 pre-allocated meshes added directly to `scene`). No `THREE.Group` exists yet — grid lines and background also add to `scene` directly.
- **Input**: `setupInput(gameState, onRestart)` accepts `onRestart` but never calls it; no Enter/R handling.
- **Tests**: 4 test files under `src/__tests__/`, Vitest + Node environment, 98.54% coverage on `src/engine/**`. No mock framework in use yet.
- **Build**: Vite `^6.0.0`, `esnext` target, outputs to `dist/`.

## Desired End State

After this phase:
- `src/engine/tilt.js` — exports `computeTiltAngle(col)`, `stepSpring(current, velocity, target)`
- `src/engine/ghost.js` — exports `computeGhostRow(board, pieceType, rotation, col, startRow)`
- `src/audio/sounds.js` — exports `playTone(freq, duration, type, gainEnvelope?, ctx?)`, `playGameSound(event, ctx)`
- `src/engine/gameState.js` — adds public `tiltAngle`, `tiltVelocity`, `justLocked`, `flashCells`, `sweeping`, `sweepRows`, `soundEvents`; adds `sweepProgress` getter; modified `_lockPiece()`, `update()`, `restart()`
- `src/renderer/blockPool.js` — `addBlock()` accepts optional `emissiveIntensity` param (default 0.6)
- `src/renderer/render.js` — `draw()` renders ghost piece + flash overrides + sweep animation
- `src/renderer/composer.js` — `createGridLines(parent)` and `createBoardBackground(parent)` accept any Object3D
- `src/main.js` — creates `boardGroup`, applies tilt, processes `soundEvents`
- `src/input.js` — Enter/R fires `onRestart` when `gameState.over === true`
- `src/__tests__/tilt.test.js`, `ghost.test.js`, `sounds.test.js` — new test files
- `src/__tests__/gameState.test.js` — additional tests for new state
- `AGENTS.md`, `README.md` — updated

**Verification**: `npm run test` all green; `npm run test:coverage` ≥ 80% on engine; `npm run build` no errors; manual play confirms board tilts, sounds play, ghost shows, flash/sweep visible, Enter/R restarts.

## What We're NOT Doing

- No local leaderboard or initials entry (Phase 3)
- No full game-over screen redesign (Phase 3)
- No Vercel deployment configuration (Phase 3)
- No mobile/touch controls
- No audio file assets — all audio synthesized via Web Audio API
- No changes to Tetris engine game logic (rotation, collision, scoring, leveling rules)
- No changes to `hud.js` or the canvas 2D next-piece preview
- No new npm packages

## Implementation Approach

**Resolution of Open Questions:**

1. **Board group vs. individual mesh tilt**: Create a `THREE.Group` (`boardGroup`) in `main.js`, add it to `scene`, and pass it as the `parent` wherever `scene` was previously used for board visuals (`createGridLines`, `createBoardBackground`, `BlockPool`). Rotate `boardGroup.rotation.z` for unified tilt of all board elements (blocks, grid, background). The function signatures for `createGridLines` and `createBoardBackground` change `scene` parameter to `parent` — backward-compatible rename since no tests cover renderer.

2. **Pool size for ghost piece**: Keep at 220. Max simultaneous usage: 200 board cells + 4 ghost cells + 4 active cells = 208. Well within pool limit.

3. **Lock flash timing**: `flashCells: Array<[col,row]>` and `_flashAccum: number` on `GameState`. Flash timer accumulates in `update()` **before** the `paused || over` guard so it always expires. Renderer overrides board cell color in-place (no extra mesh; avoids z-fighting).

4. **Line-clear sweep pause scope**: New `_sweeping` boolean + `_sweepAccum` in `GameState`. Added as a guard in `update()` after the flash block — gravity does not tick while `_sweeping`. `_lockPiece()` splits into "lock phase" (immediate board write + flash + sweep start) and `_finalizeSweep()` (row clear + score + spawn).

5. **Tilt state location**: Public `tiltAngle: 0` and `tiltVelocity: 0` on `GameState`. One-frame flag `justLocked: false` set in `_lockPiece()`, consumed by `main.js` each frame to force `tiltTarget = 0`. Pure math functions live in `src/engine/tilt.js` (no Three.js import → testable in Node). Tilt spring step runs in `main.js` RAF loop.

6. **Sound event signaling**: Public `soundEvents: string[]` array on `GameState`. Events pushed from `moveLeft/moveRight` (on success), `_tryRotate` (on success), `hardDrop` (before lock), `_lockPiece` (lineClear/tetris), `_finalizeSweep` (levelUp), `_spawnPiece` (gameOver), and `update` (softDrop on gravity tick). Main loop consumes and clears the array each frame via `playGameSound(event, ctx)`.

---

## Task 1: Tech Debt Cleanup + Keyboard Restart

### Overview

Remove the redundant `randomPieceType()` call in `restart()` and wire Enter/R keyboard restart in `input.js`. This is the smallest self-contained change and unblocks the `onRestart` signal path needed by Task 7.

### Changes Required

**File**: `src/engine/gameState.js`

Remove line 105 (`this.nextPieceType = randomPieceType();`). The subsequent `_spawnPiece()` call already sets `nextPieceType` via `randomPieceType()`.

```js
// BEFORE (lines 93-107):
restart() {
  this.board.clear();
  this.score = 0;
  this.level = 1;
  this.linesCleared = 0;
  this.paused = false;
  this.over = false;
  this.softDrop = false;
  this._gravityAccum = 0;
  this._lockAccum = 0;
  this._lockResets = 0;
  this._landed = false;
  this.nextPieceType = randomPieceType();  // ← REMOVE THIS LINE
  this._spawnPiece();
}
```

After removal, `randomPieceType` import becomes unused — leave the import for now (it's still used by `_spawnPiece`).

**File**: `src/input.js`

Add Enter/R handling that calls `onRestart` only when `gameState.over === true`:

```js
export function setupInput(gameState, onRestart) {
  const held = new Set();

  window.addEventListener('keydown', (e) => {
    if (held.has(e.code)) return;
    held.add(e.code);

    // Keyboard restart: only when game is over
    if ((e.code === 'Enter' || e.code === 'KeyR') && gameState.over) {
      onRestart?.();
      return;
    }

    switch (e.code) {
      case 'ArrowLeft':            gameState.moveLeft();       break;
      case 'ArrowRight':           gameState.moveRight();      break;
      case 'ArrowUp': case 'KeyX': gameState.rotateCW();       break;
      case 'KeyZ':                 gameState.rotateCCW();      break;
      case 'ArrowDown':            gameState.startSoftDrop();  break;
      case 'Space':
        e.preventDefault();
        gameState.hardDrop();
        break;
      case 'KeyP':                 gameState.togglePause();    break;
    }
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (e.code === 'ArrowDown') gameState.stopSoftDrop();
  });
}
```

### Success Criteria

- [ ] `restart()` still works correctly (test: same behavior as before, `nextPieceType` is valid after restart)
- [ ] Pressing Enter when `gameState.over === true` calls `onRestart`
- [ ] Pressing R when `gameState.over === true` calls `onRestart`
- [ ] Pressing Enter during active play (not game over) does NOT call `onRestart`
- [ ] Pressing Enter/R does NOT conflict with ArrowUp (rotate) or other in-game keys
- [ ] `npm run test` passes

---

## Task 2: Tilt Math Module

### Overview

Implement `computeTiltAngle(col)` and `stepSpring(current, velocity, target)` as pure exported functions in a new file. Tests cover clamping, midpoints, and one spring step. No Three.js imports.

### Changes Required

**File**: `src/engine/tilt.js` (new file)

```js
/**
 * Compute the tilt angle in degrees for the given piece column (0-indexed).
 * Formula: clamp((col - 4.5) / 4.5 * 7, -7, 7)
 * @param {number} col - active piece left-origin column (0–9)
 * @returns {number} angle in degrees, clamped to [-7, 7]
 */
export function computeTiltAngle(col) {
  const angle = (col - 4.5) / 4.5 * 7;
  return Math.max(-7, Math.min(7, angle));
}

/**
 * Advance the spring animation by one step.
 * spring constant: 0.15, damping: 0.75
 * @param {number} current - current angle (degrees)
 * @param {number} velocity - current velocity
 * @param {number} target - target angle (degrees)
 * @returns {{ angle: number, velocity: number }}
 */
export function stepSpring(current, velocity, target) {
  const newVelocity = (velocity + (target - current) * 0.15) * 0.75;
  const newAngle = current + newVelocity;
  return { angle: newAngle, velocity: newVelocity };
}
```

**File**: `src/__tests__/tilt.test.js` (new file)

```js
import { describe, it, expect } from 'vitest';
import { computeTiltAngle, stepSpring } from '../engine/tilt.js';

describe('computeTiltAngle', () => {
  it('returns -7 at col=0 (left edge)', () => {
    expect(computeTiltAngle(0)).toBeCloseTo(-7, 5);
  });

  it('returns 0 at col=4.5 (center)', () => {
    expect(computeTiltAngle(4.5)).toBeCloseTo(0, 5);
  });

  it('returns +7 at col=9 (right edge)', () => {
    expect(computeTiltAngle(9)).toBeCloseTo(7, 5);
  });

  it('clamps below -7 for col < 0', () => {
    expect(computeTiltAngle(-5)).toBe(-7);
  });

  it('clamps above +7 for col > 9', () => {
    expect(computeTiltAngle(15)).toBe(7);
  });

  it('returns approximately -3.5 at col=2.25', () => {
    expect(computeTiltAngle(2.25)).toBeCloseTo(-3.5, 2);
  });

  it('returns approximately +3.5 at col=6.75', () => {
    expect(computeTiltAngle(6.75)).toBeCloseTo(3.5, 2);
  });
});

describe('stepSpring', () => {
  it('moves toward target from rest (current=0, velocity=0, target=7)', () => {
    const { angle, velocity } = stepSpring(0, 0, 7);
    // velocity = (0 + (7-0)*0.15) * 0.75 = (1.05)*0.75 = 0.7875
    // angle = 0 + 0.7875 = 0.7875
    expect(velocity).toBeCloseTo(0.7875, 5);
    expect(angle).toBeCloseTo(0.7875, 5);
  });

  it('decays velocity when at target (current=7, velocity=1, target=7)', () => {
    const { angle, velocity } = stepSpring(7, 1, 7);
    // velocity = (1 + 0) * 0.75 = 0.75
    // angle = 7 + 0.75 = 7.75
    expect(velocity).toBeCloseTo(0.75, 5);
    expect(angle).toBeCloseTo(7.75, 5);
  });

  it('returns to rest when current=target and velocity=0', () => {
    const { angle, velocity } = stepSpring(0, 0, 0);
    expect(angle).toBe(0);
    expect(velocity).toBe(0);
  });

  it('oscillates past target (overshoot behavior)', () => {
    // Simulate 40 steps from 0 toward target=7 then snap to target=0
    let angle = 0, velocity = 0;
    for (let i = 0; i < 20; i++) {
      ({ angle, velocity } = stepSpring(angle, velocity, 7));
    }
    // Now snap to 0
    for (let i = 0; i < 40; i++) {
      ({ angle, velocity } = stepSpring(angle, velocity, 0));
    }
    // After enough steps, should settle near 0
    expect(Math.abs(angle)).toBeLessThan(0.01);
  });
});
```

### Success Criteria

- [ ] `src/engine/tilt.js` has no Three.js or DOM imports
- [ ] `npm run test` passes all new `tilt.test.js` assertions
- [ ] `computeTiltAngle(0)` returns exactly -7; `computeTiltAngle(9)` returns exactly +7
- [ ] `stepSpring` oscillation test settles to < 0.01 from 0 after 40 steps

---

## Task 3: Ghost Piece Module

### Overview

Implement `computeGhostRow()` as an exported pure function. It computes the lowest valid row for a piece given current board state — the would-land row if hard dropped.

### Changes Required

**File**: `src/engine/ghost.js` (new file)

```js
/**
 * Compute the row where the active piece would land if hard-dropped.
 * @param {Board} board
 * @param {string} pieceType
 * @param {number} rotation
 * @param {number} col
 * @param {number} startRow
 * @returns {number} the lowest valid row (same as startRow if already on surface)
 */
export function computeGhostRow(board, pieceType, rotation, col, startRow) {
  let row = startRow;
  while (board.isValid(pieceType, rotation, col, row + 1)) {
    row++;
  }
  return row;
}
```

**File**: `src/__tests__/ghost.test.js` (new file)

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Board } from '../engine/board.js';
import { computeGhostRow } from '../engine/ghost.js';

describe('computeGhostRow', () => {
  let board;

  beforeEach(() => {
    board = new Board();
  });

  it('I piece drops to bottom on empty board (row 19)', () => {
    // I piece rotation=0 at col=3, row=0: occupies row 0, cols 3-6
    const ghost = computeGhostRow(board, 'I', 0, 3, 0);
    expect(ghost).toBe(19);
  });

  it('O piece drops to bottom on empty board (row 18)', () => {
    // O piece rotation=0 at col=4, row=0: occupies rows 0-1, cols 4-5
    const ghost = computeGhostRow(board, 'O', 0, 4, 0);
    expect(ghost).toBe(18);
  });

  it('returns startRow when piece is on surface', () => {
    // Fill row 19 (bottom row) so O piece at row=18 cannot move down
    for (let c = 0; c < 10; c++) board.setCell(c, 19, 0xFF0000);
    const ghost = computeGhostRow(board, 'O', 0, 4, 18);
    expect(ghost).toBe(18);
  });

  it('lands on top of existing blocks', () => {
    // Fill rows 15-19, so I piece at row=0 lands at row=14
    for (let r = 15; r <= 19; r++) {
      for (let c = 0; c < 10; c++) board.setCell(c, r, 0xFF0000);
    }
    const ghost = computeGhostRow(board, 'I', 0, 3, 0);
    expect(ghost).toBe(14);
  });

  it('ghost row matches startRow when already at bottom of board', () => {
    const ghost = computeGhostRow(board, 'I', 0, 3, 19);
    expect(ghost).toBe(19);
  });
});
```

### Success Criteria

- [ ] `src/engine/ghost.js` has no Three.js or DOM imports
- [ ] `npm run test` passes all `ghost.test.js` assertions
- [ ] I piece on empty board → ghost row 19
- [ ] Ghost row correctly stops above filled rows

---

## Task 4: Audio System

### Overview

Implement `playTone()` and `playGameSound()` in a new audio module. `playTone()` encapsulates oscillator lifecycle. `playGameSound()` maps event names to sound configs. Both accept an injectable `AudioContext` for testability.

### Changes Required

**File**: `src/audio/sounds.js` (new file)

```js
// Frequency/duration/waveform map for all 8 game sounds
const SOUND_CONFIG = {
  move:      { freq: 200,  duration: 0.05, type: 'square'   },
  rotate:    { freq: 300,  duration: 0.05, type: 'square'   },
  softDrop:  { freq: 150,  duration: 0.04, type: 'square'   },
  hardDrop:  { freq: 440,  duration: 0.08, type: 'square'   },
  lineClear: { freq: 600,  duration: 0.15, type: 'square'   },
  tetris:    { freq: 880,  duration: 0.25, type: 'square'   },
  levelUp:   { freq: 1000, duration: 0.20, type: 'sine'     },
  gameOver:  { freq: 110,  duration: 0.50, type: 'sawtooth' },
};

/**
 * Play a synthesized tone using the given (or a new) AudioContext.
 * The oscillator is automatically stopped and disconnected after playback.
 *
 * @param {number} freq - frequency in Hz
 * @param {number} duration - duration in seconds
 * @param {OscillatorType} type - waveform type ('square'|'sine'|'sawtooth'|'triangle')
 * @param {Function|null} gainEnvelope - optional fn(gainNode, ctx) for custom envelope
 * @param {AudioContext|null} ctx - injectable AudioContext (creates new one if null)
 */
export function playTone(freq, duration, type = 'square', gainEnvelope = null, ctx = null) {
  const audioCtx = ctx ?? new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);

  if (gainEnvelope) {
    gainEnvelope(gain, audioCtx);
  } else {
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  }

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/**
 * Play the sound for a named game event.
 * @param {string} event - event name (e.g. 'move', 'rotate', 'lineClear')
 * @param {AudioContext} ctx - the shared AudioContext from main.js
 */
export function playGameSound(event, ctx) {
  const config = SOUND_CONFIG[event];
  if (config) {
    playTone(config.freq, config.duration, config.type, null, ctx);
  }
}
```

**File**: `src/__tests__/sounds.test.js` (new file)

```js
import { describe, it, expect, vi } from 'vitest';
import { playTone, playGameSound } from '../audio/sounds.js';

function makeMockCtx() {
  const disconnectOsc = vi.fn();
  const disconnectGain = vi.fn();
  const mockOsc = {
    connect: vi.fn(),
    disconnect: disconnectOsc,
    type: '',
    frequency: { setValueAtTime: vi.fn() },
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
  const mockGain = {
    connect: vi.fn(),
    disconnect: disconnectGain,
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  };
  const ctx = {
    currentTime: 0,
    createOscillator: vi.fn(() => mockOsc),
    createGain: vi.fn(() => mockGain),
    destination: {},
  };
  return { ctx, mockOsc, mockGain, disconnectOsc, disconnectGain };
}

describe('playTone', () => {
  it('creates oscillator and gain node', () => {
    const { ctx, mockOsc, mockGain } = makeMockCtx();
    playTone(440, 0.1, 'square', null, ctx);
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    expect(ctx.createGain).toHaveBeenCalledOnce();
  });

  it('sets oscillator type and frequency', () => {
    const { ctx, mockOsc } = makeMockCtx();
    playTone(440, 0.1, 'sine', null, ctx);
    expect(mockOsc.type).toBe('sine');
    expect(mockOsc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
  });

  it('calls osc.stop() with a positive time', () => {
    const { ctx, mockOsc } = makeMockCtx();
    playTone(440, 0.1, 'square', null, ctx);
    expect(mockOsc.stop).toHaveBeenCalledOnce();
    const stopArg = mockOsc.stop.mock.calls[0][0];
    expect(stopArg).toBeGreaterThan(0);
  });

  it('sets onended and disconnects both nodes when triggered', () => {
    const { ctx, mockOsc, disconnectOsc, disconnectGain } = makeMockCtx();
    playTone(440, 0.1, 'square', null, ctx);
    expect(typeof mockOsc.onended).toBe('function');
    mockOsc.onended();
    expect(disconnectOsc).toHaveBeenCalledOnce();
    expect(disconnectGain).toHaveBeenCalledOnce();
  });

  it('uses custom gainEnvelope when provided', () => {
    const { ctx, mockGain } = makeMockCtx();
    const envelope = vi.fn();
    playTone(440, 0.1, 'square', envelope, ctx);
    expect(envelope).toHaveBeenCalledWith(mockGain, ctx);
    // Default ramp should NOT have been called when envelope is provided
    expect(mockGain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  });
});

describe('playGameSound', () => {
  it('plays a sound for each valid event name', () => {
    const events = ['move', 'rotate', 'softDrop', 'hardDrop', 'lineClear', 'tetris', 'levelUp', 'gameOver'];
    for (const event of events) {
      const { ctx } = makeMockCtx();
      expect(() => playGameSound(event, ctx)).not.toThrow();
      expect(ctx.createOscillator).toHaveBeenCalled();
    }
  });

  it('does nothing for unknown event names', () => {
    const { ctx } = makeMockCtx();
    expect(() => playGameSound('unknownEvent', ctx)).not.toThrow();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
});
```

### Success Criteria

- [ ] `src/audio/sounds.js` has no DOM or Three.js imports
- [ ] `npm run test` passes all `sounds.test.js` assertions
- [ ] `playTone` calls `osc.stop()` and sets `onended` for cleanup
- [ ] `playGameSound` with an unknown event does not throw

---

## Task 5: GameState Enhancements

### Overview

Add all Phase 2 state to `GameState`: tilt fields, sound event queue, flash state, sweep state. Modify `_lockPiece()` to split into lock phase + `_finalizeSweep()`. Modify `update()` with flash timer and sweep guard. Modify `moveLeft/Right`, `_tryRotate`, `hardDrop`, `_spawnPiece` for sound events. Update `restart()` to reset all new state.

### Changes Required

**File**: `src/engine/gameState.js`

Add constants at the top (after existing constants):
```js
const FLASH_DURATION_MS = 100;
const SWEEP_DURATION_MS = 150;
```

Add new public fields in constructor (after existing `_landed` initialization):
```js
// Tilt animation state (read by main.js and renderer)
this.tiltAngle = 0;
this.tiltVelocity = 0;
this.justLocked = false;   // one-frame signal: piece just locked this frame

// Sound event queue (consumed by main.js each frame)
this.soundEvents = [];

// Lock flash state (read by renderer)
this.flashCells = [];      // Array<[col, row]> of just-locked cells
this._flashAccum = 0;

// Line-clear sweep state (read by renderer)
this.sweeping = false;
this.sweepRows = [];       // row indices being swept
this._sweepAccum = 0;
```

Add `sweepProgress` getter (after constructor):
```js
get sweepProgress() {
  if (!this.sweeping) return 0;
  return Math.min(1, this._sweepAccum / SWEEP_DURATION_MS);
}
```

Modify `update(dt)`:
```js
update(dt) {
  // Flash timer: runs regardless of pause/over state
  if (this.flashCells.length > 0) {
    this._flashAccum += dt;
    if (this._flashAccum >= FLASH_DURATION_MS) {
      this.flashCells = [];
    }
  }

  if (this.paused || this.over) return;

  // Sweep pause: gravity does not tick during line-clear sweep
  if (this.sweeping) {
    this._sweepAccum += dt;
    if (this._sweepAccum >= SWEEP_DURATION_MS) {
      this._finalizeSweep();
    }
    return;
  }

  const interval = this.softDrop
    ? Math.min(SOFT_DROP_INTERVAL, gravityInterval(this.level))
    : gravityInterval(this.level);

  this._gravityAccum += dt;

  if (this._landed) {
    this._lockAccum += dt;
    if (this._lockAccum >= LOCK_DELAY_MS) {
      this._lockPiece();
      return;
    }
  }

  if (this._gravityAccum >= interval) {
    this._gravityAccum = 0;
    const moved = this._tryMoveDown();
    if (!moved) {
      this._landed = true;
    } else {
      this._landed = false;
      this._lockAccum = 0;
      if (this.softDrop) this.soundEvents.push('softDrop');
    }
  }
}
```

Modify `moveLeft()` and `moveRight()` to push 'move' sound on success:
```js
moveLeft()  { if (this._tryMove(-1, 0)) this.soundEvents.push('move'); }
moveRight() { if (this._tryMove(+1, 0)) this.soundEvents.push('move'); }
```

Modify `hardDrop()` to push 'hardDrop' sound:
```js
hardDrop() {
  if (this.paused || this.over) return;
  this.soundEvents.push('hardDrop');
  while (this._tryMoveDown()) {}
  this._lockPiece();
}
```

Modify `_tryRotate()` to push 'rotate' sound on success:
```js
_tryRotate(direction) {
  if (this.paused || this.over) return;
  const result = tryRotate(this.board, this.pieceType, this.rotation, direction, this.col, this.row);
  if (result) {
    this.rotation = result.rotation;
    this.col = result.col;
    this.row = result.row;
    this._resetLock();
    this.soundEvents.push('rotate');
  }
}
```

Modify `_lockPiece()` to capture flash cells, set justLocked, and start sweep:
```js
_lockPiece() {
  // Capture locked cells before board write (for flash)
  const lockedCells = this.board.getPieceCells(this.pieceType, this.rotation, this.col, this.row);
  this.board.lockPiece(this.pieceType, this.rotation, this.col, this.row);

  // Flash state
  this.flashCells = lockedCells;
  this._flashAccum = 0;

  // Tilt reset signal
  this.justLocked = true;

  // Clear active piece (board is now the source of truth for locked cells)
  this.pieceType = null;

  const completedRows = this.board.getCompletedRows();
  if (completedRows.length > 0) {
    // Push line-clear sound
    this.soundEvents.push(completedRows.length === 4 ? 'tetris' : 'lineClear');
    // Start sweep — _finalizeSweep() will clear rows, score, and spawn
    this.sweepRows = completedRows;
    this._sweepAccum = 0;
    this.sweeping = true;
    return;
  }

  // No line clear — spawn immediately
  this._spawnPiece();
}
```

Add new `_finalizeSweep()` method:
```js
_finalizeSweep() {
  const prevLevel = this.level;
  this.board.clearRows(this.sweepRows);
  this._addScore(this.sweepRows.length);
  this.linesCleared += this.sweepRows.length;
  this.level = Math.floor(this.linesCleared / 10) + 1;
  if (this.level > prevLevel) this.soundEvents.push('levelUp');
  this.sweeping = false;
  this.sweepRows = [];
  this._sweepAccum = 0;
  this._spawnPiece();
}
```

Modify `_spawnPiece()` to push 'gameOver' sound:
```js
_spawnPiece(overridePiece, nextOverride) {
  this.pieceType = overridePiece ?? this.nextPieceType;
  this.nextPieceType = nextOverride ?? randomPieceType();
  this.rotation = 0;
  this.col = TETROMINOES[this.pieceType].spawnCol;
  this.row = 0;
  this._lockAccum = 0;
  this._lockResets = 0;
  this._landed = false;
  this._gravityAccum = 0;

  if (!this.board.isValid(this.pieceType, this.rotation, this.col, this.row)) {
    this.over = true;
    this.soundEvents.push('gameOver');
  }
}
```

Modify `restart()` to reset all new state and remove the redundant `randomPieceType()` call:
```js
restart() {
  this.board.clear();
  this.score = 0;
  this.level = 1;
  this.linesCleared = 0;
  this.paused = false;
  this.over = false;
  this.softDrop = false;
  this._gravityAccum = 0;
  this._lockAccum = 0;
  this._lockResets = 0;
  this._landed = false;
  // Reset Phase 2 state
  this.tiltAngle = 0;
  this.tiltVelocity = 0;
  this.justLocked = false;
  this.soundEvents = [];
  this.flashCells = [];
  this._flashAccum = 0;
  this.sweeping = false;
  this.sweepRows = [];
  this._sweepAccum = 0;
  this._spawnPiece();
}
```

### Tests to Add to `src/__tests__/gameState.test.js`

```js
// --- Sound Events ---
describe('sound events', () => {
  it('pushes "move" when moveLeft succeeds', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.soundEvents = [];
    gs.moveLeft();
    expect(gs.soundEvents).toContain('move');
  });

  it('does not push "move" when moveLeft is blocked (at left wall)', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.col = 0;
    gs.soundEvents = [];
    gs.moveLeft();
    // I piece at col=0 rotation=0 occupies cols 0-3; moving left would put it at col=-1 (invalid)
    expect(gs.soundEvents).not.toContain('move');
  });

  it('pushes "rotate" when rotateCW succeeds', () => {
    const gs = new GameState({ firstPiece: 'T', secondPiece: 'O' });
    gs.soundEvents = [];
    gs.rotateCW();
    expect(gs.soundEvents).toContain('rotate');
  });

  it('pushes "hardDrop" on hardDrop', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.soundEvents = [];
    gs.hardDrop();
    expect(gs.soundEvents).toContain('hardDrop');
  });

  it('pushes "lineClear" on single line clear', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    // Fill row 19 except cols 3-6 (where I piece fits)
    for (let c = 0; c < 10; c++) {
      if (c < 3 || c > 6) gs.board.setCell(c, 19, 0xFF0000);
    }
    gs.row = 18; // position piece so it lands on row 19
    gs.col = 3;
    gs.rotation = 0;
    gs.soundEvents = [];
    gs.hardDrop();
    expect(gs.soundEvents).toContain('lineClear');
    expect(gs.soundEvents).not.toContain('tetris');
  });

  it('pushes "tetris" on 4-line clear', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    // Fill rows 16-19, leave cols 3-6 of each row clear for I piece
    for (let r = 16; r <= 19; r++) {
      for (let c = 0; c < 10; c++) {
        if (c < 3 || c > 6) gs.board.setCell(c, r, 0xFF0000);
      }
    }
    gs.row = 15;
    gs.col = 3;
    gs.rotation = 0;
    gs.soundEvents = [];
    gs.hardDrop();
    expect(gs.soundEvents).toContain('tetris');
    expect(gs.soundEvents).not.toContain('lineClear');
  });

  it('pushes "gameOver" when spawn is blocked', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    // Fill the top of the board to block spawn
    for (let c = 0; c < 10; c++) gs.board.setCell(c, 0, 0xFF0000);
    gs.soundEvents = [];
    gs._spawnPiece();
    expect(gs.soundEvents).toContain('gameOver');
    expect(gs.over).toBe(true);
  });

  it('clears soundEvents on restart', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.soundEvents = ['move', 'rotate'];
    gs.restart();
    expect(gs.soundEvents).toEqual([]);
  });
});

// --- Flash State ---
describe('lock flash', () => {
  it('sets flashCells after hardDrop', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.hardDrop();
    expect(gs.flashCells.length).toBeGreaterThan(0);
  });

  it('flashCells are cleared after FLASH_DURATION_MS of dt', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.hardDrop();
    expect(gs.flashCells.length).toBeGreaterThan(0);
    // Advance time past flash duration (100ms)
    gs.update(101);
    expect(gs.flashCells).toEqual([]);
  });

  it('flash timer advances even when game is over', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.flashCells = [[3, 19]];
    gs._flashAccum = 0;
    gs.over = true;
    gs.update(101);
    expect(gs.flashCells).toEqual([]);
  });
});

// --- Sweep State ---
describe('line-clear sweep', () => {
  it('sets sweeping=true after line clear', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    for (let c = 0; c < 10; c++) {
      if (c < 3 || c > 6) gs.board.setCell(c, 19, 0xFF0000);
    }
    gs.row = 18; gs.col = 3; gs.rotation = 0;
    gs.hardDrop();
    expect(gs.sweeping).toBe(true);
    expect(gs.sweepRows.length).toBeGreaterThan(0);
  });

  it('gravity does not tick during sweep', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    for (let c = 0; c < 10; c++) {
      if (c < 3 || c > 6) gs.board.setCell(c, 19, 0xFF0000);
    }
    gs.row = 18; gs.col = 3; gs.rotation = 0;
    gs.hardDrop();
    expect(gs.sweeping).toBe(true);
    const prevLinesCleared = gs.linesCleared;
    // Advance 50ms — still within 150ms sweep window
    gs.update(50);
    expect(gs.sweeping).toBe(true);
    // Lines are NOT cleared yet
    expect(gs.linesCleared).toBe(prevLinesCleared);
  });

  it('finalizes sweep after SWEEP_DURATION_MS', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    for (let c = 0; c < 10; c++) {
      if (c < 3 || c > 6) gs.board.setCell(c, 19, 0xFF0000);
    }
    gs.row = 18; gs.col = 3; gs.rotation = 0;
    gs.hardDrop();
    gs.update(151); // past 150ms sweep window
    expect(gs.sweeping).toBe(false);
    expect(gs.linesCleared).toBe(1);
  });

  it('sweepProgress goes from 0 to 1 during sweep', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    for (let c = 0; c < 10; c++) {
      if (c < 3 || c > 6) gs.board.setCell(c, 19, 0xFF0000);
    }
    gs.row = 18; gs.col = 3; gs.rotation = 0;
    gs.hardDrop();
    expect(gs.sweepProgress).toBeCloseTo(0, 1);
    gs.update(75); // halfway
    expect(gs.sweepProgress).toBeCloseTo(0.5, 1);
  });
});

// --- Tilt State ---
describe('tilt state', () => {
  it('justLocked is false initially', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    expect(gs.justLocked).toBe(false);
  });

  it('justLocked is set to true after _lockPiece()', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.hardDrop(); // triggers _lockPiece()
    expect(gs.justLocked).toBe(true);
  });

  it('tiltAngle and tiltVelocity reset to 0 on restart()', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.tiltAngle = 5;
    gs.tiltVelocity = 2;
    gs.restart();
    expect(gs.tiltAngle).toBe(0);
    expect(gs.tiltVelocity).toBe(0);
  });
});

// --- softDrop sound ---
describe('softDrop sound', () => {
  it('pushes softDrop sound when gravity tick occurs while softDrop=true', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.startSoftDrop();
    gs.soundEvents = [];
    // Soft drop interval at level 1 = min(50, 1000) = 50ms
    gs.update(55); // triggers one soft drop gravity tick
    expect(gs.soundEvents).toContain('softDrop');
  });

  it('does NOT push softDrop sound when softDrop=false', () => {
    const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
    gs.soundEvents = [];
    gs.update(1001); // normal gravity tick
    expect(gs.soundEvents).not.toContain('softDrop');
  });
});
```

### Success Criteria

- [ ] `npm run test` passes all new and existing tests
- [ ] `gs.soundEvents` correctly populated for all 8 event types
- [ ] `flashCells` set after `hardDrop()`, cleared after 100ms of `update(dt)` calls
- [ ] `sweeping` pauses gravity for 150ms; `_finalizeSweep` clears rows and updates score/level
- [ ] `justLocked` is set after `_lockPiece()` call
- [ ] `restart()` resets all new state to defaults
- [ ] Coverage on `src/engine/**` remains ≥ 80%

---

## Task 6: Renderer Enhancements (Board Group + Ghost + Flash + Sweep)

### Overview

Create a `THREE.Group` for board visuals in `main.js`. Refactor `createGridLines` and `createBoardBackground` to accept any Object3D as parent. Extend `BlockPool.addBlock()` with optional `emissiveIntensity`. Update `BoardRenderer.draw()` to render ghost piece, flash override, and sweep effect.

### Changes Required

**File**: `src/renderer/composer.js`

Rename `scene` parameter to `parent` in `createGridLines` and `createBoardBackground` (same function bodies, just the parameter name):

```js
export function createGridLines(parent) {
  // ... existing body unchanged, except scene.add(lines) → parent.add(lines)
  parent.add(lines);
  return lines;
}

export function createBoardBackground(parent) {
  // ... existing body unchanged, except scene.add(plane) → parent.add(plane)
  parent.add(plane);
  return plane;
}
```

**File**: `src/renderer/blockPool.js`

Extend `addBlock()` with optional `emissiveIntensity` parameter:

```js
addBlock(col, row, color, emissiveIntensity = 0.6) {
  if (this._active >= this._entries.length) return;
  const { mesh, mat } = this._entries[this._active++];
  mat.color.setHex(color);
  mat.emissive.setHex(color);
  mat.emissiveIntensity = emissiveIntensity;
  const [x, y, z] = cellToWorld(col, row);
  mesh.position.set(x, y, z);
  mesh.visible = true;
}
```

**File**: `src/renderer/render.js`

Import ghost computation and add ghost/flash/sweep rendering:

```js
import { BlockPool } from './blockPool.js';
import { computeGhostRow } from '../engine/ghost.js';

const GHOST_INTENSITY = 0.15;
const FLASH_INTENSITY = 1.5;
const SWEEP_INTENSITY = 1.5;

export class BoardRenderer {
  constructor(parent) {
    this.pool = new BlockPool(parent, 220);
  }

  draw(gameState) {
    this.pool.begin();
    const { board } = gameState;

    // Build flash lookup set
    const flashSet = gameState.flashCells.length > 0
      ? new Set(gameState.flashCells.map(([c, r]) => `${c},${r}`))
      : null;

    // Board cells — with flash and sweep overrides
    for (let r = 0; r < board.rows; r++) {
      const isSweepRow = gameState.sweeping && gameState.sweepRows.includes(r);
      for (let c = 0; c < board.cols; c++) {
        const color = board.getCell(c, r);
        if (color !== 0) {
          const isFlash = flashSet?.has(`${c},${r}`);
          if (isFlash) {
            this.pool.addBlock(c, r, 0xFFFFFF, FLASH_INTENSITY);
          } else if (isSweepRow) {
            const intensity = SWEEP_INTENSITY * (1 - gameState.sweepProgress);
            this.pool.addBlock(c, r, 0xFFFFFF, Math.max(0.01, intensity));
          } else {
            this.pool.addBlock(c, r, color);
          }
        }
      }
    }

    // Active piece + ghost
    if (gameState.pieceType) {
      const activeColor = gameState.getActivePieceColor();

      // Ghost piece (rendered first so active piece renders on top)
      const ghostRow = computeGhostRow(
        board, gameState.pieceType, gameState.rotation, gameState.col, gameState.row
      );
      if (ghostRow !== gameState.row) {
        const ghostCells = board.getPieceCells(
          gameState.pieceType, gameState.rotation, gameState.col, ghostRow
        );
        for (const [c, r] of ghostCells) {
          if (r >= 0) this.pool.addBlock(c, r, activeColor, GHOST_INTENSITY);
        }
      }

      // Active piece
      const activeCells = gameState.getActivePieceCells();
      for (const [c, r] of activeCells) {
        if (r >= 0) this.pool.addBlock(c, r, activeColor);
      }
    }

    this.pool.end();
  }
}
```

**File**: `src/main.js`

Create `boardGroup` and pass it to all board visual creators:

```js
import * as THREE from 'three';
import { GameState } from './engine/gameState.js';
import { createScene } from './renderer/scene.js';
import { createComposer, createGridLines, createBoardBackground } from './renderer/composer.js';
import { BoardRenderer } from './renderer/render.js';
import { setupInput } from './input.js';
import { updateHud, showOverlay, hideOverlay } from './hud/hud.js';
import { computeTiltAngle, stepSpring } from './engine/tilt.js';
import { playGameSound } from './audio/sounds.js';

const canvas = document.getElementById('game-canvas');
const { renderer, scene, camera } = createScene(canvas);

// Board group — all board visuals tilt together
const boardGroup = new THREE.Group();
scene.add(boardGroup);

createGridLines(boardGroup);
createBoardBackground(boardGroup);

const composer = createComposer(renderer, scene, camera);
const boardRenderer = new BoardRenderer(boardGroup);

let gameState = new GameState();

// Shared AudioContext (created once; browsers require user gesture to start)
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

setupInput(gameState, () => {
  gameState.restart();
  hideOverlay();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  gameState.restart();
  hideOverlay();
});

let lastTime = 0;
let prevOver = false;

function loop(ts) {
  const dt = lastTime === 0 ? 0 : ts - lastTime;
  lastTime = ts;

  gameState.update(dt);

  // --- Tilt animation ---
  const tiltTarget = gameState.justLocked
    ? 0
    : (gameState.pieceType ? computeTiltAngle(gameState.col) : 0);
  if (gameState.justLocked) gameState.justLocked = false;

  const next = stepSpring(gameState.tiltAngle, gameState.tiltVelocity, tiltTarget);
  gameState.tiltAngle = next.angle;
  gameState.tiltVelocity = next.velocity;
  boardGroup.rotation.z = THREE.MathUtils.degToRad(gameState.tiltAngle);

  // --- Sound events ---
  if (gameState.soundEvents.length > 0) {
    const ctx = getAudioCtx();
    for (const event of gameState.soundEvents) {
      playGameSound(event, ctx);
    }
    gameState.soundEvents.length = 0;
  }

  boardRenderer.draw(gameState);
  composer.render();
  updateHud(gameState);

  if (gameState.over && !prevOver) {
    showOverlay('GAME OVER', gameState.score);
  }
  prevOver = gameState.over;

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

### Success Criteria

- [ ] `npm run build` produces `dist/index.html` with no errors or warnings
- [ ] Manual play: ghost piece (dim neon outline) visible at landing position
- [ ] Manual play: board tilts left/right as piece moves (up to ±7° visible angle)
- [ ] Manual play: board oscillates back to 0° when piece locks
- [ ] Manual play: locked cells flash white for ~100ms
- [ ] Manual play: cleared rows show sweep animation (white sweep) before disappearing
- [ ] Manual play: all 8 sounds play at appropriate moments
- [ ] Manual play: Enter/R on game-over screen restarts game; Enter/R during play has no effect
- [ ] `npm run test` still passes (renderer excluded from coverage)

---

## Task 7: Documentation Updates

### Overview

Update AGENTS.md with Phase 2 architecture additions. Update README.md feature list.

### Changes Required

**File**: `AGENTS.md`

Add a "Phase 2 Additions" section documenting:
- `AnimationState` contract: `tiltAngle`, `tiltVelocity`, `justLocked` on `GameState`; consumed by `main.js` RAF loop
- `playTone(freq, duration, type, gainEnvelope?, ctx?)` API signature and AudioContext injection pattern
- `computeGhostRow(board, pieceType, rotation, col, startRow)` location in `src/engine/ghost.js`
- `computeTiltAngle(col)` and `stepSpring(current, velocity, target)` in `src/engine/tilt.js`
- Sound event queue pattern: `gameState.soundEvents` populated by engine, consumed+cleared by `main.js`
- Sweep state: `sweeping`, `sweepRows`, `sweepProgress` on `GameState`; gravity paused during sweep
- Board group: `boardGroup` (THREE.Group in `main.js`) wraps grid, background, and block pool; rotated for tilt

**File**: `README.md`

Update feature list to include:
- Board tilt effect (±7° Z-rotation, spring/damping settling on piece lock)
- Ghost piece (dim neon outline showing landing position)
- Piece lock flash (~100ms white flash on locked cells)
- Line-clear sweep animation (150ms horizontal sweep before rows disappear)
- Web Audio sound effects (8 synthesized tones — no audio files fetched)
- Keyboard restart (Enter or R on game-over screen)

### Success Criteria

- [ ] AGENTS.md accurately describes the tilt/AnimationState contract, `playTone` API, ghost computation, and sound event pattern
- [ ] README.md feature list is accurate and complete

---

## Testing Strategy

### Unit Tests

**New test files**:
- `src/__tests__/tilt.test.js` — `computeTiltAngle` (boundary + mid values), `stepSpring` (exact one-step assertion, long-run convergence)
- `src/__tests__/ghost.test.js` — `computeGhostRow` (empty board, blocked board, piece-at-surface)
- `src/__tests__/sounds.test.js` — `playTone` (oscillator lifecycle, onended cleanup, custom envelope), `playGameSound` (all 8 events, unknown event)

**Additions to `src/__tests__/gameState.test.js`**:
- Sound events: `move`, `rotate`, `hardDrop`, `lineClear`, `tetris`, `gameOver`, `softDrop`
- Flash: set on lock, cleared after 100ms, advances when `over=true`
- Sweep: set on line clear, gravity paused during sweep, `_finalizeSweep` clears rows + scores + spawns
- Tilt: `justLocked` set on lock, `tiltAngle`/`tiltVelocity` reset on restart

**Mocking strategy**: AudioContext mock via plain objects with `vi.fn()` methods — no mocking framework setup needed; Vitest's `vi.fn()` is sufficient. No Three.js mocking needed (renderer excluded from test coverage).

**Anti-mock bias**: `computeGhostRow` tests use a real `Board` instance with real `setCell` calls. GameState tests use constructor injection for deterministic pieces.

### Integration / Manual Verification

- Tilt: move piece left 5 times → board tilts left; hard drop → board oscillates back to center
- Ghost: spawn I piece; ghost appears at row 19 immediately; move piece → ghost tracks
- Flash: hard drop → cells flash white for ~100ms
- Sweep: fill 3 rows, drop completing piece → white sweep on all 3 rows for ~150ms, then rows vanish
- Audio: each action produces distinct audible tone; no console errors about Web Audio graph
- Keyboard restart: game over, press Enter → game resets; press R → game resets
- Build: `npm run build` → no errors, `dist/index.html` exists

## Risk Assessment

- **`pieceType = null` during sweep**: `_lockPiece()` nulls `pieceType` before starting the sweep. The renderer gates ghost/active-piece rendering on `gameState.pieceType !== null`. Correct by design.
- **Flash on game-over frame**: Flash timer runs before the `paused || over` guard in `update()`. If `hardDrop()` → lock → spawn → game over, the flash still expires correctly even though `over = true`.
- **Pool overflow (220 limit)**: Max usage = 200 board + 4 ghost + 4 active = 208. Sweep/flash cells reuse board slots (not extra slots). No overflow possible.
- **AudioContext user-gesture requirement**: `getAudioCtx()` in `main.js` creates `AudioContext` lazily on first sound event (triggered by user keypress). This satisfies browser autoplay policies since the first key event is a user gesture.
- **`justLocked` consumed in wrong order**: `_lockPiece()` sets `justLocked = true` inside `update()`. The RAF loop reads it after `update()` returns and clears it. This is safe — the flag is a one-frame signal in the correct direction.
- **Sweep rows out of sync after board mutates**: `_finalizeSweep()` calls `board.clearRows(sweepRows)` and immediately clears `sweepRows = []` and sets `sweeping = false`. The renderer will not render sweep effect on the cleared state.
- **`three/addons/` import in `main.js`**: `THREE.MathUtils.degToRad()` requires `import * as THREE from 'three'`. This is the standard import used in existing renderer files.
