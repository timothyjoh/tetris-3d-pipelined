import * as THREE from 'three';
import { GameState } from './engine/gameState.js';
import { createScene } from './renderer/scene.js';
import { createComposer, createGridLines, createBoardBackground } from './renderer/composer.js';
import { BoardRenderer } from './renderer/render.js';
import { setupInput } from './input.js';
import { updateHud, showOverlay, hideOverlay } from './hud/hud.js';
import { computeTiltAngle, stepSpring } from './engine/tilt.js';
import { playGameSound } from './audio/sounds.js';

const canvas = document.getElementById('game-canvas');
const { renderer, scene, camera } = createScene(canvas);

// Board group — all board visuals tilt together
const boardGroup = new THREE.Group();
scene.add(boardGroup);

createGridLines(boardGroup);
createBoardBackground(boardGroup);

const composer = createComposer(renderer, scene, camera);
const boardRenderer = new BoardRenderer(boardGroup);

let gameState = new GameState();

// Shared AudioContext (created once; browsers require user gesture to start)
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

setupInput(gameState, () => {
  gameState.restart();
  hideOverlay();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  gameState.restart();
  hideOverlay();
});

let lastTime = 0;
let prevOver = false;

function loop(ts) {
  const dt = lastTime === 0 ? 0 : ts - lastTime;
  lastTime = ts;

  gameState.update(dt);

  // --- Tilt animation ---
  const tiltTarget = gameState.justLocked
    ? 0
    : (gameState.pieceType ? computeTiltAngle(gameState.col) : 0);
  if (gameState.justLocked) gameState.justLocked = false;

  const next = stepSpring(gameState.tiltAngle, gameState.tiltVelocity, tiltTarget);
  gameState.tiltAngle = next.angle;
  gameState.tiltVelocity = next.velocity;
  boardGroup.rotation.z = THREE.MathUtils.degToRad(gameState.tiltAngle);

  // --- Sound events ---
  if (gameState.soundEvents.length > 0) {
    const ctx = getAudioCtx();
    for (const event of gameState.soundEvents) {
      playGameSound(event, ctx);
    }
    gameState.soundEvents.length = 0;
  }

  boardRenderer.draw(gameState);
  composer.render();
  updateHud(gameState);

  if (gameState.over && !prevOver) {
    showOverlay('GAME OVER', gameState.score);
  }
  prevOver = gameState.over;

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
