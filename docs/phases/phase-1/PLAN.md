# Implementation Plan: Phase 1

## Overview

Build a fully playable, browser-based Tetris game from scratch using a Vite + Vanilla JS project scaffold, a pure-JS Tetris engine with SRS rotation, and a Three.js WebGL renderer with Tron neon aesthetics (emissive block materials, grid overlay, UnrealBloomPass bloom). All 7 tetrominoes, scoring, leveling, lock delay, and game-over/restart are included; board tilt and sound are explicitly deferred.

---

## Current State (from Research)

- **No application source exists** — the repo has only pipeline config, `BRIEF.md`, `CLAUDE.md`, and `SPEC.md`.
- `package.json` is configured for an unrelated `mdtoc` CLI tool — must be fully replaced.
- `"type": "module"` is already set, confirming ES Module syntax is required throughout.
- `"node": ">=18"` engine constraint is already declared and should be preserved.
- No `node_modules`, no lockfile, no test infrastructure.
- `AGENTS.md` is referenced in `CLAUDE.md` but does not yet exist.

---

## Desired End State

After this phase the repository contains:

```
/
├── index.html                      # Entry point with HUD markup
├── package.json                    # Replaced — tron-tetris, Vite + Three.js + Vitest
├── vite.config.js
├── vitest.config.js
├── AGENTS.md                       # New — conventions, scripts, architecture
├── README.md                       # New — project overview and quick-start
├── CLAUDE.md                       # Updated — project desc + emphatic AGENTS.md instruction
├── src/
│   ├── main.js                     # Entry point: game loop, wires engine + renderer + input
│   ├── input.js                    # Keyboard handler
│   ├── engine/
│   │   ├── tetrominoes.js          # 7-piece definitions, SRS shapes, colors, spawn offsets
│   │   ├── board.js                # Board class — 10×20 grid, cell CRUD, line clear
│   │   ├── rotation.js             # SRS wall-kick tables + tryRotate()
│   │   └── gameState.js            # GameState — gravity, lock delay, scoring, leveling
│   ├── renderer/
│   │   ├── scene.js                # WebGLRenderer, OrthographicCamera, Scene, lighting
│   │   ├── blockPool.js            # Pre-allocated mesh pool for board + active piece
│   │   └── composer.js             # EffectComposer, RenderPass, UnrealBloomPass, OutputPass, grid
│   └── hud/
│       └── hud.js                  # DOM updates: score, level, lines, next-piece, overlay
└── src/__tests__/
    ├── tetrominoes.test.js
    ├── board.test.js
    ├── rotation.test.js
    └── gameState.test.js
```

**Verification:** `npm run dev` → game playable at `localhost:5173`. `npm run test` → all tests pass. `npm run test:coverage` → engine coverage ≥ 80%. `npm run build` → `dist/index.html` with zero errors or warnings.

---

## What We're NOT Doing

- No board tilt / X-axis rotation (Phase 2)
- No Web Audio API sound effects (Phase 2)
- No spring/damping animation on piece landing (Phase 2)
- No local leaderboard or initials entry (Phase 3)
- No mobile/touch controls
- No backend, server, or localStorage persistence
- No Canvas 2D rendering fallback — Three.js WebGL only
- No E2E / browser automation tests
- No external `postprocessing` npm package — using `three/addons/` (bundled with `three`)

---

## Implementation Approach

**Architecture:** Three clear layers with no cross-layer imports upward:
1. **Engine** (`src/engine/`) — pure JS, zero DOM/Three.js dependencies, fully unit-testable
2. **Renderer** (`src/renderer/`) — Three.js scene; reads engine state, never writes it
3. **Orchestration** (`src/main.js`, `src/input.js`, `src/hud/`) — wires the layers together

**Post-processing choice:** Use `three/addons/postprocessing/` (the jsm path bundled with the `three` package). No extra npm dependency. Three.js r170+ exports `three/addons/*` as a package.json `exports` alias, which Vite resolves natively.

**HUD:** Static HTML structure in `index.html`. CSS absolute-positioned over the canvas. `hud.js` updates DOM text content. Next-piece preview uses a small `<canvas>` element rendered with the 2D API.

**Grid overlay:** `THREE.LineSegments` inside the Three.js scene at z=0.01 (behind block meshes at z=0.1), styled with a dim cyan at low opacity.

**Block meshes:** Pre-allocated pool of 204 `THREE.Mesh` instances (`BoxGeometry(0.95, 0.95, 0.1)`, `MeshStandardMaterial` with `emissive` color). Pool is reset each frame — blocks are repositioned and made visible/invisible without object creation/destruction.

**Coordinate system:** Board grid uses row-down convention (row 0 = top). Three.js scene uses y-up: cell (col, row) maps to world position `(-5 + col + 0.5, 10 - row - 0.5, 0.1)`. Board spans x ∈ [-5, 5], y ∈ [-10, 10].

**Game loop:** Single `requestAnimationFrame` loop in `main.js`. `dt` (ms since last frame) is passed to `GameState.update(dt)`. Renderer reads state and draws. HUD is updated every frame.

---

## Resolved Decisions

| Open Question | Decision |
|---|---|
| `postprocessing` vs jsm | Use `three/addons/` (bundled with `three`) — no extra dependency |
| Directory structure | `src/engine/`, `src/renderer/`, `src/hud/`, `src/__tests__/` |
| `package.json` replace vs merge | Full clean replacement — `mdtoc` config is entirely unrelated |
| HUD implementation | Static HTML in `index.html`, JS updates DOM, next-piece on a `<canvas>` with 2D API |
| Grid overlay technique | `THREE.LineSegments` inside the Three.js scene |

---

## Task 1: Project Scaffold + Tooling

### Overview

Replace `package.json`, create `vite.config.js`, `vitest.config.js`, and `index.html` (with full HUD structure and CSS). Install all dependencies. Verify the dev server starts and the test runner is operational.

### Changes Required

**File:** `package.json` — **Full replacement** (not a merge)

```json
{
  "name": "tron-tetris",
  "version": "0.1.0",
  "description": "Tron-inspired neon Tetris clone built with Three.js and Vite",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

**File:** `vite.config.js` — new

```js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
});
```

**File:** `vitest.config.js` — new

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80 },
    },
  },
});
```

**File:** `index.html` — new (full HUD markup + CSS)

Key structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tron Tetris</title>
  <style>
    /* Reset & base */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      font-family: 'Courier New', Courier, monospace;
    }
    #app { position: relative; width: 100vw; height: 100vh; }

    /* Three.js canvas fills the viewport */
    #game-canvas { display: block; width: 100%; height: 100%; }

    /* HUD panel — right side, absolute over canvas */
    #hud {
      position: absolute;
      top: 50%;
      right: clamp(16px, 4vw, 48px);
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 24px;
      pointer-events: none;
      color: #00ffff;
      text-shadow: 0 0 8px #00ffff, 0 0 16px #00ffff;
    }
    .hud-panel {
      border: 1px solid #00ffff44;
      padding: 12px 16px;
      min-width: 120px;
      text-align: center;
    }
    .hud-label {
      font-size: 11px;
      letter-spacing: 0.2em;
      opacity: 0.7;
      margin-bottom: 4px;
    }
    .hud-value {
      font-size: 22px;
      letter-spacing: 0.1em;
    }
    #next-canvas {
      display: block;
      margin: 8px auto 0;
      border: 1px solid #00ffff22;
      background: #000;
    }

    /* Game-over / pause overlay */
    #overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 24px;
      background: rgba(0, 0, 0, 0.82);
      color: #00ffff;
      text-shadow: 0 0 12px #00ffff;
    }
    #overlay.hidden { display: none; }
    #overlay-title { font-size: 48px; letter-spacing: 0.2em; }
    #overlay-score { font-size: 20px; }
    #restart-btn {
      font-family: inherit;
      font-size: 16px;
      letter-spacing: 0.2em;
      color: #00ffff;
      background: transparent;
      border: 1px solid #00ffff;
      padding: 10px 28px;
      cursor: pointer;
      text-shadow: 0 0 8px #00ffff;
      box-shadow: 0 0 12px #00ffff44;
    }
    #restart-btn:hover {
      background: #00ffff22;
    }
  </style>
</head>
<body>
  <div id="app">
    <canvas id="game-canvas"></canvas>

    <div id="hud">
      <div class="hud-panel">
        <div class="hud-label">SCORE</div>
        <div class="hud-value" id="hud-score">0</div>
      </div>
      <div class="hud-panel">
        <div class="hud-label">LEVEL</div>
        <div class="hud-value" id="hud-level">1</div>
      </div>
      <div class="hud-panel">
        <div class="hud-label">LINES</div>
        <div class="hud-value" id="hud-lines">0</div>
      </div>
      <div class="hud-panel">
        <div class="hud-label">NEXT</div>
        <canvas id="next-canvas" width="100" height="100"></canvas>
      </div>
    </div>

    <div id="overlay" class="hidden">
      <div id="overlay-title">GAME OVER</div>
      <div id="overlay-score"></div>
      <button id="restart-btn">PLAY AGAIN</button>
    </div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**Install:** `npm install`

### Success Criteria

- [ ] `npm install` completes without errors; `node_modules/` contains `three`, `vite`, `vitest`
- [ ] `npm run dev` starts dev server at `localhost:5173`; browser shows black page (no errors in console since `src/main.js` doesn't exist yet — that's OK, just verify server starts)
- [ ] `npm run test` exits cleanly (no test files yet — zero tests pass is acceptable for this task)
- [ ] `npm run build` fails gracefully (no entry point yet — but tooling itself is valid)

---

## Task 2: Tetromino Definitions + Board Class

### Overview

Define all 7 SRS tetrominoes (shapes for all 4 rotation states, neon colors, spawn column offsets). Implement the `Board` class (10×20 grid, cell access, bounds/collision checking, piece-cell projection, piece locking, line clear). Write thorough unit tests for the Board.

### Changes Required

**File:** `src/engine/tetrominoes.js` — new

```js
// Each shape: 4×4 boolean grid, 4 rotation states, row-0 = top
// Neon Tron colors per tetromino type
export const TETROMINOES = {
  I: {
    color: 0x00ffff,   // cyan
    spawnCol: 3,
    shapes: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
    ],
  },
  O: {
    color: 0xffff00,   // yellow
    spawnCol: 3,
    shapes: [
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    ],
  },
  T: {
    color: 0xff00ff,   // magenta
    spawnCol: 3,
    shapes: [
      [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,0,0],[0,1,1,0],[0,1,0,0],[0,0,0,0]],
      [[0,0,0,0],[1,1,1,0],[0,1,0,0],[0,0,0,0]],
      [[0,1,0,0],[1,1,0,0],[0,1,0,0],[0,0,0,0]],
    ],
  },
  S: {
    color: 0x00ff00,   // green
    spawnCol: 3,
    shapes: [
      [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,0,0],[0,1,1,0],[0,0,1,0],[0,0,0,0]],
      [[0,0,0,0],[0,1,1,0],[1,1,0,0],[0,0,0,0]],
      [[1,0,0,0],[1,1,0,0],[0,1,0,0],[0,0,0,0]],
    ],
  },
  Z: {
    color: 0xff2040,   // red
    spawnCol: 3,
    shapes: [
      [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,1,1,0],[0,1,0,0],[0,0,0,0]],
      [[0,0,0,0],[1,1,0,0],[0,1,1,0],[0,0,0,0]],
      [[0,1,0,0],[1,1,0,0],[1,0,0,0],[0,0,0,0]],
    ],
  },
  J: {
    color: 0x4040ff,   // blue
    spawnCol: 3,
    shapes: [
      [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,1,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
      [[0,0,0,0],[1,1,1,0],[0,0,1,0],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[1,1,0,0],[0,0,0,0]],
    ],
  },
  L: {
    color: 0xff8000,   // orange
    spawnCol: 3,
    shapes: [
      [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,1,0],[0,0,0,0]],
      [[0,0,0,0],[1,1,1,0],[1,0,0,0],[0,0,0,0]],
      [[1,1,0,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
    ],
  },
};

export const PIECE_TYPES = Object.keys(TETROMINOES); // ['I','O','T','S','Z','J','L']

export function randomPieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}
```

**File:** `src/engine/board.js` — new

```js
import { TETROMINOES } from './tetrominoes.js';

export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

export class Board {
  constructor(cols = BOARD_COLS, rows = BOARD_ROWS) {
    this.cols = cols;
    this.rows = rows;
    // 0 = empty; non-zero = locked color (hex number)
    this.cells = new Array(rows * cols).fill(0);
  }

  getCell(col, row) {
    return this.cells[row * this.cols + col];
  }

  setCell(col, row, color) {
    this.cells[row * this.cols + col] = color;
  }

  isInBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  // Returns true if (col, row) is out of bounds OR occupied by a locked piece
  isBlocked(col, row) {
    if (!this.isInBounds(col, row)) return true;
    return this.cells[row * this.cols + col] !== 0;
  }

  // Get board [col, row] coordinates for each filled cell of a piece
  getPieceCells(pieceType, rotation, originCol, originRow) {
    const shape = TETROMINOES[pieceType].shapes[rotation];
    const cells = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (shape[r][c]) {
          cells.push([originCol + c, originRow + r]);
        }
      }
    }
    return cells;
  }

  // True if piece placement is valid (in bounds and no collision)
  isValid(pieceType, rotation, originCol, originRow) {
    return this.getPieceCells(pieceType, rotation, originCol, originRow)
      .every(([c, r]) => this.isInBounds(c, r) && !this.isBlocked(c, r));
  }

  // Lock piece onto the board (write locked cells)
  lockPiece(pieceType, rotation, originCol, originRow) {
    const color = TETROMINOES[pieceType].color;
    this.getPieceCells(pieceType, rotation, originCol, originRow)
      .forEach(([c, r]) => this.setCell(c, r, color));
  }

  // Returns indices of completed rows (bottom-up order, largest index first)
  getCompletedRows() {
    const completed = [];
    for (let r = 0; r < this.rows; r++) {
      let full = true;
      for (let c = 0; c < this.cols; c++) {
        if (!this.isBlocked(c, r)) { full = false; break; }
      }
      if (full) completed.push(r);
    }
    return completed;
  }

  // Remove the given row indices (already completed) and shift rows above down
  clearRows(rowIndices) {
    // Remove rows from largest index first to keep indices stable
    const sorted = [...rowIndices].sort((a, b) => b - a);
    for (const row of sorted) {
      // Remove that row's cells and prepend empty row at top
      this.cells.splice(row * this.cols, this.cols);
      this.cells.unshift(...new Array(this.cols).fill(0));
    }
    return rowIndices.length;
  }

  clear() {
    this.cells.fill(0);
  }
}
```

**File:** `src/__tests__/board.test.js` — new

Key scenarios:
- `getCell`/`setCell` round-trip
- `isInBounds`: corners, out-of-bounds values
- `isBlocked`: empty cell → false; out of bounds → true; occupied cell → true
- `getPieceCells`: verify cell list for each of the 7 pieces at rotation 0
- `isValid`: piece fully in bounds → true; piece overlapping wall → false; piece overlapping locked cell → false
- `lockPiece`: verify cells are written with correct color
- `getCompletedRows`: empty board → []; partial row → []; complete row → [rowIndex]
- `clearRows`: removes correct rows, shifts above rows down, adds empty rows at top
- Multi-line clear (Tetris): 4 rows cleared simultaneously

**File:** `src/__tests__/tetrominoes.test.js` — new

Key scenarios:
- All 7 `PIECE_TYPES` are present
- Each piece has exactly 4 rotation states
- Each rotation state is a 4×4 grid of 0s and 1s
- Each piece has a numeric `color` and numeric `spawnCol`
- `randomPieceType()` returns a valid piece type

### Success Criteria

- [ ] `npm run test` passes all board and tetromino tests
- [ ] `Board.clearRows` correctly shifts rows: a cell at row 5 moves to row 6 after clearing row 6
- [ ] `Board.isValid` returns false when any cell overlaps a wall or locked piece
- [ ] All 7 tetrominoes have 4 valid rotation shapes

---

## Task 3: SRS Rotation + Wall Kicks

### Overview

Implement the SRS wall kick tables for all piece types and a `tryRotate()` function. Return the new rotation state and position if any kick succeeds, or `null` if all kicks fail.

### Changes Required

**File:** `src/engine/rotation.js` — new

```js
// SRS wall kick offsets in [dCol, dRow] — row-down convention (positive dRow = move DOWN)
// Derived from the Tetris Guideline with y-axis flipped to match our grid.

const KICKS_JLSTZ = {
  '0->1': [[0,0],[-1,0],[-1,-1],[0,+2],[-1,+2]],
  '1->0': [[0,0],[+1,0],[+1,+1],[0,-2],[+1,-2]],
  '1->2': [[0,0],[+1,0],[+1,+1],[0,-2],[+1,-2]],
  '2->1': [[0,0],[-1,0],[-1,-1],[0,+2],[-1,+2]],
  '2->3': [[0,0],[+1,0],[+1,-1],[0,+2],[+1,+2]],
  '3->2': [[0,0],[-1,0],[-1,+1],[0,-2],[-1,-2]],
  '3->0': [[0,0],[-1,0],[-1,+1],[0,-2],[-1,-2]],
  '0->3': [[0,0],[+1,0],[+1,-1],[0,+2],[+1,+2]],
};

const KICKS_I = {
  '0->1': [[0,0],[-2,0],[+1,0],[-2,+1],[+1,-2]],
  '1->0': [[0,0],[+2,0],[-1,0],[+2,-1],[-1,+2]],
  '1->2': [[0,0],[-1,0],[+2,0],[-1,-2],[+2,+1]],
  '2->1': [[0,0],[+1,0],[-2,0],[+1,+2],[-2,-1]],
  '2->3': [[0,0],[+2,0],[-1,0],[+2,-1],[-1,+2]],
  '3->2': [[0,0],[-2,0],[+1,0],[-2,+1],[+1,-2]],
  '3->0': [[0,0],[+1,0],[-2,0],[+1,+2],[-2,-1]],
  '0->3': [[0,0],[-1,0],[+2,0],[-1,-2],[+2,+1]],
};

// O piece: single no-op kick (O always rotates about its own center, never blocked)
const KICKS_O = { default: [[0,0]] };

function getKicks(pieceType, fromRot, toRot) {
  const key = `${fromRot}->${toRot}`;
  if (pieceType === 'I') return KICKS_I[key] ?? [[0,0]];
  if (pieceType === 'O') return KICKS_O.default;
  return KICKS_JLSTZ[key] ?? [[0,0]];
}

/**
 * Try to rotate a piece, applying SRS wall kicks.
 * direction: +1 = clockwise, -1 = counter-clockwise
 * Returns { rotation, col, row } if successful, null if all kicks fail.
 */
export function tryRotate(board, pieceType, currentRotation, direction, col, row) {
  const nextRotation = ((currentRotation + direction) + 4) % 4;
  const kicks = getKicks(pieceType, currentRotation, nextRotation);

  for (const [dCol, dRow] of kicks) {
    const newCol = col + dCol;
    const newRow = row + dRow;
    if (board.isValid(pieceType, nextRotation, newCol, newRow)) {
      return { rotation: nextRotation, col: newCol, row: newRow };
    }
  }
  return null; // rotation not possible
}
```

**File:** `src/__tests__/rotation.test.js` — new

Key scenarios:
- CW rotation from state 0→1→2→3→0 for each piece (unobstructed): returns correct next state
- CCW rotation 0→3→2→1→0 for each piece (unobstructed): correct next state
- Wall kick test: place piece adjacent to right wall, rotate CW → piece shifts left via kick
- Wall kick test: place piece adjacent to left wall, rotate CW → piece shifts right via kick
- Floor kick test: piece in bottom rows, rotate → kick moves piece up (negative dRow)
- When all kicks fail (piece fully surrounded), `tryRotate` returns `null`
- O piece rotation always returns nextRotation with same col/row (no kick needed)

### Success Criteria

- [ ] All 7 pieces rotate through all 4 states without error
- [ ] Wall kick tests pass: pieces near walls successfully rotate when a kick offset provides a valid position
- [ ] `tryRotate` returns `null` when no kick is valid
- [ ] `npm run test` passes all rotation tests

---

## Task 4: Game State — Gravity, Lock Delay, Scoring, Leveling, Game Over

### Overview

Implement `GameState` — the central game controller. Manages the active piece, gravity accumulator, lock delay (500ms, 15-reset max), hard/soft drop, line clear + scoring, level progression, and game-over detection. Also exports `gravityInterval(level)` for the gravity speed curve.

### Changes Required

**File:** `src/engine/gameState.js` — new

```js
import { Board, BOARD_COLS } from './board.js';
import { TETROMINOES, randomPieceType } from './tetrominoes.js';
import { tryRotate } from './rotation.js';

// Standard Tetris Guideline gravity intervals per level (ms per row drop)
export const GRAVITY_TABLE = [
  1000, 793, 618, 473, 356, 262, 190, 135, 94, 83,  // levels 1–10
    83,  83,  83,  83,  83,  50,  33,  33,  33,  17,  // levels 11–20
];

export function gravityInterval(level) {
  const idx = Math.min(level - 1, GRAVITY_TABLE.length - 1);
  return GRAVITY_TABLE[idx];
}

const LOCK_DELAY_MS  = 500;
const MAX_LOCK_RESETS = 15;
const SOFT_DROP_INTERVAL = 50; // ms

const LINE_SCORES = [0, 100, 300, 500, 800]; // indexed by line count (1–4)

export class GameState {
  constructor() {
    this.board = new Board();
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.paused = false;
    this.over = false;
    this.softDrop = false;

    // Active piece state
    this.pieceType = null;
    this.rotation = 0;
    this.col = 0;
    this.row = 0;

    this.nextPieceType = randomPieceType();

    // Gravity / lock timing
    this._gravityAccum = 0;
    this._lockAccum = 0;
    this._lockResets = 0;
    this._landed = false; // true when piece is resting on surface

    this._spawnPiece();
  }

  // --- Public API called by game loop ---

  update(dt) {
    if (this.paused || this.over) return;

    const interval = this.softDrop
      ? Math.min(SOFT_DROP_INTERVAL, gravityInterval(this.level))
      : gravityInterval(this.level);

    this._gravityAccum += dt;

    if (this._gravityAccum >= interval) {
      this._gravityAccum = 0;

      const moved = this._tryMoveDown();
      if (!moved) {
        // Piece has landed — run lock delay
        this._lockAccum += interval;
        if (this._lockAccum >= LOCK_DELAY_MS) {
          this._lockPiece();
        }
      } else {
        // Piece successfully moved down — reset lock delay
        this._lockAccum = 0;
        this._landed = false;
      }
    }
  }

  moveLeft()  { this._tryMove(-1, 0); }
  moveRight() { this._tryMove(+1, 0); }

  rotateCW()  { this._tryRotate(+1); }
  rotateCCW() { this._tryRotate(-1); }

  startSoftDrop() { this.softDrop = true; }
  stopSoftDrop()  { this.softDrop = false; }

  hardDrop() {
    if (this.paused || this.over) return;
    while (this._tryMoveDown()) { /* drop */ }
    this._lockPiece();
  }

  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
  }

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
    this.nextPieceType = randomPieceType();
    this._spawnPiece();
  }

  // Returns array of [col, row] for the current active piece's cells
  getActivePieceCells() {
    if (!this.pieceType) return [];
    return this.board.getPieceCells(this.pieceType, this.rotation, this.col, this.row);
  }

  getActivePieceColor() {
    return this.pieceType ? TETROMINOES[this.pieceType].color : 0;
  }

  // --- Private helpers ---

  _spawnPiece() {
    this.pieceType = this.nextPieceType;
    this.nextPieceType = randomPieceType();
    this.rotation = 0;
    this.col = TETROMINOES[this.pieceType].spawnCol;
    this.row = 0;
    this._lockAccum = 0;
    this._lockResets = 0;
    this._landed = false;
    this._gravityAccum = 0;

    // Game over: if spawn position is already blocked
    if (!this.board.isValid(this.pieceType, this.rotation, this.col, this.row)) {
      this.over = true;
    }
  }

  _tryMove(dCol, dRow) {
    if (this.paused || this.over) return false;
    const newCol = this.col + dCol;
    const newRow = this.row + dRow;
    if (this.board.isValid(this.pieceType, this.rotation, newCol, newRow)) {
      this.col = newCol;
      this.row = newRow;
      this._resetLock();
      return true;
    }
    return false;
  }

  _tryMoveDown() {
    return this._tryMove(0, +1);
  }

  _tryRotate(direction) {
    if (this.paused || this.over) return;
    const result = tryRotate(this.board, this.pieceType, this.rotation, direction, this.col, this.row);
    if (result) {
      this.rotation = result.rotation;
      this.col = result.col;
      this.row = result.row;
      this._resetLock();
    }
  }

  _resetLock() {
    if (this._lockResets < MAX_LOCK_RESETS) {
      this._lockAccum = 0;
      this._lockResets++;
    }
    // If max resets reached, do NOT reset lock — it will expire naturally
  }

  _lockPiece() {
    this.board.lockPiece(this.pieceType, this.rotation, this.col, this.row);
    const completedRows = this.board.getCompletedRows();
    if (completedRows.length > 0) {
      this.board.clearRows(completedRows);
      this._addScore(completedRows.length);
      this.linesCleared += completedRows.length;
      this.level = Math.floor(this.linesCleared / 10) + 1;
    }
    this.pieceType = null;
    this._spawnPiece();
  }

  _addScore(lineCount) {
    const points = (LINE_SCORES[lineCount] ?? 0) * this.level;
    this.score += points;
  }
}
```

**File:** `src/__tests__/gameState.test.js` — new

Key scenarios:
- `gravityInterval(1)` → 1000; `gravityInterval(10)` → 83; `gravityInterval(20)` → 17
- Level starts at 1; after 10 lines cleared → level 2; after 20 lines → level 3
- Score for 1 line at level 1 → 100; 4 lines at level 1 → 800; 1 line at level 2 → 200
- Hard drop: piece teleports to lowest valid position and locks immediately
- Game over: detected when spawn position is blocked (fill top rows to trigger)
- `restart()`: resets all state — score 0, level 1, board empty, not over
- Lock delay: `_lockAccum` accumulates when piece can't move down; piece locks after `LOCK_DELAY_MS`
- Soft drop: effective interval is `Math.min(SOFT_DROP_INTERVAL, normalInterval)`
- Max lock resets: after 15 resets, additional moves do not reset `_lockAccum`

**Note:** Testing `GameState` requires mocking or seeding `randomPieceType()`. Export a `GameState` constructor that accepts an optional `initialPieceType` and `nextPieceType` override for testability:

```js
// Allow dependency injection for tests
export class GameState {
  constructor({ firstPiece, secondPiece } = {}) {
    // ...
    this.nextPieceType = secondPiece ?? randomPieceType();
    this._spawnPiece(firstPiece);
  }
  _spawnPiece(overridePiece) {
    this.pieceType = overridePiece ?? this.nextPieceType;
    // ...
  }
}
```

### Success Criteria

- [ ] `gravityInterval` returns correct values for levels 1, 5, 10, 20
- [ ] Scoring: 100/300/500/800 × level for 1/2/3/4 line clears respectively
- [ ] Level increments at 10, 20, 30 lines
- [ ] Game over sets `this.over = true` when spawn is blocked
- [ ] `restart()` produces clean initial state
- [ ] `npm run test` passes all gameState tests

---

## Task 5: Three.js Scene + Block Renderer

### Overview

Set up the Three.js WebGL scene with orthographic camera, a dark background plane, and a pre-allocated block mesh pool. Render the board state and active piece each frame.

### Changes Required

**File:** `src/renderer/scene.js` — new

```js
import * as THREE from 'three';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();

  // Ambient light for MeshStandardMaterial
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // Camera: show board (10×20) with 2-cell padding
  const camera = buildCamera(canvas);

  // Handle resize
  window.addEventListener('resize', () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    updateCamera(camera, canvas);
  });

  return { renderer, scene, camera };
}

function buildCamera(canvas) {
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const vHeight = BOARD_ROWS + 4; // 24 units tall
  const vWidth = vHeight * aspect;
  const camera = new THREE.OrthographicCamera(
    -vWidth / 2, vWidth / 2,
    vHeight / 2, -vHeight / 2,
    0.1, 100
  );
  camera.position.z = 10;
  return camera;
}

function updateCamera(camera, canvas) {
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const vHeight = BOARD_ROWS + 4;
  const vWidth = vHeight * aspect;
  camera.left   = -vWidth / 2;
  camera.right  =  vWidth / 2;
  camera.top    =  vHeight / 2;
  camera.bottom = -vHeight / 2;
  camera.updateProjectionMatrix();
}
```

**File:** `src/renderer/blockPool.js` — new

```js
import * as THREE from 'three';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

// Board is centered at origin: x ∈ [-5, 5], y ∈ [-10, 10]
// Cell (col, row) → world center: (-COLS/2 + col + 0.5, ROWS/2 - row - 0.5)
function cellToWorld(col, row) {
  return [
    -BOARD_COLS / 2 + col + 0.5,
     BOARD_ROWS / 2 - row - 0.5,
    0.1,
  ];
}

export class BlockPool {
  constructor(scene, maxBlocks = 220) {
    const geo = new THREE.BoxGeometry(0.95, 0.95, 0.1);
    this._entries = [];

    for (let i = 0; i < maxBlocks; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this._entries.push({ mesh, mat });
    }

    this._active = 0;
  }

  // Call at start of each render frame
  begin() { this._active = 0; }

  // Place a block; call between begin() and end()
  addBlock(col, row, color) {
    if (this._active >= this._entries.length) return;
    const { mesh, mat } = this._entries[this._active++];
    mat.color.setHex(color);
    mat.emissive.setHex(color);
    const [x, y, z] = cellToWorld(col, row);
    mesh.position.set(x, y, z);
    mesh.visible = true;
  }

  // Hide all unused pool entries
  end() {
    for (let i = this._active; i < this._entries.length; i++) {
      this._entries[i].mesh.visible = false;
    }
  }
}
```

**File:** `src/renderer/composer.js` — new (grid + bloom setup; full scene draw)

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';
import { BlockPool } from './blockPool.js';

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,   // strength
    0.4,   // radius
    0.82,  // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return composer;
}

export function createGridLines(scene) {
  const positions = [];
  const halfCols = BOARD_COLS / 2;
  const halfRows = BOARD_ROWS / 2;

  // Vertical lines
  for (let c = 0; c <= BOARD_COLS; c++) {
    const x = -halfCols + c;
    positions.push(x, halfRows, 0.02, x, -halfRows, 0.02);
  }
  // Horizontal lines
  for (let r = 0; r <= BOARD_ROWS; r++) {
    const y = halfRows - r;
    positions.push(-halfCols, y, 0.02, halfCols, y, 0.02);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({
    color: 0x0a3a3a,
    opacity: 0.5,
    transparent: true,
  });

  const lines = new THREE.LineSegments(geo, mat);
  scene.add(lines);
  return lines;
}
```

**File:** `src/renderer/render.js` — new (draw function called each frame)

```js
import { BlockPool } from './blockPool.js';

export class BoardRenderer {
  constructor(scene) {
    this.pool = new BlockPool(scene, 220);
  }

  draw(gameState) {
    this.pool.begin();

    // Draw locked board cells
    const { board } = gameState;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const color = board.getCell(c, r);
        if (color !== 0) this.pool.addBlock(c, r, color);
      }
    }

    // Draw active piece
    const activeCells = gameState.getActivePieceCells();
    const activeColor = gameState.getActivePieceColor();
    for (const [c, r] of activeCells) {
      if (r >= 0) this.pool.addBlock(c, r, activeColor); // skip hidden rows above board
    }

    this.pool.end();
  }
}
```

> Note: The renderer modules have no unit tests (Three.js rendering requires a WebGL context unavailable in Node). Visual verification is done manually.

### Success Criteria

- [ ] `npm run dev`: browser shows black background, colored blocks render for initial spawned piece
- [ ] Blocks have emissive neon glow appearance (visible even without bloom)
- [ ] Board cells are exactly 1 unit apart with 0.05-unit gaps between blocks
- [ ] Canvas resizes correctly when browser window is resized
- [ ] No Three.js warnings in console (no deprecated API usage)

---

## Task 6: Grid Overlay + Bloom Post-Processing

### Overview

Add the `LineSegments` grid to the scene and wire up `EffectComposer` + `UnrealBloomPass` + `OutputPass`. The bloom pass makes emissive block materials glow. The grid provides the Tron-style scanline effect.

### Changes Required

Grid creation is already defined in `src/renderer/composer.js` (`createGridLines`). This task wires it into `main.js` (see Task 7) and tunes bloom parameters.

**Bloom parameter choices:**
- `strength: 1.2` — strong enough to glow, not so strong it bleeds everywhere
- `radius: 0.4` — moderate spread
- `threshold: 0.82` — only very bright (emissive) materials bloom; grid lines and background do not

**Grid styling:**
- Color: `0x0a3a3a` (dark teal) — visible but subtle against black background
- Opacity: 0.5 — present but not distracting
- Z: 0.02 — behind block meshes (z=0.1)

**Background board area:** Add a dark plane behind the board cells to distinguish the play field:

```js
// In scene.js or main.js setup
function createBoardBackground(scene) {
  const geo = new THREE.PlaneGeometry(BOARD_COLS, BOARD_ROWS);
  const mat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.z = -0.05; // behind grid lines and blocks
  scene.add(plane);
}
```

### Success Criteria

- [ ] Blocks visibly glow/bloom against the black background
- [ ] Grid lines are visible over the dark board background
- [ ] Grid lines do NOT glow (threshold prevents it)
- [ ] `npm run dev`: no Three.js console errors from EffectComposer setup

---

## Task 7: Game Loop + Keyboard Input

### Overview

Wire together the engine (`GameState`), renderer (`BoardRenderer`, `composer`), and input in `main.js`. Implement keyboard input in `input.js`. Start the `requestAnimationFrame` loop.

### Changes Required

**File:** `src/input.js` — new

```js
export function setupInput(gameState, onRestart) {
  const held = new Set();

  window.addEventListener('keydown', (e) => {
    if (held.has(e.code)) return; // prevent key repeat for most actions
    held.add(e.code);

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

**File:** `src/main.js` — new

```js
import { GameState } from './engine/gameState.js';
import { createScene } from './renderer/scene.js';
import { createComposer, createGridLines } from './renderer/composer.js';
import { BoardRenderer } from './renderer/render.js';
import { setupInput } from './input.js';
import { updateHud, showOverlay, hideOverlay } from './hud/hud.js';

const canvas = document.getElementById('game-canvas');
const { renderer, scene, camera } = createScene(canvas);
createGridLines(scene);

// Optional: dark board background plane (see Task 6)
// createBoardBackground(scene);

const composer = createComposer(renderer, scene, camera);
const boardRenderer = new BoardRenderer(scene);

let gameState = new GameState();

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

- [ ] Opening `localhost:5173`: a piece spawns and falls on its own
- [ ] Arrow Left/Right moves piece; Arrow Up / X rotates CW; Z rotates CCW
- [ ] Arrow Down soft-drops; Space hard-drops to bottom and locks immediately
- [ ] P key pauses and unpauses
- [ ] Completed rows are cleared; board shifts down; score increments
- [ ] Level display increases after every 10 lines
- [ ] Piece fall speed visibly increases as level rises
- [ ] Game runs at stable 60fps (no perceptible stutter)

---

## Task 8: HUD Overlay + Game Over Screen

### Overview

Implement `hud.js` to update DOM elements (score, level, lines, next-piece canvas). Show/hide the game-over overlay. Render the next-piece preview on the small 2D canvas.

### Changes Required

**File:** `src/hud/hud.js` — new

```js
import { TETROMINOES } from '../engine/tetrominoes.js';

const elScore  = document.getElementById('hud-score');
const elLevel  = document.getElementById('hud-level');
const elLines  = document.getElementById('hud-lines');
const nextCanvas = document.getElementById('next-canvas');
const overlay  = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');

const nextCtx = nextCanvas.getContext('2d');
const CELL = nextCanvas.width / 6; // 4×4 grid + 1-cell padding each side

export function updateHud(gameState) {
  elScore.textContent = gameState.score.toLocaleString();
  elLevel.textContent = gameState.level;
  elLines.textContent = gameState.linesCleared;
  renderNextPiece(gameState.nextPieceType);
}

function renderNextPiece(pieceType) {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!pieceType) return;

  const { color, shapes } = TETROMINOES[pieceType];
  const shape = shapes[0];
  const hex = color.toString(16).padStart(6, '0');
  nextCtx.fillStyle = `#${hex}`;
  nextCtx.shadowColor = `#${hex}`;
  nextCtx.shadowBlur = 8;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c]) {
        nextCtx.fillRect(
          (c + 1) * CELL + 1,
          (r + 1) * CELL + 1,
          CELL - 2,
          CELL - 2,
        );
      }
    }
  }
}

export function showOverlay(title, score) {
  overlayTitle.textContent = title;
  overlayScore.textContent = `SCORE: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

export function hideOverlay() {
  overlay.classList.add('hidden');
}
```

### Success Criteria

- [ ] Score display updates in real time as lines are cleared
- [ ] Level display increments when lines threshold is crossed
- [ ] Lines display shows cumulative lines cleared
- [ ] Next-piece preview shows the correct next piece with its neon color
- [ ] Game-over overlay appears with final score when game ends
- [ ] "PLAY AGAIN" button resets the game and hides the overlay
- [ ] P key pause does not show the overlay (game simply stops falling)

---

## Task 9: Documentation + Build Verification

### Overview

Create `AGENTS.md` and `README.md`. Update `CLAUDE.md` with project description. Verify `npm run build` produces a clean `dist/`. Verify all acceptance criteria from the SPEC.

### Changes Required

**File:** `AGENTS.md` — new

```markdown
# AGENTS.md

READ THIS FIRST before writing any code or running any commands.

## Install

npm install

## Dev Server

npm run dev          # Vite dev server at localhost:5173

## Tests

npm run test         # Run all Vitest unit tests
npm run test:coverage  # Coverage report in coverage/ (engine target ≥ 80%)

## Build

npm run build        # Output to dist/
npm run preview      # Preview production build locally

## Architecture

src/
  main.js            — Entry point: RAF game loop, wires all layers
  input.js           — Keyboard event handling
  engine/            — Pure JS game logic (no DOM/Three.js)
    tetrominoes.js   — 7-piece shapes, SRS rotations, colors
    board.js         — Board class: 10×20 grid, line clear
    rotation.js      — SRS wall kick tables, tryRotate()
    gameState.js     — GameState: gravity, lock delay, scoring, level
  renderer/          — Three.js rendering (reads engine state, never writes)
    scene.js         — WebGLRenderer, OrthographicCamera, Scene
    blockPool.js     — Pre-allocated mesh pool
    composer.js      — EffectComposer, UnrealBloomPass, grid LineSegments
    render.js        — BoardRenderer: maps game state to block meshes
  hud/
    hud.js           — DOM updates for score/level/lines/next-piece/overlay
  __tests__/         — Vitest unit tests (engine modules only)

## Conventions

- ES Modules only (no CommonJS require)
- Node ≥ 18
- Three.js addons via `three/addons/` (not a separate postprocessing package)
- No E2E tests; unit tests cover engine only (renderer requires WebGL context)
```

**File:** `README.md` — new

```markdown
# Tron Tetris

A neon-retro Tetris clone built with Three.js and Vite. Classic Tetris mechanics
rendered with a Tron-inspired aesthetic: dark background, glowing neon block colors,
grid overlay, and bloom post-processing.

## Getting Started

npm install
npm run dev     # open localhost:5173

## Controls

| Key | Action |
|---|---|
| ← → | Move left / right |
| ↑ or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| P | Pause |

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest unit tests |
| `npm run test:coverage` | Generate coverage report in `coverage/` |

## Project Structure

See AGENTS.md for full architecture overview.
```

**File:** `CLAUDE.md` — update (prepend project description, keep existing content intact)

Add to the top of `CLAUDE.md`, before the existing `## ⚠️ FIRST: Read AGENTS.md` section:

```markdown
## Project: Tron Tetris

A neon-retro Tetris clone built with Three.js and Vite. See AGENTS.md for
architecture, install steps, and test commands.

⚠️ **AGENTS.md MUST be read at the start of every session.** It contains
project conventions, available npm scripts, and architectural decisions that
all agents must follow.

---
```

**Build verification command:** `npm run build` — must exit 0 with zero errors/warnings in stdout.

### Success Criteria

- [ ] `AGENTS.md` exists and accurately documents install, test, build commands, and file structure
- [ ] `README.md` exists with getting-started steps and controls table
- [ ] `CLAUDE.md` retains its existing cc-pipeline section; new project description is prepended
- [ ] `npm run build` exits successfully; `dist/index.html` exists
- [ ] `npm run test:coverage` generates `coverage/` directory; engine line coverage ≥ 80%
- [ ] All SPEC acceptance criteria are manually verified (see checklist below)

---

## Full Acceptance Criteria Checklist

After all tasks are complete, verify:

- [ ] `npm install` completes without errors
- [ ] `npm run dev` → `localhost:5173` shows a playable game
- [ ] All 7 tetrominoes spawn, move, rotate, soft-drop, hard-drop correctly
- [ ] Wall kicks prevent pieces from rotating through walls or floor
- [ ] Completed rows clear; rows above shift down correctly
- [ ] Score: 100/300/500/800 pts × level for 1/2/3/4 line clears
- [ ] Level increases after every 10 lines; fall speed visibly increases
- [ ] Game over triggers when new piece cannot spawn; restart prompt shown
- [ ] Three.js scene: dark background, neon-colored blocks, visible bloom
- [ ] Grid lines visible on board
- [ ] HUD shows score, level, lines cleared, next-piece preview
- [ ] `npm run test` → all tests pass
- [ ] `npm run test:coverage` → engine coverage ≥ 80%
- [ ] `npm run build` → `dist/index.html`, zero errors or warnings

---

## Testing Strategy

### Unit Tests (Vitest, `src/__tests__/`)

**`tetrominoes.test.js`**
- All 7 PIECE_TYPES present; each has 4 rotation states; each state is 4×4 boolean grid
- Colors are positive integers (hex); spawnCol is 0–9

**`board.test.js`**
- Cell CRUD round-trip
- `isInBounds`: all four corners, one step outside each edge
- `isBlocked`: empty = false; out-of-bounds = true; locked = true
- `getPieceCells`: all 7 pieces at rotation 0 — verify exact cell coordinates
- `isValid`: piece centered in board = true; one cell over right wall = false
- `lockPiece`: cells written with correct color
- `getCompletedRows` + `clearRows`: 0-line, 1-line, 2-line, 4-line (Tetris) scenarios
- Row shift: after clearing row 5 from a 7-row board, cell formerly at row 4 is now at row 5

**`rotation.test.js`**
- All pieces: 4 CW rotations return to original state
- All pieces: 4 CCW rotations return to original state
- I piece at right edge: rotation with kick succeeds
- Piece fully surrounded: `tryRotate` returns null
- O piece: rotation always returns next state with same col/row

**`gameState.test.js`**
- `gravityInterval`: spot-check levels 1, 5, 10, 15, 20
- Scoring: correct points for 1/2/3/4 line clears at levels 1 and 3
- Level: increments at 10, 20, 30 lines
- Hard drop: piece reaches lowest valid row and locks
- Game over: fill rows 0–1 with locked cells, spawn → `over === true`
- `restart()`: all counters reset, board empty
- Lock delay: use `_lockAccum` injection or `update(dt)` calls to verify 500ms behavior
- Soft drop: effective interval = min(50, normalInterval)

**Mocking strategy:** No mocking. Use dependency injection (`firstPiece`, `secondPiece` params on `GameState` constructor) to seed deterministic piece sequences. `Board` is a pure data structure testable without any globals.

### No E2E Tests

Per SPEC and BRIEF — no browser automation or E2E tests required.

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `three/addons/` import fails with Vite | If import resolution fails, add Vite alias: `resolve: { alias: { 'three/addons/': 'node_modules/three/examples/jsm/' } }` |
| `UnrealBloomPass` color shift in r155+ | Add `OutputPass` after bloom pass (already included in plan) |
| SRS wall kick values incorrect | Write rotation tests with near-wall placements; iterate on kick table values until tests pass |
| Lock delay timing off in test | Test via direct `_lockAccum` state inspection or call `update(500)` with a landed piece |
| Block pool exhausted (> 220 blocks) | Pool size 220 = 200 board + 4 active + 16 ghost piece buffer; increase if needed |
| Canvas size mismatch with Three.js | Use `canvas.clientWidth`/`clientHeight` (CSS size) not `canvas.width`/`height` for renderer |
| `vite build` tree-shaking three/addons | Tree-shaking is handled by Vite/Rollup naturally; no special config needed |
