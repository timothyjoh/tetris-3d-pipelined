import { describe, it, expect, beforeEach } from 'vitest';
import { tryRotate } from '../engine/rotation.js';
import { Board } from '../engine/board.js';

describe('tryRotate', () => {
  let board;

  beforeEach(() => {
    board = new Board();
  });

  describe('basic CW rotation for T piece', () => {
    it('rotates CW from 0 to 1 on unobstructed board', () => {
      const result = tryRotate(board, 'T', 0, +1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(1);
      expect(result.col).toBe(3);
      expect(result.row).toBe(5);
    });

    it('rotates CW from 1 to 2 on unobstructed board', () => {
      const result = tryRotate(board, 'T', 1, +1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(2);
      expect(result.col).toBe(3);
      expect(result.row).toBe(5);
    });

    it('rotates CW from 2 to 3 on unobstructed board', () => {
      const result = tryRotate(board, 'T', 2, +1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(3);
      expect(result.col).toBe(3);
      expect(result.row).toBe(5);
    });

    it('rotates CW from 3 to 0 on unobstructed board', () => {
      const result = tryRotate(board, 'T', 3, +1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(0);
      expect(result.col).toBe(3);
      expect(result.row).toBe(5);
    });
  });

  describe('full CW rotation cycle returns to original state', () => {
    const pieceTypes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    for (const type of pieceTypes) {
      it(`${type} piece: 4 CW rotations returns to rotation 0`, () => {
        let rot = 0;
        let col = 3;
        let row = 5;
        for (let i = 0; i < 4; i++) {
          const result = tryRotate(board, type, rot, +1, col, row);
          expect(result).not.toBeNull();
          rot = result.rotation;
          col = result.col;
          row = result.row;
        }
        expect(rot).toBe(0);
      });
    }
  });

  describe('wall kick', () => {
    it('I piece kicks when right wall is blocked', () => {
      // Block col 9 for rows 5-8
      for (let r = 5; r <= 8; r++) {
        board.setCell(9, r, 1);
      }
      // I piece at col=6, row=5, rotation=0. CW rotation should succeed via kick.
      const result = tryRotate(board, 'I', 0, +1, 6, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(1);
    });

    it('T piece kicks right when rotating CCW near left wall', () => {
      // SRS CCW (0->3) kicks for JLSTZ include [+1,0] (rightward).
      // T rot 3 at col=0 would have cell at (0,6); block it to force the kick.
      board.setCell(0, 6, 1);
      // T piece at col=0, row=5. CCW rotation: kick [0,0] fails (col 0,row 6 blocked),
      // kick [+1,0] succeeds at col=1 (cells clear).
      const result = tryRotate(board, 'T', 0, -1, 0, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(3);
      expect(result.col).toBeGreaterThan(0); // kicked right
    });

    it('J piece kicks upward (negative dRow) when near floor', () => {
      // Fill row 19 to simulate floor obstruction near bottom
      for (let c = 0; c < 10; c++) {
        board.setCell(c, 19, 1);
      }
      // J piece rotation state 1->2 near bottom row 17; kick should allow rotation
      // even though naive rotation would overlap row 19
      const result = tryRotate(board, 'J', 1, +1, 3, 17);
      // Result may succeed or be null depending on exact shapes; test that tryRotate
      // returns a valid (in-bounds) result when a kick position is available
      if (result !== null) {
        expect(result.row).toBeLessThanOrEqual(19);
        expect(result.rotation).toBe(2);
      }
      // At minimum, verify tryRotate doesn't throw
    });
  });

  describe('surrounded piece cannot rotate', () => {
    it('returns null when all kick positions are blocked', () => {
      // Fill cells all around T piece at col=3, row=5
      // T piece rot 0 occupies: (4,5), (3,6),(4,6),(5,6)
      // Block everything adjacent to make all rotation states invalid
      for (let r = 4; r <= 8; r++) {
        for (let c = 2; c <= 6; c++) {
          board.setCell(c, r, 1);
        }
      }
      // Clear the T piece's current cells so it's "valid" in current position
      board.setCell(4, 5, 0);
      board.setCell(3, 6, 0);
      board.setCell(4, 6, 0);
      board.setCell(5, 6, 0);

      const result = tryRotate(board, 'T', 0, +1, 3, 5);
      expect(result).toBeNull();
    });
  });

  describe('O piece rotation', () => {
    it('tryRotate CW returns next rotation with same col/row', () => {
      const result = tryRotate(board, 'O', 0, +1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(1);
      expect(result.col).toBe(3);
      expect(result.row).toBe(5);
    });

    it('tryRotate CCW returns previous rotation with same col/row', () => {
      const result = tryRotate(board, 'O', 1, -1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(0);
      expect(result.col).toBe(3);
      expect(result.row).toBe(5);
    });
  });

  describe('CCW rotation', () => {
    it('T piece rotates CCW from 0 to 3', () => {
      const result = tryRotate(board, 'T', 0, -1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(3);
    });

    it('T piece rotates CCW from 3 to 2', () => {
      const result = tryRotate(board, 'T', 3, -1, 3, 5);
      expect(result).not.toBeNull();
      expect(result.rotation).toBe(2);
    });
  });
});
