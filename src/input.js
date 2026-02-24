export function setupInput(gameState, onRestart, options = {}) {
  const { suppressRestart = () => false } = options;
  const held = new Set();

  const onKeydown = (e) => {
    if (held.has(e.code)) return;
    held.add(e.code);

    // Keyboard restart: only when game is over and not suppressed (e.g. initials entry)
    if ((e.code === 'Enter' || e.code === 'KeyR') && gameState.over && !suppressRestart()) {
      onRestart?.();
      return;
    }

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
  };

  const onKeyup = (e) => {
    held.delete(e.code);
    if (e.code === 'ArrowDown') gameState.stopSoftDrop();
  };

  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);

  return () => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('keyup', onKeyup);
  };
}
