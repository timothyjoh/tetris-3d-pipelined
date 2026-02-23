import { describe, it, expect } from 'vitest';
import { TETROMINOES, PIECE_TYPES, randomPieceType } from '../engine/tetrominoes.js';

describe('PIECE_TYPES', () => {
  it('contains all 7 standard Tetris piece types', () => {
    expect(PIECE_TYPES).toEqual(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
  });

  it('has exactly 7 pieces', () => {
    expect(PIECE_TYPES.length).toBe(7);
  });
});

describe('TETROMINOES', () => {
  for (const type of ['I', 'O', 'T', 'S', 'Z', 'J', 'L']) {
    describe(`${type} piece`, () => {
      const piece = TETROMINOES[type];

      it('has exactly 4 rotation states', () => {
        expect(piece.shapes.length).toBe(4);
      });

      it('each rotation state is a 4x4 grid of 0s and 1s', () => {
        for (let rot = 0; rot < 4; rot++) {
          const shape = piece.shapes[rot];
          expect(shape.length).toBe(4);
          for (let r = 0; r < 4; r++) {
            expect(shape[r].length).toBe(4);
            for (let c = 0; c < 4; c++) {
              expect([0, 1]).toContain(shape[r][c]);
            }
          }
        }
      });

      it('has a positive integer color', () => {
        expect(piece.color).toBeGreaterThan(0);
        expect(Number.isInteger(piece.color)).toBe(true);
      });

      it('has spawnCol in range 0-9', () => {
        expect(piece.spawnCol).toBeGreaterThanOrEqual(0);
        expect(piece.spawnCol).toBeLessThanOrEqual(9);
      });
    });
  }
});

describe('randomPieceType', () => {
  it('returns a valid piece type string', () => {
    for (let i = 0; i < 50; i++) {
      const type = randomPieceType();
      expect(PIECE_TYPES).toContain(type);
    }
  });

  it('returns a string', () => {
    expect(typeof randomPieceType()).toBe('string');
  });
});
