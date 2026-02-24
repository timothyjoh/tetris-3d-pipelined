const LEADERBOARD_KEY = 'tron-tetris-leaderboard';

/**
 * Returns true if score qualifies for the top-10 leaderboard.
 * A score qualifies if the board has fewer than 10 entries OR it strictly
 * beats the 10th-place score (ties with 10th place do NOT qualify).
 */
export function isTopTen(score, entries) {
  if (entries.length < 10) return true;
  return score > entries[9].score;
}

/**
 * Inserts a new {initials, score} entry into the leaderboard.
 * Returns a new array sorted descending by score, capped at 10 entries.
 * Does not mutate the input array. Ties: the new entry is placed after
 * existing entries of equal score (stable insertion order is preserved).
 */
export function insertScore(initials, score, entries) {
  const updated = [...entries, { initials, score }];
  updated.sort((a, b) => b.score - a.score);
  return updated.slice(0, 10);
}

/**
 * Returns a new array of entries sorted descending by score, max 10.
 * Does not mutate the input array.
 */
export function rankEntries(entries) {
  return [...entries].sort((a, b) => b.score - a.score).slice(0, 10);
}

/** Loads leaderboard from localStorage. Returns [] on first call or parse error. */
export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Saves leaderboard array to localStorage as JSON. */
export function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}
