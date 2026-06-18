<div align="center">

# RifateApp

Community raffle organizer — create raffles, sell numbers, and share progress with your buyers.

Ideal for neighborhoods, schools, clubs, and events.

![GitHub last commit](https://img.shields.io/github/last-commit/mauroviveros/rifate.app?logo=git)
![GitHub License](https://img.shields.io/github/license/mauroviveros/rifate.app?logo=github)
![GitHub Repo stars](https://img.shields.io/github/stars/mauroviveros/rifate.app)
![GitHub watchers](https://img.shields.io/github/watchers/mauroviveros/rifate.app)

[![Astro](https://img.shields.io/badge/astro-%232C2052.svg?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

[![Shadcn/ui](https://img.shields.io/badge/shadcn/ui-%23000000?style=for-the-badge&logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

## 📦 Requirements

- [NodeJS](https://nodejs.org/) _v22+_
- [PNPM](https://pnpm.io/) _v11+_

## ⚙️ Environments

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Then define the following variables:

| Variable | Required | What it is used for | Where to get it |
| :-- | :--: | :-- | :-- |
| `PUBLIC_SUPABASE_URL` | Yes | Supabase project URL used in browser/server clients | Supabase Dashboard -> Project Settings -> API. [Supabase docs](https://supabase.com/docs/guides/getting-started/quickstarts/astro) |
| `PUBLIC_SUPABASE_KEY` | Yes | Supabase anonymous public key for client-side requests | Supabase Dashboard -> Project Settings -> API (`anon` key). [Supabase API keys](https://supabase.com/docs/guides/api/api-keys) |

Notes:

- Keep `.env` out of version control (only commit `.env.example`).
- If you deploy on Vercel, define the same variables in Project Settings -> Environment Variables.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command | Action |
| :-- | :-- |
| `pnpm install` | Installs dependencies |
| `pnpm dev` | Starts local dev server at `localhost:4321` |
| `pnpm build` | Build your production site to `./dist/` |
| `pnpm preview` | Preview your build locally, before deploying |
| `pnpm lint` | Run ESLint with Prettier formatting |
| `pnpm supabase ...` | Run Supabase CLI commands |
