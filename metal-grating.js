import * as THREE from './vendor/three.module.js';

// Rhino objects with Metal_Pattern materials, plus the solid proxy behind the door infill.
const grilles = new Set([
  'Rhino_2f513e5c-e65b-436c-a49a-501a55efa0b9',
  'Rhino_e9034d3f-cb7b-4794-929e-b9abc80d788c',
  'Rhino_fbdd9b87-1f2a-45a6-8fe0-f89f46e02034',
]);
export const gratingDoorProxy = 'Rhino_ce44791f-2c74-4c8f-8841-df2672b84c8c';

const resolution = 64;
const pitch = 0.05;
const mask = new Uint8Array(resolution * resolution * 4);
for (let y = 0; y < resolution; y++) {
  for (let x = 0; x < resolution; x++) {
    const bar = Math.min(x, resolution - 1 - x, y, resolution - 1 - y) < 6;
    mask.fill(bar ? 255 : 0, (y * resolution + x) * 4, (y * resolution + x + 1) * 4);
  }
}
const alphaMap = new THREE.DataTexture(mask, resolution, resolution);
alphaMap.wrapS = alphaMap.wrapT = THREE.RepeatWrapping;
alphaMap.generateMipmaps = true;
alphaMap.minFilter = THREE.LinearMipmapLinearFilter;
alphaMap.magFilter = THREE.LinearFilter;
alphaMap.anisotropy = 8;
alphaMap.needsUpdate = true;

export function applyMetalGrating(mesh) {
  if (!grilles.has(mesh.name)) return;
  const indexed = mesh.geometry;
  const geometry = indexed.toNonIndexed();
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const [a, b, c, normal, tangent, up] = Array.from({length: 6}, () => new THREE.Vector3());
  up.y = 1;
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, i + 1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, i + 2).applyMatrix4(mesh.matrixWorld);
    normal.subVectors(b, a).cross(tangent.subVectors(c, a)).normalize();
    const horizontal = Math.abs(normal.y) > 0.7;
    tangent.crossVectors(up, normal).normalize();
    // Give opposite faces the same projection so the holes line up.
    if (tangent.x < -0.0001 || (Math.abs(tangent.x) <= 0.0001 && tangent.z < 0)) tangent.negate();
    for (const [j, point] of [a, b, c].entries()) {
      uv[2 * (i + j)] = (horizontal ? point.x : point.dot(tangent)) / pitch;
      uv[2 * (i + j) + 1] = (horizontal ? point.z : point.y) / pitch;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  mesh.geometry = geometry;
  indexed.dispose();
  Object.assign(mesh.material, {alphaMap, alphaTest: 0.25, metalness: 0.55, roughness: 0.45});
}
