# Kreav — Claude Code Session Guide

@AGENTS.md

## Project Docs (read these before touching any file)

@structure.md
@role.md
@design.md

## Quick Context

- **What it is**: Neobrutalist marketing landing page for Kreav, a digital-product marketplace for Asian creators.
- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · GSAP 3 · Three.js 0.184 · Zod v4
- **Entry point**: `src/app/page.tsx` (Server Component) assembles all section components inside `ThemeProvider`.
- **Dev server**: `npm run dev` → `http://localhost:3000`
- **Build check**: always run `npm run build` before reporting a task complete — TypeScript errors are build failures.

## Critical Gotchas

- **Tailwind v4** — no `tailwind.config.js`; all tokens live in `src/app/globals.css` under `@theme inline`.
- **Zod v4** — import from `"zod/v4"`, not `"zod"`.
- **Three.js material casts** — `Mesh.material` is typed as `Material | Material[]`; always cast: `(mesh.material as THREE.MeshBasicMaterial).opacity`.
- **Dark mode** — driven by `data-theme` on `<html>` (not Tailwind's `dark:` variant); theme-sensitive colours must use `var(--bg)`, `var(--text)`, `var(--card)`, `var(--card-text)`, `var(--muted)`.
- **SSR safety** — Three.js canvases must be imported via `next/dynamic(..., { ssr: false })`; never import `three` at the top level of a Server Component.
