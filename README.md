<div align="center">

<!-- Banner: replace this line with the image when you have it
![rifate.app](https://image-url)
-->

# [rifate.app](https://rifate.app/)

Raffles sold over WhatsApp, without re-editing the image on every sale.

One permanent link always shows the current grid: the image is not the record, it is a projection of the record.

![GitHub last commit](https://img.shields.io/github/last-commit/mauroviveros/rifate.app?logo=git)
![GitHub Repo stars](https://img.shields.io/github/stars/mauroviveros/rifate.app)
![GitHub watchers](https://img.shields.io/github/watchers/mauroviveros/rifate.app)
![CI](https://img.shields.io/github/actions/workflow/status/mauroviveros/rifate.app/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)

[![Astro](https://img.shields.io/badge/astro-%232C2052.svg?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/cloudflare%20workers-%23F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![D1](https://img.shields.io/badge/cloudflare%20d1-%23F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)

[![Better Auth](https://img.shields.io/badge/better%20auth-%23000000.svg?style=for-the-badge&logo=betterauth&logoColor=white)](https://www.better-auth.com/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%233178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

## 🎟️ What it solves

Running a raffle today means editing an image of the number grid every time a
number is sold, posting it to a WhatsApp status again, and keeping a parallel
notebook of who owns which number. The record and the image drift apart, and the
manual work grows with every sale.

Here the grid is state in the database, and everything else is derived from it:

- **Organizer** — creates the raffle, records sales, confirms orders, runs the draw, and shares a link that never changes.
- **Visitor** — opens the link, sees live status and, on PRO raffles, preselects numbers and creates an order. **Never needs an account.**

## 📦 Requirements

- [Node.js](https://nodejs.org/) _v24_ (minimum supported: _v22.12.0_)
- [pnpm](https://pnpm.io/) _v11.25.0_
- A [Cloudflare](https://dash.cloudflare.com/) account with access to Workers, D1 and Durable Objects
- Google OAuth credentials ([Google Cloud Console](https://console.cloud.google.com/apis/credentials))

## ⚙️ Environments

This project runs on Workers, so local variables do **not** go in a `.env` file
but in `.dev.vars`, which is what `wrangler` reads:

```bash
cp .dev.vars.example .dev.vars
```

| Variable               | Required | What it is used for                         | Where to get it                                                                                                                        |
| :--------------------- | :------: | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   |   Yes    | Signs session cookies and tokens            | `openssl rand -base64 32`. [Better Auth docs](https://www.better-auth.com/docs/installation)                                           |
| `GOOGLE_CLIENT_ID`     |   Yes    | Google login (the only provider)            | Google Cloud Console -> APIs & Services -> Credentials. [Better Auth · Google](https://www.better-auth.com/docs/authentication/google) |
| `GOOGLE_CLIENT_SECRET` |   Yes    | Secret counterpart of the client ID         | Google Cloud Console, same OAuth 2.0 credential                                                                                        |
| `PUBLIC_APP_URL`       |   Yes    | Base URL for links, callbacks and OG images | Local: `http://localhost:4321`. In production it comes from `vars` in [wrangler.jsonc](wrangler.jsonc)                                 |

Google Cloud Console needs one authorized callback URI per environment you sign
in from:

```
http://localhost:4321/api/auth/callback/google
https://rifate.app/api/auth/callback/google
```

Notes:

- **Key names matter more than values**: `wrangler types` builds the `Env` interface by reading `.dev.vars`. If you add a variable, add it to `.dev.vars.example` too or `pnpm check` fails in CI.
- `.dev.vars` is out of version control. Only `.dev.vars.example` is committed.
- In production, secrets are set with `pnpm exec wrangler secret put <VARIABLE>`, not in `wrangler.jsonc`.

## 🚀 Getting started

```bash
pnpm install
cp .dev.vars.example .dev.vars          # then fill in the values
pnpm generate-types                     # generates worker-configuration.d.ts
pnpm exec wrangler d1 migrations apply rifate-db --local
pnpm dev
```

`pnpm install` also wires up the git hooks (`core.hooksPath .githooks`):
`pre-commit` formats whatever is staged, and `pre-push` runs
`lint + check + test` only when the push targets `main`.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                         | Action                                                                     |
| :------------------------------ | :------------------------------------------------------------------------- |
| `pnpm install`                  | Installs dependencies and sets up the git hooks                            |
| `pnpm dev`                      | Starts local dev server at `localhost:4321`                                |
| `pnpm build`                    | Build your production site to `./dist/`                                    |
| `pnpm preview`                  | Preview the build on the Workers runtime                                   |
| `pnpm run deploy`               | `build` + `wrangler deploy`. Needs `run`: `pnpm deploy` is a pnpm built-in |
| `pnpm generate-types`           | Regenerates the binding types (`wrangler types`)                           |
| `pnpm check`                    | Astro and TypeScript type checking                                         |
| `pnpm test` / `pnpm test:watch` | Tests with Vitest on the Workers pool                                      |
| `pnpm lint` / `pnpm lint:fix`   | ESLint                                                                     |
| `pnpm format`                   | Prettier across the repo                                                   |

## 🧱 Infrastructure

Bindings are declared in [wrangler.jsonc](wrangler.jsonc):

| Binding   | Service                   | What for                                                               |
| :-------- | :------------------------ | :--------------------------------------------------------------------- |
| `DB`      | D1 (`rifate-db`)          | Accounts, profiles, raffles, buyers, vouchers                          |
| `RAFFLE`  | Durable Object (`Raffle`) | The number grid: reserve and sell without race conditions              |
| `ASSETS`  | Workers Assets            | Static output of the build (`dist/client`)                             |
| `SESSION` | KV                        | Injected by the Astro adapter; unused today — real sessions live in D1 |

D1 migrations live in [migrations/](migrations); the Durable Object schema in
`src/do/schema.ts`.

## 🗂️ Project structure

```text
/
├── docs/                    # v2 refactor planning docs (Spanish)
├── migrations/              # D1 migrations
├── src/
│   ├── actions/             # Astro Actions (mutations from the client)
│   ├── components/          # Landing, panel, forms and UI (Starwind)
│   ├── do/                  # Raffle Durable Object and its schema
│   ├── layouts/
│   ├── lib/                 # auth · db · raffles (domain and repositories)
│   ├── pages/               # Landing, /panel/*, /api/auth/[...all]
│   └── worker.ts            # Worker entrypoint
├── test/
└── wrangler.jsonc
```

## 📚 Documentation

The full refactor planning lives in [docs/](docs/README.md), written in Spanish:
context and scope, stack, architecture, data model, authorization, flows, phased
roadmap, Cloudflare guide, Durable Objects, Better Auth, and the «Talonario»
design system.

External references: [Astro](https://docs.astro.build) ·
[Cloudflare Workers](https://developers.cloudflare.com/workers/) ·
[D1](https://developers.cloudflare.com/d1/) ·
[Better Auth](https://www.better-auth.com/docs) ·
[Starwind UI](https://starwind.dev/)
