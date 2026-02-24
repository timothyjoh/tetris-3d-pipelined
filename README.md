# Tron Tetris

A neon-retro Tetris clone built with Three.js and Vite. Classic Tetris mechanics
rendered with a Tron-inspired aesthetic: dark background, glowing neon block colors,
grid overlay, and bloom post-processing.

## Features

- **Tron aesthetic** — dark background, neon block colors, UnrealBloom post-processing
- **Board tilt effect** — board Y-rotates up to ±7° tracking the active piece center column; spring/damping animation snaps back to 0° on piece lock
- **Ghost piece** — dim neon outline shows where the active piece will land
- **Piece lock flash** — ~100ms white flash on cells when a piece locks
- **Line-clear sweep animation** — 150ms left-to-right column wipe across cleared rows before they disappear
- **Web Audio sound effects** — 8 synthesized tones (move, rotate, soft drop, hard drop, line clear, Tetris, level up, game over); no audio files fetched from network
- **Mute toggle** — press M during play or tap the 🔊 / 🔇 HUD icon to silence audio; state persists across restarts
- **Keyboard restart** — press Enter or R on the game-over screen to restart without mouse
- **Local leaderboard** — top 10 scores stored in `localStorage`; arcade-style 3-character initials entry (A–Z, 0–9) when score qualifies for the top 10
- **Touch controls** — on-screen button pad (← → ↑ ↓ ⬛) visible on touch devices or narrow viewports (≤768px); hold ← / → for auto-repeat

## Live Demo

[https://sdk-test-lemon.vercel.app](https://sdk-test-lemon.vercel.app)

## Getting Started

```
npm install
npm run dev     # open localhost:5173
```

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| ← / → | Move left / right |
| ↑ or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| P or Escape | Pause / Resume |
| M | Mute / unmute |
| Enter or R | Restart (game over screen only) |

### Touch Controls

On touch-capable devices or viewports ≤ 768px wide, an on-screen control pad appears at the
bottom of the screen: ← (move left), ↑ (rotate), ↓ (soft drop), → (move right), and ⬛ (hard
drop). Hold ← or → for auto-repeat. Tap the 🔊 / 🔇 icon in the HUD to toggle audio.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest unit tests |
| `npm run test:coverage` | Generate coverage report in `coverage/` |

## E2E Tests

End-to-end tests run against the Vite production preview server using Playwright.

```bash
npm run build       # build production bundle first
npm run test:e2e    # run all E2E tests (headless Chromium)
```

Video recordings of each test run are saved to `test-results/` (excluded from git).

The `VITE_TEST_HOOKS=true` environment variable is set automatically by `playwright.config.ts`
via `webServer.env` — no manual configuration needed.

To open the HTML report after a run:

```bash
npx playwright show-report
```

## Deploy

The project is deployed to Vercel as a standard Vite static build. No `vercel.json` is needed — Vercel auto-configures for Vite projects. Connect the GitHub repo to Vercel with build command `npm run build` and output directory `dist`. See [AGENTS.md](./AGENTS.md) for full details.

## Project Structure

See [AGENTS.md](./AGENTS.md) for full architecture overview.
