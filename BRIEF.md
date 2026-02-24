# BRIEF: Tron Tetris — Neon-Retro Tetris Clone

## Overview

A single-page Tetris clone built with Three.js and Vite, deployable to Vercel. Gameplay is classic 2D Tetris (standard grid, keyboard controls, standard scoring and pacing), but rendered with a Tron-inspired neon-retro aesthetic. Blocks are true 3D cubes rendered in perspective. The signature effect: as the active piece moves left or right, the board tilts on the Y-axis (never more than ±7°) so the side the piece is on leans toward the viewer — then springs back to neutral when the piece lands, giving the board a living, reactive feel without breaking classic Tetris mechanics.

## Tech Stack

- **Vite** — build tooling and dev server
- **Three.js** — 3D rendering (board tilt, neon glow effects)
- **Vanilla JS / ES Modules** — no framework
- **Web Audio API** — retro 8-bit sound synthesis (no audio files needed)
- **Vercel** — static hosting (single HTML page output)

## Features (Priority Order)

1. **Classic Tetris Engine** — Standard 10×20 grid, all 7 tetrominoes, keyboard controls (arrow keys / WASD), wall kicks, standard gravity and lock delay
2. **Board Tilt Effect** — Board tilts up to ±7° on the Y-axis as the active piece moves left/right; the side the piece is on leans *toward the viewer* (left piece → left edge comes forward; right piece → right edge comes forward); smoothly springs back to 0° on piece landing
3. **Tron Neon Aesthetic** — Dark background, glowing neon-colored blocks per tetromino, scanline/grid overlay, bloom/glow post-processing effect via Three.js
4. **3D Block Geometry** — Each grid cell rendered as a true 3D cube (~0.85 units deep); directional lighting from front-top to show face shading; perspective camera so depth foreshortening is visible; board feels like a physical slab one block deep
5. **Standard Scoring & Leveling** — Points for single/double/triple/Tetris line clears (standard multipliers), speed increases every 10 lines cleared, level display
6. **Retro Sound Effects** — 8-bit tones synthesized via Web Audio API: piece move, piece rotate, soft drop, hard drop, line clear, Tetris (4-line), level up, game over
7. **Local Leaderboard** — Top 10 scores saved to localStorage, shown on game over screen with initials entry (3 chars, arcade style)

## UI & Design

- **Aesthetic:** Tron / neon-retro arcade — deep black background, bright cyan/magenta/yellow neon block outlines with glow, subtle grid lines on the board
- **Layout:** Centered board, score/level/lines panel on the side, next-piece preview
- **Game Over:** Full-screen overlay with score, initials entry prompt, leaderboard table, and restart button
- **Post-processing:** Three.js `UnrealBloomPass` or equivalent for neon glow

## Constraints

- Single deployable page (Vite builds to `dist/`, Vercel serves `index.html`)
- No backend — all state is client-side / localStorage
- Three.js used for rendering (not a Canvas 2D fallback)
- Board tilt is purely cosmetic — it must never affect hitboxes or game logic
- Keyboard-only controls (no mobile touch required for MVP)

## Testing

- Vitest for unit tests
- Test the Tetris engine core: piece spawning, rotation (wall kicks), line clear detection, scoring logic, level progression
- Playwright for e2e / visual tests (Phase 5): automated gameplay recording via video capture

## Definition of Done

~4 phases for MVP:
1. **Phase 1** — Tetris engine + Three.js rendering + Tron aesthetic (static board, no tilt yet)
2. **Phase 2** — Board tilt effect (Z-axis, now superseded), sound effects, polish
3. **Phase 3** — Leaderboard, game over screen, Vercel deploy config, final QA
4. **Phase 4** — 3D block geometry & corrected Y-axis tilt:
   - Replace flat `BoxGeometry(0.95, 0.95, 0.1)` blocks with true cubes `BoxGeometry(0.85, 0.85, 0.85)`
   - Switch from `OrthographicCamera` to `PerspectiveCamera` (FOV ~50°, positioned ~18 units back) so depth is perceptible
   - Add a directional key light (front-top, white/cyan) + keep ambient; `MeshStandardMaterial` roughness ~0.4 so face shading shows
   - Change tilt axis from `boardGroup.rotation.z` → `boardGroup.rotation.y`; sign: negative Y angle when piece is right of center (right edge toward viewer), positive when left of center; formula and spring unchanged
   - Board background/grid updates if needed to work with perspective camera
   - All existing unit tests must still pass; no game logic changes

5. **Phase 5** — Playwright e2e testing & gameplay video recording:
   - Install Playwright (`@playwright/test`) and configure `playwright.config.ts` to run against `npm run preview` (production build)
   - Enable Playwright video recording (`video: 'on'`) so every test run captures a `.webm` of the game in action; videos saved to `test-results/`
   - Write a `tests/gameplay.spec.ts` suite that:
     - Loads the game and confirms the canvas is visible and a piece is active
     - Simulates a sequence of moves (left, right, rotate, hard drop) using `keyboard.press` / `keyboard.down`
     - Plays long enough to clear at least one line (seed the board if needed via `page.evaluate` to inject a known state)
     - Asserts score increases after a line clear
     - Asserts game-over overlay appears after the board fills
   - Add `npm run test:e2e` script (`playwright test`) and `npm run test:e2e:ui` (`playwright test --ui`) to `package.json`
   - CI-friendly: headed mode off by default, retries: 1, reporter: `html`
   - All Vitest unit tests must still pass alongside Playwright tests

6. **Phase 6** — Start screen, pause, and resume:
   - **Start screen**: on page load the game does not begin; show a full-screen overlay (same style as game over) with the game title and a prominent "START" button; clicking the button (or pressing any key) dismisses the overlay and starts the game loop
   - **Pause on ESC**: pressing `Escape` during play pauses the game and shows a full-screen blackout overlay with a "PAUSED" message centered on screen; the board and HUD are hidden/obscured behind it
   - **Resume on any key**: while paused, pressing any key (including ESC again) dismisses the overlay and resumes the game exactly where it left off
   - Pause is disabled on game over (ESC should not re-pause a finished game)
   - `GameState.togglePause()` already exists — wire ESC to it in `input.js`; the overlay logic lives in `hud.js`
   - Update Playwright `gameplay.spec.ts` to verify: start overlay is present on load, game starts after keypress, ESC pauses, any key resumes

Project is complete when all 7 features work, unit tests pass, Playwright gameplay tests pass with video artifacts captured, and it deploys cleanly to Vercel.
