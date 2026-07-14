# Project Structure

## Overview

Kreav is a Next.js 16 marketing landing page for a digital-product marketplace targeting Asian creators. It uses the App Router, TypeScript, Tailwind CSS v4, GSAP for animations, Three.js for 3D canvas scenes, and Zod for form validation.

---

## Directory Layout

```
kreve/
├── src/
│   ├── app/
│   │   ├── globals.css        # Tailwind v4 @theme tokens + dark-mode CSS vars
│   │   ├── layout.tsx         # Root layout: Google fonts, <html> attrs, metadata
│   │   └── page.tsx           # Single-page entry — assembles all section components
│   ├── components/
│   │   ├── Nav.tsx            # Fixed navigation bar
│   │   ├── Hero.tsx           # Above-the-fold section with map canvas
│   │   ├── MapCanvas.tsx      # Three.js Asia map (client-only, ssr:false)
│   │   ├── Marquee.tsx        # GSAP infinite ticker strip
│   │   ├── HowItWorks.tsx     # 3-step card section
│   │   ├── ProductShowcase.tsx# Showcase heading + dynamic ShowcaseCanvas
│   │   ├── ShowcaseCanvas.tsx # Three.js 3D product constellation (client-only)
│   │   ├── Features.tsx       # 2×2 feature grid
│   │   ├── CreatorSpotlight.tsx # Horizontal-scroll creator cards
│   │   ├── Waitlist.tsx       # Zod-validated email form + animated counter
│   │   └── Footer.tsx         # 4-column footer with ghost KREAV wordmark
│   └── context/
│       └── theme.tsx          # ThemeProvider + useTheme hook (dark/light)
├── public/                    # Static assets
├── structure.md               # ← this file
├── role.md                    # AI agent working rules
├── design.md                  # Design system reference
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

---

## Page Composition (`page.tsx`)

```
ThemeProvider
└── root <div> (CSS var background/color)
    ├── Nav
    ├── Hero
    │   └── MapCanvas          (dynamic, ssr:false)
    ├── Marquee
    ├── HowItWorks
    ├── ProductShowcase
    │   └── ShowcaseCanvas     (dynamic, ssr:false)
    ├── Features
    ├── CreatorSpotlight
    ├── Waitlist
    └── Footer
```

All components are imported directly in `page.tsx`. The Three.js canvases are wrapped in `next/dynamic` with `{ ssr: false }` to prevent server-side rendering.

---

## Key Patterns

### Client vs Server components
- All interactive/animation components use `"use client"` at the top.
- `layout.tsx` and `page.tsx` are Server Components (no `"use client"`).
- `ThemeProvider` is a client component; wrap it around the page root, not inside `layout.tsx`.

### Three.js canvases
Every Three.js component follows this lifecycle:
```ts
useEffect(() => {
  // 1. Grab refs, check WebGL support → show fallback if unavailable
  // 2. Create renderer, scene, camera
  // 3. Build geometry
  // 4. Set up event listeners (pointermove, resize)
  // 5. Start requestAnimationFrame loop
  // 6. Return cleanup: cancelAnimationFrame + renderer.dispose()
}, []);
```
Never put Three.js logic in `useGSAP` or GSAP scopes — keep them separate.

### GSAP animations
- Import `{ useGSAP }` from `@gsap/react`.
- Register plugins (e.g. `ScrollTrigger`) at module scope before component definitions.
- Entrance animations target `data-hero` or `data-r="..."` attributes so the HTML structure stays readable.
- Scroll-triggered reveals use `{ once: true }` so they don't repeat.

### Dark mode
- `ThemeProvider` sets `data-theme="dark"` or `"light"` on `document.documentElement`.
- All theme-sensitive colors use CSS custom properties: `var(--bg)`, `var(--text)`, `var(--card)`, `var(--card-text)`, `var(--muted)`.
- Never hardcode light/dark colours directly on elements that need to respond to theme toggling — always use a CSS var.

### Styling approach
- **Layout & spacing**: Tailwind utility classes (`flex`, `grid`, `gap-*`, `p-*`).
- **Brand colours & shadows**: inline `style` props (or the shared CSS classes `.neo-shadow`, `.neo-btn`).
- Inline styles are intentional for design-critical properties so they're co-located with the element and not hidden inside a CSS file.

### Form validation
- `Waitlist.tsx` uses Zod v4. Import from `"zod/v4"`, not `"zod"`.
- Schema: `z.object({ email: z.email(...) })` with `.safeParse()`.

---

## Dependencies

| Package | Purpose |
|---|---|
| `next@16` | Framework, App Router |
| `react@19` | UI |
| `tailwindcss@4` | Utility CSS (v4 — no config file, uses `@theme` in CSS) |
| `gsap@3` | Scroll + entrance animations |
| `@gsap/react@2` | `useGSAP` hook for React-safe GSAP |
| `three@0.184` | 3D canvas scenes |
| `zod@4` | Waitlist form validation |
| `@types/three` | TypeScript types for Three.js |

---

## Scripts

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build + type check
npm run lint     # ESLint
```
