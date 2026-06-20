// world.js — orchestration du contenu du monde : terrain (chunks), eau et
// végétation. Regroupe leur création et expose un update() global, pour que
// main.js reste de la pure glu.

import { createTerrain } from './terrain.js';
import { createWater } from './water.js';
import { createVegetation } from './vegetation.js';

export function createWorld(scene) {
  const terrain = createTerrain(scene);
  const vegetation = createVegetation(scene);
  const water = createWater(scene);

  return {
    terrain,
    vegetation,
    water,
    update(time) {
      water.update(time); // anime les vagues
    },
  };
}
