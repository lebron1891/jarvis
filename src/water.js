// water.js — nappe d'eau plate, translucide, à l'altitude 0.
// Léger mouvement via un vertex shader simple (somme de sinus injectée dans
// le MeshStandardMaterial avec onBeforeCompile, pour garder l'éclairage du soleil
// et le reflet spéculaire qui alimente le bloom).

import * as THREE from 'three';
import { WORLD, WATER_LEVEL, PALETTE } from './config.js';

export function createWater(scene) {
  const size = WORLD.size + 60;
  const geo = new THREE.PlaneGeometry(size, size, 96, 96);
  geo.rotateX(-Math.PI / 2); // passe dans le plan horizontal (XZ)

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.water),
    transparent: true,
    opacity: 0.8,
    roughness: 0.12,
    metalness: 0.1,
    depthWrite: false, // laisse voir le fond immergé sans z-fighting au rivage
  });

  let shaderRef = null;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shaderRef = shader;
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float w =
             sin(position.x * 0.15 + uTime * 1.2) * 0.18
           + cos(position.z * 0.13 - uTime * 1.0) * 0.18
           + sin((position.x + position.z) * 0.07 + uTime * 0.6) * 0.22;
         transformed.y += w;`
      );
  };

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = WATER_LEVEL - 0.02;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  scene.add(mesh);

  return {
    mesh,
    update(time) {
      if (shaderRef) shaderRef.uniforms.uTime.value = time;
    },
  };
}
