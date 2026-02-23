import * as THREE from 'three';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const camera = buildCamera(canvas);

  window.addEventListener('resize', () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    updateCamera(camera, canvas);
  });

  return { renderer, scene, camera };
}

function buildCamera(canvas) {
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const vHeight = BOARD_ROWS + 4;
  const vWidth = vHeight * aspect;
  const camera = new THREE.OrthographicCamera(
    -vWidth / 2, vWidth / 2,
    vHeight / 2, -vHeight / 2,
    0.1, 100
  );
  camera.position.z = 10;
  return camera;
}

function updateCamera(camera, canvas) {
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const vHeight = BOARD_ROWS + 4;
  const vWidth = vHeight * aspect;
  camera.left   = -vWidth / 2;
  camera.right  =  vWidth / 2;
  camera.top    =  vHeight / 2;
  camera.bottom = -vHeight / 2;
  camera.updateProjectionMatrix();
}
