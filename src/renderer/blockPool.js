import * as THREE from 'three';
import { BOARD_COLS, BOARD_ROWS } from '../engine/board.js';

function cellToWorld(col, row) {
  return [
    -BOARD_COLS / 2 + col + 0.5,
     BOARD_ROWS / 2 - row - 0.5,
    0.1,
  ];
}

export class BlockPool {
  constructor(scene, maxBlocks = 220) {
    const geo = new THREE.BoxGeometry(0.95, 0.95, 0.1);
    this._entries = [];

    for (let i = 0; i < maxBlocks; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this._entries.push({ mesh, mat });
    }
    this._active = 0;
  }

  begin() { this._active = 0; }

  addBlock(col, row, color, emissiveIntensity = 0.6) {
    if (this._active >= this._entries.length) return;
    const { mesh, mat } = this._entries[this._active++];
    mat.color.setHex(color);
    mat.emissive.setHex(color);
    mat.emissiveIntensity = emissiveIntensity;
    const [x, y, z] = cellToWorld(col, row);
    mesh.position.set(x, y, z);
    mesh.visible = true;
  }

  end() {
    for (let i = this._active; i < this._entries.length; i++) {
      this._entries[i].mesh.visible = false;
    }
  }
}
