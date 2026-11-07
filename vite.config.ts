import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — относительные пути работают на GitHub Pages при любом имени
// репозитория (спека §10.1). Шейдер и react-vendor разложены по чанкам (§9).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) принимает только функциональную форму.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('gsap')) return 'gsap';
          if (id.includes('roughjs') || id.includes('rough-notation')) return 'rough';
          if (id.includes('/react') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
