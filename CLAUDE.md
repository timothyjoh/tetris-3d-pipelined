# CLAUDE.md

## Project: Tron Tetris

A neon-retro Tetris clone built with Three.js and Vite. See AGENTS.md for
architecture, install steps, and test commands.

⚠️ **AGENTS.md MUST be read at the start of every session.** It contains
project conventions, available npm scripts, and architectural decisions that
all agents must follow.

---

## ⚠️ FIRST: Read AGENTS.md

If `AGENTS.md` exists, read it NOW before doing anything else. It has project conventions, install steps, test commands, and architecture decisions.

---

## cc-pipeline

This project uses [cc-pipeline](https://github.com/timothyjoh/cc-pipeline) for autonomous development.

## Writing the Brief

If `BRIEF.md` doesn't exist yet, help the user create one:

```
Using the @BRIEF.md.example as a template, we need to discuss this project's
goals and write a BRIEF.md in the project root. Ask me first for a quick
description of the project, then ask me questions one-at-a-time so that we
can construct a good initial project brief.
```

## Running the Pipeline

> **⚠️ Do NOT run the pipeline from within Claude Code.** The pipeline spawns its own Claude Code sessions in tmux — nesting Claude inside Claude is not supported. Run it from a regular terminal instead.

```bash
# From a regular terminal (not Claude Code):
npx cc-pipeline run
```

If it errors or gets stuck, investigate the issue, fix it, then resume:

```bash
npx cc-pipeline run
```

The pipeline resumes from where it left off — state is tracked in `.pipeline/pipeline.jsonl`.

Check progress anytime:

```bash
npx cc-pipeline@latest status
```

## How the Pipeline Works

Each phase runs through these steps in order:

1. **spec** — Break the project vision into a phase spec
2. **research** — Analyze the current codebase
3. **plan** — Create an implementation plan
4. **build** — Implement the plan (interactive Claude in tmux)
5. **review** — Staff engineer-level code review
6. **fix** — Address review findings (if any)
7. **reflect** — Look back and plan the next phase
8. **status** — Update STATUS.md with what was built, how to run it, review findings, test coverage, and what's next
9. **commit** — Git commit and push

Phase outputs are saved to `docs/phases/phase-N/`.

The pipeline stops automatically when the project is complete (`PROJECT COMPLETE` in REFLECTIONS.md).

## Rendering (as of Phase 4)

- **Camera**: `PerspectiveCamera` (FOV 50°, Z = 26). `OrthographicCamera` has been removed.
- **Board tilt**: `boardGroup.rotation.y` drives tilt (not `.rotation.z`). Positive Y = left edge toward viewer.
  - Formula: `boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle)`
  - `tilt.js` engine functions (`computeTiltAngle`, `stepSpring`) are unchanged.
- **Block geometry**: `BoxGeometry(0.85, 0.85, 0.85)` cubes, centered at Z = 0.425.
- **Lighting**: `AmbientLight(0xffffff, 0.3)` + `DirectionalLight(0xffffff, 1.0)` from front-top-right (5, 10, 10).

---

## E2E Tests (Playwright)

Run against the production preview build (must build first):

```bash
npm run build        # required before e2e tests
npm run test:e2e     # headless Chromium, video recording on
npm run test:e2e:ui  # Playwright UI mode (manual verification)
```

Video artifacts are written to `test-results/` (gitignored).

---

## Phase 6 Conventions

- **Start screen**: On page load, `#start-overlay` is shown. The game loop (`requestAnimationFrame`) does NOT start until the overlay is dismissed by any keydown or click. When writing tests that need the game loop running, dismiss the start screen first.
- **`window.__gameState` gate**: Set only when `import.meta.env.VITE_TEST_HOOKS === 'true'` or `import.meta.env.DEV`. In E2E tests, `playwright.config.ts` passes `VITE_TEST_HOOKS=true` via `webServer.env` — no manual env var needed when running `npm run test:e2e`.
- **Pause state**: `gameState.paused` is toggled by ESC (and by `KeyP` from `setupInput`). The `#pause-overlay` element shows when paused; any key resumes.

## Phase 7 Addition

- **`stopImmediatePropagation` in state-machine handler**: `src/main.js:106–125` now calls `e.stopImmediatePropagation()` in all three consuming branches (start-dismiss, pause-resume, ESC-pause). Future key bindings added to `setupInput` may safely overlap with start-screen/pause/resume keys — they will be blocked when an overlay is active and allowed through during normal play.
- **`waitForFunction` guards**: E2E tests that need the game loop running use `window.__gameState?.pieceType !== null` (not `!== undefined`) to confirm the game loop has ticked at least once after dismissing the start overlay.

## Phase 8 Additions

### Touch Control Overlay Architecture
- `#touch-controls` div in `index.html` — uses event delegation; a single `touchstart` listener
  on the container reads `data-action` from the target button.
- `src/input-touch.js` — exports `setupTouchInput(container, gameState, isActive)`.
  Auto-repeat for ← / →: 300 ms initial delay, 80 ms interval (via `setTimeout`/`setInterval`).
  `touchcancel` is handled identically to `touchend` to ensure soft-drop stops cleanly.
- Visibility: CSS `@media (hover: none), (max-width: 768px)` — combined touch-capable and
  narrow-viewport condition.

### Mute Flag Location
- `gameState.muted` (boolean, default `false`) — on the `GameState` class in `src/engine/gameState.js`.
- Toggled by `KeyM` in `src/input.js` and by `#mute-btn` click in `src/main.js`.
- Audio gating: `if (!gameState.muted)` wraps the sound dispatch loop in `src/main.js`.
- HUD indicator: `updateMuteIndicator(muted)` in `src/hud/hud.js`, called from `updateHud`.
- E2E accessible as `window.__gameState.muted` (existing hook, no new code).
- Per R4: muted state persists across restarts within the session (`restart()` does not reset `muted`).

---

## Customizing the Pipeline

See `.pipeline/CLAUDE.md` for full configuration docs — how to edit workflow steps, change agents/models, customize prompts, and add new steps.
