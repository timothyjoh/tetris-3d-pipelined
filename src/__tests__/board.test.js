import { describe, it, expect, beforeEach } from 'vitest';
import { Board, BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

describe('Board', () => {
  let board;

  beforeEach(() => {
    board = new Board();
  });

  describe('constructor', () => {
    it('creates a 10x20 board by default', () => {
      expect(board.cols).toBe(10);
      expect(board.rows).toBe(20);
    });

    it('initializes all cells to 0', () => {
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          expect(board.getCell(c, r)).toBe(0);
        }
      }
    });
  });

  describe('getCell / setCell', () => {
    it('round-trips a value', () => {
      board.setCell(5, 10, 0xff00ff);
      expect(board.getCell(5, 10)).toBe(0xff00ff);
    });

    it('does not affect other cells', () => {
      board.setCell(3, 7, 42);
      expect(board.getCell(4, 7)).toBe(0);
      expect(board.getCell(3, 8)).toBe(0);
    });
  });

  describe('isInBounds', () => {
    it('(0,0) is in bounds', () => {
      expect(board.isInBounds(0, 0)).toBe(true);
    });

    it('(9,19) is in bounds', () => {
      expect(board.isInBounds(9, 19)).toBe(true);
    });

    it('(-1,0) is out of bounds', () => {
      expect(board.isInBounds(-1, 0)).toBe(false);
    });

    it('(10,0) is out of bounds', () => {
      expect(board.isInBounds(10, 0)).toBe(false);
    });

    it('(0,20) is out of bounds', () => {
      expect(board.isInBounds(0, 20)).toBe(false);
    });

    it('(0,-1) is out of bounds', () => {
      expect(board.isInBounds(0, -1)).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('empty cell is not blocked', () => {
      expect(board.isBlocked(0, 0)).toBe(false);
    });

    it('out-of-bounds is blocked', () => {
      expect(board.isBlocked(-1, 0)).toBe(true);
    });

    it('locked cell is blocked', () => {
      board.setCell(3, 5, 1);
      expect(board.isBlocked(3, 5)).toBe(true);
    });
  });

  describe('getPieceCells', () => {
    it('I piece at rotation 0 returns correct cells', () => {
      // I piece rot 0: row 1 has [1,1,1,1], spawnCol=3
      const cells = board.getPieceCells('I', 0, 3, 0);
      expect(cells).toEqual([[3, 1], [4, 1], [5, 1], [6, 1]]);
    });

    it('O piece at rotation 0 returns correct cells', () => {
      // O piece rot 0: [[0,1,1,0],[0,1,1,0],...]
      const cells = board.getPieceCells('O', 0, 3, 0);
      expect(cells).toEqual([[4, 0], [5, 0], [4, 1], [5, 1]]);
    });
  });

  describe('isValid', () => {
    it('T piece at col=3, row=0 is valid on empty board', () => {
      expect(board.isValid('T', 0, 3, 0)).toBe(true);
    });

    it('I piece at col=8, row=0 is invalid (overlaps wall)', () => {
      // I rot 0 occupies cols 8,9,10,11 at row 1 — cols 10,11 out of bounds
      expect(board.isValid('I', 0, 8, 0)).toBe(false);
    });

    it('is invalid when cells overlap locked piece', () => {
      board.setCell(4, 1, 1);
      expect(board.isValid('I', 0, 3, 0)).toBe(false);
    });
  });

  describe('lockPiece', () => {
    it('locks piece cells with the piece color', () => {
      board.lockPiece('I', 0, 3, 0);
      // I piece color is 0x00ffff
      expect(board.getCell(3, 1)).toBe(0x00ffff);
      expect(board.getCell(4, 1)).toBe(0x00ffff);
      expect(board.getCell(5, 1)).toBe(0x00ffff);
      expect(board.getCell(6, 1)).toBe(0x00ffff);
    });

    it('does not affect cells outside the piece', () => {
      board.lockPiece('I', 0, 3, 0);
      expect(board.getCell(3, 0)).toBe(0);
      expect(board.getCell(7, 1)).toBe(0);
    });
  });

  describe('getCompletedRows', () => {
    it('returns completed row index when row is full', () => {
      for (let c = 0; c < BOARD_COLS; c++) {
        board.setCell(c, 19, 1);
      }
      expect(board.getCompletedRows()).toEqual([19]);
    });

    it('returns empty array for partial row', () => {
      for (let c = 0; c < BOARD_COLS - 1; c++) {
        board.setCell(c, 19, 1);
      }
      expect(board.getCompletedRows()).toEqual([]);
    });

    it('returns multiple completed rows', () => {
      for (let r = 18; r <= 19; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          board.setCell(c, r, 1);
        }
      }
      expect(board.getCompletedRows()).toEqual([18, 19]);
    });
  });

  describe('clearRows', () => {
    it('clears a completed row and shifts cells down', () => {
      // Place something at row 18
      board.setCell(0, 18, 42);
      // Fill row 19
      for (let c = 0; c < BOARD_COLS; c++) {
        board.setCell(c, 19, 1);
      }
      board.clearRows([19]);
      // Row 18 content should have shifted to row 19
      expect(board.getCell(0, 19)).toBe(42);
      // Top row should be empty
      expect(board.getCell(0, 0)).toBe(0);
    });

    it('clears 4 rows (Tetris) and shifts remaining rows down', () => {
      // Put a sentinel cell at row 15 (above the to-be-cleared rows 16-19)
      board.setCell(3, 15, 99);
      // Fill rows 16-19 completely
      for (let r = 16; r <= 19; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          board.setCell(c, r, 1);
        }
      }
      const cleared = board.clearRows([16, 17, 18, 19]);
      expect(cleared).toBe(4);
      // Old row 15 → new row 19 (shifted down 4 rows)
      expect(board.getCell(3, 19)).toBe(99);
      // New rows 0-3 should be empty (former rows 16-19 are gone)
      for (let r = 0; r <= 3; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          expect(board.getCell(c, r)).toBe(0);
        }
      }
    });
  });

  describe('clear', () => {
    it('resets all cells to 0', () => {
      board.setCell(5, 5, 99);
      board.setCell(0, 0, 42);
      board.clear();
      expect(board.getCell(5, 5)).toBe(0);
      expect(board.getCell(0, 0)).toBe(0);
    });
  });
});

describe('constants', () => {
  it('BOARD_COLS is 10', () => {
    expect(BOARD_COLS).toBe(10);
  });

  it('BOARD_ROWS is 20', () => {
    expect(BOARD_ROWS).toBe(20);
  });
});
