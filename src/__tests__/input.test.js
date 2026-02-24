// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupInput } from '../input.js';

function makeGameState(over = false) {
  return {
    over,
    moveLeft: vi.fn(),
    moveRight: vi.fn(),
    rotateCW: vi.fn(),
    rotateCCW: vi.fn(),
    startSoftDrop: vi.fn(),
    stopSoftDrop: vi.fn(),
    hardDrop: vi.fn(),
    togglePause: vi.fn(),
  };
}

function fireKey(code, type = 'keydown') {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

describe('setupInput — keyboard restart', () => {
  let onRestart;
  let gameState;
  let cleanup;

  beforeEach(() => {
    onRestart = vi.fn();
    gameState = makeGameState(false);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('Enter triggers restart when gameState.over is true', () => {
    gameState.over = true;
    cleanup = setupInput(gameState, onRestart);
    fireKey('Enter');
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('KeyR triggers restart when gameState.over is true', () => {
    gameState.over = true;
    cleanup = setupInput(gameState, onRestart);
    fireKey('KeyR');
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('Enter does NOT trigger restart when gameState.over is false', () => {
    gameState.over = false;
    cleanup = setupInput(gameState, onRestart);
    fireKey('Enter');
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('KeyR does NOT trigger restart when gameState.over is false', () => {
    gameState.over = false;
    cleanup = setupInput(gameState, onRestart);
    fireKey('KeyR');
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('suppressRestart option prevents restart when returning true', () => {
    gameState.over = true;
    cleanup = setupInput(gameState, onRestart, { suppressRestart: () => true });
    fireKey('Enter');
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('suppressRestart option allows restart when returning false', () => {
    gameState.over = true;
    cleanup = setupInput(gameState, onRestart, { suppressRestart: () => false });
    fireKey('Enter');
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
