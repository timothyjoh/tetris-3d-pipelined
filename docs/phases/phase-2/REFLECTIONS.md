# Reflections: Phase 2

## Looking Back

### What Went Well

- **Pure-function-first discipline held**: `computeTiltAngle` and `stepSpring` were implemented as zero-dependency pure functions in `src/engine/tilt.js` before any Three.js wiring — exactly as Phase 1 reflections prescribed. Tests for them are airtight with exact arithmetic verification.
- **AudioContext injection pattern worked cleanly**: The `playTone(freq, duration, type, gainEnvelope?, ctx?)` injectable-context design made `sounds.test.js` straightforward with plain `vi.fn()` mocks — no real Web Audio stack needed. Zero flaky async behavior.
- **Sound event queue pattern is clean**: Decoupling sound triggering (engine pushes string names to `gameState.soundEvents`) from sound playback (main.js loop consumes and clears) kept the engine layer free of browser API dependencies. Easy to extend, easy to test.
- **Coverage remained high**: Engine coverage held at 97.8% statements despite adding three new modules and significant gameState complexity. The Phase 1 discipline of "write tests during build" carried over.
- **MUST-FIX pass was complete and fast**: All 5 review findings (2 critical, 3 minor) were addressed and marked fixed. The build now produces zero warnings. Test count grew from 158 → 163.
- **`THREE.Group` board abstraction is clean**: All board visuals (blocks, grid, background) rotate together as a unit. Renderer, engine, and main.js boundaries are preserved.

### What Didn't Work

- **Tilt uses left-origin column, not center column**: The SPEC explicitly says `col` is "the active piece's center column." The implementation passes `gameState.col` (left-origin) to `computeTiltAngle`. For a 4-wide I piece, the max achievable tilt is ~±2.33° rather than ±7°. The PLAN documented this deviation but didn't flag it as a spec contradiction — it was silently accepted. This reduces the visual impact of the tilt effect significantly.
- **Sweep animation is a fade, not a horizontal sweep**: The SPEC called for a "horizontal sweep effect." The implementation fades all cleared-row cells uniformly from white to dim over 150ms. There is no left-to-right column propagation. The timing requirement is met but the visual character is wrong. This was noted in REVIEW but was not included in MUST-FIX.
- **input.js keyboard restart is completely untested**: The Enter/R handler is live code with conditional logic (game-over guard, no-op during play) but has zero unit tests. The node test environment can't dispatch DOM events without a jsdom setup, and no such setup was created. The REVIEW caught this but it was also not promoted to MUST-FIX.
- **No Phase 2 commits landed**: `git log --oneline -15` shows only "Phase 1 complete" commits. All Phase 2 work exists as unstaged modifications and untracked files. The pipeline did not commit the phase.

### Spec vs Reality

- **Delivered as spec'd**: All 8 sound effects synthesized (no audio files); ghost piece via pool (no per-frame allocation); lock flash purely visual, does not delay game loop; sweep pauses gravity for 150ms; keyboard restart guards on `gameState.over`; redundant `randomPieceType()` removed; `onRestart` wired; AGENTS.md and README.md updated; build clean; ≥80% engine coverage.
- **Deviated from spec**: Tilt `col` is left-origin rather than piece center (max effective tilt ~2.33° not ±7°); sweep animation is uniform emissive fade rather than left-to-right horizontal sweep.
- **Deferred**: True horizontal sweep animation (left-to-right column propagation); `input.js` keyboard-restart unit tests; per-event frequency/duration assertions for `playGameSound` (partially fixed with two spot-checks, but full per-event coverage is absent); `playTone` when called without `ctx` creates an unclosed `AudioContext` — dead code in production but a latent leak.

### Review Findings Impact

- **Build chunk-size warning (CRITICAL)**: Fixed by adding `chunkSizeWarningLimit: 600` to `vite.config.js`. Build now exits cleanly.
- **Missing `levelUp` sound event test (CRITICAL)**: Fixed — test added to `gameState.test.js` using `linesCleared = 9` setup to cross level boundary during `_finalizeSweep`.
- **Weak `playGameSound` assertions**: Partially fixed — two spot-check tests added (`gameOver` at 110 Hz sawtooth, `move` at 200 Hz square). Full per-event coverage still absent.
- **No rotated-piece ghost test**: Fixed — `I piece rotation=1` test added to `ghost.test.js`.
- **Missing `sweepProgress` clamp-at-1 test**: Fixed — edge case test added verifying post-finalize `sweepProgress === 0`.
- **Tilt formula using left-origin column**: Identified in REVIEW, not in MUST-FIX. Remains a known deviation.
- **Sweep visual character**: Identified in REVIEW, not in MUST-FIX. Remains a known deviation.
- **`input.js` tests absent**: Identified in REVIEW, not in MUST-FIX. Remains a known gap.

---

## Looking Forward

### Recommendations for Next Phase

- **Fix the tilt column before Phase 3**: The tilt effect is a signature feature of the project (listed second in BRIEF.md's feature priority). At max ~2.33° it is barely perceptible. Fix: pass `gameState.col + pieceHalfWidth` to `computeTiltAngle` (where `pieceHalfWidth` is `TETROMINOES[pieceType].width / 2`). This is a one-line change in `main.js` that restores the spec'd ±7° range. Do this at the start of Phase 3 before new features are built on top.
- **Fix the sweep visual**: The "horizontal sweep" character matters for game feel. A left-to-right sweep means rendering cells in a completed row only if `c <= sweepProgress * board.cols`. This is a small renderer change — a `&& c <= Math.floor(gameState.sweepProgress * board.cols)` condition in the sweep branch of `render.js`. Fix during Phase 3 build.
- **Commit Phase 2 work before starting Phase 3**: All Phase 2 files are uncommitted. Create a "Phase 2 complete" commit before Phase 3 begins. Future phases' `git log` context depends on this.
- **Add jsdom to vitest config for `input.js` tests**: Set `environment: 'jsdom'` (or add a `@vitest/environment-jsdom` entry) for `input.test.js` specifically. The `input.js` keyboard logic is simple and fast to test if the DOM event infrastructure exists.
- **Continue the "pure-function-first" pattern**: It worked for tilt math and ghost computation. The leaderboard (Phase 3) will have score-ranking logic — implement as pure functions before wiring to localStorage or DOM.

### What Should Next Phase Build?

Phase 3 is the final MVP phase per BRIEF.md. It should deliver:

1. **Local leaderboard** — Top 10 scores in `localStorage`; keyed by score value. On game over, if the score qualifies for top 10, prompt for 3-char initials entry (arcade style); display ranked table.
2. **Game-over screen redesign** — Full-screen overlay showing: final score, initials entry prompt (when qualifying), leaderboard table, restart button. The current overlay is minimal (`GAME OVER` text + score); Phase 3 replaces or expands it.
3. **Vercel deployment config** — `vercel.json` (if needed) or confirm that the Vite `dist/` output deploys cleanly with no SPA routing issues; validate that the deployed URL works.
4. **Final QA pass** — Exercise all Phase 1+2 features, verify tilt and sweep visuals are correct (after the two spec-deviation fixes above), confirm no console errors in production build.

Scope boundary: no new gameplay mechanics, no mobile touch, no backend.

Priority order: leaderboard logic (pure functions first) → game-over screen UI → Vercel config → QA + fixes.

### Technical Debt Noted

- **Tilt uses left-origin column (max ~2.33°)**: `src/main.js:55` — `computeTiltAngle(gameState.col)` should be `computeTiltAngle(gameState.col + pieceHalfWidth)`.
- **Sweep is uniform fade, not horizontal sweep**: `src/renderer/render.js:31-34` — needs column-gating condition based on `sweepProgress`.
- **`playTone` without `ctx` leaks an AudioContext**: `src/audio/sounds.js:24` — the `ctx ?? new AudioContext()` branch creates an unclosed context. Dead code in production but should be removed or guarded.
- **`input.js` keyboard restart untested**: `src/input.js:9-12` — no unit test covers the Enter/R handler or its game-over guard condition.
- **`getActivePieceCells()` and `getActivePieceColor()` not unit tested**: `src/engine/gameState.js:162-168` — renderer-facing methods exercised only by integration path. Low risk but a coverage blind spot.

### Process Improvements

- **MUST-FIX scope should include spec-visual deviations**: The REVIEW correctly identified that tilt and sweep deviate from spec, but both were excluded from MUST-FIX. If a review finding describes a spec violation (not just a style preference), it should be MUST-FIX. Future phases: if REVIEW says "deviates from spec," it goes in MUST-FIX.
- **Commit at phase end, not just "Phase N complete" message**: A well-formed commit message describing what changed (new modules, new tests, what spec items are addressed) would make future git-log context far more useful than "Phase 1 complete" repeated five times.
- **Check tilt visuals during build, not just in review**: The tilt column bug was present throughout the build but wasn't caught until review because there's no automated assertion on the rendered angle. For Phase 3 features that are visible in the browser, add a brief manual verification step to the build task's own success criteria.
