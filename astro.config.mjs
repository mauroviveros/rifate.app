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
          'ban',
          'calendar',
          'check',
          'chevron-down',
          'circle-alert',
          'circle-x',
          'clock',
          'copy',
          'house',
          'image-down',
          'loader-circle',
          'lock',
          'log-out',
          'mail',
          'message-circle',
          'pencil',
          'phone',
          'plus',
          'rotate-ccw',
          'share-2',
          'sparkles',
          'ticket',
          'trash-2',
          'triangle-alert',
          'trophy',
          'x',
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
