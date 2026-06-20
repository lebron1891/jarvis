// effects.js — pipeline de post-processing (lib pmndrs/postprocessing).
//   - Bloom léger sur les zones lumineuses (soleil, neige, reflets sur l'eau)
//   - Tonemapping ACES filmique
//   - Vignettage subtil (appliqué en dernier, en espace écran)
// Le rendu HDR (HalfFloat) + MSAA donne un bloom propre et des arêtes nettes.

import { HalfFloatType } from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { POST } from './config.js';

export function createEffects(renderer, scene, camera) {
  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: Math.min(4, renderer.capabilities.maxSamples),
  });

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: POST.bloomIntensity,
    luminanceThreshold: POST.bloomThreshold,
    luminanceSmoothing: POST.bloomSmoothing,
    radius: POST.bloomRadius,
    mipmapBlur: true,
  });

  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

  const vignette = new VignetteEffect({
    offset: POST.vignetteOffset,
    darkness: POST.vignetteDarkness,
  });

  // Ordre : bloom (HDR) → ACES → vignette (écran).
  composer.addPass(new EffectPass(camera, bloom, toneMapping, vignette));

  return {
    render() {
      composer.render();
    },
    setSize(w, h) {
      composer.setSize(w, h);
    },
  };
}
