# BRIEF: Tron Tetris — Neon-Retro Tetris Clone

## Overview

A single-page Tetris clone built with Three.js and Vite, deployable to Vercel. Gameplay is classic 2D Tetris (standard grid, keyboard controls, standard scoring and pacing), but rendered with a Tron-inspired neon-retro aesthetic. The signature 3D touch: as the player moves the active piece left or right, the board subtly tilts on its X-axis (never more than ±7 degrees), then oscillates back to neutral when the piece lands — giving the board a living, reactive feel without breaking classic Tetris mechanics.

## Tech Stack

- **Vite** — build tooling and dev server
- **Three.js** — 3D rendering (board tilt, neon glow effects)
- **Vanilla JS / ES Modules** — no framework
- **Web Audio API** — retro 8-bit sound synthesis (no audio files needed)
- **Vercel** — static hosting (single HTML page output)

## Features (Priority Order)

1. **Classic Tetris Engine** — Standard 10×20 grid, all 7 tetrominoes, keyboard controls (arrow keys / WASD), wall kicks, standard gravity and lock delay
2. **Board Tilt Effect** — Board tilts up to ±7° on the Z-axis as the active piece moves left/right; smoothly oscillates back to 0° on piece landing (spring/damping animation)
3. **Tron Neon Aesthetic** — Dark background, glowing neon-colored blocks per tetromino, scanline/grid overlay, bloom/glow post-processing effect via Three.js
4. **Standard Scoring & Leveling** — Points for single/double/triple/Tetris line clears (standard multipliers), speed increases every 10 lines cleared, level display
5. **Retro Sound Effects** — 8-bit tones synthesized via Web Audio API: piece move, piece rotate, soft drop, hard drop, line clear, Tetris (4-line), level up, game over
6. **Local Leaderboard** — Top 10 scores saved to localStorage, shown on game over screen with initials entry (3 chars, arcade style)

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
- No e2e tests required for MVP

## Definition of Done

~3 phases for MVP:
1. **Phase 1** — Tetris engine + Three.js rendering + Tron aesthetic (static board, no tilt yet)
2. **Phase 2** — Board tilt effect, sound effects, polish
3. **Phase 3** — Leaderboard, game over screen, Vercel deploy config, final QA

Project is complete when all 6 features work, unit tests pass, and it deploys cleanly to Vercel.
