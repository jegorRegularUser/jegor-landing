import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/* SPA: <img> LCP-портрета появляется только после гидрации React — preload
   из <head> сокращает хвост загрузки LCP. Имена ассетов хэшируются билдом,
   поэтому <link> вклеивает transformIndexHtml по факту готового бандла
   (только портрет.avif: его и выберет <picture>; второй preload = лишний
   запрос). В dev — no-op. */
function preloadHeroPortrait(): Plugin {
  let base = '/';
  return {
    name: 'preload-hero-portrait',
    apply: 'build',
    configResolved(cfg) {
      base = cfg.base;
    },
    transformIndexHtml(html, ctx) {
      const avif = ctx.bundle
        ? Object.keys(ctx.bundle).find((k) => /^assets\/portrait-[^.]+\.avif$/.test(k))
        : undefined;
      if (!avif) return html;
      // base './' обязателен: на GitHub Pages страница живёт в подпути репо,
      // а Vite не ребейзит href, вклеенный вручную (только известные теги).
      return html.replace(
        '</head>',
        `    <link rel="preload" as="image" href="${base}${avif}" fetchpriority="high" />\n  </head>`,
      );
    },
  };
}

// base './' — относительные пути работают на GitHub Pages при любом имени
// репозитория (спека §10.1). Шейдер и react-vendor разложены по чанкам (§9).
export default defineConfig({
  base: './',
  plugins: [react(), preloadHeroPortrait()],
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
