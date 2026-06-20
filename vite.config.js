import { defineConfig } from 'vite';

// Configuration minimale : base relative pour que le build soit portable
// (ouvrable depuis n'importe quel sous-dossier ou hébergement statique).
export default defineConfig({
  base: './',
  server: {
    open: false,
  },
});
