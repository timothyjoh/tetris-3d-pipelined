# Phase 1: Tetris Engine + Three.js Rendering + Tron Aesthetic

## Objective

Deliver a fully playable Tetris game in the browser with a Tron-inspired neon aesthetic rendered via Three.js. By the end of this phase, a user can open the page, play a complete game of Tetris (all 7 tetrominoes, keyboard controls, scoring, leveling, game over), and see it rendered with dark backgrounds, glowing neon-colored blocks, and a scanline/grid overlay — all served from a Vite dev server. The board tilt effect and sound are deferred to Phase 2.

## Scope

### In Scope
- Vite project scaffold (Vanilla JS / ES Modules)
- Vitest test framework with V8 coverage reporting
- Classic Tetris engine: 10×20 grid, all 7 tetrominoes, rotation with wall kicks, gravity, lock delay, line clear detection and removal
- Standard scoring (single/double/triple/Tetris multipliers) and level progression (speed up every 10 lines)
- Keyboard controls: Arrow Left/Right (move), Arrow Up / X (rotate CW), Z (rotate CCW), Arrow Down (soft drop), Space (hard drop), P (pause)
- Three.js scene: orthographic camera, board rendered as a flat plane with neon-colored block meshes, dark background
- Tron neon aesthetic: black background, per-tetromino cyan/magenta/yellow/green/orange/red/blue neon block colors with emissive glow material, subtle grid-line overlay on the board
- `UnrealBloomPass` post-processing for neon bloom/glow effect
- HUD overlay (HTML/CSS over the canvas): score, level, lines cleared, next-piece preview
- Game over detection and a minimal restart prompt (full leaderboard screen is Phase 3)
- AGENTS.md, README.md, and CLAUDE.md updates as required for Phase 1
- Vercel-compatible static output (`dist/`) via `vite build`

### Out of Scope
- Board tilt / X-axis rotation effect (Phase 2)
- Web Audio API sound effects (Phase 2)
- Spring/damping animation on piece landing (Phase 2)
- Local leaderboard, initials entry, and full game-over screen (Phase 3)
- Mobile/touch controls (not required for MVP)
- Backend or server-side logic

## Requirements

- The game must run at a stable 60fps in a modern browser (Chrome/Firefox/Safari latest)
- All 7 standard tetrominoes (I, O, T, S, Z, J, L) must spawn, move, rotate, and lock correctly
- SRS (Super Rotation System) wall kicks must be implemented for all pieces
- Line clears must correctly remove completed rows, shift rows down, and award points
- Level increases every 10 lines; gravity (drop interval) must follow the standard Guideline speed curve
- Lock delay: piece locks 0.5 s after landing (resets on move/rotate, max 15 resets)
- Three.js `WebGLRenderer` must be used — no Canvas 2D fallback
- Post-processing bloom must be applied via Three.js `EffectComposer` + `UnrealBloomPass`
- Block materials must use `MeshStandardMaterial` or `MeshBasicMaterial` with `emissive` color for the neon glow look
- HUD elements (score, level, lines, next piece) must be legible over the Three.js canvas
- `vite build` must produce a working `dist/index.html` with no build errors or warnings
- All unit tests must pass with `vitest run`; coverage report must be generated with `vitest run --coverage`

## Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts a Vite dev server; opening `localhost:5173` shows the game
- [ ] All 7 tetrominoes spawn and can be moved left/right, rotated, soft-dropped, and hard-dropped
- [ ] Wall kicks prevent pieces from rotating through walls or the floor
- [ ] Completed rows are cleared and rows above shift down correctly
- [ ] Score increments correctly: 100/300/500/800 pts × level for 1/2/3/4 lines
- [ ] Level increases after every 10 lines; piece fall speed visibly increases
- [ ] Game over triggers when a new piece cannot spawn; a restart prompt is shown
- [ ] The Three.js scene renders with dark background, neon-colored blocks, and visible bloom glow
- [ ] Grid lines are visible on the board surface
- [ ] HUD shows current score, level, lines cleared, and next-piece preview
- [ ] `npm run test` runs all Vitest unit tests and they all pass
- [ ] `npm run test:coverage` generates a coverage report in `coverage/`; engine coverage ≥ 80%
- [ ] `npm run build` produces `dist/index.html` with no errors or warnings
- [ ] All tests pass
- [ ] Code compiles without warnings

## Testing Strategy

- **Framework:** Vitest (specified in BRIEF.md) with `@vitest/coverage-v8`
- **Test location:** `src/__tests__/` (or co-located `*.test.js` files)
- **Key test scenarios:**
  - Tetromino spawning: each of the 7 pieces spawns at the correct position and orientation
  - Rotation: each piece rotates correctly through all 4 states; wall kicks apply when rotation would overlap a wall or filled cell
  - Movement: left/right/down moves respect board boundaries and filled cells
  - Lock: piece locks after lock delay; lock resets on move/rotate up to 15 times
  - Line clear: single, double, triple, and Tetris (4-line) clears remove the correct rows
  - Score: correct point values awarded for each clear type, multiplied by level
  - Level progression: level increments at 10, 20, 30 … lines
  - Game over: detected when spawn position is blocked
  - Gravity interval: returns correct drop interval for each level per the speed curve
- **Coverage target:** ≥ 80% line coverage on Tetris engine modules (`engine/`, `game/`, or equivalent)
- **No E2E tests required** (as stated in BRIEF.md)

## Documentation Updates

- **AGENTS.md** *(new file)*: Document how to install dependencies, run the dev server, run tests, run tests with coverage, and an overview of the project file structure. This file must exist so all agents (Claude Code, Codex CLI, etc.) pick up the same conventions.
- **CLAUDE.md** *(update, do not overwrite)*: Add a brief project description and an emphatic instruction that agents must read `AGENTS.md` immediately upon starting any session. Keep the existing cc-pipeline section intact.
- **README.md** *(new file)*: Project description, getting started (install, `npm run dev`), available npm scripts (`dev`, `build`, `test`, `test:coverage`, `preview`), and a brief project structure overview.

## Dependencies

- Node.js ≥ 18 installed on the dev machine
- No prior phase work (this is the foundation phase)
- External npm packages needed:
  - `vite` (dev)
  - `three`
  - `vitest` (dev)
  - `@vitest/coverage-v8` (dev)
  - `postprocessing` or Three.js `examples/jsm/postprocessing/` for EffectComposer + UnrealBloomPass

## Adjustments from Previous Phase

First phase — no prior adjustments.
