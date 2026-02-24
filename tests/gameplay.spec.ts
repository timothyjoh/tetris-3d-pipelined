import { test, expect } from '@playwright/test';

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
  // window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
  await page.waitForFunction(() => (window as any).__gameState !== undefined);

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
  // window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
  await page.waitForFunction(() => (window as any).__gameState !== undefined);

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
  // window.__gameState is set synchronously at module evaluation (VITE_TEST_HOOKS=true in webServer.env)
  await page.waitForFunction(() => (window as any).__gameState !== undefined);

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
  await page.waitForFunction(() => (window as any).__gameState !== undefined);

  // ESC pauses
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  const pausedTrue = await page.evaluate(() => (window as any).__gameState.paused);
  expect(pausedTrue).toBe(true);

  // Any key resumes
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
  await page.waitForFunction(() => (window as any).__gameState !== undefined);

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
