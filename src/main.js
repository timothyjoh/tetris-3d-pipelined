import * as THREE from 'three';
import { GameState } from './engine/gameState.js';
import { createScene } from './renderer/scene.js';
import { createComposer, createGridLines, createBoardBackground } from './renderer/composer.js';
import { BoardRenderer } from './renderer/render.js';
import { setupInput } from './input.js';
import { setupTouchInput } from './input-touch.js';
import {
  updateHud, showOverlay, hideOverlay,
  showInitialsPrompt, setInitialChar, setInitialsCursor,
  showLeaderboard, updateMuteIndicator,
} from './hud/hud.js';
import { computeTiltAngle, stepSpring } from './engine/tilt.js';
import { TETROMINOES } from './engine/tetrominoes.js';
import { playGameSound } from './audio/sounds.js';
import {
  isTopTen, insertScore, rankEntries, loadLeaderboard, saveLeaderboard,
} from './engine/leaderboard.js';

const canvas = document.getElementById('game-canvas');
const { renderer, scene, camera } = createScene(canvas);

// Board group — all board visuals tilt together
const boardGroup = new THREE.Group();
scene.add(boardGroup);

createGridLines(boardGroup);
createBoardBackground(boardGroup);

const composer = createComposer(renderer, scene, camera);
const boardRenderer = new BoardRenderer(boardGroup);

const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');

let gameState = new GameState();
// Test hook: gated behind VITE_TEST_HOOKS=true (set in playwright.config.ts webServer.env)
// or DEV mode. Never set in a standard production build.
if (import.meta.env.VITE_TEST_HOOKS === 'true' || import.meta.env.DEV) {
  window.__gameState = gameState;
}

// Shared AudioContext (created once; browsers require user gesture to start)
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// --- Initials entry state ---
let initialsActive = false;
let initialsChars = [];

function submitInitials() {
  initialsActive = false;
  const initials = initialsChars.join('');
  const current = loadLeaderboard();
  const updated = insertScore(initials, gameState.score, current);
  saveLeaderboard(updated);
  const highlightIndex = updated.findIndex(
    (e) => e.initials === initials && e.score === gameState.score,
  );
  showLeaderboard(updated, highlightIndex);
}

function handleInitialsKey(e) {
  if (!initialsActive) return;
  const key = e.key.toUpperCase();
  if (/^[A-Z0-9]$/.test(key) && initialsChars.length < 3) {
    e.preventDefault();
    e.stopImmediatePropagation();
    initialsChars.push(key);
    setInitialChar(initialsChars.length - 1, key);
    setInitialsCursor(initialsChars.length < 3 ? initialsChars.length : 3);
  } else if (e.code === 'Backspace' && initialsChars.length > 0) {
    e.preventDefault();
    e.stopImmediatePropagation();
    initialsChars.pop();
    setInitialChar(initialsChars.length, '_');
    setInitialsCursor(initialsChars.length);
  } else if (e.code === 'Enter' && initialsChars.length === 3) {
    e.preventDefault();
    e.stopImmediatePropagation();
    submitInitials();
  }
}

function handleRestart() {
  initialsActive = false;
  initialsChars = [];
  gameState.restart();
  hideOverlay();
}

let gameStarted = false;

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  startOverlay.classList.add('hidden');
  requestAnimationFrame(loop);
}

// State-machine keydown handler — registered BEFORE setupInput so start-screen and
// pause transitions run before game-control keys are processed.
// Phase order: start → playing → (paused ↔ playing) → over
window.addEventListener('keydown', (e) => {
  if (!gameStarted) {
    // Any key dismisses start screen and begins the game loop.
    // stopImmediatePropagation prevents this key from also reaching setupInput
    // (e.g. P would otherwise call togglePause(), Space would call hardDrop()).
    startGame();
    e.stopImmediatePropagation();
    return;
  }
  if (gameState.over) return; // game-over: Enter/R handled by setupInput (no stopImmediatePropagation)
  if (gameState.paused) {
    // Any key resumes; stop propagation so the same key doesn't also
    // trigger a game-control action (e.g. Space would call hardDrop()).
    gameState.togglePause();
    pauseOverlay.classList.add('hidden');
    e.stopImmediatePropagation();
    return;
  }
  if (e.code === 'Escape') {
    // ESC pauses during active play; stop propagation (ESC has no setupInput binding,
    // but the discipline is: consuming branches always call stopImmediatePropagation).
    gameState.togglePause();
    pauseOverlay.classList.remove('hidden');
    e.stopImmediatePropagation();
  }
});

startOverlay.addEventListener('click', startGame);

setupInput(gameState, handleRestart, { suppressRestart: () => initialsActive });
window.addEventListener('keydown', handleInitialsKey);

document.getElementById('mute-btn').addEventListener('click', () => {
  if (gameStarted && !gameState.paused) {
    gameState.muted = !gameState.muted;
    updateMuteIndicator(gameState.muted);
  }
});

const touchControls = document.getElementById('touch-controls');
setupTouchInput(touchControls, gameState, () => gameStarted && !gameState.paused && !gameState.over);

document.getElementById('restart-btn').addEventListener('click', handleRestart);

let lastTime = 0;
let prevOver = false;

function loop(ts) {
  const dt = lastTime === 0 ? 0 : ts - lastTime;
  lastTime = ts;

  gameState.update(dt);

  // --- Tilt animation ---
  const pieceHalfWidth = gameState.pieceType
    ? TETROMINOES[gameState.pieceType].width / 2
    : 0;
  const tiltTarget = gameState.justLocked
    ? 0
    : (gameState.pieceType ? computeTiltAngle(gameState.col + pieceHalfWidth) : 0);
  if (gameState.justLocked) gameState.justLocked = false;

  const next = stepSpring(gameState.tiltAngle, gameState.tiltVelocity, tiltTarget);
  gameState.tiltAngle = next.angle;
  gameState.tiltVelocity = next.velocity;
  boardGroup.rotation.y = THREE.MathUtils.degToRad(-gameState.tiltAngle);

  // --- Sound events ---
  if (gameState.soundEvents.length > 0) {
    if (!gameState.muted) {
      const ctx = getAudioCtx();
      for (const event of gameState.soundEvents) {
        playGameSound(event, ctx);
      }
    }
    gameState.soundEvents.length = 0; // always drain, even when muted
  }

  boardRenderer.draw(gameState);
  composer.render();
  updateHud(gameState);

  if (gameState.over && !prevOver) {
    showOverlay('GAME OVER', gameState.score);
    const entries = loadLeaderboard();
    if (isTopTen(gameState.score, entries)) {
      initialsChars = [];
      initialsActive = true;
      showInitialsPrompt();
    } else {
      showLeaderboard(rankEntries(entries), -1);
    }
  }
  prevOver = gameState.over;

  requestAnimationFrame(loop);
}

// Game loop deferred — startGame() is called when the start overlay is dismissed.
