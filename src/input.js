export function setupInput(gameState, onRestart) {
  const held = new Set();

  window.addEventListener('keydown', (e) => {
    if (held.has(e.code)) return;
    held.add(e.code);

    switch (e.code) {
      case 'ArrowLeft':            gameState.moveLeft();       break;
      case 'ArrowRight':           gameState.moveRight();      break;
      case 'ArrowUp': case 'KeyX': gameState.rotateCW();       break;
      case 'KeyZ':                 gameState.rotateCCW();      break;
      case 'ArrowDown':            gameState.startSoftDrop();  break;
      case 'Space':
        e.preventDefault();
        gameState.hardDrop();
        break;
      case 'KeyP':                 gameState.togglePause();    break;
    }
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (e.code === 'ArrowDown') gameState.stopSoftDrop();
  });
}
