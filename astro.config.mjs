// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Domaine de production (sert aux URLs canoniques, au sitemap et aux balises Open Graph).
const SITE = process.env.SITE_URL || 'https://www.blindagesdefrance.fr';

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      filter: (page) => !/\/(admin|merci|404|selection)(\/|$)/.test(page),
      i18n: undefined,
    }),
  ],
  vite: {
    build: { chunkSizeWarningLimit: 1100 },
    // le worker de MapLibre est un module ES
    worker: { format: 'es' },
  },
});
