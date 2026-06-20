// sky.js — ambiance : dôme céleste en dégradé, brouillard atmosphérique,
// lumière hémisphérique + soleil directionnel avec ombres douces, et un disque
// solaire lumineux (source de bloom). Le ciel suit la caméra, la shadow-camera
// du soleil suit le joueur pour des ombres nettes autour de lui.

import * as THREE from 'three';
import { SKY, FOG, PALETTE } from './config.js';

export function createSky(scene) {
  const topColor = new THREE.Color(PALETTE.skyTop);
  const horizonColor = new THREE.Color(PALETTE.skyHorizon);

  // --- Dôme en dégradé ------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(SKY.radius, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: topColor },
      horizonColor: { value: horizonColor },
      exponent: { value: SKY.exponent },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform float exponent;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        float t = pow(h, exponent);
        gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // --- Brouillard (couleur = horizon → masque le clipping lointain) ---------
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), FOG.near, FOG.far);

  // --- Lumières -------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(
    new THREE.Color(PALETTE.skyHorizon),
    new THREE.Color(PALETTE.ground),
    SKY.hemiIntensity
  );
  scene.add(hemi);

  const sunDir = new THREE.Vector3(SKY.sunDir.x, SKY.sunDir.y, SKY.sunDir.z).normalize();
  const sun = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), SKY.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SKY.shadowMapSize, SKY.shadowMapSize);
  const d = SKY.shadowExtent;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);

  // --- Disque solaire (billboard lumineux pour le bloom) --------------------
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: new THREE.Color().setRGB(2.4, 2.1, 1.7), // HDR > 1 → franchit le seuil bloom
      fog: false,
      depthWrite: false,
      transparent: true,
    })
  );
  sunSprite.scale.setScalar(44);
  sunSprite.frustumCulled = false;
  scene.add(sunSprite);

  const sunOffset = sunDir.clone().multiplyScalar(220);
  const spriteOffset = sunDir.clone().multiplyScalar(SKY.radius * 0.85);

  return {
    sun,
    update(camera, playerPos) {
      // Le ciel reste centré sur la caméra (on n'atteint jamais le bord).
      sky.position.copy(camera.position);
      sunSprite.position.copy(camera.position).add(spriteOffset);
      // La shadow-camera suit le joueur.
      sun.position.copy(playerPos).add(sunOffset);
      sun.target.position.copy(playerPos);
    },
  };
}
