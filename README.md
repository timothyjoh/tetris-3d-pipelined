# Tron Tetris

A neon-retro Tetris clone built with Three.js and Vite. Classic Tetris mechanics
rendered with a Tron-inspired aesthetic: dark background, glowing neon block colors,
grid overlay, and bloom post-processing.

## Features

- **Tron aesthetic** — dark background, neon block colors, UnrealBloom post-processing
- **Board tilt effect** — board Z-rotates up to ±7° tracking the active piece center column; spring/damping animation snaps back to 0° on piece lock
- **Ghost piece** — dim neon outline shows where the active piece will land
- **Piece lock flash** — ~100ms white flash on cells when a piece locks
- **Line-clear sweep animation** — 150ms left-to-right column wipe across cleared rows before they disappear
- **Web Audio sound effects** — 8 synthesized tones (move, rotate, soft drop, hard drop, line clear, Tetris, level up, game over); no audio files fetched from network
- **Keyboard restart** — press Enter or R on the game-over screen to restart without mouse
- **Local leaderboard** — top 10 scores stored in `localStorage`; arcade-style 3-character initials entry (A–Z, 0–9) when score qualifies for the top 10

## Getting Started

```
npm install
npm run dev     # open localhost:5173
```

## Controls

| Key | Action |
|-----|--------|
| ← → | Move left / right |
| ↑ or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| P | Pause |
| Enter or R | Restart (game over screen only) |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest unit tests |
| `npm run test:coverage` | Generate coverage report in `coverage/` |

## Deploy

The project is deployed to Vercel as a standard Vite static build. No `vercel.json` is needed — Vercel auto-configures for Vite projects. Connect the GitHub repo to Vercel with build command `npm run build` and output directory `dist`. See [AGENTS.md](./AGENTS.md) for full details.

## Project Structure

See [AGENTS.md](./AGENTS.md) for full architecture overview.
