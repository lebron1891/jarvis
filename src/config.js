// config.js — constantes partagées entre tous les systèmes.
// Tout ce qui se tune (taille du monde, bruit, palette, joueur, brouillard…)
// vit ici pour garder les autres modules focalisés sur leur logique.

// --- Monde / chunks ---------------------------------------------------------
export const WORLD = {
  size: 500, // monde de 500 x 500 unités, centré sur l'origine
  chunkSize: 100, // taille d'un chunk (5 x 5 = 25 chunks)
  chunksPerSide: 5,
  segments: 48, // subdivisions par chunk (≈ 2 u par facette → low-poly visible)
};

export const WATER_LEVEL = 0;

// --- Génération procédurale (bruit Simplex + FBM + domain warp) -------------
export const NOISE = {
  seed: 1337,
  warpSeed: 99,
  detailSeed: 7,
  colorSeed: 451,

  baseFreq: 0.0065, // fréquence du relief principal
  octaves: 5,
  lacunarity: 2.0,
  persistence: 0.5,

  warpFreq: 0.005, // déformation du domaine → formes plus organiques
  warpAmp: 28,

  exponent: 1.5, // > 1 : aplatit les plaines, accentue les reliefs
  hillHeight: 44, // amplitude verticale
  lift: 4, // remonte le terrain pour avoir surtout des terres émergées

  terraceStart: 16, // altitude à partir de laquelle on crée des plateaux
  terraceStep: 7,
  terraceStrength: 0.4,

  detailFreq: 0.05, // micro-relief
  detailAmp: 1.0,

  colorFreq: 0.03, // variation de teinte de l'herbe (patches)
};

// --- Palette « Jour clair » -------------------------------------------------
export const PALETTE = {
  skyTop: '#3E78C2',
  skyHorizon: '#CFE3F2',
  fog: '#CFE3F2',
  sun: '#FFF6E5',
  ground: '#6B5B3E', // rebond de lumière (hémisphère, sol)

  sandDeep: '#C9B888', // sable immergé (un peu plus sombre)
  sand: '#E2D2A2',
  grass: '#7DA85A',
  grassDark: '#5C8443',
  rock: '#8B8377',
  snow: '#F4F2EC',
  water: '#2A7B9B',

  trunk: '#6B4E32',
  leafA: '#4F7A3A',
  leafB: '#3E6630',
  rockProp: '#7E7A70',
};

// --- Brouillard atmosphérique ----------------------------------------------
export const FOG = { near: 70, far: 330 };

// --- Soleil / ciel / ombres -------------------------------------------------
export const SKY = {
  radius: 600, // rayon du dôme céleste
  sunDir: { x: -0.55, y: 0.82, z: -0.3 }, // direction depuis laquelle vient le soleil
  sunIntensity: 2.6,
  hemiIntensity: 0.55,
  exponent: 0.7, // courbure du dégradé ciel
  shadowMapSize: 2048,
  shadowExtent: 90, // demi-largeur de la shadow-camera (suit le joueur)
};

// --- Joueur -----------------------------------------------------------------
export const PLAYER = {
  eyeHeight: 1.7,
  walkSpeed: 6,
  runSpeed: 11,
  jumpSpeed: 7,
  gravity: 22,
  lookSensitivity: 0.0022,
  startHeightOffset: 2,
};

// --- Végétation -------------------------------------------------------------
export const VEGETATION = {
  treeSeed: 24,
  rockSeed: 88,
  forestSeed: 305,
  treeCount: 1300,
  rockCount: 520,
  treeMinAlt: 1.5,
  treeMaxAlt: 18,
  treeMaxSlope: 0.55,
  forestFreq: 0.02, // basse fréquence → clusters de forêts
};

// --- Post-processing --------------------------------------------------------
export const POST = {
  bloomIntensity: 0.7,
  bloomThreshold: 0.75,
  bloomSmoothing: 0.3,
  bloomRadius: 0.62,
  vignetteOffset: 0.32,
  vignetteDarkness: 0.55,
};
