import { describe, it, expect } from 'vitest';
import { isTopTen, insertScore, rankEntries } from '../engine/leaderboard.js';

describe('isTopTen', () => {
  it('returns true for empty entries', () => {
    expect(isTopTen(0, [])).toBe(true);
  });

  it('returns true when entries.length < 10', () => {
    const entries = [{ initials: 'AAA', score: 100 }];
    expect(isTopTen(50, entries)).toBe(true);
  });

  it('returns true when score strictly beats 10th place', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 100,
    }));
    // 10th place score = 100; score 101 qualifies
    expect(isTopTen(101, entries)).toBe(true);
  });

  it('returns false when score equals 10th place (tie does not qualify)', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 100,
    }));
    // 10th place score = 100; tie of 100 does not qualify
    expect(isTopTen(100, entries)).toBe(false);
  });

  it('returns false when score is below 10th place', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 100,
    }));
    expect(isTopTen(50, entries)).toBe(false);
  });

  it('returns true with exactly 9 entries (< 10)', () => {
    const entries = Array.from({ length: 9 }, (_, i) => ({
      initials: 'ZZZ',
      score: i * 1000,
    }));
    expect(isTopTen(1, entries)).toBe(true);
  });
});

describe('insertScore', () => {
  it('inserts and sorts correctly into empty array', () => {
    const result = insertScore('ABC', 500, []);
    expect(result).toEqual([{ initials: 'ABC', score: 500 }]);
  });

  it('inserts in correct sorted position', () => {
    const entries = [
      { initials: 'AAA', score: 1000 },
      { initials: 'BBB', score: 500 },
    ];
    const result = insertScore('CCC', 750, entries);
    expect(result[0]).toEqual({ initials: 'AAA', score: 1000 });
    expect(result[1]).toEqual({ initials: 'CCC', score: 750 });
    expect(result[2]).toEqual({ initials: 'BBB', score: 500 });
  });

  it('caps at 10 entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 1000,
    }));
    const result = insertScore('NEW', 99999, entries);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ initials: 'NEW', score: 99999 });
  });

  it('does not mutate the input array', () => {
    const entries = [{ initials: 'AAA', score: 500 }];
    const originalLength = entries.length;
    insertScore('BBB', 600, entries);
    expect(entries).toHaveLength(originalLength);
    expect(entries[0]).toEqual({ initials: 'AAA', score: 500 });
  });

  it('tie: new entry placed after existing entry of equal score', () => {
    const entries = [{ initials: 'OLD', score: 500 }];
    const result = insertScore('NEW', 500, entries);
    expect(result[0]).toEqual({ initials: 'OLD', score: 500 });
    expect(result[1]).toEqual({ initials: 'NEW', score: 500 });
  });

  it('inserting a low score into a full board drops it off the end', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      initials: 'AAA',
      score: (10 - i) * 1000,
    }));
    const result = insertScore('LOW', 1, entries);
    expect(result).toHaveLength(10);
    expect(result.find((e) => e.initials === 'LOW')).toBeUndefined();
  });

  it('inserts at top of list when score is highest', () => {
    const entries = [{ initials: 'BBB', score: 500 }];
    const result = insertScore('AAA', 9999, entries);
    expect(result[0]).toEqual({ initials: 'AAA', score: 9999 });
    expect(result[1]).toEqual({ initials: 'BBB', score: 500 });
  });

  it('inserts at bottom of list when score is lowest', () => {
    const entries = [{ initials: 'AAA', score: 9999 }];
    const result = insertScore('BBB', 1, entries);
    expect(result[0]).toEqual({ initials: 'AAA', score: 9999 });
    expect(result[1]).toEqual({ initials: 'BBB', score: 1 });
  });
});

describe('rankEntries', () => {
  it('returns sorted descending by score', () => {
    const entries = [
      { initials: 'CCC', score: 100 },
      { initials: 'AAA', score: 900 },
      { initials: 'BBB', score: 500 },
    ];
    const result = rankEntries(entries);
    expect(result[0].score).toBe(900);
    expect(result[1].score).toBe(500);
    expect(result[2].score).toBe(100);
  });

  it('caps at 10 entries', () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      initials: 'AAA',
      score: i * 100,
    }));
    expect(rankEntries(entries)).toHaveLength(10);
  });

  it('does not mutate the input array', () => {
    const entries = [
      { initials: 'B', score: 100 },
      { initials: 'A', score: 900 },
    ];
    rankEntries(entries);
    expect(entries[0].initials).toBe('B');
  });

  it('returns empty array for empty input', () => {
    expect(rankEntries([])).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const entries = [{ initials: 'AAA', score: 100 }];
    expect(rankEntries(entries)).toEqual([{ initials: 'AAA', score: 100 }]);
  });

  it('top-10 are the highest-scoring entries when > 10 given', () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      initials: 'AAA',
      score: i * 100,
    }));
    const result = rankEntries(entries);
    // Should have scores 1400, 1300, ..., 500
    expect(result[0].score).toBe(1400);
    expect(result[9].score).toBe(500);
  });
});
