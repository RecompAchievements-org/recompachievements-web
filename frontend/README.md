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

Requirements: Node.js 20.9+ and npm. Pages that talk to the API (the alpha sign-up, the games,
and accounts) also need the backend running locally (see [`../backend/README.md`](../backend/README.md)).

```bash
npm install
cp .env.example .env.local   # API address and internal key for local development
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | Address of the API (`http://localhost:5080` locally) |
| `API_INTERNAL_KEY` | Must match the API's `InternalApi__Key` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public key of the human-verification challenge on the alpha sign-up, account sign-up, and forgot-password forms |
| `TURNSTILE_SECRET_KEY` | Secret key used by the server to verify that challenge |

Only `NEXT_PUBLIC_` values reach the browser (and are fixed at build time); the rest are read only
by server code. `.env.example` contains the provider's official **test** keys, which always pass, for
local development and preview deployments; production uses real keys set in the hosting dashboard.
Without a secret key, those forms are rejected rather than accepted unchecked.

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
│   │   ├── page.tsx          # Home: alpha call to action, featured slider, and games
│   │   ├── not-found.tsx     # Localized 404 for notFound() inside pages
│   │   ├── opengraph-image.tsx  # Social preview card (1200×630), one per locale
│   │   ├── alpha/            # Alpha sign-up: page, form (client), server action
│   │   │   └── confirm/      # Email confirmation: page, confirm button (client), server action
│   │   ├── sign-up/, sign-in/  # Account forms (client) with their server actions
│   │   ├── confirm-email/    # Confirms an account email (button POST)
│   │   ├── forgot-password/, reset-password/  # Set or reset a password through an emailed link
│   │   ├── welcome/          # After a Discord/GitHub sign-up: shows the account email, picks the username
│   │   ├── account/          # Redirect to own profile; [username]/ public profile and wall;
│   │   │                     # settings/ (photo, email, platforms, password, sign out); messages/ (placeholder)
│   │   ├── progress/         # [username]/: public completion progress (labeled sample data for now)
│   │   ├── auth/             # startPlatform action; callback/[provider]/route.ts receives Discord/GitHub
│   │   ├── games/            # Game directory; [slug]/ game page, its loading skeleton, and social card
│   │   ├── moderation/       # Staff only: report queue, reports/[id], users/[username], log, server actions
│   │   ├── rules/            # Public community rules
│   │   ├── content-policy/   # What we host, image sources, removal requests
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
│   ├── alpha/                # AlphaOpenBadge ("sign-up open" announcement)
│   ├── auth/                 # AuthShell, PlatformButtons, PlatformIcon, FormParts (client: fields, submit, human check)
│   ├── game/                 # GameGrid, GameCard, FeaturedSlider + SliderControls (client), GameArt,
│   │                         # GeneratedArt, FadeInImage (client), GameBackdrop, GameArtCredits,
│   │                         # GameDetailsCard,
│   │                         # ConsolePill, repoLinks, AchievementRow, PreviewNotice,
│   │                         # GameCommentsSection (saved comments, per visitor)
│   ├── layout/               # SiteHeader, SiteFooter, Logo, LocaleSwitcher, LocaleFlag, SocialLinks, AccountLink,
│   │                         # AccountMenu (client), MenuIcon, EmailRequiredBanner
│   ├── comments/             # CommentThread, CommentAuthor, SavedComments (client), CommentsSkeleton,
│   │                         # actions.ts: every comment section
│   ├── moderation/           # ReportButton, ModerationControls (client), ModerationShell, UserSearch
│   ├── profile/              # ProfilePhoto, ProfileCard, ProfileBadges, BadgeIcon,
│   │                         # BadgeDetails and PlayerPreview (client popovers), sampleBadges,
│   │                         # ProfileSampleSections
│   ├── progress/             # ProgressRow; sampleProgress: mock data until real unlocks exist
│   ├── seo/                  # JsonLd (schema.org structured data)
│   └── ui/                   # Primitives: Button/ButtonLink, Card, Badge, ExternalLink, Skeleton,
│                             # HumanCheck (client, human-verification widget)
├── i18n/
│   ├── config.ts             # Locales, URL helpers, hreflang alternates
│   ├── server.ts             # getLocale(), getMessages(), Messages type
│   ├── format.ts             # interpolate, plural, number/date formatting
│   ├── rich.tsx              # rich(): elements inside translated strings
│   └── messages/             # en.json (source of truth), es.json, pt.json
├── lib/
│   ├── api/                  # Server-only API client (client.ts) and per-feature calls (games.ts is cached; accounts.ts, comments.ts, moderation.ts)
│   ├── auth/                 # session.ts: the only code touching account cookies; staff.ts: moderation page guard; forms.ts: shared form rules and error codes
│   ├── clientIp.ts           # Visitor IP from the proxy headers (forwarded to the API)
│   ├── turnstile.ts          # Server-side verification of the human-verification challenge
│   ├── socialImage.tsx       # Shared size, colors, font, and logo for social preview images
│   ├── cx.ts                 # Class-name join helper
│   └── site.ts               # Site name, URLs, public contact address, and social links
└── proxy.ts                  # Locale routing and detection
```

## SEO and social previews

| URL | Source | Notes |
|---|---|---|
| `/robots.txt` | `src/app/robots.ts` | Allows all crawlers; links the sitemap |
| `/sitemap.xml` | `src/app/sitemap.ts` | Lists each path in `publicPaths`, plus every game page from the API (built per request; static pages only if the API is down), once per locale with `hreflang` alternates. **Add every new static public page to `publicPaths`.** |
| `/favicon.ico`, `/icon.svg`, `/apple-icon.png` | `src/app/` | Site icon in search results, browser tabs, and phone home screens |
| `/<lang>/opengraph-image` | `src/app/[lang]/opengraph-image.tsx` | 1200×630 PNG per locale with the logo, translated title, and description; Next.js adds the `og:image` and `twitter:image` tags to every page in that locale |
| `/<lang>/games/<slug>/opengraph-image` | `src/app/[lang]/games/[slug]/opengraph-image.tsx` | Per-game card: console, title, achievement count, and points |

The home page also includes schema.org structured data (`JsonLd` component): a `WebSite` block, so
search engines show **RecompAchievements** as the site name, and an `Organization` block with the
logo (`apple-icon.png`), the public contact address, and the official GitHub, Reddit, and YouTube
profiles (`siteConfig.social`), so the project isn't confused with similarly named ones. Add new
official profiles to `siteConfig.social` and they appear in both the footer and this block.

**Regenerating the icons** after a logo change: render `icon.svg` at 512 px with a transparent
background, downscale it into a 16/32/48 px `favicon.ico`, and render it at 180 px with ~14%
padding on the `background` color for `apple-icon.png` (iOS fills transparency with black).

Social images can't read Tailwind tokens, so `src/lib/socialImage.tsx` repeats the theme colors
in `socialColors`; change them together with `globals.css`. The heading font is Chakra Petch Bold
(SIL Open Font License, `assets/fonts/OFL.txt`), loaded from `assets/fonts/`. `src/proxy.ts`
lets `/…/opengraph-image` requests through untouched, so a crawler always gets the image of the
locale in the URL.

## Data from the API

Game data comes from `src/lib/api/games.ts` (`getGames`, `getGame`), cached with `"use cache"`
for hours (`cacheLife("hours")`, tags `games` and `game:<slug>`) and shared by all visitors. The
build never calls the API: `GameGrid` and the game page load data at request time inside
`<Suspense>` (with `connection()`), so CI and preview builds work without it. A catalog change
on the API shows up on the site within the cache lifetime. Game pages are partially prerendered:
the layout is static and the game content streams in, so an unknown slug renders the not-found
page with `noindex` (a streamed page can't change its status code).

## Accounts

Sign-up, sign-in, and Settings talk to the API's `/api/v1/auth` endpoints through
`src/lib/api/accounts.ts`; the browser never calls the API. After signing in, the API's session
token is kept in an **HttpOnly, Secure, SameSite=Lax** cookie (`__Host-session` in production)
that only `src/lib/auth/session.ts` reads or writes. Pages read it (`getCurrentAccount()`, one API
call per request, shared by the header, the banner, and the page) inside `<Suspense>`, so every
page's static shell stays prerendered; cookies are only set in Server Actions and the callback
Route Handler.

**Discord and GitHub** (authorization code with PKCE): the `startPlatform` Server Action asks the
API for the platform's authorize URL, saves the `state` and PKCE verifier in a short-lived HttpOnly
cookie, and redirects. The platform sends the visitor back to `/auth/callback/<platform>` (always
the unprefixed path, registered with each platform), which checks the `state` and passes the code
to the API. Then:

- a known platform ID signs in, and the visitor lands on their profile;
- an unknown one becomes a **pending sign-up** (short-lived cookie) and goes to `/welcome`, which
  shows the email the account will be created with (or that it will have none yet) before the
  username is chosen and the account is created;
- connecting from Settings links the platform; if the account has no confirmed email and the
  platform has a verified one, Settings offers to use it (still confirmed by our email).

The header shows signed-in players their photo and a menu with Profile, Completion Progress
(`/progress/<username>`, public), Messages (placeholder), Settings, Moderation (staff only), and
Sign Out. A mouse opens it
on hover and a click goes to the profile; on touch screens the first tap opens it.

Signed-in accounts without a confirmed email see a banner under the header
(`EmailRequiredBanner`): they can't collect achievements until they add and confirm one. All
account pages are `noindex` and left out of the sitemap.

**Public profiles:** `/account/<username>` can be opened by anyone and shows only public data
(`getPublicPlayer`), labeled sample sections (badges, medals, last achievements earned, subsets earned, completion, last game played), and a
full-width comment wall. Walls and game pages both use `SavedComments` (built on the shared
`CommentThread`) with a thread reference, so they share posting, deleting, reports, mute notices,
and numbered pages (`CommentPagination`, `?commentsPage=` in the URL, one page shown at a time). Every comment
section shows each author’s photo, username, and join date (`CommentAuthor`); `PlayerPreview`
previews their profile and links to it.
Signed-out visitors can read; accounts with a confirmed email can post; a comment's author and
the wall's owner can delete it. Reads and writes are per visitor and never cached.

**Profile photos:** Settings shrinks a chosen JPEG, PNG, or WebP in the browser and sends it through
a Server Action; the API checks it and creates the stored files. `ProfilePhoto` shows them without
the image optimizer, so a removed photo leaves no copy on the website.

**Moderation:** signed-in players report profiles, photos, and comments with `ReportButton`. Staff
use `/moderation` for the report queue, report and account reviews, and the audit log. These pages
are `noindex` and show the not-found page to everyone else; the API enforces every permission.

## Featured slider and game images

The home page's slider (`FeaturedSlider`) shows the catalog's `featured` games in the catalog's
display order (curated, so the launch target stays first), with a **New Release**
badge for releases in the last 30 days. Every slide is rendered on
the server; `SliderControls` only switches between them (auto-advance every 7 seconds, pause button,
arrow keys, swipe, and no movement with reduced motion).

Game art comes from SteamGridDB through the catalog's `art` (see the backend README) and is
shown by `GameArt`, which falls back to `GeneratedArt`:

| Place | Image | Shape |
|---|---|---|
| Game page header | `cover` | 2:3 portrait |
| Game page backdrop (`GameBackdrop`) | `hero`, blurred and dimmed, fading into the page; scrolls away with it | full width, top of the page |
| Home page backdrop | the visible slide's `hero` (same `GameBackdrop`), crossfading whenever the slide changes; loaded the first time a slide shows | full width, top of the page |
| Game cards (`/games`, home) | `hero`, cropped | 16:9 |
| Featured slider | `hero`, with an "Art by …" credit overlay | wide panel |
| Details card thumbnail | `icon`, else `cover` | square |

Images load from SteamGridDB's CDN through `next/image` (allowed in `next.config.ts`, optimized
copies cached for 30 days; the site never calls SteamGridDB's API), fading in over a `Skeleton`
once loaded (`FadeInImage`), and the game page lists every image's artist and SteamGridDB page in
its credits legend (`GameArtCredits`, below the comments). The home page notes the source under
its games grid ("Game art from SteamGridDB").

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
- The header's language switcher shows each language with a country flag, keeps the current page,
  and saves the choice in `NEXT_LOCALE` (one year).

Every page is prerendered once per locale and sets `canonical` and `hreflang` alternates.

**Using translations in a Server Component:**

```tsx
import { getLocale, getMessages } from "@/i18n/server";
import { localizePath } from "@/i18n/config";
import { plural } from "@/i18n/format";

const locale = await getLocale();
const { home, achievement } = await getMessages();
// home.joinAlpha, plural(locale, 25, achievement.points), localizePath(locale, "/games/x")
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
| `medal-platinum` · `medal-gold` · `medal-silver` | `#bfe8f5` · `#f5c04a` · `#c4ccd8` | Completion medals on profiles |
| `success` · `danger` · `info` | `#3ddc97` · `#ff6b7a` · `#5cc8ff` | Status |
| `rarity-common` … `rarity-legendary` | `#a8b0c4` · `#4ade80` · `#60a5fa` · `#c084fc` · `#fbbf24` | Rarity tiers |
| `console-playstation` · `console-nintendo` · `console-xbox` | `#5b9dff` · `#ff6b78` · `#5fcf5f` | Original console pills on game pages (`ConsolePill`) |

Use them as Tailwind utilities (`bg-surface`, `text-muted`, `border-gold/40`, `fill-accent`) and
the `font-display` / `font-mono` font utilities.

### UI primitives

| Component | Props |
|---|---|
| `Button`, `ButtonLink` | `variant`: `primary` · `secondary` · `ghost`; `size`: `sm` · `md`; `ButtonLink` also takes `external` to open in a new tab |
| `ExternalLink` | Any `a` props; opens in a new tab with `rel="noopener noreferrer"` and a screen-reader hint |
| `Card` | Any `div` props |
| `Skeleton`, `SkeletonText` | `className` (size and shape; for `SkeletonText`, the real text's font and line height), `widths` (one per line; add `sm:hidden` for lines that only wrap on phones) |
| `Badge` | `tone`: `neutral` · `accent` · `gold` · `success` · `common` · `uncommon` · `rare` · `epic` · `legendary` |
