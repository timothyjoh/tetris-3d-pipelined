# AGENTS.md

READ THIS FIRST before writing any code or running any commands.

## Install

```
npm install
```

## Dev Server

```
npm run dev          # Vite dev server at localhost:5173
```

## Tests

```
npm run test         # Run all Vitest unit tests
npm run test:coverage  # Coverage report in coverage/ (engine target ≥ 80%)
```

## Build

```
npm run build        # Output to dist/
npm run preview      # Preview production build locally
```

## Architecture

```
src/
  main.js            — Entry point: RAF game loop, wires all layers
  input.js           — Keyboard event handling
  engine/            — Pure JS game logic (no DOM/Three.js)
    tetrominoes.js   — 7-piece shapes, SRS rotations, colors
    board.js         — Board class: 10×20 grid, line clear
    rotation.js      — SRS wall kick tables, tryRotate()
    gameState.js     — GameState: gravity, lock delay, scoring, level
  renderer/          — Three.js rendering (reads engine state, never writes)
    scene.js         — WebGLRenderer, OrthographicCamera, Scene
    blockPool.js     — Pre-allocated mesh pool
    composer.js      — EffectComposer, UnrealBloomPass, grid LineSegments
    render.js        — BoardRenderer: maps game state to block meshes
  hud/
    hud.js           — DOM updates for score/level/lines/next-piece/overlay
  __tests__/         — Vitest unit tests (engine modules only)
```

## Conventions

- ES Modules only (no CommonJS require)
- Node ≥ 18
- Three.js addons via `three/addons/` (not a separate postprocessing package)
- No E2E tests; unit tests cover engine only (renderer requires WebGL context)
- GameState constructor accepts `{firstPiece, secondPiece}` for deterministic testing
