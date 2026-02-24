import { describe, it, expect } from 'vitest';
import { computeTiltAngle, stepSpring } from '../engine/tilt.js';

describe('computeTiltAngle', () => {
  it('returns -7 at col=0 (left edge)', () => {
    expect(computeTiltAngle(0)).toBeCloseTo(-7, 5);
  });

  it('returns 0 at col=4.5 (center)', () => {
    expect(computeTiltAngle(4.5)).toBeCloseTo(0, 5);
  });

  it('returns +7 at col=9 (right edge)', () => {
    expect(computeTiltAngle(9)).toBeCloseTo(7, 5);
  });

  it('clamps below -7 for col < 0', () => {
    expect(computeTiltAngle(-5)).toBe(-7);
  });

  it('clamps above +7 for col > 9', () => {
    expect(computeTiltAngle(15)).toBe(7);
  });

  it('returns approximately -3.5 at col=2.25', () => {
    expect(computeTiltAngle(2.25)).toBeCloseTo(-3.5, 2);
  });

  it('returns approximately +3.5 at col=6.75', () => {
    expect(computeTiltAngle(6.75)).toBeCloseTo(3.5, 2);
  });
});

describe('computeTiltAngle — center column (Phase 3 fix)', () => {
  it('I piece at col 0 with center offset (halfWidth=2) produces ~-3.89°', () => {
    // I piece width=4, halfWidth=2; center=0+2=2
    expect(computeTiltAngle(0 + 2)).toBeCloseTo(-3.889, 2);
  });

  it('T piece at col 0 with center offset (halfWidth=1.5) produces ~-4.67°', () => {
    // T piece width=3, halfWidth=1.5; center=0+1.5=1.5
    // formula: (1.5-4.5)/4.5*7 = -3/4.5*7 = -4.667
    expect(computeTiltAngle(0 + 1.5)).toBeCloseTo(-4.667, 2);
  });

  it('center column produces values within ±7° for all piece types at all valid cols', () => {
    const halfWidths = { I: 2, O: 1, T: 1.5, S: 1.5, Z: 1.5, J: 1.5, L: 1.5 };
    for (const [, hw] of Object.entries(halfWidths)) {
      for (let col = 0; col <= 6; col++) {
        const angle = computeTiltAngle(col + hw);
        expect(Math.abs(angle)).toBeLessThanOrEqual(7);
      }
    }
  });

  it('I piece at rightmost col (col=6, halfWidth=2) produces ~+5.44°', () => {
    // I piece at col=6, center=8; formula: (8-4.5)/4.5*7 = 3.5/4.5*7 = 5.444
    expect(computeTiltAngle(6 + 2)).toBeCloseTo(5.444, 2);
  });
});

describe('stepSpring', () => {
  it('moves toward target from rest (current=0, velocity=0, target=7)', () => {
    const { angle, velocity } = stepSpring(0, 0, 7);
    // velocity = (0 + (7-0)*0.15) * 0.75 = (1.05)*0.75 = 0.7875
    // angle = 0 + 0.7875 = 0.7875
    expect(velocity).toBeCloseTo(0.7875, 5);
    expect(angle).toBeCloseTo(0.7875, 5);
  });

  it('decays velocity when at target (current=7, velocity=1, target=7)', () => {
    const { angle, velocity } = stepSpring(7, 1, 7);
    // velocity = (1 + 0) * 0.75 = 0.75
    // angle = 7 + 0.75 = 7.75
    expect(velocity).toBeCloseTo(0.75, 5);
    expect(angle).toBeCloseTo(7.75, 5);
  });

  it('returns to rest when current=target and velocity=0', () => {
    const { angle, velocity } = stepSpring(0, 0, 0);
    expect(angle).toBe(0);
    expect(velocity).toBe(0);
  });

  it('oscillates past target (overshoot behavior)', () => {
    // Simulate spring reaching near target=7, then snapping to target=0
    // The spring eigenvalue magnitude is sqrt(0.75) ≈ 0.866 per step,
    // so we need ≥ 46 settle steps for amplitude 7 to decay below 0.01.
    let angle = 0, velocity = 0;
    for (let i = 0; i < 20; i++) {
      ({ angle, velocity } = stepSpring(angle, velocity, 7));
    }
    // Now snap to 0 and run 60 settle steps (enough for convergence)
    for (let i = 0; i < 60; i++) {
      ({ angle, velocity } = stepSpring(angle, velocity, 0));
    }
    // After enough steps, should settle near 0
    expect(Math.abs(angle)).toBeLessThan(0.01);
  });
});
