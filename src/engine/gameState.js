import { Board, BOARD_COLS } from './board.js';
import { TETROMINOES, randomPieceType } from './tetrominoes.js';
import { tryRotate } from './rotation.js';

export const GRAVITY_TABLE = [
  1000, 793, 618, 473, 356, 262, 190, 135, 94, 83,
    83,  83,  83,  83,  83,  50,  33,  33,  33,  17,
];

export function gravityInterval(level) {
  const idx = Math.min(level - 1, GRAVITY_TABLE.length - 1);
  return GRAVITY_TABLE[idx];
}

const LOCK_DELAY_MS = 500;
const MAX_LOCK_RESETS = 15;
const SOFT_DROP_INTERVAL = 50;
const LINE_SCORES = [0, 100, 300, 500, 800];
const FLASH_DURATION_MS = 100;
const SWEEP_DURATION_MS = 150;

export class GameState {
  constructor({ firstPiece, secondPiece } = {}) {
    this.board = new Board();
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.paused = false;
    this.over = false;
    this.softDrop = false;

    this.pieceType = null;
    this.rotation = 0;
    this.col = 0;
    this.row = 0;

    this.nextPieceType = null;

    this._gravityAccum = 0;
    this._lockAccum = 0;
    this._lockResets = 0;
    this._landed = false;

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

    this._spawnPiece(firstPiece, secondPiece);
  }

  get sweepProgress() {
    if (!this.sweeping) return 0;
    return Math.min(1, this._sweepAccum / SWEEP_DURATION_MS);
  }

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

    // Advance lock delay every frame when piece is resting on surface
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
        this._landed = true;   // mark as landed; lock timer runs per-frame above
      } else {
        this._landed = false;
        this._lockAccum = 0;
        if (this.softDrop) this.soundEvents.push('softDrop');
      }
    }
  }

  moveLeft()  { if (this._tryMove(-1, 0)) this.soundEvents.push('move'); }
  moveRight() { if (this._tryMove(+1, 0)) this.soundEvents.push('move'); }
  rotateCW()  { this._tryRotate(+1); }
  rotateCCW() { this._tryRotate(-1); }
  startSoftDrop() { this.softDrop = true; }
  stopSoftDrop()  { this.softDrop = false; }

  hardDrop() {
    if (this.paused || this.over) return;
    this.soundEvents.push('hardDrop');
    while (this._tryMoveDown()) {}
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

  getActivePieceCells() {
    if (!this.pieceType) return [];
    return this.board.getPieceCells(this.pieceType, this.rotation, this.col, this.row);
  }

  getActivePieceColor() {
    return this.pieceType ? TETROMINOES[this.pieceType].color : 0;
  }

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
      this.soundEvents.push('rotate');
    }
  }

  _resetLock() {
    if (this._lockResets < MAX_LOCK_RESETS) {
      this._lockAccum = 0;
      this._lockResets++;
    }
  }

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

  _addScore(lineCount) {
    const points = (LINE_SCORES[lineCount] ?? 0) * this.level;
    this.score += points;
  }
}
