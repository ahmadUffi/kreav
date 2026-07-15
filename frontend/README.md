# Kreav — Frontend

The web app for **Kreav**, a programmable settlement layer for digital-product creators powered by Stellar. This is the full Kreav surface — a neobrutalist **marketing landing** page plus the **creator app** (store, product detail, onboarding/signup, wallet connect + cash-out, creator dashboard, and public Linktree-style mini-site). It is the frontend of a settlement layer, **not** a marketplace/social platform.

## Stack
- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (no config file — tokens live in `src/app/globals.css` under `@theme inline`)
- **GSAP 3** (animations) · **Three.js 0.184** (3D canvas scenes)
- **Zod v4** (form validation — import from `"zod/v4"`)
- **axios** + **@stellar/freighter-api** (backend API + wallet)
- Package manager: **npm**

## Getting started
```bash
npm install
npm run dev        # http://localhost:3000
```
Set `NEXT_PUBLIC_API_URL` (backend base URL) in `.env.local` — see `.env.example`. `NEXT_PUBLIC_ANCHOR_ENABLED=true` enables the real SEP-24 anchor cash-out flow.

## Scripts
- `npm run dev` — dev server
- `npm run build` — production build (also type-checks; treat TS errors as build failures)
- `npm run start` — serve the production build
- `npm run lint` — ESLint

## Deployment
Built as a Docker image (Next.js standalone) and served behind **Caddy** on a self-hosted VPS via `docker-compose.yml`. `NEXT_PUBLIC_*` values are **baked at build time** (docker build args) — changing them requires a rebuild. See `docs/backend/Deployment-PRD.md`.

## Docs
- `CLAUDE.md` — session guide + critical gotchas (Tailwind v4, Zod v4, SSR/canvas, dark mode)
- `structure.md` — directory layout and component architecture
- `design.md` — design system (two surfaces: marketing vs app)
- `role.md` — working rules for this frontend
