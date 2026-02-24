import { describe, it, expect, beforeEach } from 'vitest';
import { Board } from '../engine/board.js';
import { computeGhostRow } from '../engine/ghost.js';

describe('computeGhostRow', () => {
  let board;

  beforeEach(() => {
    board = new Board();
  });

  it('I piece drops to bottom on empty board (originRow 18, cells at board row 19)', () => {
    // I piece rotation=0: shape row 1 has the cells, so at originRow=r cells are at board row r+1.
    // The lowest valid originRow is 18 (cells land at board row 19, the bottom).
    const ghost = computeGhostRow(board, 'I', 0, 3, 0);
    expect(ghost).toBe(18);
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
    // Fill rows 15-19. I piece rotation=0 cells are at originRow+1.
    // At originRow=13, cells at board row 14 (not filled) → valid.
    // At originRow=14, cells at board row 15 (filled) → invalid.
    // So ghost stops at originRow=13.
    for (let r = 15; r <= 19; r++) {
      for (let c = 0; c < 10; c++) board.setCell(c, r, 0xFF0000);
    }
    const ghost = computeGhostRow(board, 'I', 0, 3, 0);
    expect(ghost).toBe(13);
  });

  it('I piece rotation=1 (1-wide, 4-tall) drops to row 16 on empty board', () => {
    // I rotation=1 shape: cells at [originCol+2, originRow+0..3]
    // Bottom cell is at originRow+3. Max valid originRow = 20-4 = 16.
    const ghost = computeGhostRow(board, 'I', 1, 3, 0);
    expect(ghost).toBe(16);
  });

  it('ghost row matches startRow when already at bottom of board', () => {
    const ghost = computeGhostRow(board, 'I', 0, 3, 19);
    expect(ghost).toBe(19);
  });
});
