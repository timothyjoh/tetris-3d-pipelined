const KICKS_JLSTZ = {
  '0->1': [[0,0],[-1,0],[-1,-1],[0,+2],[-1,+2]],
  '1->0': [[0,0],[+1,0],[+1,+1],[0,-2],[+1,-2]],
  '1->2': [[0,0],[+1,0],[+1,+1],[0,-2],[+1,-2]],
  '2->1': [[0,0],[-1,0],[-1,-1],[0,+2],[-1,+2]],
  '2->3': [[0,0],[+1,0],[+1,-1],[0,+2],[+1,+2]],
  '3->2': [[0,0],[-1,0],[-1,+1],[0,-2],[-1,-2]],
  '3->0': [[0,0],[-1,0],[-1,+1],[0,-2],[-1,-2]],
  '0->3': [[0,0],[+1,0],[+1,-1],[0,+2],[+1,+2]],
};

const KICKS_I = {
  '0->1': [[0,0],[-2,0],[+1,0],[-2,+1],[+1,-2]],
  '1->0': [[0,0],[+2,0],[-1,0],[+2,-1],[-1,+2]],
  '1->2': [[0,0],[-1,0],[+2,0],[-1,-2],[+2,+1]],
  '2->1': [[0,0],[+1,0],[-2,0],[+1,+2],[-2,-1]],
  '2->3': [[0,0],[+2,0],[-1,0],[+2,-1],[-1,+2]],
  '3->2': [[0,0],[-2,0],[+1,0],[-2,+1],[+1,-2]],
  '3->0': [[0,0],[+1,0],[-2,0],[+1,+2],[-2,-1]],
  '0->3': [[0,0],[-1,0],[+2,0],[-1,-2],[+2,+1]],
};

const KICKS_O = { default: [[0,0]] };

function getKicks(pieceType, fromRot, toRot) {
  const key = `${fromRot}->${toRot}`;
  if (pieceType === 'I') return KICKS_I[key] ?? [[0,0]];
  if (pieceType === 'O') return KICKS_O.default;
  return KICKS_JLSTZ[key] ?? [[0,0]];
}

export function tryRotate(board, pieceType, currentRotation, direction, col, row) {
  const nextRotation = ((currentRotation + direction) + 4) % 4;
  const kicks = getKicks(pieceType, currentRotation, nextRotation);
  for (const [dCol, dRow] of kicks) {
    const newCol = col + dCol;
    const newRow = row + dRow;
    if (board.isValid(pieceType, nextRotation, newCol, newRow)) {
      return { rotation: nextRotation, col: newCol, row: newRow };
    }
  }
  return null;
}
