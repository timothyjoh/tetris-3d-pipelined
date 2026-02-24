import { describe, it, expect } from 'vitest';

// Test the column-gate formula directly (mirrors render.js logic)
function isSweepCellVisible(col, sweepProgress, boardCols) {
  return col < Math.floor(sweepProgress * boardCols);
}

describe('sweep column gate', () => {
  it('at sweepProgress=0.5 column 4 is visible', () => {
    expect(isSweepCellVisible(4, 0.5, 10)).toBe(true);
  });

  it('at sweepProgress=0.5 column 5 is not visible', () => {
    expect(isSweepCellVisible(5, 0.5, 10)).toBe(false);
  });

  it('at sweepProgress=0 no columns are visible', () => {
    expect(isSweepCellVisible(0, 0, 10)).toBe(false);
  });

  it('at sweepProgress=1.0 all columns 0–9 are visible', () => {
    for (let c = 0; c < 10; c++) {
      expect(isSweepCellVisible(c, 1.0, 10)).toBe(true);
    }
  });

  it('at sweepProgress=0.1 only column 0 is visible', () => {
    expect(isSweepCellVisible(0, 0.1, 10)).toBe(true);
    expect(isSweepCellVisible(1, 0.1, 10)).toBe(false);
  });

  it('at sweepProgress=0.3 columns 0–2 are visible, column 3 is not', () => {
    expect(isSweepCellVisible(0, 0.3, 10)).toBe(true);
    expect(isSweepCellVisible(1, 0.3, 10)).toBe(true);
    expect(isSweepCellVisible(2, 0.3, 10)).toBe(true);
    expect(isSweepCellVisible(3, 0.3, 10)).toBe(false);
  });

  it('boundary: column exactly at sweepFront is not visible', () => {
    // sweepProgress=0.5, boardCols=10 → sweepFront=5; col 5 is NOT visible
    expect(isSweepCellVisible(5, 0.5, 10)).toBe(false);
    // sweepFront-1 (col 4) IS visible
    expect(isSweepCellVisible(4, 0.5, 10)).toBe(true);
  });
});
