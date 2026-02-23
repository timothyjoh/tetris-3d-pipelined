import { BlockPool } from './blockPool.js';

export class BoardRenderer {
  constructor(scene) {
    this.pool = new BlockPool(scene, 220);
  }

  draw(gameState) {
    this.pool.begin();
    const { board } = gameState;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const color = board.getCell(c, r);
        if (color !== 0) this.pool.addBlock(c, r, color);
      }
    }
    const activeCells = gameState.getActivePieceCells();
    const activeColor = gameState.getActivePieceColor();
    for (const [c, r] of activeCells) {
      if (r >= 0) this.pool.addBlock(c, r, activeColor);
    }
    this.pool.end();
  }
}
