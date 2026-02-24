import { test, expect } from '@playwright/test';

// Shared guard: waits until the game module has loaded AND the first piece has spawned.
// Use this instead of bare `__gameState !== undefined` checks.
// Phase 8: extracted from inline waitForFunction calls in Tests 3–5 to a named helper
// so future guard upgrades are a single-line change.
async function waitForGameReady(page: any) {
  await page.waitForFunction(() => {
    const gs = (window as any).__gameState;
    return gs != null && gs.pieceType !== null;
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Canvas visible
// Confirms Vite build + Three.js boot succeeds; score starts at "0".
// ──────────────────────────────────────────────────────────────────────────────
test('canvas is visible and score starts at zero', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.locator('#hud-score')).toHaveText('0');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Move and rotate
// First ArrowLeft dismisses the start overlay (consumed by state-machine handler before setupInput).
// Remaining keys (ArrowLeft ×2, ArrowRight ×2, ArrowUp ×1) reach game input; asserts no crash.
// ──────────────────────────────────────────────────────────────────────────────
test('move and rotate inputs do not crash the game', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');

  // Game is still running — score element is present
  await expect(page.locator('#hud-score')).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: Line clear increases score
// Inject a near-complete board (rows 16–19, cols 1–9 filled; col 0 open).
// Place a vertical I-piece (rotation 3) at col=-1 so it occupies col 0.
// Hard-drop → 4 complete rows → score goes from "0" to "800" (level 1).
// NOTE: Line clears trigger a 150 ms sweep animation; score updates after it.
// ──────────────────────────────────────────────────────────────────────────────
test('line clear increases score above zero', async ({ page }) => {
  await page.goto('/');
  // Dismiss start overlay to start the game loop (ArrowLeft is harmless: no hard drop)
  await page.keyboard.press('ArrowLeft');
  // Wait until __gameState exists AND pieceType is non-null: confirms module loaded and piece spawned
  // (VITE_TEST_HOOKS=true is set in playwright.config.ts webServer.env)
  // Phase 8: uses shared waitForGameReady helper (extracted from inline guard)
  await waitForGameReady(page);

  await page.evaluate(() => {
    const gs = (window as any).__gameState;
    // Fill rows 16–19, cols 1–9 (leaving col 0 open)
    for (let row = 16; row <= 19; row++) {
      for (let col = 1; col <= 9; col++) {
        gs.board.setCell(col, row, 1);
      }
    }
    // I-piece rotation 3: cells at originCol+1 for each of 4 rows
    // originCol=-1 → actual col 0; drops to rows 16–19 → 4 complete lines
    gs.pieceType = 'I';
    gs.rotation = 3;
    gs.col = -1;
    gs.row = 0;
    gs.hardDrop();
  });

  // Wait for sweep animation (150 ms) + RAF frame to update DOM
  await expect(page.locator('#hud-score')).toHaveText('800', { timeout: 5000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 4: Game-over overlay appears
// Pre-fill the O-piece spawn cells (4,0),(5,0),(4,1),(5,1).
// Set nextPieceType='O' so _spawnPiece() tries O at spawnCol=3 → invalid → over.
// Active O-piece is placed at col=0 (safe area) and hard-dropped (no line clears).
// On next RAF frame: showOverlay() fires → #overlay becomes visible.
// ──────────────────────────────────────────────────────────────────────────────
test('game-over overlay becomes visible after topping out', async ({ page }) => {
  await page.goto('/');
  // Dismiss start overlay to start the game loop (ArrowLeft is harmless: no hard drop)
  await page.keyboard.press('ArrowLeft');
  // Wait until __gameState exists AND pieceType is non-null: confirms module loaded and piece spawned
  // (VITE_TEST_HOOKS=true is set in playwright.config.ts webServer.env)
  // Phase 8: uses shared waitForGameReady helper (extracted from inline guard)
  await waitForGameReady(page);

  await page.evaluate(() => {
    const gs = (window as any).__gameState;
    // Block the O-piece spawn area: cells at (originCol+1, 0–1) with spawnCol=3
    // O-piece rotation 0 shape: [[0,1,1,0],[0,1,1,0],...] → cells at col+1, col+2
    gs.board.setCell(4, 0, 1);
    gs.board.setCell(5, 0, 1);
    gs.board.setCell(4, 1, 1);
    gs.board.setCell(5, 1, 1);
    // Force the next piece to be O so we know exactly what spawns
    gs.nextPieceType = 'O';
    // Place active O-piece at col=0 (occupies cols 1–2, rows 0–1 — no overlap)
    gs.pieceType = 'O';
    gs.col = 0;
    gs.row = 0;
    gs.rotation = 0;
    // Hard-drop: O falls to rows 18–19, no line clears, then _spawnPiece() fails
    gs.hardDrop();
  });

  await expect(page.locator('#overlay')).toBeVisible({ timeout: 5000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 5: Leaderboard flow — game-over → initials → table row
// Same game-over injection as Test 4. Score=0 qualifies for top-10 on a fresh
// localStorage (isTopTen(0, []) → true). Type "AAA", press Enter, assert row.
// handleInitialsKey calls e.key.toUpperCase(), so lowercase 'KeyA' events work.
// Enter check uses e.code === 'Enter'.
// ──────────────────────────────────────────────────────────────────────────────
test('submitting initials shows leaderboard row with entered initials', async ({ page }) => {
  await page.goto('/');
  // Dismiss start overlay to start the game loop (ArrowLeft is harmless: no hard drop)
  await page.keyboard.press('ArrowLeft');
  // Wait until __gameState exists AND pieceType is non-null: confirms module loaded and piece spawned
  // (VITE_TEST_HOOKS=true is set in playwright.config.ts webServer.env)
  // Phase 8: uses shared waitForGameReady helper (extracted from inline guard)
  await waitForGameReady(page);

  // Trigger game over (same injection as Test 4)
  await page.evaluate(() => {
    const gs = (window as any).__gameState;
    gs.board.setCell(4, 0, 1);
    gs.board.setCell(5, 0, 1);
    gs.board.setCell(4, 1, 1);
    gs.board.setCell(5, 1, 1);
    gs.nextPieceType = 'O';
    gs.pieceType = 'O';
    gs.col = 0;
    gs.row = 0;
    gs.rotation = 0;
    gs.hardDrop();
  });

  // Wait for overlay AND initials prompt (both shown in the same RAF frame)
  await expect(page.locator('#overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#initials-prompt')).toBeVisible({ timeout: 5000 });

  // Type three-character initials using logical key names
  // e.key.toUpperCase() in handleInitialsKey accepts lowercase 'a' from KeyA
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('Enter'); // e.code === 'Enter' triggers submitInitials()

  // Leaderboard section becomes visible with a row containing "AAA"
  await expect(page.locator('#leaderboard-section')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#leaderboard-body')).toContainText('AAA');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 6: Start overlay visible on load
// Confirms start screen is shown before any interaction; score has not ticked.
// ──────────────────────────────────────────────────────────────────────────────
test('start overlay is visible on load', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-overlay')).toBeVisible();
  await expect(page.locator('#hud-score')).toHaveText('0');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 7: Game starts after keypress on start screen
// Pressing Space dismisses the start overlay and begins the game loop.
// The state-machine handler calls e.stopImmediatePropagation() after startGame(),
// so Space does NOT also trigger hardDrop() via setupInput. Key choice is safe.
// ──────────────────────────────────────────────────────────────────────────────
test('game starts after keypress on start screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-overlay')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#start-overlay')).toBeHidden();
  await expect(page.locator('#game-canvas')).toBeVisible();
  // Game loop is now live — wait for gameState to confirm not over
  await page.waitForFunction(() => {
    const gs = (window as any).__gameState;
    return gs !== undefined && !gs.over;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 8: ESC pauses and any key resumes
// After dismissing start screen, ESC shows pause overlay (paused === true).
// A subsequent Space press hides the overlay (paused === false).
// ──────────────────────────────────────────────────────────────────────────────
test('ESC pauses and any key resumes', async ({ page }) => {
  await page.goto('/');
  // Dismiss start screen
  await page.keyboard.press('ArrowLeft');
  // Phase 8: upgraded from stale `!== undefined` guard to rigorous two-condition form
  await waitForGameReady(page);

  // ESC pauses
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  const pausedTrue = await page.evaluate(() => (window as any).__gameState.paused);
  expect(pausedTrue).toBe(true);

  // Any key resumes — state-machine handler calls stopImmediatePropagation() in the
  // pause-resume branch, so Space does NOT also reach setupInput's hardDrop().
  await page.keyboard.press('Space');
  await expect(page.locator('#pause-overlay')).toBeHidden();
  const pausedFalse = await page.evaluate(() => (window as any).__gameState.paused);
  expect(pausedFalse).toBe(false);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 9: ESC during game-over does NOT show the pause overlay
// After game-over, pressing Escape must be a no-op (guard in main.js + togglePause).
// ──────────────────────────────────────────────────────────────────────────────

test('ESC during game-over does not show pause overlay', async ({ page }) => {
  await page.goto('/');
  // Dismiss start overlay to start the game loop (ArrowLeft is harmless: no hard drop)
  await page.keyboard.press('ArrowLeft');
  // Phase 8: upgraded from stale `!== undefined` guard to rigorous two-condition form
  await waitForGameReady(page);

  // Trigger game over using the same O-piece injection as Tests 4 and 5
  await page.evaluate(() => {
    const gs = (window as any).__gameState;
    gs.board.setCell(4, 0, 1);
    gs.board.setCell(5, 0, 1);
    gs.board.setCell(4, 1, 1);
    gs.board.setCell(5, 1, 1);
    gs.nextPieceType = 'O';
    gs.pieceType = 'O';
    gs.col = 0;
    gs.row = 0;
    gs.rotation = 0;
    gs.hardDrop();
  });

  // Wait for game-over overlay to appear
  await expect(page.locator('#overlay')).toBeVisible({ timeout: 5000 });

  // Confirm game is actually over before pressing ESC
  const isOver = await page.evaluate(() => (window as any).__gameState.over);
  expect(isOver).toBe(true);

  // Press ESC — must NOT show the pause overlay
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeHidden();
  // paused flag must remain false (togglePause returns early when over)
  const isPaused = await page.evaluate(() => (window as any).__gameState.paused);
  expect(isPaused).toBe(false);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 10: Click on start overlay starts the game
// The #start-overlay element has a click listener → startGame(). Clicking it
// should hide the overlay and start the game loop (gameState.over === false).
// ──────────────────────────────────────────────────────────────────────────────
test('click on start overlay starts the game', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-overlay')).toBeVisible();

  await page.click('#start-overlay');

  await expect(page.locator('#start-overlay')).toBeHidden();
  // Confirm the game loop is live: module loaded AND first piece has spawned
  // Phase 8: upgraded from partially-stale guard (`!== undefined && gs.over === false`)
  // to rigorous two-condition form; the isOver assertion below still verifies over===false
  await waitForGameReady(page);
  const isOver = await page.evaluate(() => (window as any).__gameState.over);
  expect(isOver).toBe(false);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 11: Touch ← button moves piece left
// Set viewport to 390×844 (iPhone 14 portrait) so CSS media query shows touch controls.
// Tap the left arrow button; assert gameState.col decreased (or is bounded at wall).
// ──────────────────────────────────────────────────────────────────────────────
test('touch left button moves piece left', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  // Move right twice to ensure piece is not against the left wall,
  // so a successful touch-left will always decrease col by exactly 1.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  const colBefore = await page.evaluate(() => (window as any).__gameState.col);

  const btn = page.locator('[data-action="left"]');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const colAfter = await page.evaluate(() => (window as any).__gameState.col);
  // Strict equality: touch-left must decrease col by exactly 1.
  // Moving right twice before ensures the piece is not at the left wall.
  expect(colAfter).toBe(colBefore - 1);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 12: Touch rotate button rotates piece
// Tap the rotate (↑) button; assert gameState.rotation changed from initial value.
// Uses 390×844 viewport to show touch controls.
// ──────────────────────────────────────────────────────────────────────────────
test('touch rotate button rotates piece', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  const rotBefore = await page.evaluate(() => (window as any).__gameState.rotation);

  const btn = page.locator('[data-action="rotate"]');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const rotAfter = await page.evaluate(() => (window as any).__gameState.rotation);
  expect(rotAfter).not.toBe(rotBefore);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 13: Touch hard drop button lands piece near bottom
// Tap the hard drop (⬛) button; piece locks near bottom and a new piece spawns.
// Verifies a cell exists at row 19 (the bottom-most row) after the drop.
// Uses 390×844 viewport to show touch controls.
// ──────────────────────────────────────────────────────────────────────────────
test('touch hard drop button drops piece to bottom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  const btn = page.locator('[data-action="hardDrop"]');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // After hard drop a new piece spawns; wait for the game to be ready again
  await waitForGameReady(page);
  // The previous piece locked near the bottom — board should have cells at row 19
  const hasCellNearBottom = await page.evaluate(() => {
    const gs = (window as any).__gameState;
    for (let col = 0; col < 10; col++) {
      if (gs.board.getCell(col, 19) !== 0) return true;
    }
    return false;
  });
  expect(hasCellNearBottom).toBe(true);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 14: Mute button toggles mute flag and HUD icon
// Click the mute button in the HUD; assert window.__gameState.muted toggles.
// Also verifies the HUD icon changes between 🔊 and 🔇.
// Uses 390×844 viewport; mute button is always visible in the HUD.
// ──────────────────────────────────────────────────────────────────────────────
test('mute button toggles mute flag and HUD icon', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('ArrowLeft'); // dismiss start screen
  await waitForGameReady(page);

  const mutedBefore = await page.evaluate(() => (window as any).__gameState.muted);
  expect(mutedBefore).toBe(false);

  // Click the mute button to mute
  await page.click('#mute-btn');

  const mutedAfter = await page.evaluate(() => (window as any).__gameState.muted);
  expect(mutedAfter).toBe(true);

  // Verify HUD icon changed to muted
  const icon = await page.locator('#mute-btn').textContent();
  expect(icon).toBe('🔇');

  // Click again to unmute
  await page.click('#mute-btn');
  const mutedFinal = await page.evaluate(() => (window as any).__gameState.muted);
  expect(mutedFinal).toBe(false);
});
