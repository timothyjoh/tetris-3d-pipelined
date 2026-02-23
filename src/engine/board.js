import { TETROMINOES } from './tetrominoes.js';

export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

export class Board {
  constructor(cols = BOARD_COLS, rows = BOARD_ROWS) {
    this.cols = cols;
    this.rows = rows;
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

  isBlocked(col, row) {
    if (!this.isInBounds(col, row)) return true;
    return this.cells[row * this.cols + col] !== 0;
  }

  getPieceCells(pieceType, rotation, originCol, originRow) {
    const shape = TETROMINOES[pieceType].shapes[rotation];
    const cells = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (shape[r][c]) cells.push([originCol + c, originRow + r]);
      }
    }
    return cells;
  }

  isValid(pieceType, rotation, originCol, originRow) {
    return this.getPieceCells(pieceType, rotation, originCol, originRow)
      .every(([c, r]) => this.isInBounds(c, r) && !this.isBlocked(c, r));
  }

  lockPiece(pieceType, rotation, originCol, originRow) {
    const color = TETROMINOES[pieceType].color;
    this.getPieceCells(pieceType, rotation, originCol, originRow)
      .forEach(([c, r]) => this.setCell(c, r, color));
  }

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

  clearRows(rowIndices) {
    const rowSet = new Set(rowIndices);
    const kept = [];
    for (let r = 0; r < this.rows; r++) {
      if (!rowSet.has(r)) {
        for (let c = 0; c < this.cols; c++) {
          kept.push(this.cells[r * this.cols + c]);
        }
      }
    }
    const emptyRows = new Array(rowIndices.length * this.cols).fill(0);
    this.cells = [...emptyRows, ...kept];
    return rowIndices.length;
  }

  clear() {
    this.cells.fill(0);
  }
}
