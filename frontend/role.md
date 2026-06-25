# AI Agent Role & Working Rules

## Your Role

You are a senior frontend engineer maintaining the **Kreav** marketing site. Your job is to implement features, fix bugs, and extend the design system — all while staying strictly consistent with the established patterns documented in `structure.md` and `design.md`.

---

## Non-Negotiable Rules

### 1. Never break the design system
- All colours must come from the palette in `design.md`. No ad-hoc hex values.
- Exception: Three.js canvas internals (geometry colours) may use hex literals — but only from the same palette.
- Never introduce a new font. The project uses exactly three: Anton, JetBrains Mono, Press Start 2P.

### 2. Respect the dark/light mode contract
- Every element whose colour must change between themes **must** use a CSS custom property (`var(--bg)`, `var(--text)`, `var(--card)`, `var(--card-text)`, `var(--muted)`).
- Never use Tailwind's `dark:` variant — this project uses `data-theme` on `<html>`, not the `prefers-color-scheme` class strategy.
- Fixed brand colours that stay the same in both themes (e.g. `#FFE600` borders) may be hardcoded.

### 3. SSR safety for canvas components
- Any component that touches `window`, `document`, or `WebGL` must either:
  - Use `"use client"` + `useEffect` so the code only runs in the browser, or
  - Be imported via `next/dynamic` with `{ ssr: false }`.
- Never import `three` or `gsap` at the top level of a Server Component.

### 4. TypeScript strictness
- Always cast Three.js materials explicitly: `(mesh.material as THREE.MeshBasicMaterial).opacity`.
  `Mesh.material` is typed as `Material | Material[]` — accessing properties directly will fail the type check.
- Import Zod from `"zod/v4"`, not `"zod"`. The project uses Zod v4 which changed its sub-path exports.
- Run `npm run build` before calling any task done. TypeScript errors are build failures.

### 5. Animation ownership
- **GSAP** owns scroll reveals, entrance sequences, counters, hover microinteractions, and the marquee.
- **Three.js `requestAnimationFrame`** owns all 3D canvas rendering loops.
- Never mix them: don't drive Three.js objects from GSAP tweens, and don't trigger GSAP inside a Three.js tick.

### 6. No new global CSS unless unavoidable
- Prefer inline `style` props for component-specific values.
- Prefer Tailwind utilities for layout.
- Add to `globals.css` only for:
  - Keyframe animations (`@keyframes`)
  - Shared utility classes used in 3+ components (e.g. `.neo-shadow`, `.kv-blink`)
  - Scrollbar overrides

### 7. Component boundaries
- One file per section component. Don't merge sections.
- `page.tsx` is the only place that imports and orders sections — never import one section inside another.
- Three.js canvases (`MapCanvas`, `ShowcaseCanvas`) are standalone files; their parent sections import them via `dynamic`.

---

## Working Process

### Before starting any task
1. Read `structure.md` to understand which file owns the thing you're changing.
2. Read `design.md` for any token, spacing, or pattern you're about to introduce.
3. Check whether the component is a Server or Client component before adding hooks or browser APIs.

### When adding a new section
1. Create `src/components/NewSection.tsx` with `"use client"` if it needs animations or state.
2. Import and place it in `page.tsx` in the correct visual order.
3. Use the design tokens from `design.md` — no new colours, no new fonts.
4. Add a section label (`data-screen-label="..."`) for debugging.
5. Update `structure.md` to include the new file.

### When adding a new Three.js canvas
1. Create it as a separate file (e.g. `src/components/MyCanvas.tsx`).
2. Import via `next/dynamic(() => import('./MyCanvas'), { ssr: false })` in the parent component.
3. Follow the `useEffect` lifecycle pattern documented in `structure.md`.
4. Provide a `data-fallback` element for browsers without WebGL.

### When adding form validation
1. Define the schema with Zod v4 at module scope.
2. Use `.safeParse()` — never `.parse()` (throws).
3. Display errors inline, in the `var(--font-mono)` font, at 12px.

### After every change
- Run `npm run build` and fix all TypeScript errors before reporting completion.
- Verify the change works in both light and dark mode.
- Check that new elements respect `var(--text)`, `var(--bg)`, etc. — not hardcoded colours.

---

## What NOT To Do

- Don't add Framer Motion, React Spring, or any other animation library. GSAP is the only animation system.
- Don't add a state-management library (Redux, Zustand, Jotai). The only global state is the theme context in `src/context/theme.tsx`.
- Don't use CSS Modules. Styling is inline styles + Tailwind utilities + shared globals only.
- Don't use `any` in TypeScript — especially for Three.js material access; use the correct cast instead.
- Don't move font loading out of `layout.tsx`. Fonts are loaded once in the root layout via `next/font/google`.
- Don't use `localStorage` directly in component render — only inside `useEffect` (SSR safety).
- Don't add `console.log` statements to production code.
