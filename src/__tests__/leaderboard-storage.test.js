// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadLeaderboard, saveLeaderboard } from '../engine/leaderboard.js';

describe('loadLeaderboard / saveLeaderboard', () => {
  beforeEach(() => {
    let store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns [] on first call (key absent)', () => {
    expect(loadLeaderboard()).toEqual([]);
  });

  it('round-trips entries through JSON correctly', () => {
    const entries = [
      { initials: 'AAA', score: 1000 },
      { initials: 'BBB', score: 500 },
    ];
    saveLeaderboard(entries);
    expect(loadLeaderboard()).toEqual(entries);
  });

  it('returns [] when stored value is invalid JSON', () => {
    localStorage.setItem('tron-tetris-leaderboard', 'not-json{{{');
    expect(loadLeaderboard()).toEqual([]);
  });
});
