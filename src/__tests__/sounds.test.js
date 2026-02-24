import { describe, it, expect, vi } from 'vitest';
import { playTone, playGameSound } from '../audio/sounds.js';

function makeMockCtx() {
  const disconnectOsc = vi.fn();
  const disconnectGain = vi.fn();
  const mockOsc = {
    connect: vi.fn(),
    disconnect: disconnectOsc,
    type: '',
    frequency: { setValueAtTime: vi.fn() },
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
  const mockGain = {
    connect: vi.fn(),
    disconnect: disconnectGain,
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  };
  const ctx = {
    currentTime: 0,
    createOscillator: vi.fn(() => mockOsc),
    createGain: vi.fn(() => mockGain),
    destination: {},
  };
  return { ctx, mockOsc, mockGain, disconnectOsc, disconnectGain };
}

describe('playTone', () => {
  it('creates oscillator and gain node', () => {
    const { ctx } = makeMockCtx();
    playTone(440, 0.1, 'square', null, ctx);
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    expect(ctx.createGain).toHaveBeenCalledOnce();
  });

  it('sets oscillator type and frequency', () => {
    const { ctx, mockOsc } = makeMockCtx();
    playTone(440, 0.1, 'sine', null, ctx);
    expect(mockOsc.type).toBe('sine');
    expect(mockOsc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
  });

  it('calls osc.stop() with a positive time', () => {
    const { ctx, mockOsc } = makeMockCtx();
    playTone(440, 0.1, 'square', null, ctx);
    expect(mockOsc.stop).toHaveBeenCalledOnce();
    const stopArg = mockOsc.stop.mock.calls[0][0];
    expect(stopArg).toBeGreaterThan(0);
  });

  it('sets onended and disconnects both nodes when triggered', () => {
    const { ctx, mockOsc, disconnectOsc, disconnectGain } = makeMockCtx();
    playTone(440, 0.1, 'square', null, ctx);
    expect(typeof mockOsc.onended).toBe('function');
    mockOsc.onended();
    expect(disconnectOsc).toHaveBeenCalledOnce();
    expect(disconnectGain).toHaveBeenCalledOnce();
  });

  it('uses custom gainEnvelope when provided', () => {
    const { ctx, mockGain } = makeMockCtx();
    const envelope = vi.fn();
    playTone(440, 0.1, 'square', envelope, ctx);
    expect(envelope).toHaveBeenCalledWith(mockGain, ctx);
    // Default ramp should NOT have been called when envelope is provided
    expect(mockGain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  });
});

describe('playGameSound', () => {
  it('plays a sound for each valid event name', () => {
    const events = ['move', 'rotate', 'softDrop', 'hardDrop', 'lineClear', 'tetris', 'levelUp', 'gameOver'];
    for (const event of events) {
      const { ctx } = makeMockCtx();
      expect(() => playGameSound(event, ctx)).not.toThrow();
      expect(ctx.createOscillator).toHaveBeenCalled();
    }
  });

  it('gameOver event uses 110 Hz sawtooth', () => {
    const { ctx, mockOsc } = makeMockCtx();
    playGameSound('gameOver', ctx);
    expect(mockOsc.type).toBe('sawtooth');
    expect(mockOsc.frequency.setValueAtTime).toHaveBeenCalledWith(110, 0);
  });

  it('move event uses 200 Hz square', () => {
    const { ctx, mockOsc } = makeMockCtx();
    playGameSound('move', ctx);
    expect(mockOsc.type).toBe('square');
    expect(mockOsc.frequency.setValueAtTime).toHaveBeenCalledWith(200, 0);
  });

  it('does nothing for unknown event names', () => {
    const { ctx } = makeMockCtx();
    expect(() => playGameSound('unknownEvent', ctx)).not.toThrow();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
});
