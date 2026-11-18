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

Requirements: Node.js 20.9+ and npm. Pages that talk to the API (the alpha sign-up) also need
the backend running locally (see [`../backend/README.md`](../backend/README.md)).

```bash
npm install
cp .env.example .env.local   # API address and internal key for local development
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | Address of the API (`http://localhost:5080` locally) |
| `API_INTERNAL_KEY` | Must match the API's `InternalApi__Key` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public key of the human-verification challenge on the sign-up form |
| `TURNSTILE_SECRET_KEY` | Secret key used by the server to verify that challenge |

Only `NEXT_PUBLIC_` values reach the browser (and are fixed at build time); the rest are read only
by server code. `.env.example` contains the provider's official **test** keys, which always pass, for
local development and preview deployments; production uses real keys set in the hosting dashboard.
Without a secret key, sign-ups are rejected rather than accepted unchecked.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run lint` | ESLint (must pass) |
| `npm run build` | Production build (must pass) |
| `npm run start` | Serve the production build |

## Project structure

```
assets/
└── fonts/                    # ChakraPetch-Bold.ttf + OFL.txt, used by social preview images
src/
├── app/
│   ├── [lang]/
│   │   ├── layout.tsx        # Root layout: <html lang>, metadata, header, footer, skip link
│   │   ├── page.tsx          # Home (placeholder until the game directory)
│   │   ├── not-found.tsx     # Localized 404 for notFound() inside pages
│   │   ├── opengraph-image.tsx  # Social preview card (1200×630), one per locale
│   │   ├── alpha/            # Alpha sign-up: page, form (client), human check, server action
│   │   │   └── confirm/      # Email confirmation: page, confirm button (client), server action
│   │   └── privacy/          # Privacy notice
│   ├── global-not-found.tsx  # Trilingual 404 for URLs that match no route
│   ├── fonts.ts              # next/font setup shared by both root files
│   ├── globals.css           # Tailwind import and design tokens
│   ├── icon.svg              # Favicon for modern browsers (same mark as LogoMark)
│   ├── favicon.ico           # 16/32/48 px favicon for search engines and older browsers
│   ├── apple-icon.png        # 180 px home-screen icon (opaque background)
│   ├── robots.ts             # /robots.txt: allow all, points to the sitemap
│   └── sitemap.ts            # /sitemap.xml: every public page × locale, with hreflang links
├── components/
│   ├── layout/               # SiteHeader, SiteFooter, Logo, LocaleSwitcher
│   ├── seo/                  # JsonLd (schema.org structured data)
│   └── ui/                   # Primitives: Button/ButtonLink, Card, Badge, ProgressBar, ExternalLink
├── i18n/
│   ├── config.ts             # Locales, URL helpers, hreflang alternates
│   ├── server.ts             # getLocale(), getMessages(), Messages type
│   ├── format.ts             # interpolate, plural, number/percent/date formatting
│   ├── rich.tsx              # rich(): elements inside translated strings
│   └── messages/             # en.json (source of truth), es.json, pt.json
├── lib/
│   ├── api/                  # Server-only API client (client.ts) and per-feature calls
│   ├── clientIp.ts           # Visitor IP from the proxy headers (forwarded to the API)
│   ├── turnstile.ts          # Server-side verification of the human-verification challenge
│   ├── cx.ts                 # Class-name join helper
│   └── site.ts               # Site name, URLs, and public contact address
└── proxy.ts                  # Locale routing and detection
```

## SEO and social previews

| URL | Source | Notes |
|---|---|---|
| `/robots.txt` | `src/app/robots.ts` | Allows all crawlers; links the sitemap |
| `/sitemap.xml` | `src/app/sitemap.ts` | Lists each path in `publicPaths` once per locale, with `hreflang` alternates. **Add every new public page to `publicPaths`.** |
| `/favicon.ico`, `/icon.svg`, `/apple-icon.png` | `src/app/` | Site icon in search results, browser tabs, and phone home screens |
| `/<lang>/opengraph-image` | `src/app/[lang]/opengraph-image.tsx` | 1200×630 PNG per locale with the logo, translated title, and description; Next.js adds the `og:image` and `twitter:image` tags to every page in that locale |

The home page also includes a schema.org `WebSite` block (`JsonLd` component) so search engines
show **RecompAchievements** as the site name.

**Regenerating the icons** after a logo change: render `icon.svg` at 512 px with a transparent
background, downscale it into a 16/32/48 px `favicon.ico`, and render it at 180 px with ~14%
padding on the `background` color for `apple-icon.png` (iOS fills transparency with black).

The social image can't read Tailwind tokens, so it repeats the theme colors in a small `colors`
object; change them together with `globals.css`. The heading font is Chakra Petch Bold
(SIL Open Font License, `assets/fonts/OFL.txt`), loaded from `assets/fonts/`. `src/proxy.ts`
lets `/…/opengraph-image` requests through untouched, so a crawler always gets the image of the
locale in the URL.

## Deployment

Hosted on Vercel, which builds this folder with the default Next.js settings: merges to `main`
deploy to [recompachievements.org](https://recompachievements.org/), and pull requests get preview
deployments. See the [root README](../README.md#deployment).

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
`src/i18n/server.ts` and in `global-not-found.tsx`. The sitemap and social images pick up the
new locale automatically.

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
