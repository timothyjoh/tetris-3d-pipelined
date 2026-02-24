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
  resetOverlayUI();
}

// --- Leaderboard UI ---
const initialsPrompt = document.getElementById('initials-prompt');
const initSlots = [
  document.getElementById('init-0'),
  document.getElementById('init-1'),
  document.getElementById('init-2'),
];
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardBody = document.getElementById('leaderboard-body');

/**
 * Shows the initials prompt and resets all slots to '_' with slot 0 active.
 */
export function showInitialsPrompt() {
  initialsPrompt.classList.remove('hidden');
  leaderboardSection.classList.add('hidden');
  initSlots.forEach((slot, i) => {
    slot.textContent = '_';
    slot.classList.toggle('active', i === 0);
  });
}

/**
 * Updates a single initials slot's character.
 * index: 0–2; char: single character or '_'.
 */
export function setInitialChar(index, char) {
  initSlots[index].textContent = char;
}

/**
 * Updates the active cursor indicator.
 * activeCursor: 0–2 for next-empty slot; 3 = all filled (no active slot).
 */
export function setInitialsCursor(activeCursor) {
  initSlots.forEach((slot, i) => {
    slot.classList.toggle('active', i === activeCursor);
  });
}

/**
 * Hides the initials prompt and shows the leaderboard table.
 * entries: ranked array of {initials, score}; highlightIndex: index to highlight (-1 = none).
 */
export function showLeaderboard(entries, highlightIndex = -1) {
  initialsPrompt.classList.add('hidden');
  leaderboardSection.classList.remove('hidden');
  leaderboardBody.innerHTML = '';
  entries.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('lb-highlight');

    const tdRank = document.createElement('td');
    tdRank.textContent = i + 1;

    const tdName = document.createElement('td');
    tdName.textContent = entry.initials;

    const tdScore = document.createElement('td');
    tdScore.textContent = entry.score.toLocaleString();

    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdScore);
    leaderboardBody.appendChild(tr);
  });
}

/**
 * Resets overlay UI to initial state (hides prompt and leaderboard).
 * Called on restart so the next game-over starts fresh.
 */
export function resetOverlayUI() {
  initialsPrompt.classList.add('hidden');
  leaderboardSection.classList.add('hidden');
}
