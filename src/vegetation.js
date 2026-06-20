// vegetation.js — arbres et rochers low-poly placés procéduralement.
// Tout est rendu via InstancedMesh (1 draw call par type) pour tenir le 60 fps.
// La densité dépend du biome : forêts en clusters sur les zones herbeuses peu
// pentues, rochers plutôt sur les hauteurs et les pentes.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { WORLD, WATER_LEVEL, PALETTE, VEGETATION } from './config.js';
import { heightAt, normalAt, makeRng } from './terrain.js';

const YAXIS = new THREE.Vector3(0, 1, 0);

// --- Helpers de construction de géométrie (couleurs en vertex colors) -------
function colorPart(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const c = new THREE.Color(hex);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function mergeParts(parts) {
  let total = 0;
  for (const g of parts) total += g.getAttribute('position').count;
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const c = g.getAttribute('color');
    position.set(p.array, o * 3);
    normal.set(n.array, o * 3);
    color.set(c.array, o * 3);
    o += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  merged.computeBoundingSphere();
  return merged;
}

// Sapin low-poly : tronc + deux cônes empilés. Base posée à y = 0.
function makeTreeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 1.6, 5);
  trunk.translate(0, 0.8, 0);
  const cone1 = new THREE.ConeGeometry(1.3, 2.2, 7);
  cone1.translate(0, 2.1, 0);
  const cone2 = new THREE.ConeGeometry(0.95, 1.8, 7);
  cone2.translate(0, 3.3, 0);
  return mergeParts([
    colorPart(trunk, PALETTE.trunk),
    colorPart(cone1, PALETTE.leafA),
    colorPart(cone2, PALETTE.leafB),
  ]);
}

// Rocher low-poly : icosaèdre déformé, légèrement aplati.
function makeRockGeometry(rng) {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const f = 0.78 + rng() * 0.5;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.8, pos.getZ(i) * f);
  }
  return colorPart(g, PALETTE.rockProp);
}

// --- Placement --------------------------------------------------------------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();

function buildTrees(material) {
  const rng = makeRng(VEGETATION.treeSeed);
  const forest = createNoise2D(makeRng(VEGETATION.forestSeed));
  const half = WORLD.size / 2 - 4;
  const matrices = [];
  const tints = [];

  let attempts = 0;
  const maxAttempts = VEGETATION.treeCount * 14;
  while (matrices.length < VEGETATION.treeCount && attempts < maxAttempts) {
    attempts++;
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const e = heightAt(x, z);
    if (e < VEGETATION.treeMinAlt || e > VEGETATION.treeMaxAlt) continue;
    const slope = 1 - normalAt(x, z).y;
    if (slope > VEGETATION.treeMaxSlope) continue;

    // Densité par biome : clusters de forêt.
    const f = forest(x * VEGETATION.forestFreq, z * VEGETATION.forestFreq) * 0.5 + 0.5;
    if (rng() > f * f * 1.15) continue;

    const s = 0.7 + rng() * 0.9;
    _pos.set(x, e, z);
    _q.setFromAxisAngle(YAXIS, rng() * Math.PI * 2);
    _scl.set(s, s + rng() * 0.35, s);
    matrices.push(new THREE.Matrix4().compose(_pos, _q, _scl));

    const t = 0.82 + rng() * 0.28;
    tints.push(new THREE.Color(t, t * (0.95 + rng() * 0.1), t * 0.9));
  }

  const mesh = new THREE.InstancedMesh(makeTreeGeometry(), material, matrices.length);
  mesh.name = 'trees';
  for (let i = 0; i < matrices.length; i++) {
    mesh.setMatrixAt(i, matrices[i]);
    mesh.setColorAt(i, tints[i]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildRocks(material) {
  const rng = makeRng(VEGETATION.rockSeed);
  const half = WORLD.size / 2 - 4;
  const matrices = [];

  let attempts = 0;
  const maxAttempts = VEGETATION.rockCount * 16;
  while (matrices.length < VEGETATION.rockCount && attempts < maxAttempts) {
    attempts++;
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const e = heightAt(x, z);
    if (e < WATER_LEVEL + 0.2) continue; // pas dans l'eau
    const slope = 1 - normalAt(x, z).y;

    // Plus probable en altitude et sur les pentes, rare sur les sommets neigeux.
    let p = 0.14;
    if (e > 16) p += 0.25;
    if (slope > 0.4) p += 0.4;
    if (e > 30) p -= 0.22;
    if (rng() > p) continue;

    const s = 0.4 + rng() * 1.2;
    _pos.set(x, e - 0.15 * s, z);
    _euler.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6);
    _q.setFromEuler(_euler);
    _scl.set(s * (0.8 + rng() * 0.5), s, s * (0.8 + rng() * 0.5));
    matrices.push(new THREE.Matrix4().compose(_pos, _q, _scl));
  }

  const mesh = new THREE.InstancedMesh(makeRockGeometry(rng), material, matrices.length);
  mesh.name = 'rocks';
  for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createVegetation(scene) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.85,
    metalness: 0.0,
  });

  const group = new THREE.Group();
  group.name = 'vegetation';
  group.add(buildTrees(material));
  group.add(buildRocks(material));
  scene.add(group);
  return group;
}
