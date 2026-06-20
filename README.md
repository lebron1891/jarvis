# Mini Monde 3D

Un petit monde 3D explorable en **first-person** dans le navigateur, généré
procéduralement, en style **low-poly** assumé. Three.js + Vite, JavaScript vanilla.

![stack](https://img.shields.io/badge/three.js-r169-blue) ![vite](https://img.shields.io/badge/vite-5-purple)

## Démarrage

```bash
npm install
npm run dev
```

Vite affiche une URL locale (par défaut `http://localhost:5173`). Ouvre-la,
**clique sur la fenêtre** pour capturer la souris, et explore.

Autres commandes :

```bash
npm run build     # build de production dans dist/
npm run preview   # sert le build de production
```

## Contrôles

| Touche            | Action              |
| ----------------- | ------------------- |
| **Z Q S D**       | Se déplacer (AZERTY ; WASD et flèches fonctionnent aussi) |
| **Souris**        | Regarder            |
| **Maj (Shift)**   | Courir              |
| **Espace**        | Sauter              |
| **Clic**          | Capturer la souris (pointer lock) |
| **Échap**         | Libérer la souris   |

Les coordonnées du joueur s'affichent en bas à gauche.

## Ce que contient le monde

- **Terrain procédural** (bruit Simplex + FBM + domain warp) : vallées, collines,
  plateaux. Monde de 500 × 500 unités généré en 25 chunks.
- **Style low-poly** : flat shading, facettes visibles, palette limitée — sable,
  herbe, roche, neige selon l'altitude (et les falaises selon la pente).
- **Eau** plate translucide à l'altitude 0, avec un léger mouvement de vagues.
- **Ciel** en dégradé + **brouillard** atmosphérique pour masquer le clipping.
- **Soleil** directionnel avec ombres douces et disque solaire lumineux.
- **Arbres et rochers** low-poly placés procéduralement (densité par biome),
  rendus en instancing.
- **Post-processing** : bloom léger, tonemapping ACES, vignettage subtil.

## Architecture

Un fichier par système, sans God-class :

```
src/
├── main.js        Bootstrap (renderer, scène, caméra, boucle, resize)
├── config.js      Constantes partagées (palette, tailles, bruit, joueur…)
├── terrain.js     FBM Simplex → mesh low-poly, heightAt() / normalAt()
├── world.js       Orchestration : terrain + eau + végétation, update global
├── water.js       Nappe d'eau translucide + vagues (vertex shader)
├── vegetation.js  Arbres & rochers low-poly (InstancedMesh, densité biome)
├── sky.js         Dôme dégradé, brouillard, soleil + ombres
├── player.js      Contrôleur FPS (ZQSD, souris, gravité, collision)
├── effects.js     Post-processing (bloom + ACES + vignette)
└── hud.js         Crosshair + coordonnées + overlay d'aide
```

### Notes techniques

- **Collision** : le joueur échantillonne `heightAt(x, z)` (l'altitude analytique
  qui sert aussi à mailler le terrain). C'est l'équivalent d'un raycast vertical,
  mais en O(1) et sans dépendre de la géométrie.
- **Performance (cible 60 fps)** : terrain en chunks (frustum culling natif),
  brouillard qui borne la distance de rendu, végétation en **InstancedMesh**
  (1 draw call par type), flat shading peu coûteux, shadow-camera qui suit le
  joueur. À l'échelle 500 × 500 tous les chunks sont générés au chargement.

### Réglages

Presque tout se tune dans `src/config.js` : palette, amplitude/fréquence du
relief, densité de végétation, brouillard, vitesses du joueur, intensité du
bloom, etc.
