// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupInput } from '../input.js';

function fireKey(code, options = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...options }));
}

function fireKeyup(code) {
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}

describe('initials submit — Enter key interaction', () => {
  let onRestart;
  let gameState;
  let initialsActive;
  let submitInitials;
  let handleInitialsKey;
  let cleanup;

  beforeEach(() => {
    onRestart = vi.fn();
    initialsActive = true;
    gameState = { over: true };

    // Mirrors submitInitials() in main.js
    submitInitials = vi.fn(() => { initialsActive = false; });

    // Mirrors handleInitialsKey in main.js (Enter branch only, with 3 chars filled)
    handleInitialsKey = (e) => {
      if (!initialsActive) return;
      if (e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        submitInitials();
      }
    };

    // Fixed order: setupInput FIRST, then handleInitialsKey
    cleanup = setupInput(gameState, onRestart, { suppressRestart: () => initialsActive });
    window.addEventListener('keydown', handleInitialsKey);
  });

  afterEach(() => {
    cleanup?.();
    window.removeEventListener('keydown', handleInitialsKey);
  });

  it('pressing Enter with initialsActive=true calls submitInitials, not onRestart', () => {
    fireKey('Enter');
    expect(submitInitials).toHaveBeenCalledOnce();
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('key-repeat Enter after submit does NOT trigger restart', () => {
    fireKey('Enter');   // first press: setupInput blocked (suppressRestart=true), then handleInitialsKey submits
    fireKey('Enter');   // repeat: held.has('Enter')=true → setupInput returns early; initialsActive=false so handleInitialsKey returns early too
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('fresh Enter press after submitting (key released then re-pressed) triggers restart', () => {
    fireKey('Enter');    // submit
    fireKeyup('Enter');  // release — clears 'Enter' from held set
    fireKey('Enter');    // fresh press: initialsActive=false, held clear → onRestart fires
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
