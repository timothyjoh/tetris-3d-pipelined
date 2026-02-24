# Phase 3: Leaderboard, Game-Over Screen, and Vercel Deploy

## Objective

Complete the MVP by delivering the local leaderboard (top 10 scores in `localStorage` with arcade-style 3-character initials entry), a full-screen game-over overlay redesign, and a clean Vercel deployment. This phase also pays down the two spec-deviation debts from Phase 2 — correcting the tilt column offset and the sweep animation character — so that the final shipped product matches all six features described in BRIEF.md.

## Scope

### In Scope
- **Technical debt fixes** (start of phase, before new features): tilt uses left-origin column instead of piece-center column (max ~2.33° vs spec's ±7°); sweep animation is a uniform fade instead of a horizontal left-to-right sweep
- **Leaderboard logic** — pure functions: `isTopTen(score, entries)`, `insertScore(initials, score, entries) → entries`, `rankEntries(entries) → sorted top-10`; backed by `localStorage`
- **Initials entry** — 3-character, digit/letter input (arcade style), triggered only when the final score qualifies for the top 10; skip prompt and go straight to leaderboard if score doesn't qualify
- **Game-over screen redesign** — full-screen Tron-styled overlay showing: final score, initials entry UI (when qualifying), ranked leaderboard table (top 10, with the new entry highlighted), and a restart button
- **Vercel deploy config** — `vercel.json` if needed; confirm `dist/` builds and serves `index.html` correctly with no SPA routing errors
- **`input.js` unit tests** — add jsdom environment to Vitest config so keyboard restart logic (Enter/R, game-over guard) can be tested
- **Final QA** — manual verification of all Phase 1+2+3 features in production build; zero console errors; build exits clean

### Out of Scope
- Mobile/touch controls
- Online leaderboard or backend of any kind
- New gameplay mechanics or difficulty modes
- Audio changes (beyond what's already shipped)
- Any new Three.js post-processing passes

## Requirements

- `computeTiltAngle` must receive the piece's **center column** (`gameState.col + pieceHalfWidth`), not the left-origin column; `pieceHalfWidth` is `TETROMINOES[gameState.type].width / 2`
- Line-clear sweep must gate cell rendering by column: a cell at column `c` in a swept row is visible only while `c <= Math.floor(sweepProgress * board.cols)`, producing a true left-to-right wipe
- Leaderboard entries are stored in `localStorage` under a stable key (e.g., `tron-tetris-leaderboard`); the stored value is a JSON array of `{ initials: string, score: number }`, capped at 10 entries, sorted descending by score
- `isTopTen(score, entries)` returns `true` if `entries.length < 10` or `score > entries[9].score`
- `insertScore(initials, score, entries)` returns a new sorted array, max 10 entries (does not mutate the input)
- Initials input: exactly 3 characters, A–Z and 0–9 accepted; cursor advances automatically after each character; Backspace deletes last character; Enter/Return submits when all 3 are filled
- Initials entry prompt appears only when `isTopTen(finalScore, currentEntries)` is true; otherwise the leaderboard table is shown immediately
- The new entry (if any) must be visually highlighted (distinct color/style) in the ranked table
- Game-over overlay must be full-screen and rendered in the Tron neon aesthetic (dark background, neon text/borders); must not be a plain HTML `<div>` drop-in — it should match the visual language of the existing Three.js scene
- Restart from game-over (button click **and** R/Enter key) must clear initials input state and re-evaluate top-10 on the next game over
- `vercel.json` is added if the Vite `dist/` output requires rewrites; otherwise, document in AGENTS.md that no config is needed and why
- `npm run build` must produce `dist/index.html` with no errors or warnings
- All existing unit tests must continue to pass; new behavior must be covered by new tests

## Acceptance Criteria

- [ ] Moving the active piece left/right visibly tilts the board up to ±7° (piece-center column used, not left-origin)
- [ ] Line-clear sweep animates as a left-to-right horizontal wipe (cells disappear column by column, not all at once)
- [ ] On game over with a qualifying score, a 3-character initials prompt appears in the Tron overlay
- [ ] Initials input accepts A–Z / 0–9; auto-advances cursor; Backspace deletes; Enter submits on 3 chars
- [ ] After initials entry (or immediately if score doesn't qualify), a ranked top-10 leaderboard table is shown
- [ ] The new entry is visually highlighted in the leaderboard table
- [ ] Scores persist across page reloads (verified by scoring, reloading, and confirming the entry is still there)
- [ ] Pressing R or Enter on the game-over screen restarts the game and clears the initials input
- [ ] `input.js` keyboard-restart logic (Enter/R, game-over guard) is covered by unit tests using jsdom
- [ ] The project deploys to Vercel and `index.html` serves correctly at the root URL with no console errors
- [ ] `npm run test` passes with all tests green
- [ ] `npm run test:coverage` shows ≥ 80% line coverage on engine modules (maintained)
- [ ] `npm run build` completes with no errors or warnings
- [ ] No console errors or unhandled promise rejections in the production build

## Testing Strategy

- **Framework:** Vitest (existing); add `jsdom` environment for `input.test.js` via a `@vitest-environment jsdom` docblock or `vitest.config.js` `environmentMatchGlobs`
- **Key test scenarios:**
  - Tilt fix: `computeTiltAngle` called with center column for each piece type produces values in `(−7, +7]`; I piece at col 0 produces `computeTiltAngle(0 + 2)` = `clamp((2 − 4.5) / 4.5 * 7, −7, 7)` ≈ `−3.89°`
  - Sweep fix: given `sweepProgress = 0.5` and `board.cols = 10`, a renderer unit test (or pure helper test) confirms column 4 is rendered and column 5 is not
  - `isTopTen`: returns `true` for empty list; returns `true` when list has < 10 entries; returns `true` when score beats 10th place; returns `false` when score ≤ 10th place with a full list
  - `insertScore`: inserts and sorts correctly; caps at 10; does not mutate input array; handles ties (new entry goes after existing entry of equal score)
  - `rankEntries`: returns entries sorted descending by score, max 10
  - `localStorage` integration: `loadLeaderboard()` returns `[]` on first call (no key); `saveLeaderboard(entries)` round-trips through JSON correctly
  - `input.js` (jsdom): dispatching `keydown` with `key: 'Enter'` when `gameState.over === true` calls restart; dispatching when `gameState.over === false` does not; same for `'r'` / `'R'`
- **Coverage target:** ≥ 80% line coverage on engine modules maintained; all new leaderboard pure functions at 100% branch coverage
- **No E2E tests required** (per BRIEF.md)
- **Testability note:** Leaderboard pure functions (`isTopTen`, `insertScore`, `rankEntries`) must have zero DOM or `localStorage` dependency — accept and return plain arrays. `localStorage` I/O must be in thin wrapper functions (`loadLeaderboard`, `saveLeaderboard`) that can be mocked independently.

## Documentation Updates

- **AGENTS.md**: Add a "Phase 3 additions" section documenting: the leaderboard module API (`isTopTen`, `insertScore`, `rankEntries`, `loadLeaderboard`, `saveLeaderboard`), the `localStorage` key, and how to run a local production build (`npm run build && npm run preview`)
- **README.md**: Update feature list to include local leaderboard and arcade initials entry; add a "Deploy" section explaining Vercel deployment (link `vercel.json` or note it's not needed)
- **CLAUDE.md**: No structural changes needed; architecture decisions live in AGENTS.md

## Dependencies

- Phase 1 complete (Tetris engine, Three.js renderer, Tron aesthetic, Vitest)
- Phase 2 complete (board tilt, sound effects, ghost piece, lock flash, sweep animation, keyboard restart) — all work must be committed before Phase 3 begins
- No new npm packages expected; `jsdom` may be needed for Vitest (`@vitest/environment-jsdom` or the built-in jsdom option, whichever matches the existing Vitest version)
- A Vercel account and CLI (`vercel`) for deployment validation (or use the Vercel GitHub integration)

## Adjustments from Previous Phase

Based on Phase 2 reflections:

- **Fix spec deviations at the top of the phase, before new features**: Tilt column and sweep visual character are both spec violations. The Phase 2 REVIEW flagged them but they were not promoted to MUST-FIX. This phase begins with both fixes so the final product ships as specced.
- **Spec deviations go in MUST-FIX**: If a review finding says "deviates from spec," it is a MUST-FIX item — not optional polish. This rule is enforced from the start of Phase 3.
- **Pure-function-first for leaderboard**: Following the pattern that worked for tilt math and ghost computation — implement `isTopTen`, `insertScore`, `rankEntries` as pure functions with 100% branch coverage before wiring to `localStorage` or DOM.
- **jsdom setup for `input.js` tests**: The Phase 2 reflection explicitly called out the absence of keyboard-restart tests as a gap. Add jsdom environment at the start of Phase 3 and write those tests before touching any new input handling.
- **Commit Phase 2 before starting**: All Phase 2 work is currently uncommitted. Create a descriptive "Phase 2 complete" commit (listing new modules, test count, spec items addressed) before Phase 3 begins — future `git log` context depends on it.
- **Manual visual check during build, not just review**: Tilt and sweep visuals must be verified in the browser at the end of Phase 3 build (before the review step), not deferred to the reviewer.
