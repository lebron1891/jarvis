// player.js — contrôleur first-person.
//   - Déplacement ZQSD (AZERTY) + alias WASD/flèches, Shift pour courir,
//     Espace pour sauter.
//   - Souris pour regarder (pointer lock au clic sur le canvas).
//   - Gravité + collision simple avec le terrain via heightAt() (équivaut à un
//     raycast vers le bas, en O(1)).

import * as THREE from 'three';
import { PLAYER, WATER_LEVEL } from './config.js';
import { heightAt, normalAt } from './terrain.js';

// Cherche un point de spawn agréable : émergé et peu pentu, en spirale depuis
// l'origine. Repli sur l'origine si rien trouvé.
function findSpawn() {
  for (let r = 0; r < 220; r += 6) {
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const e = heightAt(x, z);
      if (e > WATER_LEVEL + 2 && 1 - normalAt(x, z).y < 0.35) return { x, z, e };
    }
  }
  return { x: 0, z: 0, e: heightAt(0, 0) };
}

export function createPlayer({ camera, domElement, onLockChange }) {
  camera.rotation.order = 'YXZ';

  const spawn = findSpawn();
  let px = spawn.x;
  let pz = spawn.z;
  let py = spawn.e + PLAYER.eyeHeight + PLAYER.startHeightOffset;
  let yaw = 0;
  let pitch = 0;
  let vy = 0;
  let onGround = false;
  let locked = false;

  const keys = { fwd: false, back: false, left: false, right: false, run: false, jump: false };

  camera.position.set(px, py, pz);
  camera.rotation.set(0, 0, 0);

  // --- Pointer lock ---------------------------------------------------------
  domElement.addEventListener('click', () => {
    if (!locked) domElement.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === domElement;
    if (onLockChange) onLockChange(locked);
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    yaw -= e.movementX * PLAYER.lookSensitivity;
    pitch -= e.movementY * PLAYER.lookSensitivity;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
  });

  // --- Clavier (par caractère → AZERTY ZQSD et QWERTY WASD marchent) --------
  const setKey = (e, down) => {
    switch (e.key.toLowerCase()) {
      case 'z':
      case 'w':
      case 'arrowup':
        keys.fwd = down;
        break;
      case 's':
      case 'arrowdown':
        keys.back = down;
        break;
      case 'q':
      case 'a':
      case 'arrowleft':
        keys.left = down;
        break;
      case 'd':
      case 'arrowright':
        keys.right = down;
        break;
      case 'shift':
        keys.run = down;
        break;
    }
    if (e.code === 'Space') {
      keys.jump = down;
      e.preventDefault();
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', (e) => setKey(e, true));
  window.addEventListener('keyup', (e) => setKey(e, false));

  // --- Boucle ---------------------------------------------------------------
  function update(dt) {
    const speed = keys.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const fwd = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
    const str = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    // avant = (-sinY, 0, -cosY) ; droite = (cosY, 0, -sinY)
    let dx = -sinY * fwd + cosY * str;
    let dz = -cosY * fwd - sinY * str;
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx /= len;
      dz /= len;
      px += dx * speed * dt;
      pz += dz * speed * dt;
    }

    // Gravité + saut.
    vy -= PLAYER.gravity * dt;
    if (keys.jump && onGround) {
      vy = PLAYER.jumpSpeed;
      onGround = false;
    }
    py += vy * dt;

    // Collision sol (raycast vertical analytique).
    const groundY = heightAt(px, pz) + PLAYER.eyeHeight;
    if (py <= groundY) {
      py = groundY;
      vy = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    camera.position.set(px, py, pz);
    camera.rotation.set(pitch, yaw, 0);
  }

  return {
    update,
    get position() {
      return camera.position;
    },
  };
}
