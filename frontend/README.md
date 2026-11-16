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
- Internationalization with Next.js's built-in pattern (`app/[lang]` + `next/root-params` + JSON
  dictionaries); no i18n library

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
├── app/
│   ├── [lang]/
│   │   ├── layout.tsx        # Root layout: <html lang>, metadata, header, footer, skip link
│   │   ├── page.tsx          # Home (placeholder until the game directory)
│   │   └── not-found.tsx     # Localized 404 for notFound() inside pages
│   ├── global-not-found.tsx  # Trilingual 404 for URLs that match no route
│   ├── fonts.ts              # next/font setup shared by both root files
│   ├── globals.css           # Tailwind import and design tokens
│   └── icon.svg              # Favicon (same mark as LogoMark)
├── components/
│   ├── layout/               # SiteHeader, SiteFooter, Logo, LocaleSwitcher
│   └── ui/                   # Primitives: Button/ButtonLink, Card, Badge, ProgressBar, ExternalLink
├── i18n/
│   ├── config.ts             # Locales, URL helpers, hreflang alternates
│   ├── server.ts             # getLocale(), getMessages(), Messages type
│   ├── format.ts             # interpolate, plural, number/percent/date formatting
│   ├── rich.tsx              # rich(): elements inside translated strings
│   └── messages/             # en.json (source of truth), es.json, pt.json
├── lib/
│   ├── cx.ts                 # Class-name join helper
│   └── site.ts               # Site name, URLs, and public contact address
└── proxy.ts                  # Locale routing and detection
```

## Internationalization

| Locale | Language | URL | `<html lang>` |
|---|---|---|---|
| `en` (default) | English | `/games/x` (no prefix) | `en` |
| `es` | Spanish | `/es/games/x` | `es` |
| `pt` | Portuguese (Brazil) | `/pt/games/x` | `pt-BR` |

**How a request is routed** (`src/proxy.ts`):

- `/es/...` and `/pt/...` are served as-is, so a shared link always opens in its language.
- `/en/...` redirects (308) to the unprefixed URL.
- An unprefixed URL is served in English (rewritten internally to `/en/...`), unless:
  - the `NEXT_LOCALE` cookie holds `es` or `pt` → redirect to that language; or
  - there is no cookie and the browser's `Accept-Language` prefers Spanish or Portuguese → redirect
    there once and save the cookie.
- The header's language switcher keeps the current page and saves the choice in `NEXT_LOCALE`
  (one year).

Every page is prerendered once per locale and sets `canonical` and `hreflang` alternates.

**Using translations in a Server Component:**

```tsx
import { getLocale, getMessages } from "@/i18n/server";
import { localizePath } from "@/i18n/config";
import { plural } from "@/i18n/format";

const locale = await getLocale();
const { home, achievement } = await getMessages();
// home.badge, plural(locale, 25, achievement.points), localizePath(locale, "/games/x")
```

**Adding a string:** add the key to `en.json`, `es.json`, and `pt.json`. A key missing from any
file fails `npm run build`.

**Adding a language:** add its code to `locales` in `src/i18n/config.ts` (plus `localeNames`,
`htmlLang`, `openGraphLocale`), create `messages/<code>.json`, register it in the loaders in
`src/i18n/server.ts` and in `global-not-found.tsx`.

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
