// main.js — bootstrap : renderer / scène / caméra, montage de chaque système,
// boucle d'animation et resize. Pas de logique métier ici, juste de la glu.

import * as THREE from 'three';
import { SKY } from './config.js';
import { createSky } from './sky.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';

const app = document.getElementById('app');

// --- Renderer (l'antialiasing est géré par le composer en MSAA) -------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping; // ACES est appliqué en post-processing
app.appendChild(renderer.domElement);

// --- Scène / caméra ---------------------------------------------------------
const scene = new THREE.Scene();
// far > rayon du dôme céleste pour qu'il reste rendu.
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  SKY.radius + 100
);

// --- Systèmes ---------------------------------------------------------------
const hud = createHud();
const sky = createSky(scene);
const world = createWorld(scene);
const player = createPlayer({
  camera,
  domElement: renderer.domElement,
  onLockChange: (locked) => hud.setLocked(locked),
});
const effects = createEffects(renderer, scene, camera);

// --- Boucle -----------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  player.update(dt);
  const pos = camera.position;
  sky.update(camera, pos);
  world.update(time);
  hud.update(pos);

  effects.render();
}
animate();

// --- Resize -----------------------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  effects.setSize(w, h);
});
