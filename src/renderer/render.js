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
