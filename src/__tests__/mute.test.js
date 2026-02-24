import { describe, it, expect } from 'vitest';
import { GameState } from '../engine/gameState.js';

describe('GameState mute', () => {
  it('starts unmuted', () => {
    const gs = new GameState();
    expect(gs.muted).toBe(false);
  });

  it('can be toggled to muted', () => {
    const gs = new GameState();
    gs.muted = !gs.muted;
    expect(gs.muted).toBe(true);
  });

  it('can be toggled back to unmuted', () => {
    const gs = new GameState();
    gs.muted = !gs.muted;
    gs.muted = !gs.muted;
    expect(gs.muted).toBe(false);
  });

  it('soundEvents queue still exists when muted', () => {
    // Verify the engine never gates soundEvents itself — that's main.js's job
    const gs = new GameState();
    gs.muted = true;
    gs.moveLeft(); // triggers a 'move' sound event if valid
    // soundEvents must exist and be an array regardless of mute state
    expect(Array.isArray(gs.soundEvents)).toBe(true);
  });

  it('muted flag persists across restarts (session persistence per R4)', () => {
    const gs = new GameState();
    gs.muted = true;
    gs.restart();
    expect(gs.muted).toBe(true);
  });
});
