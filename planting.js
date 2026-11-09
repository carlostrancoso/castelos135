import * as THREE from './vendor/three.module.js';

export function makePlanting() {
  const planting = new THREE.Group();
  planting.name = 'Árvores dos pátios';
  const up = new THREE.Vector3(0, 1, 0);
  const bark = new THREE.MeshStandardMaterial({color: 0x69513d, roughness: 1});
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const foliage = new THREE.MeshStandardMaterial({roughness: 1});

  function tree(name, position, height, palette, spread, seed) {
    const tree = new THREE.Group();
    tree.name = name;
    tree.position.set(...position);
    planting.add(tree);
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    function branch(from, to, radius) {
      const direction = to.clone().sub(from);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.36, radius, direction.length(), 6), bark
      );
      mesh.position.copy(from).lerp(to, 0.5);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      mesh.castShadow = true;
      tree.add(mesh);
    }
    const clusters = 10;
    const leavesPerCluster = 32;
    const crown = new THREE.InstancedMesh(leaf, foliage, clusters * leavesPerCluster);
    crown.castShadow = true;
    crown.receiveShadow = true;
    tree.add(crown);
    const instance = new THREE.Object3D();
    const origin = new THREE.Vector3();
    const fork = new THREE.Vector3(-0.045, height * 0.43, 0.035);
    branch(origin, fork, height * 0.026);
    for (let i = 0; i < clusters; i++) {
      const angle = i * 2.39996;
      const elevation = 0.63 + (i / (clusters - 1)) * 0.27;
      const radius = spread * (1 - (i / clusters) * 0.68);
      const tip = new THREE.Vector3(Math.cos(angle) * radius, height * elevation, Math.sin(angle) * radius);
      const start = origin.clone().lerp(fork, 0.66 + random() * 0.34);
      const elbow = start.clone().lerp(tip, 0.64);
      elbow.y -= height * 0.08;
      branch(start, elbow, height * 0.009);
      branch(elbow, tip, height * 0.005);
      for (let j = 0; j < leavesPerCluster; j++) {
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * spread * 0.39;
        const size = spread * (0.07 + random() * 0.12);
        instance.position.set(tip.x + Math.cos(angle) * radius,
          tip.y + (random() - 0.5) * height * 0.13, tip.z + Math.sin(angle) * radius);
        instance.rotation.set(random() * 0.9, random() * Math.PI, random() * 0.5);
        instance.scale.set(size * 1.25, size * 0.48, size);
        instance.updateMatrix();
        const index = i * leavesPerCluster + j;
        crown.setMatrixAt(index, instance.matrix);
        crown.setColorAt(index, new THREE.Color(palette[Math.floor(random() * palette.length)]));
      }
    }
  }

  tree('Ácer japonês · pátio da frente', [0.02, 0, -16.32], 1.95,
    [0x7b4437, 0x9b5840, 0x844a43, 0xaa674b, 0x786d47], 0.70, 135);
  tree('Oliveira · pátio do tardoz', [1.03, 0.746, 8.65], 2.15,
    [0x677750, 0x7f8b65, 0x8c9876, 0x5d6e4e, 0xa1a98b], 0.83, 368);
  return planting;
}
