// @ts-check
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  site: 'https://rifate.app',
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    icon({
      include: {
        lucide: [
          'arrow-left',
          'arrow-right',
          'circle-alert',
          'calendar',
          'check',
          'chevron-down',
          'circle-alert',
          'clock',
          'house',
          'loader-circle',
          'log-out',
          'mail',
          'message-circle',
          'plus',
          'share-2',
          'ticket',
        ],
        logos: ['google-icon'],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Bricolage Grotesque',
      cssVariable: '--googlefont-bricolage',
      weights: [700, 800],
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Figtree',
      cssVariable: '--googlefont-figtree',
      weights: [400, 600, 700, 800],
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
  ],
  redirects: { '/login': '/ingresar' },
});
