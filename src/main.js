import { GameState } from './engine/gameState.js';
import { createScene } from './renderer/scene.js';
import { createComposer, createGridLines, createBoardBackground } from './renderer/composer.js';
import { BoardRenderer } from './renderer/render.js';
import { setupInput } from './input.js';
import { updateHud, showOverlay, hideOverlay } from './hud/hud.js';

const canvas = document.getElementById('game-canvas');
const { renderer, scene, camera } = createScene(canvas);
createGridLines(scene);
createBoardBackground(scene);

const composer = createComposer(renderer, scene, camera);
const boardRenderer = new BoardRenderer(scene);

let gameState = new GameState();

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
