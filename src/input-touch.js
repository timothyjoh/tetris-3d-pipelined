/**
 * Sets up touch event delegation on the touch control container.
 *
 * @param {HTMLElement} container - the #touch-controls div
 * @param {GameState} gameState
 * @param {() => boolean} isActive - returns true when game accepts touch input
 */
export function setupTouchInput(container, gameState, isActive) {
  let activeTouchAction = null;
  let repeatDelay = null;
  let repeatInterval = null;

  function clearRepeat() {
    clearTimeout(repeatDelay);
    clearInterval(repeatInterval);
    repeatDelay = null;
    repeatInterval = null;
  }

  function dispatch(action) {
    switch (action) {
      case 'left':     gameState.moveLeft();      break;
      case 'right':    gameState.moveRight();     break;
      case 'rotate':   gameState.rotateCW();      break;
      case 'softDrop': gameState.startSoftDrop(); break;
      case 'hardDrop': gameState.hardDrop();      break;
    }
  }

  container.addEventListener('touchstart', (e) => {
    e.preventDefault(); // prevent page scroll and double-tap zoom
    if (!isActive()) return;
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    clearRepeat();
    activeTouchAction = btn.dataset.action;
    dispatch(activeTouchAction);

    // Auto-repeat for move left/right only (300ms delay, 80ms interval)
    if (activeTouchAction === 'left' || activeTouchAction === 'right') {
      repeatDelay = setTimeout(() => {
        repeatInterval = setInterval(() => dispatch(activeTouchAction), 80);
      }, 300);
    }
  }, { passive: false });

  function onTouchEnd() {
    if (activeTouchAction === 'softDrop') gameState.stopSoftDrop();
    clearRepeat();
    activeTouchAction = null;
  }

  container.addEventListener('touchend', onTouchEnd);
  container.addEventListener('touchcancel', onTouchEnd);
}
