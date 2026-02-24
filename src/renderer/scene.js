import * as THREE from 'three';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 10);
  scene.add(dirLight);

  const camera = buildCamera(canvas);

  window.addEventListener('resize', () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    updateCamera(camera, canvas);
  });

  return { renderer, scene, camera };
}

function buildCamera(canvas) {
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
  camera.position.z = 26;
  return camera;
}

function updateCamera(camera, canvas) {
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
