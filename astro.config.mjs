// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import icon from "astro-icon";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
    site: "https://rifate.app",
  output: 'server',
  adapter: vercel(),
  integrations: [icon(), react()],
  vite: {
    plugins: [tailwindcss()]
  },
  fonts: [{
    provider: fontProviders.fontsource(),
    name: "Nunito",
    cssVariable: "--fontsource-nunito",
    weights: [400, 500, 600, 700, 800, 900]
  }],
  redirects: {
    "/dashboard": "/dashboard/raffle"
  }
});
