/**
 * Compute the row where the active piece would land if hard-dropped.
 * @param {Board} board
 * @param {string} pieceType
 * @param {number} rotation
 * @param {number} col
 * @param {number} startRow
 * @returns {number} the lowest valid row (same as startRow if already on surface)
 */
export function computeGhostRow(board, pieceType, rotation, col, startRow) {
  let row = startRow;
  while (board.isValid(pieceType, rotation, col, row + 1)) {
    row++;
  }
  return row;
}
