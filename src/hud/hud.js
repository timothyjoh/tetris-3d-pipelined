import { TETROMINOES } from '../engine/tetrominoes.js';

const elScore  = document.getElementById('hud-score');
const elLevel  = document.getElementById('hud-level');
const elLines  = document.getElementById('hud-lines');
const nextCanvas = document.getElementById('next-canvas');
const overlay  = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');

const nextCtx = nextCanvas.getContext('2d');
const CELL = nextCanvas.width / 6;

export function updateHud(gameState) {
  elScore.textContent = gameState.score.toLocaleString();
  elLevel.textContent = gameState.level;
  elLines.textContent = gameState.linesCleared;
  renderNextPiece(gameState.nextPieceType);
}

function renderNextPiece(pieceType) {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!pieceType) return;
  const { color, shapes } = TETROMINOES[pieceType];
  const shape = shapes[0];
  const hex = color.toString(16).padStart(6, '0');
  nextCtx.fillStyle = `#${hex}`;
  nextCtx.shadowColor = `#${hex}`;
  nextCtx.shadowBlur = 8;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c]) {
        nextCtx.fillRect(
          (c + 1) * CELL + 1,
          (r + 1) * CELL + 1,
          CELL - 2,
          CELL - 2,
        );
      }
    }
  }
}

export function showOverlay(title, score) {
  overlayTitle.textContent = title;
  overlayScore.textContent = `SCORE: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

export function hideOverlay() {
  overlay.classList.add('hidden');
}
