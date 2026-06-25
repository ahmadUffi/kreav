# Design System

**Style**: Neobrutalism — high contrast, raw edges, pixel-grid aesthetic, zero border-radius (except rare 3px), hard offset box-shadows.

**Source of truth**: The original design canvas is `Kreav Marketplace.dc.html` in the linked Claude Design project. This file documents the implementation tokens extracted from it.

---

## Colour Palette

### Brand tokens (static — never change with theme)

| Token | Hex | CSS class | Usage |
|---|---|---|---|
| Yellow | `#FFE600` | `bg-yellow` / `text-yellow` | Primary CTA, eyebrow badges, accent borders |
| Ink | `#0A0A0A` | `bg-ink` / `text-ink` | All borders, shadows, dark text, dark backgrounds |
| Magenta | `#FF3BFF` | `bg-magenta` | Accent fills, selection highlight |
| Cyan | `#00F5FF` | `bg-cyan` | Accent fills, currency labels, node glow |
| Orange | `#FF4D00` | `bg-orange` | Step 01 number, clip element |
| Chalk | `#F5F5F0` | `bg-chalk` | Light-mode page background |

Tailwind classes are available because these colours are registered in `globals.css` under `@theme`.

### Theme-adaptive tokens (switch with dark mode)

Use as **CSS custom properties only** — never hardcode the hex values in components that should respond to the theme toggle.

| CSS Variable | Light value | Dark value | Meaning |
|---|---|---|---|
| `var(--bg)` | `#F5F5F0` | `#0A0A0A` | Page background |
| `var(--text)` | `#0A0A0A` | `#ffffff` | Primary text |
| `var(--card)` | `#ffffff` | `#111111` | Card/panel background |
| `var(--card-text)` | `#0A0A0A` | `#ffffff` | Text on cards |
| `var(--muted)` | `#3a3a3a` | `#b8b8b8` | Secondary/body text |

---

## Typography

### Fonts

| Role | Family | CSS variable | Tailwind class | Next.js variable |
|---|---|---|---|---|
| Display / headings | Anton (400) | `var(--font-anton)` | `font-anton` | `--font-anton-var` |
| Body / UI / buttons | JetBrains Mono (400 500 700 800) | `var(--font-mono)` | `font-mono` | `--font-mono-var` |
| Pixel / step numbers | Press Start 2P (400) | `var(--font-pixel)` | `font-pixel` | `--font-pixel-var` |

Fonts are loaded in `layout.tsx` via `next/font/google`. Never load them via a `<link>` tag.

### Type scale

| Element | Font | Size | Weight | Transform |
|---|---|---|---|---|
| Hero H1 | Anton | `clamp(46px, 7.4vw, 112px)` | 400 | — |
| Section H2/H3 | Anton | `clamp(30px, 4.6vw, 58px)` | 400 | uppercase |
| Feature title | Anton | `25px` | 400 | uppercase |
| Step title | Anton | `21px` | 400 | uppercase |
| Counter / ghost | Press Start 2P | `clamp(70px, 15vw, 200px)` | 400 | — |
| Step number | Press Start 2P | `28px` | 400 | — |
| Feature letter | Press Start 2P | `11px` | 400 | — |
| Badge / eyebrow | JetBrains Mono | `12px` | 700 | uppercase, letter-spacing 3px |
| Nav links | JetBrains Mono | `12px` | 400 | uppercase, letter-spacing 1.5px |
| Body / caption | JetBrains Mono | `13–15px` | 400 | — |
| Buttons | JetBrains Mono | `12–14px` | 800 | uppercase, letter-spacing 1px |
| Card price | Anton | `16px` | 400 | — |

---

## Shadows & Borders

The neobrutalist shadow is always a **solid offset** in `#0A0A0A`. Never use blurred box-shadows.

| Name | CSS | Tailwind helper class |
|---|---|---|
| Small | `box-shadow: 4px 4px 0 #0A0A0A` | `.neo-shadow-sm` |
| Default | `box-shadow: 6px 6px 0 #0A0A0A` | `.neo-shadow` |
| Large | `box-shadow: 8px 8px 0 #0A0A0A` | `.neo-shadow-lg` |
| Hover (button press) | `box-shadow: 2px 2px 0 #0A0A0A` | — (applied inline) |

Border rule: **always `3px solid #0A0A0A`** on cards and badges. Nav CTAs use `4px`. Inline badges use `2px`.

When a card is hovered, change `border-color` to `#FFE600` and bump the shadow to 8px. Restore on mouse-leave.

---

## Button Anatomy

```
background: #FFE600  (primary)  /  #ffffff  (secondary)  /  #FF3BFF  (section CTA)
color: #0A0A0A
border: 3–4px solid #0A0A0A
padding: 15px 26px  (large)  /  11px 18px  (nav)  /  7px 9px  (icon)
box-shadow: 6px 6px 0 #0A0A0A
font: JetBrains Mono 800, uppercase, letter-spacing 1px
```

**Press effect** (applied with `onMouseEnter` / `onMouseLeave` directly — not CSS `:hover`):
```
transform: translate(2px, 2px)
box-shadow: 2px 2px 0 #0A0A0A
```

---

## Badge / Eyebrow Anatomy

```
background: #FFE600  (or #0A0A0A for inverted)
color: #0A0A0A  (or #FFE600 for inverted)
border: 3px solid #0A0A0A
box-shadow: 4px 4px 0 #0A0A0A
font: JetBrains Mono 700, 12px, uppercase, letter-spacing 3px
padding: 9px 14px
text-format: [ Label ]  ← include square brackets
```

---

## Card Anatomy

Cards appear in HowItWorks, Features, CreatorSpotlight, and the Hero float cards.

```
background: var(--card)
border: 3px solid #0A0A0A
box-shadow: 6px 6px 0 #0A0A0A
padding: 26–30px
border-radius: 0  ← no rounding
```

**Hover state** (apply via `onMouseEnter`/`onMouseLeave`):
```
border-color: #FFE600
box-shadow: 8px 8px 0 #0A0A0A
```

### Checker pattern (feature cards B & C)
```css
background: #FFE600;
background-image: repeating-conic-gradient(#FFE600 0 25%, #f3d600 0 50%);
background-size: 26px 26px;
```
Use the `.checker` CSS class from `globals.css`.

---

## Spacing System

No custom spacing scale — use Tailwind's default scale (`4 = 1rem`, `6 = 1.5rem`, etc.) for padding/margin, and match these section paddings:

| Section | Padding |
|---|---|
| Hero | `130px 40px 60px` |
| HowItWorks | `110px 40px` |
| Features | `20px 40px 100px` |
| CreatorSpotlight | `20px 0 100px` (outer); `8px 40px 28px` (scroll track) |
| Waitlist | `64px 40px` |
| Footer | `70px 40px 34px` |
| Max-width containers | `1280px` (most sections), `1440px` (Hero), `1180px` (Showcase) |

---

## Animation Conventions

### GSAP entrance (hero)
All hero elements start with `opacity: 0` (set via inline style). GSAP sets them to `opacity: 1` on mount. Targets are identified by `data-r="..."` attribute:

| Attribute | Element |
|---|---|
| `data-r="nav"` | Navigation bar |
| `data-r="eyebrow"` | Eyebrow badge |
| `data-r="h1-1/2/3"` | Headline lines |
| `data-r="sub"` | Typewriter container |
| `data-r="cta-1/2"` | CTA buttons |
| `data-r="badge"` | Trust badges |
| `data-r="map-wrap"` | Three.js map wrapper |
| `data-r="float-card"` | Floating product cards |

### Scroll reveals
```ts
gsap.fromTo(el,
  { clipPath: 'inset(100% 0 0 0)', opacity: 0 },
  { clipPath: 'inset(0% 0 0 0)', opacity: 1, duration: 0.6,
    scrollTrigger: { trigger: el, start: 'top 85%' } }
);
```

### Marquee timing
- Duration: `38s` (GSAP `repeat: -1`, `ease: "none"`).
- The track is **duplicated** in markup (two identical `<div>` blocks) so the gap is seamless at the loop point.

### Float cards
Cards in the hero section get a slow sinusoidal float via GSAP after their entrance:
```ts
gsap.to(card, { y: '+=12', duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true })
```

### Logo glitch
The logo has two hidden clone spans (magenta clip-path top half, cyan clip-path bottom half). On `mouseenter`, GSAP rapidly shifts them left/right 6 times at `0.05s` intervals, then hides them. This same pattern is used in both `Nav.tsx` and `Footer.tsx`.

---

## Three.js Scenes

### Map canvas (`MapCanvas.tsx`)
- **Dot grid**: 46×34 points; land dots are `#00F5FF` at 50% brightness, sea dots are `#1F1F1F`.
- **Nodes**: ID (Indonesia, yellow), PH (Philippines, magenta), VN (Vietnam, cyan). Each has a core circle, a glow sprite (AdditiveBlending), and 3 pulsing rings.
- **Package flight**: Bezier arc from source node → `y: 1.9` midpoint → destination. Duration: `LIFT 0.35s + TRAVEL 1.7s + POP 0.45s`.
- **Camera**: Slow sinusoidal pan on X axis (`sin(t × 0.25) × 1.1`), looking at origin.

### Showcase canvas (`ShowcaseCanvas.tsx`)
Five 3D objects arranged in a constellation:

| Index | Object | Position | Scale |
|---|---|---|---|
| 0 | Ebook (opening book) | `-1.7, -0.7, 0` | `1.0` |
| 1 | Presets (fanning cards) | `-3.5, 0.95, 0` | `0.92` |
| 2 | Course (monitor) | `0, 0.55, 0.2` | `1.28` (largest, centre) |
| 3 | Music (vinyl + sleeve) | `2.0, -0.65, 0` | `1.0` |
| 4 | Template (stacked docs) | `3.6, 0.3, 0` | `0.95` |

- Objects are connected by a **complete graph** of dashed `LineDashedMaterial` lines (`#FFE600`, opacity `0.25`).
- On hover, the two edges connected to the hovered node brighten to `0.85 + sin(t×8)×0.15`.
- Labels are HTML `<div>` elements positioned via `tmpV.project(camera)` in the render loop.
- Entrance: objects fly in from random off-screen positions when the section enters the viewport (IntersectionObserver).

---

## Pixel-art SVG Icons

Section icons are drawn in a crisp pixel-art style using SVG `<rect>` elements with `shapeRendering="crispEdges"`. They use the brand palette. Never use `<path>` arcs or `viewBox` fractional coordinates in these icons.

---

## Colour Usage Quick Reference

| Element | Background | Border | Text | Shadow |
|---|---|---|---|---|
| Primary CTA | `#FFE600` | `#0A0A0A` | `#0A0A0A` | `6px 6px 0 #0A0A0A` |
| Secondary CTA | `#ffffff` | `#0A0A0A` | `#0A0A0A` | `6px 6px 0 #0A0A0A` |
| Waitlist CTA | `#ffffff` | `#0A0A0A` | `#0A0A0A` | `6px 6px 0 #0A0A0A` |
| Waitlist section | `#FF3BFF` | `#0A0A0A` (top+bottom 4px) | `#0A0A0A` | — |
| Eyebrow badge | `#FFE600` | `#0A0A0A` | `#0A0A0A` | `4px 4px 0 #0A0A0A` |
| Inverted badge | `#0A0A0A` | — | `#FFE600` | — |
| How It Works card | `var(--card)` | `#0A0A0A` | `var(--card-text)` | `6px 6px 0 #0A0A0A` |
| Feature card A/D | `#ffffff` | `#0A0A0A` | `#0A0A0A` | `6px 6px 0 #0A0A0A` |
| Feature card B/C | `#FFE600` + checker | `#0A0A0A` | `#0A0A0A` | `6px 6px 0 #0A0A0A` |
| Marquee strip | `#0A0A0A` (bg) | `#0A0A0A` | `#FFE600` | — |
| Creator card (alt) | `#FFE600` | `#0A0A0A` | `#0A0A0A` | `5px 5px 0 #0A0A0A` |
| Nav (scrolled) | `#0A0A0A` | `#FFE600` (bottom) | `#ffffff` | — |
| Progress bar | `#FFE600` | — | — | — |
| Selection highlight | `#FF3BFF` | — | `#0A0A0A` | — |
