// @ts-check
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  site: 'https://rifate.app',
  output: 'server',
  adapter: vercel(),
  integrations: [icon(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Nunito',
      cssVariable: '--fontsource-nunito',
      weights: [400, 500, 600, 700, 800, 900],
    },
  ],
  redirects: {
    '/dashboard': '/dashboard/raffle',
  },
});
