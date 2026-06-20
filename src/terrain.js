// terrain.js — génération procédurale du relief.
//
// Expose :
//   - heightAt(x, z)  : altitude analytique (source de vérité unique, O(1))
//   - normalAt(x, z)  : normale approchée (différences finies) pour la pente
//   - makeRng(seed)   : PRNG déterministe partagé (réutilisé par vegetation.js)
//   - createTerrain() : Group de meshes (un par chunk), flat-shaded, couleurs
//                       par altitude bakées en vertex colors.
//
// Le même heightAt() sert à la fois à mailler le terrain et à la collision du
// joueur : équivalent d'un raycast vers le bas mais sans toucher la géométrie.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { WORLD, WATER_LEVEL, NOISE, PALETTE } from './config.js';

// --- PRNG déterministe (mulberry32) ----------------------------------------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Sources de bruit (déterministes) --------------------------------------
const noiseBase = createNoise2D(makeRng(NOISE.seed));
const noiseWarp = createNoise2D(makeRng(NOISE.warpSeed));
const noiseDetail = createNoise2D(makeRng(NOISE.detailSeed));
const noiseColor = createNoise2D(makeRng(NOISE.colorSeed));

// Bruit fractal (FBM) — somme d'octaves, renvoie ~[-1, 1].
function fbm(x, z) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < NOISE.octaves; o++) {
    sum += amp * noiseBase(x * freq, z * freq);
    norm += amp;
    amp *= NOISE.persistence;
    freq *= NOISE.lacunarity;
  }
  return sum / norm;
}

// --- Altitude analytique ----------------------------------------------------
export function heightAt(x, z) {
  // Domain warp : décale les coordonnées pour des contours moins « réguliers ».
  const wx = x + NOISE.warpAmp * noiseWarp(x * NOISE.warpFreq, z * NOISE.warpFreq);
  const wz =
    z + NOISE.warpAmp * noiseWarp(x * NOISE.warpFreq + 5.2, z * NOISE.warpFreq + 1.3);

  let h = fbm(wx * NOISE.baseFreq, wz * NOISE.baseFreq); // [-1, 1]

  // Redistribution : plaines plus plates, reliefs plus marqués.
  const shaped = Math.sign(h) * Math.pow(Math.abs(h), NOISE.exponent);
  let e = shaped * NOISE.hillHeight + NOISE.lift;

  // Plateaux : terrassement progressif au-dessus d'une altitude.
  if (e > NOISE.terraceStart) {
    const terraced = Math.round(e / NOISE.terraceStep) * NOISE.terraceStep;
    e = e * (1 - NOISE.terraceStrength) + terraced * NOISE.terraceStrength;
  }

  // Micro-relief pour casser la régularité des facettes.
  e += noiseDetail(x * NOISE.detailFreq, z * NOISE.detailFreq) * NOISE.detailAmp;
  return e;
}

// Normale approchée par différences finies (sert à la pente : végétation,
// teinte des falaises, choix de spawn du joueur).
const _n = new THREE.Vector3();
export function normalAt(x, z) {
  const e = 0.6;
  const hL = heightAt(x - e, z);
  const hR = heightAt(x + e, z);
  const hD = heightAt(x, z - e);
  const hU = heightAt(x, z + e);
  return _n.set(hL - hR, 2 * e, hD - hU).normalize().clone();
}

// --- Dégradé de couleur par altitude ---------------------------------------
// Bandes avec recouvrements → transitions douces (sable → herbe → roche → neige).
function lin(hex) {
  return new THREE.Color(hex); // ColorManagement actif → valeurs linéaires
}
const STOPS = [
  { h: -100, c: lin(PALETTE.sandDeep) },
  { h: -2.0, c: lin(PALETTE.sand) },
  { h: 2.0, c: lin(PALETTE.sand) },
  { h: 4.5, c: lin(PALETTE.grass) },
  { h: 15.0, c: lin(PALETTE.grass) },
  { h: 19.0, c: lin(PALETTE.rock) },
  { h: 27.0, c: lin(PALETTE.rock) },
  { h: 31.0, c: lin(PALETTE.snow) },
  { h: 100.0, c: lin(PALETTE.snow) },
];
const C_ROCK = lin(PALETTE.rock);
const C_GRASS_DARK = lin(PALETTE.grassDark);

// Écrit dans `target` la couleur de base correspondant à l'altitude.
function gradientColor(e, target) {
  if (e <= STOPS[0].h) return target.copy(STOPS[0].c);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (e <= b.h) {
      const t = (e - a.h) / (b.h - a.h);
      return target.copy(a.c).lerp(b.c, t);
    }
  }
  return target.copy(STOPS[STOPS.length - 1].c);
}

const _col = new THREE.Color();
// Couleur finale d'une facette : dégradé + patches d'herbe + falaises rocheuses
// + léger jitter de luminosité.
function faceColor(x, z, e, slope, jitter, target) {
  gradientColor(e, target);

  // Patches d'herbe plus sombre (zone herbeuse seulement).
  if (e > 3 && e < 17) {
    const g = noiseColor(x * NOISE.colorFreq, z * NOISE.colorFreq) * 0.5 + 0.5;
    target.lerp(C_GRASS_DARK, g * 0.45);
  }

  // Falaises : au-delà d'une certaine pente, la roche affleure.
  if (slope > 0.6 && e > 2) {
    const k = Math.min(1, (slope - 0.6) / 0.3);
    target.lerp(C_ROCK, k);
  }

  // Jitter de luminosité par facette.
  target.offsetHSL(0, 0, (jitter - 0.5) * 0.06);
  return target;
}

// --- Construction d'un chunk ------------------------------------------------
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _fn = new THREE.Vector3();

function buildChunkGeometry(originX, originZ) {
  const seg = WORLD.segments;
  const size = WORLD.chunkSize;
  const step = size / seg;
  const quads = seg * seg;
  const verts = quads * 6; // 2 triangles, 3 sommets

  const positions = new Float32Array(verts * 3);
  const colors = new Float32Array(verts * 3);
  let o = 0;

  // Pousse un triangle (winding corrigé pour que la normale pointe vers le haut),
  // calcule sa couleur de facette et l'applique à ses 3 sommets.
  const pushTri = (ax, az, bx, bz, cx, cz) => {
    const ay = heightAt(ax, az);
    const by = heightAt(bx, bz);
    const cy = heightAt(cx, cz);

    _a.set(bx - ax, by - ay, bz - az);
    _b.set(cx - ax, cy - ay, cz - az);
    _fn.copy(_a).cross(_b).normalize();
    // Garantit une face supérieure : on inverse l'ordre si la normale descend.
    let p1x = bx, p1z = bz, p1y = by;
    let p2x = cx, p2z = cz, p2y = cy;
    if (_fn.y < 0) {
      p1x = cx; p1z = cz; p1y = cy;
      p2x = bx; p2z = bz; p2y = by;
      _fn.negate();
    }

    const slope = 1 - Math.abs(_fn.y);
    const avgH = (ay + by + cy) / 3;
    const jitter = (Math.sin(ax * 12.9898 + az * 78.233) * 43758.5453) % 1;
    faceColor((ax + bx + cx) / 3, (az + bz + cz) / 3, avgH, slope, Math.abs(jitter), _col);

    const px = [ax, p1x, p2x];
    const py = [ay, p1y, p2y];
    const pz = [az, p1z, p2z];
    for (let k = 0; k < 3; k++) {
      positions[o] = px[k];
      positions[o + 1] = py[k];
      positions[o + 2] = pz[k];
      colors[o] = _col.r;
      colors[o + 1] = _col.g;
      colors[o + 2] = _col.b;
      o += 3;
    }
  };

  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const x0 = originX + i * step;
      const z0 = originZ + j * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      // Quad (x0,z0)-(x1,z0)-(x1,z1)-(x0,z1) → 2 triangles.
      pushTri(x0, z0, x1, z0, x1, z1);
      pushTri(x0, z0, x1, z1, x0, z1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// --- API : terrain complet en chunks ---------------------------------------
export function createTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
  });

  const n = WORLD.chunksPerSide;
  const half = WORLD.size / 2;
  for (let cz = 0; cz < n; cz++) {
    for (let cx = 0; cx < n; cx++) {
      const ox = -half + cx * WORLD.chunkSize;
      const oz = -half + cz * WORLD.chunkSize;
      const geo = buildChunkGeometry(ox, oz);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  scene.add(group);
  return group;
}
