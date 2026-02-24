# Implementation Plan: Phase 4

## Overview

Phase 4 fixes a critical Phase 3 carryover bug (Enter-key race condition in the initials-submit flow), then delivers a full 3D rendering upgrade: `PerspectiveCamera`, true cubic block geometry, directional lighting for face shading, and Y-axis board tilt so the active piece's side leans toward the viewer.

## Current State (from Research)

- **Camera**: `OrthographicCamera` in `scene.js`, `vHeight = BOARD_ROWS + 4 = 24`, `camera.position.z = 10`.
- **Block geometry**: `BoxGeometry(0.95, 0.95, 0.1)` — flat slab. Block center at `z = 0.1` in `cellToWorld`. `roughness: 0.2`.
- **Tilt**: Applied via `boardGroup.rotation.z` at `main.js:113`.
- **Race condition**: `handleInitialsKey` is registered at line 79, `setupInput` at line 88. When Enter is pressed to submit initials:
  1. `handleInitialsKey` fires first → calls `stopImmediatePropagation()` → calls `submitInitials()` which sets `initialsActive = false`.
  2. `setupInput`'s listener was meant to be blocked by `stopImmediatePropagation`, but the `held` Set never saw 'Enter' (it was blocked on the first press). On any key-repeat Enter event, `handleInitialsKey` returns early (initialsActive is false), `stopImmediatePropagation` is never called, and `setupInput`'s listener fires with `suppressRestart()=false` → game restarts.
- **EffectComposer**: `createComposer(renderer, scene, camera)` — receives camera by reference from `main.js:29`. No structural change needed: replacing the camera type in `buildCamera` (inside `createScene`) means the returned reference is already a PerspectiveCamera when `createComposer` is called.
- **Board world dimensions**: X ∈ [−5, 5], Y ∈ [−10, 10] in local `boardGroup` space.
- **Grid lines**: Z = 0.02. **Background plane**: Z = −0.05.
- **jsdom tests**: registered in `vitest.config.js` via `environmentMatchGlobs`.

## Desired End State

After Phase 4:
- `src/main.js`: `setupInput()` called before `window.addEventListener('keydown', handleInitialsKey)`. Tilt applied via `boardGroup.rotation.y` with negated angle.
- `src/renderer/scene.js`: `PerspectiveCamera` (FOV 50°, Z ≈ 26). `DirectionalLight` added. `updateCamera` updates `aspect` and calls `updateProjectionMatrix()`.
- `src/renderer/blockPool.js`: `BoxGeometry(0.85, 0.85, 0.85)`. `cellToWorld` Z = 0.425. `roughness: 0.4`.
- `src/renderer/composer.js`: Grid lines verified in-browser; Z adjusted if depth-fighting observed (expected: no change needed).
- `src/__tests__/initials-submit.test.js`: New jsdom integration test covering the full Enter-key interaction.
- `vitest.config.js`: New test file added to `environmentMatchGlobs`.
- `CLAUDE.md`: Notes about PerspectiveCamera and `rotation.y`.
- **All 201 existing tests pass + new initials-submit tests pass.**
- Manual browser verification: blocks appear as 3D cubes with face shading; left/right tilt with correct sign; board fully framed; no depth artifacts.

### Verification commands

```bash
npm test           # all tests pass, coverage ≥ 97%
npm run build      # no errors or warnings
npm run dev        # manual visual inspection at localhost:5173
```

## What We're NOT Doing

- Game logic changes (engine, scoring, leaderboard functions)
- Audio changes
- Post-processing changes (bloom parameters)
- Ghost piece or sweep animation changes
- Playwright e2e tests (Phase 5)
- Start/pause screen (Phase 6)
- Mobile/touch input
- Fixing `isTopTen` sorted-input assumption (Phase 3 debt)
- XSS fix in `showLeaderboard` (Phase 3 debt)
- `input.test.js` listener accumulation cleanup (Phase 3 debt)

## Implementation Approach

**Four independent change groups, in recommended order:**

1. **Bug fix first** — swap listener registration order in `main.js`. This is the highest-priority carryover and must be green before any rendering work begins.
2. **Write the integration test** — confirms the fix works and prevents regression. New file, low risk.
3. **Rendering changes** — camera → geometry → lighting → tilt axis. Each is localized to 1–2 files.
4. **Docs + commit** — `CLAUDE.md` update, then `git commit`.

### Race condition fix: why swap the registration order

The `stopImmediatePropagation` approach is fragile against key repeats. When Enter is held:
- First keydown: `handleInitialsKey` calls `stopImmediatePropagation` (prevents `setupInput` from running). `submitInitials()` sets `initialsActive = false`.
- Repeat keydown: `handleInitialsKey` returns early (not initialsActive). `stopImmediatePropagation` never called. `setupInput`'s listener fires — `held.has('Enter') = false` (never got added on first press), `suppressRestart() = false` (initialsActive is false) → **restart fires**.

**Fix**: register `setupInput` FIRST, `handleInitialsKey` SECOND.
- First Enter: `setupInput` fires → `suppressRestart()=true` → blocked. Adds 'Enter' to `held`.
- `handleInitialsKey` fires → submits initials → `initialsActive=false`.
- Repeat Enter: `setupInput` fires → `held.has('Enter')=true` → early return. No restart. ✓
- After release + fresh press: `setupInput` fires → `held.has('Enter')=false`, `suppressRestart()=false` → restart. ✓ (correct UX — user explicitly presses Enter again)

### Camera math

Board height with margins: `BOARD_ROWS + 4 = 24` units (same margin as the ortho camera used).
- FOV = 50° (vertical), half-angle = 25°, tan(25°) ≈ 0.4663
- Required Z: `24 / (2 × 0.4663) ≈ 25.7` → use **Z = 26**
- Verify: at Z=26, visible height = `2 × 26 × tan(25°) ≈ 24.3` — board (20 rows) occupies ~82% of height ✓
- Verify: all objects at Z ∈ [−0.05, 0.85] are 25.15–26.05 units from camera, well within near=0.1, far=100 ✓

### Tilt sign convention

`computeTiltAngle` returns `(col − 4.5) / 4.5 × 7`:
- Piece left of center (col 0): returns **−7** (negative)
- Piece right of center (col 9): returns **+7** (positive)

Three.js `rotation.y`:
- Positive Y: right-hand rule around +Y axis → left side (+−X) moves toward viewer (+Z). **Left edge toward viewer = positive Y.** ✓
- So: piece left → `tiltAngle = −7` → need `rotation.y > 0` → **negate**: `rotation.y = degToRad(−tiltAngle)`

Formula: `boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle)`

### Grid/background Z under perspective

After geometry change: block back face at Z = 0.000, front face at Z = 0.850.
- Grid at Z = 0.02: sits **inside** the block volume — visible in empty cells, hidden behind front faces in occupied cells. No z-fighting (different depths). **No change needed.**
- Background at Z = −0.05: clearly behind everything. **No change needed.**
- Verify visually in-browser; adjust if unexpected artifacts appear.

---

## Task 1: Fix Enter-Key Race Condition

### Overview

Swap the registration order of `setupInput` and `handleInitialsKey` in `main.js` so `setupInput`'s `held` Set properly tracks the Enter key during initials submission, preventing key-repeat restarts.

### Changes Required

**File**: `src/main.js`

Move lines 79–88 so `setupInput` is called **before** the `handleInitialsKey` listener registration:

```js
// BEFORE (broken order):
window.addEventListener('keydown', handleInitialsKey);   // line 79
// ... handleRestart definition ...
setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive });  // line 88

// AFTER (fixed order):
setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive });
// ... handleRestart definition stays where it is ...
window.addEventListener('keydown', handleInitialsKey);
```

The exact edit: cut `window.addEventListener('keydown', handleInitialsKey);` from line 79 and paste it after line 88 (after `setupInput`). `handleRestart` is defined at line 81 and referenced by `setupInput` at line 88, so `handleRestart` definition stays in place — only the `handleInitialsKey` registration line moves.

**Exact diff** (lines 79–90 before → after):

Before:
```js
window.addEventListener('keydown', handleInitialsKey);

function handleRestart() {
  initialsActive = false;
  initialsChars = [];
  gameState.restart();
  hideOverlay();
}

setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive });

document.getElementById('restart-btn').addEventListener('click', handleRestart);
```

After:
```js
function handleRestart() {
  initialsActive = false;
  initialsChars = [];
  gameState.restart();
  hideOverlay();
}

setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive });
window.addEventListener('keydown', handleInitialsKey);

document.getElementById('restart-btn').addEventListener('click', handleRestart);
```

No other files changed in this task.

### Success Criteria

- [ ] `src/main.js` has `setupInput(...)` call **before** `window.addEventListener('keydown', handleInitialsKey)`.
- [ ] `boardGroup.rotation.z` line is still present (not changed yet — that's Task 4).
- [ ] `npm run build` completes cleanly.
- [ ] All 201 existing tests pass (`npm test`).

---

## Task 2: Integration Test for Initials-Submit Flow

### Overview

Add `src/__tests__/initials-submit.test.js` — a jsdom test that simulates both `setupInput` and `handleInitialsKey` registering in the fixed order, fires keyboard events, and asserts the race is gone.

Register `vitest.config.js` entry for the new file.

### Changes Required

**File**: `vitest.config.js`

Add the new test file to `environmentMatchGlobs`:
```js
environmentMatchGlobs: [
  ['src/__tests__/input.test.js', 'jsdom'],
  ['src/__tests__/leaderboard-storage.test.js', 'jsdom'],
  ['src/__tests__/initials-submit.test.js', 'jsdom'],  // ADD THIS
],
```

**File**: `src/__tests__/initials-submit.test.js` (new file)

The test cannot import `main.js` directly (Three.js / WebGL won't work in jsdom). Instead, it recreates the two-listener pattern in isolation, mirroring the fixed `main.js` logic:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupInput } from '../input.js';

function fireKey(code, options = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...options }));
}

function fireKeyup(code) {
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}

describe('initials submit — Enter key interaction', () => {
  let onRestart;
  let gameState;
  let initialsActive;
  let submitInitials;
  let handleInitialsKey;
  let cleanup;

  beforeEach(() => {
    onRestart = vi.fn();
    initialsActive = true;
    gameState = { over: true };

    // Mirrors submitInitials() in main.js
    submitInitials = vi.fn(() => { initialsActive = false; });

    // Mirrors handleInitialsKey in main.js (Enter branch only, with 3 chars filled)
    handleInitialsKey = (e) => {
      if (!initialsActive) return;
      if (e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        submitInitials();
      }
    };

    // Fixed order: setupInput FIRST, then handleInitialsKey
    cleanup = setupInput(gameState, onRestart, { suppressRestart: () => initialsActive });
    window.addEventListener('keydown', handleInitialsKey);
  });

  afterEach(() => {
    cleanup?.();
    window.removeEventListener('keydown', handleInitialsKey);
  });

  it('pressing Enter with initialsActive=true calls submitInitials, not onRestart', () => {
    fireKey('Enter');
    expect(submitInitials).toHaveBeenCalledOnce();
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('key-repeat Enter after submit does NOT trigger restart', () => {
    fireKey('Enter');                    // first press: submit fires, initialsActive=false
    fireKey('Enter');                    // repeat: held.has('Enter')=true → setupInput returns early
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('fresh Enter press after submitting (key released then re-pressed) triggers restart', () => {
    fireKey('Enter');       // submit
    fireKeyup('Enter');     // release
    fireKey('Enter');       // fresh press: initialsActive=false, held clear → restart
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('Enter does NOT trigger restart when initialsActive=true (suppressRestart works)', () => {
    // initialsActive stays true (submitInitials not yet called)
    // Only verify that setupInput's listener is properly suppressed
    const suppressedGameState = { over: true };
    let innerInitialsActive = true;
    const innerCleanup = setupInput(suppressedGameState, onRestart, {
      suppressRestart: () => innerInitialsActive,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    expect(onRestart).not.toHaveBeenCalled();
    innerCleanup();
  });
});
```

### Success Criteria

- [ ] New test file exists at `src/__tests__/initials-submit.test.js`.
- [ ] `vitest.config.js` includes the new file in `environmentMatchGlobs`.
- [ ] All tests pass including the new ones (`npm test`).
- [ ] The test that covers key-repeat (`'key-repeat Enter after submit does NOT trigger restart'`) passes — this is the regression test for the Phase 3 bug.

---

## Task 3: PerspectiveCamera + DirectionalLight

### Overview

Replace `OrthographicCamera` with `PerspectiveCamera` in `scene.js`. Rewrite `updateCamera` to update the aspect ratio. Add a `DirectionalLight` for face shading.

### Changes Required

**File**: `src/renderer/scene.js`

Replace `buildCamera` and `updateCamera`:

```js
// Replace buildCamera:
function buildCamera(canvas) {
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
  camera.position.z = 26;
  return camera;
}

// Replace updateCamera:
function updateCamera(camera, canvas) {
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
```

Add `DirectionalLight` in `createScene`, after the existing `AmbientLight`:
```js
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 10);   // front-top-right angle
scene.add(dirLight);
```

The resize listener in `createScene` (lines 15–18) calls `updateCamera` — it already works correctly with the new signature since `updateCamera` is the only thing that changes.

**No changes to `main.js`** — `createScene` still returns `camera`; `createComposer(renderer, scene, camera)` at `main.js:29` receives the new PerspectiveCamera automatically. No stale reference issue.

### Success Criteria

- [ ] `src/renderer/scene.js` has no reference to `OrthographicCamera`.
- [ ] `buildCamera` returns a `PerspectiveCamera` with FOV=50, near=0.1, far=100, Z=26.
- [ ] `updateCamera` sets `camera.aspect` and calls `updateProjectionMatrix()`.
- [ ] A `DirectionalLight` is added to the scene with a position above the board.
- [ ] `npm run build` passes with no warnings.
- [ ] All 201 tests pass (`npm test`) — no engine tests touch Three.js.
- [ ] **Manual**: `npm run dev` → board is fully visible in viewport with ~10% margin; no clipping.
- [ ] **Manual**: Resizing the browser window does not distort the board.

---

## Task 4: True 3D Block Geometry + Material Roughness

### Overview

Upgrade block geometry from a thin slab to a proper cube. Update `cellToWorld` Z center to match the new depth. Adjust material roughness so the directional light produces visible face shading without washing out Tron neon.

### Changes Required

**File**: `src/renderer/blockPool.js`

Three targeted line changes:

1. `cellToWorld` Z value: `0.1` → `0.425`
2. `BoxGeometry` dimensions: `(0.95, 0.95, 0.1)` → `(0.85, 0.85, 0.85)`
3. `roughness` in `MeshStandardMaterial`: `0.2` → `0.4`

```js
// cellToWorld — line 8
function cellToWorld(col, row) {
  return [
    -BOARD_COLS / 2 + col + 0.5,
     BOARD_ROWS / 2 - row - 0.5,
    0.425,   // was 0.1 — half of 0.85 depth, flush with board plane at Z=0
  ];
}

// BlockPool constructor — geometry line
const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);   // was (0.95, 0.95, 0.1)

// MeshStandardMaterial — roughness
roughness: 0.4,   // was 0.2 — higher roughness makes directional light shading more visible
```

No other changes to `blockPool.js`.

### Success Criteria

- [ ] `BoxGeometry(0.95, 0.95, 0.1)` is gone from the codebase.
- [ ] `BoxGeometry(0.85, 0.85, 0.85)` is present.
- [ ] `cellToWorld` returns Z = 0.425.
- [ ] `roughness` is 0.4.
- [ ] `npm run build` passes.
- [ ] All 201 tests pass.
- [ ] **Manual**: Locked blocks show three visible faces (top, front, side) at neutral tilt — visibly 3D.
- [ ] **Manual**: Top face is noticeably brighter than front face — directional shading is visible.
- [ ] **Manual**: Neon colors are not washed out by the directional light.

---

## Task 5: Y-Axis Board Tilt

### Overview

Change the board tilt from `rotation.z` (2D tilt in the screen plane) to `rotation.y` (3D tilt toward/away from viewer). Negate the angle: `computeTiltAngle` returns negative for left-of-center, but Three.js positive Y rotation brings the left edge toward the viewer.

### Changes Required

**File**: `src/main.js`

One line change at line 113:

```js
// BEFORE:
boardGroup.rotation.z = THREE.MathUtils.degToRad(gameState.tiltAngle);

// AFTER:
boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle);
```

**Sign verification**:
- Three.js `rotation.y > 0` (right-hand rule around +Y): left side (−X) rotates toward viewer (+Z) ✓
- `computeTiltAngle` for piece at left (col 0): `(0 − 4.5)/4.5 × 7 = −7` → negated → `+7` → `rotation.y > 0` → left edge toward viewer ✓
- `computeTiltAngle` for piece at right (col 9): `(9 − 4.5)/4.5 × 7 = +7` → negated → `−7` → `rotation.y < 0` → right edge toward viewer ✓

No changes to `src/engine/tilt.js` — `computeTiltAngle` and `stepSpring` are unchanged.

### Success Criteria

- [ ] `boardGroup.rotation.z` is **not written** anywhere in `main.js` (or anywhere in the game loop).
- [ ] `boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle)` is in the game loop.
- [ ] `npm run build` passes.
- [ ] All 201 tests pass.
- [ ] **Manual**: Moving the active piece left → left edge of board leans toward viewer.
- [ ] **Manual**: Moving the active piece right → right edge of board leans toward viewer.
- [ ] **Manual**: Piece locking → board returns to neutral (tilt angle springs to 0).
- [ ] **Manual**: Tilt feel (speed, overshoot) is unchanged from Phase 3.

---

## Task 6: Board Background / Grid Verification

### Overview

Visually verify in-browser that grid lines and background plane render correctly under perspective projection with the new 3D block geometry. No code change is expected, but this task gates the decision.

### Expected Behavior

With blocks centered at Z = 0.425 (back face at Z = 0.000, front face at Z = 0.850):
- **Grid lines** at Z = 0.02: sit inside the block volume. In **empty cells**: visible against the background. In **occupied cells**: hidden behind the block's front face. Result: subtle grid visible only in gaps — correct Tron look.
- **Background plane** at Z = −0.05: behind everything. No depth-fighting.

**No code change is expected.**

### If Depth-Fighting IS Observed

If z-fighting between grid lines (Z = 0.02) and block back faces (Z = 0.000) is visible as shimmering artifacts in `composer.js`:
- Move grid lines to Z = −0.01 (clearly behind block back faces)
- This is a one-line change in `createGridLines`: change `0.02` to `-0.01` in the `positions.push` calls

### Success Criteria

- [ ] **Manual**: Grid lines render cleanly in empty cells with no shimmering or z-fighting artifacts.
- [ ] **Manual**: Background plane shows no depth-fighting with grid lines or block geometry.
- [ ] If `composer.js` was changed, `npm run build` passes and all 201 tests pass.

---

## Task 7: Documentation + Commit

### Overview

Update `CLAUDE.md` with Phase 4 rendering notes. Commit all Phase 4 work.

### Changes Required

**File**: `CLAUDE.md` (if it exists) or create a note in project docs

Add under a "Rendering" or "Architecture" section:
```
## Rendering (as of Phase 4)
- Camera: `PerspectiveCamera` (FOV 50°, Z = 26). `OrthographicCamera` has been removed.
- Board tilt: `boardGroup.rotation.y` drives tilt (not `.rotation.z`). Positive Y = left edge toward viewer.
  - Formula: `boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle)`
  - `tilt.js` engine functions (`computeTiltAngle`, `stepSpring`) are unchanged.
- Block geometry: `BoxGeometry(0.85, 0.85, 0.85)` cubes, centered at Z = 0.425.
- Lighting: `AmbientLight(0xffffff, 0.3)` + `DirectionalLight(0xffffff, 1.0)` from front-top-right.
```

**Git commit** (after all tasks pass):
```bash
git add src/main.js src/renderer/scene.js src/renderer/blockPool.js \
        src/__tests__/initials-submit.test.js vitest.config.js CLAUDE.md
git commit -m "Phase 4 complete"
```

### Success Criteria

- [ ] `CLAUDE.md` documents PerspectiveCamera and `rotation.y` tilt.
- [ ] `git log` shows a "Phase 4 complete" commit.
- [ ] All acceptance criteria from the SPEC are satisfied (checked manually and via `npm test`).

---

## Testing Strategy

### Unit Tests (Vitest — Node environment)

**No changes to existing engine tests.** All 201 must pass unmodified.

New file: `src/__tests__/initials-submit.test.js` (jsdom)
- Tests the two-listener registration pattern in isolation (no Three.js, no DOM beyond `window`)
- Key scenarios:
  - Single Enter press during initials → submit fires, restart does NOT fire
  - Key-repeat Enter (same press held) → restart does NOT fire (held Set blocks it)
  - Fresh Enter after release → restart DOES fire (correct post-submit behavior)
- Import only `setupInput` from `input.js` — no `main.js` import (Three.js incompatible with jsdom)

### Rendering Verification (Manual — browser)

All rendering acceptance criteria are verified manually in `npm run dev`. Checklist to sign off in REFLECTIONS.md:
- [ ] Board fully framed with margins, no clipping at default viewport
- [ ] Window resize preserves framing (no distortion)
- [ ] Blocks appear as 3D cubes with three visible faces at neutral tilt
- [ ] Top face brighter than front face (directional shading)
- [ ] Neon colors intact (not washed out)
- [ ] Left-tilt on left piece, right-tilt on right piece
- [ ] Tilt springs to zero on piece lock
- [ ] No z-fighting artifacts on grid/background
- [ ] Initials submit → leaderboard shown → game does NOT restart

### Coverage

- Engine coverage must remain ≥ 97% (no engine code is changed or deleted)
- `src/engine/**` coverage threshold (80%) will be met
- New `initials-submit.test.js` covers input integration; it does not count toward `src/engine/**` coverage

---

## Risk Assessment

- **EffectComposer stale camera reference**: Not a risk. `createScene` returns the new PerspectiveCamera; `main.js:29` passes it to `createComposer` before the composer is created. The camera reference in `RenderPass` is always the correct PerspectiveCamera object. ✓
- **Tilt sign inversion visually wrong**: Mitigated by explicit sign derivation in this plan. Verify in-browser immediately after Task 5; swap sign if wrong — it's a one-character fix.
- **Board clips vertically at Z=26, FOV=50**: Calculated margin is ~2 rows each side. If it clips (e.g., very tall narrow viewport), increase Z to 28. Verify in-browser.
- **Directional light washes out neon**: `emissiveIntensity: 0.6` on each block's `MeshStandardMaterial` adds self-illumination on top of lighting. Adjust `dirLight.intensity` (down to 0.7) or `roughness` (up to 0.5) if neon appears washed out. Both are trivial tuning changes.
- **Key-repeat behavior differs by OS/browser**: The `held` Set in `setupInput` is the correct mechanism for preventing repeat processing. The fix (swapping registration order) relies on `held.has('Enter')` being true on repeat — this is guaranteed because `setupInput`'s listener is first and always adds 'Enter' to `held` on the initial press.
- **`handleInitialsKey`'s `stopImmediatePropagation` now fires after `setupInput`**: It no longer blocks any listener, but it also doesn't hurt anything. It's harmless on character keys (A-Z0-9, Backspace) since `setupInput` has no case for those. On Enter, `setupInput` already handled and returned — `stopImmediatePropagation` is a no-op. Code can stay as-is.
