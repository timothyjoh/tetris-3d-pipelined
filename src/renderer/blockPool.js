import * as THREE from 'three';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

function cellToWorld(col, row) {
  return [
    -BOARD_COLS / 2 + col + 0.5,
     BOARD_ROWS / 2 - row - 0.5,
    0.425,
  ];
}

const _boxGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
const _edgesGeo = new THREE.EdgesGeometry(_boxGeo);

export class BlockPool {
  constructor(scene, maxBlocks = 220) {
    this._entries = [];

    for (let i = 0; i < maxBlocks; i++) {
      // Smoked-glass face — tinted, semi-transparent, doesn't write depth
      // so back edges bleed through faintly
      const faceMat = new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0.18,
        roughness: 0.05,
        metalness: 0.0,
        depthWrite: false,
      });
      const faceMesh = new THREE.Mesh(_boxGeo, faceMat);
      faceMesh.visible = false;
      scene.add(faceMesh);

      // Neon edge outline
      const edgeMat = new THREE.LineBasicMaterial({ transparent: true });
      const edgeMesh = new THREE.LineSegments(_edgesGeo, edgeMat);
      edgeMesh.visible = false;
      scene.add(edgeMesh);

      this._entries.push({ faceMesh, faceMat, edgeMesh, edgeMat });
    }
    this._active = 0;
  }

  begin() { this._active = 0; }

  addBlock(col, row, color, emissiveIntensity = 1.0) {
    if (this._active >= this._entries.length) return;
    const { faceMesh, faceMat, edgeMesh, edgeMat } = this._entries[this._active++];

    const intensity = Math.min(emissiveIntensity, 1.0);
    faceMat.color.setHex(color);
    faceMat.opacity = 0.18 * intensity;

    edgeMat.color.setHex(color);
    edgeMat.opacity = intensity;

    const [x, y, z] = cellToWorld(col, row);
    faceMesh.position.set(x, y, z);
    faceMesh.visible = true;
    edgeMesh.position.set(x, y, z);
    edgeMesh.visible = true;
  }

  end() {
    for (let i = this._active; i < this._entries.length; i++) {
      this._entries[i].faceMesh.visible = false;
      this._entries[i].edgeMesh.visible = false;
    }
  }
}
