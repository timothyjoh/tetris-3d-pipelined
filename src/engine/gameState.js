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

    this._spawnPiece(firstPiece, secondPiece);
  }

  update(dt) {
    if (this.paused || this.over) return;

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
    this.nextPieceType = randomPieceType();
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
