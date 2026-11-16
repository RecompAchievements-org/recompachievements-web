# RecompAchievements — Frontend

The [recompachievements.org](https://recompachievements.org/) website. For the project overview,
architecture, and roadmap, see the [root README](../README.md). Coding rules for this app live in
[`AGENTS.md`](AGENTS.md).

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components, Partial Prefetching)
- **React 19** and **TypeScript** (strict)
- **Tailwind CSS v4**, configured in CSS (`src/app/globals.css`); there is no `tailwind.config.js`
- Fonts self-hosted through `next/font`: **Geist** (body), **Geist Mono** (numbers, code),
  **Chakra Petch** (display headings)

## Getting started

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run lint` | ESLint (must pass) |
| `npm run build` | Production build (must pass) |
| `npm run start` | Serve the production build |

## Project structure

```
src/
├── app/                  # Routes only: page, layout, loading, error, not-found, icons
│   ├── globals.css       # Tailwind import and design tokens
│   ├── icon.svg          # Favicon (same mark as LogoMark)
│   ├── layout.tsx        # Root layout: fonts, metadata, header, footer, skip link
│   └── page.tsx          # Home (placeholder until the game directory)
├── components/
│   ├── layout/           # SiteHeader, SiteFooter, Logo
│   └── ui/               # Primitives: Button/ButtonLink, Card, Badge, ProgressBar, ExternalLink
└── lib/
    ├── cx.ts             # Class-name join helper
    └── site.ts           # Site name, URLs, and public contact address
```

## Design system

The site has a single dark theme. The default Tailwind color palette is cleared in
`globals.css`, so **only the tokens below exist**; classes like `bg-zinc-900` won't work. Every text
color passes WCAG AA (4.5:1) on all three surface levels.

| Token | Hex | Use |
|---|---|---|
| `background` | `#0a0c14` | Page background |
| `surface` | `#121624` | Cards, footer |
| `surface-raised` | `#1a2033` | Elements on cards: badges, inputs, progress tracks |
| `border` / `border-strong` | `#262d44` / `#3a4360` | Dividers / emphasized outlines |
| `foreground` | `#e7e9f2` | Primary text |
| `muted` | `#9aa3ba` | Secondary text |
| `subtle` | `#808aa6` | Tertiary text, fine print |
| `accent` / `accent-strong` | `#8b7bff` / `#a397ff` | Brand violet: links, primary buttons, focus ring / hover |
| `on-accent` | `#0a0c14` | Text on accent backgrounds |
| `gold` / `on-gold` | `#f5c04a` / `#0a0c14` | Points and achievement highlights |
| `success` · `danger` · `info` | `#3ddc97` · `#ff6b7a` · `#5cc8ff` | Status |
| `rarity-common` … `rarity-legendary` | `#a8b0c4` · `#4ade80` · `#60a5fa` · `#c084fc` · `#fbbf24` | Rarity tiers |

Use them as Tailwind utilities (`bg-surface`, `text-muted`, `border-gold/40`, `fill-accent`) and
the `font-display` / `font-mono` font utilities.

### UI primitives

| Component | Props |
|---|---|
| `Button`, `ButtonLink` | `variant`: `primary` · `secondary` · `ghost`; `size`: `sm` · `md`; `ButtonLink` also takes `external` to open in a new tab |
| `ExternalLink` | Any `a` props; opens in a new tab with `rel="noopener noreferrer"` and a screen-reader hint |
| `Card` | Any `div` props |
| `Badge` | `tone`: `neutral` · `accent` · `gold` · `success` · `common` · `uncommon` · `rare` · `epic` · `legendary` |
| `ProgressBar` | `value` (0–100), `label` (accessible name), `tone`: `accent` · `gold` · `success` |
