import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,
    0.4,
    0.82,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return composer;
}

export function createGridLines(parent) {
  const positions = [];
  const halfCols = BOARD_COLS / 2;
  const halfRows = BOARD_ROWS / 2;

  for (let c = 0; c <= BOARD_COLS; c++) {
    const x = -halfCols + c;
    positions.push(x, halfRows, 0.02, x, -halfRows, 0.02);
  }
  for (let r = 0; r <= BOARD_ROWS; r++) {
    const y = halfRows - r;
    positions.push(-halfCols, y, 0.02, halfCols, y, 0.02);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({
    color: 0x0a3a3a,
    opacity: 0.5,
    transparent: true,
  });

  const lines = new THREE.LineSegments(geo, mat);
  parent.add(lines);
  return lines;
}

export function createBoardBackground(parent) {
  const geo = new THREE.PlaneGeometry(BOARD_COLS, BOARD_ROWS);
  const mat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.z = -0.05;
  parent.add(plane);
  return plane;
}
