import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, gravityInterval, GRAVITY_TABLE } from '../engine/gameState.js';
import { BOARD_COLS } from '../engine/board.js';

describe('gravityInterval', () => {
  it('level 1 returns 1000', () => {
    expect(gravityInterval(1)).toBe(1000);
  });

  it('level 5 returns 356', () => {
    expect(gravityInterval(5)).toBe(356);
  });

  it('level 10 returns 83', () => {
    expect(gravityInterval(10)).toBe(83);
  });

  it('level 15 returns 83', () => {
    expect(gravityInterval(15)).toBe(83);
  });

  it('level 20 returns 17', () => {
    expect(gravityInterval(20)).toBe(17);
  });

  it('level beyond table length clamps to last entry', () => {
    expect(gravityInterval(100)).toBe(GRAVITY_TABLE[GRAVITY_TABLE.length - 1]);
  });
});

describe('GameState', () => {
  describe('constructor', () => {
    it('starts with score 0, level 1, linesCleared 0', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      expect(gs.score).toBe(0);
      expect(gs.level).toBe(1);
      expect(gs.linesCleared).toBe(0);
      expect(gs.over).toBe(false);
    });

    it('spawns the firstPiece', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'T' });
      expect(gs.pieceType).toBe('I');
    });

    it('sets nextPieceType to secondPiece when provided', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'T' });
      expect(gs.nextPieceType).toBe('T');
    });
  });

  describe('scoring with line clear', () => {
    it('awards 100 points for 1-line clear at level 1', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      // Fill row 19 except cols 3-6 (where horizontal I piece will land)
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c < 3 || c > 6) {
          gs.board.setCell(c, 19, 1);
        }
      }
      // I piece at rot 0 occupies row 1 cols 3-6. Hard drop should fill row 19.
      gs.hardDrop();
      expect(gs.score).toBe(100);
    });

    it('awards 300 points for 2-line clear at level 1', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      // Pre-fill rows 18-19 completely; I piece hard drops to row 16 (cells at
      // row 17), getCompletedRows returns [18,19], triggering a 2-line clear.
      for (let r = 18; r <= 19; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          gs.board.setCell(c, r, 1);
        }
      }
      gs.hardDrop();
      expect(gs.score).toBe(300);
    });

    it('awards 800 points for 4-line (Tetris) clear at level 1', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      // Pre-fill rows 16-19 completely; I piece hard drops to row 14 (cells at
      // row 15), getCompletedRows returns [16,17,18,19] for a Tetris clear.
      for (let r = 16; r <= 19; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          gs.board.setCell(c, r, 1);
        }
      }
      gs.hardDrop();
      expect(gs.score).toBe(800);
    });

    it('applies level multiplier: 1-line clear at level 2 awards 200 points', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.level = 2;
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c < 3 || c > 6) gs.board.setCell(c, 19, 1);
      }
      gs.hardDrop();
      expect(gs.score).toBe(200);
    });
  });

  describe('level progression', () => {
    it('starts at level 1', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      expect(gs.level).toBe(1);
    });

    it('level increases to 2 after 10 lines cleared', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      // Simulate 10 lines cleared by setting the counter directly
      // then triggering level recalculation via _lockPiece path
      gs.linesCleared = 9;
      // Now clear 1 more line to trigger level 2
      // Fill row 19 except where current piece will land
      // Reset with a fresh I piece for a clean drop
      gs.board.clear();
      gs.pieceType = 'I';
      gs.rotation = 0;
      gs.col = 3;
      gs.row = 0;
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c < 3 || c > 6) {
          gs.board.setCell(c, 19, 1);
        }
      }
      gs.hardDrop();
      expect(gs.level).toBe(2);
    });
  });

  describe('game over', () => {
    it('sets over=true when spawn position is blocked', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      // Fill top rows to block any piece spawn
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          gs.board.setCell(c, r, 1);
        }
      }
      // Force a new spawn by calling _spawnPiece
      gs._spawnPiece('T');
      expect(gs.over).toBe(true);
    });
  });

  describe('restart', () => {
    it('resets all state to initial values', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      // Simulate some play
      gs.score = 500;
      gs.level = 3;
      gs.linesCleared = 20;
      gs.over = true;
      gs.board.setCell(5, 5, 1);

      gs.restart();

      expect(gs.score).toBe(0);
      expect(gs.level).toBe(1);
      expect(gs.linesCleared).toBe(0);
      expect(gs.over).toBe(false);
      expect(gs.paused).toBe(false);
      expect(gs.board.getCell(5, 5)).toBe(0);
    });

    it('spawns a new piece after restart', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.over = true;
      gs.restart();
      expect(gs.pieceType).not.toBeNull();
    });
  });

  describe('hardDrop', () => {
    it('locks piece at the bottom of the board', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.hardDrop();
      // I piece rot 0: row 1 has cols 3-6. After hard drop, should be locked
      // at row 19 (bottom). Check that those cells have the I piece color.
      const I_COLOR = 0x00ffff;
      expect(gs.board.getCell(3, 19)).toBe(I_COLOR);
      expect(gs.board.getCell(4, 19)).toBe(I_COLOR);
      expect(gs.board.getCell(5, 19)).toBe(I_COLOR);
      expect(gs.board.getCell(6, 19)).toBe(I_COLOR);
    });

    it('spawns next piece after hard drop', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'T' });
      const nextBefore = gs.nextPieceType;
      gs.hardDrop();
      // After hard drop, the piece should be what nextPieceType was
      expect(gs.pieceType).toBe(nextBefore);
    });

    it('does nothing when game is over', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.over = true;
      const scoreBefore = gs.score;
      gs.hardDrop();
      expect(gs.score).toBe(scoreBefore);
    });

    it('does nothing when game is paused', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.paused = true;
      gs.hardDrop();
      // Piece should not have moved - still at spawn position
      expect(gs.pieceType).toBe('I');
      expect(gs.row).toBe(0);
    });
  });

  describe('update(dt)', () => {
    it('does not advance when paused', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.paused = true;
      const rowBefore = gs.row;
      gs.update(5000); // large dt, should not fire
      expect(gs.row).toBe(rowBefore);
    });

    it('does not advance when game is over', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.over = true;
      const rowBefore = gs.row;
      gs.update(5000);
      expect(gs.row).toBe(rowBefore);
    });

    it('piece moves down after accumulating enough gravity time', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      const startRow = gs.row;
      // gravityInterval(1) = 1000ms; call update with 1001ms
      gs.update(1001);
      expect(gs.row).toBe(startRow + 1);
    });

    it('piece locks after LOCK_DELAY_MS (500ms) when resting on surface', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      // Position piece one row above the floor then tick gravity to land it
      gs.row = 18;
      gs.update(1001); // gravity fires, piece tries to move to 19
      // After landing, 500ms of update calls should trigger lock
      let iterations = 0;
      const pieceBefore = gs.pieceType;
      while (gs.pieceType === pieceBefore && iterations < 1000) {
        gs.update(16); // ~60fps
        iterations++;
      }
      // Piece should have locked and new piece spawned
      expect(gs.pieceType).not.toBe(pieceBefore);
    });

    it('soft drop uses shorter interval (50ms or less)', () => {
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.startSoftDrop();
      const startRow = gs.row;
      // At soft drop interval (50ms), update(51) should fire gravity
      gs.update(51);
      expect(gs.row).toBeGreaterThan(startRow);
    });

    it('soft drop interval is min(50, normalInterval)', () => {
      // At level 20, normal interval = 17ms. Soft drop should use 17ms (not 50ms).
      const gs = new GameState({ firstPiece: 'I', secondPiece: 'O' });
      gs.level = 20;
      gs.startSoftDrop();
      const startRow = gs.row;
      gs.update(18); // > 17ms, should fire once
      expect(gs.row).toBeGreaterThan(startRow);
    });
  });

  describe('movement', () => {
    it('moveLeft shifts piece left', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      const startCol = gs.col;
      gs.moveLeft();
      expect(gs.col).toBe(startCol - 1);
    });

    it('moveRight shifts piece right', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      const startCol = gs.col;
      gs.moveRight();
      expect(gs.col).toBe(startCol + 1);
    });
  });

  describe('rotation', () => {
    it('rotateCW changes the rotation state', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      expect(gs.rotation).toBe(0);
      gs.rotateCW();
      expect(gs.rotation).toBe(1);
    });

    it('rotateCCW wraps rotation from 0 to 3', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      expect(gs.rotation).toBe(0);
      gs.rotateCCW();
      expect(gs.rotation).toBe(3);
    });

    it('rotation resets lock accumulator', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      gs._lockAccum = 400;
      gs.rotateCW();
      expect(gs._lockAccum).toBe(0);
    });

    it('rotation does nothing when paused', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      gs.paused = true;
      gs.rotateCW();
      expect(gs.rotation).toBe(0);
    });
  });

  describe('togglePause', () => {
    it('toggles paused state', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      expect(gs.paused).toBe(false);
      gs.togglePause();
      expect(gs.paused).toBe(true);
      gs.togglePause();
      expect(gs.paused).toBe(false);
    });

    it('does not toggle when game is over', () => {
      const gs = new GameState({ firstPiece: 'T', secondPiece: 'I' });
      gs.over = true;
      gs.togglePause();
      expect(gs.paused).toBe(false);
    });
  });
});
