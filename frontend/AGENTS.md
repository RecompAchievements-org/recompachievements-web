<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend rules

Stack: Next.js 16 (App Router, Turbopack, Cache Components + Partial Prefetching enabled),
React 19, TypeScript (strict), Tailwind CSS v4 (CSS-first config in `src/app/globals.css`).

### Commands (run from `frontend/`)

- `npm run dev` — local dev server
- `npm run lint` — ESLint; must pass
- `npm run build` — production build; must pass before a task is done

### Rendering & data

- **Server Components by default.** Add `"use client"` only to leaf components that need state,
  effects, or browser APIs. Never put `"use client"` on a page or layout.
- **All data access goes through `src/lib/api/`.** Pages and components never call `fetch` on the
  backend directly. That layer calls the .NET API (`backend/`) from server code only, using a
  server-only base URL environment variable; the browser never talks to the API. Features are
  built end to end (database → API → page), so there is no mock-data layer.
- `src/lib/api/client.ts` (`apiPost`, typed `ApiResult`, ProblemDetails) is the only place that
  attaches the website's API credentials and request context. Every file under `src/lib/api/` starts
  with `import "server-only"`.
- Forms post to **Server Actions** (`actions.ts` next to the page) and use `useActionState` in a
  small client component. Actions receive the locale as a hidden field (root params aren't
  available there), return error **codes** that the client translates, and never return secrets.
  Validate on the server even when the input has native constraints.
- Mutations triggered by emailed links happen on a button press (POST), never on page load.
- The alpha sign-up form includes a human-verification challenge. Its token must be verified on the
  server (`verifyHumanToken` in `src/lib/turnstile.ts`) before the API is called; never skip or
  weaken that check, and keep it failing closed when its secret is missing.
- **Caching uses `"use cache"`** in data functions, always paired with `cacheLife(...)`, and
  `cacheTag(...)` where the data can be invalidated (e.g. `game:${slug}`). Do not use the legacy
  `fetch` `next: { revalidate }` options or `export const revalidate`.
- Wrap slow or per-user sections in `<Suspense>` with a skeleton fallback so the shell streams.
- Mutations (forms, settings, dev portal) use **Server Actions**, validated on the server.
- Secrets and backend URLs are read only in server code. Only `NEXT_PUBLIC_*` vars reach the client.

### Internationalization

Locales: `en` (default, no URL prefix), `es` (`/es/...`), `pt` (Brazilian Portuguese, `/pt/...`).
All routes live under `src/app/[lang]/`; `src/proxy.ts` rewrites English URLs to `/en` internally,
redirects `/en/...` to the unprefixed URL, and applies the saved (`NEXT_LOCALE` cookie) or detected
language on unprefixed visits.

- **No hard-coded UI text.** Every visible string, `aria-label`, `alt`, and metadata text comes from
  `src/i18n/messages/<locale>.json`. Brand names (`RecompAchievements`, `GitHub`) may stay literal.
- **Add every key to all three files** in the same change. `en.json` defines the `Messages` type, so
  a key missing from `es.json` or `pt.json` fails `npm run build`.
- In Server Components, read the locale with `getLocale()` and strings with `getMessages()` from
  `@/i18n/server`. Route Handlers (including `opengraph-image`) and Server Actions can't use
  `next/root-params`: they take the locale from `params` and call `loadMessages(locale)`.
  Never pass `lang` down as a prop. Client Components receive translated strings
  as props from their Server Component parent.
- Build internal links with `localizePath(locale, "/path")`; never write `/es/...` by hand.
- Placeholders use `{name}`: `interpolate()` for text, `rich()` for React elements (links, spans).
  Counts use `plural()`; numbers, percentages, and dates use `formatNumber/formatPercent/formatDate`
  from `@/i18n/format`, never `toFixed` or manual formatting.
- Every page's metadata sets `alternates: localeAlternates(locale, "/path")` (canonical + hreflang).
- Translations are written in the target language's gaming vocabulary (`logros`, `conquistas`);
  Portuguese is Brazilian.
- **Copy style:** English headings and buttons use Title Case (Chicago: "I Build a Recomp",
  "Back to Home"); Spanish and Portuguese use sentence case. Use typographic characters in every
  language: `’` and `“ ”`, not `'` and `"`; `…`, not `...` (loading text ends with `…`).
- Brand names and code tokens (`RecompAchievements`, `GitHub`, `AGPL-3.0`) are wrapped in
  `translate="no"` so browser auto-translation leaves them intact.

### Routes (v0.1)

Paths below are unprefixed (English); each also exists under `/es` and `/pt`. Pages live in
`src/app/[lang]/`.

- `/` — home (game directory later); primary call to action: Join the Alpha
- `/alpha` — alpha tester sign-up form
- `/alpha/confirm` — confirms a sign-up with the emailed token (`noindex`, not in the sitemap)
- `/privacy` — privacy notice; update its `lastUpdated` date and translations whenever data
  handling changes
- `/games/[slug]` — game detail: achievements, points, rarity
- `/u/[username]` — user profile: completion %, recent unlocks
- `/dev` — developer portal: register a recomp, manage achievements and keys

Every public page defines its metadata (`metadata` or `generateMetadata`), building on the
defaults and title template in the root layout and including `localeAlternates`.

SEO files (details in `README.md`):

- **Every new public page is added to `publicPaths` in `src/app/sitemap.ts`** in the same change
  (RULE-003); pages that shouldn't be indexed (e.g. `/dev`) are left out.
- `src/app/[lang]/opengraph-image.tsx` is the site-wide social card. Game and profile pages get
  their own `opengraph-image.tsx` in their segment. Image routes use `next/og`, inline styles, and
  the `colors` object (they can't read Tailwind tokens); keep those colors in sync with
  `globals.css`.
- `src/proxy.ts` must keep passing `/…/opengraph-image` and `/…/twitter-image` through without
  locale redirects or detection.

Not-found handling: `notFound()` inside a page renders the localized `src/app/[lang]/not-found.tsx`;
URLs that match no route render the static, trilingual `src/app/global-not-found.tsx`.

### Structure

```
src/
├── app/
│   ├── [lang]/     # every route: layout, page, loading, error, not-found, opengraph-image
│   ├── global-not-found.tsx  # 404 for unmatched URLs (outside [lang])
│   ├── fonts.ts    # next/font setup shared by both root files
│   ├── robots.ts   # /robots.txt
│   └── sitemap.ts  # /sitemap.xml; list every public page in publicPaths
├── components/
│   ├── layout/     # site chrome (SiteHeader, SiteFooter, Logo, LocaleSwitcher)
│   ├── seo/        # JsonLd for schema.org structured data
│   ├── ui/         # generic primitives (Button, Card, Badge, ProgressBar, ExternalLink)
│   └── <feature>/  # feature components (game/, profile/, achievement/)
├── lib/
│   ├── api/        # data access layer: server-only calls to the .NET API
│   ├── clientIp.ts # visitor IP from proxy headers (server-only)
│   ├── turnstile.ts # server-side human-verification check (server-only)
│   ├── types/      # domain types shared across the app
│   ├── cx.ts       # class-name join helper
│   └── site.ts     # site name, URLs, public contact address (never hard-code these)
├── i18n/
│   ├── config.ts   # locales, localizePath, localeAlternates (safe for proxy, server, client)
│   ├── server.ts   # getLocale, getMessages (pages); loadMessages(locale) (route handlers only)
│   ├── format.ts   # interpolate, plural, number/percent/date formatting
│   ├── rich.tsx    # rich(): React elements inside translated strings
│   └── messages/   # en.json (source of truth), es.json, pt.json
└── proxy.ts        # locale routing: rewrite, redirects, detection, cookie
```

### Styling

- Tailwind utilities only; no CSS modules or CSS-in-JS. Inline `style` is only for values known
  at runtime (e.g. a progress bar's width).
- Use the theme tokens in `@theme` (`bg-surface`, `text-muted`, `text-accent`, `text-gold`…). The
  default Tailwind palette is cleared, so raw palette classes (`bg-zinc-900`) and hex values don't
  exist; add a token in `globals.css` (and the token table in `README.md`) if one is missing.
- Single dark theme (`color-scheme: dark`). New text colors must pass WCAG AA (4.5:1) on
  `background`, `surface`, and `surface-raised`.
- Headings use `font-display`; numbers and code use `font-mono`.
- Reuse `components/ui` primitives before writing new styled elements.
- Links to other sites open in a new tab: use `ExternalLink` (or `ButtonLink` with `external`),
  never a bare `target="_blank"`. Internal links use `next/link`; `mailto:` links stay in the same tab.
- `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`, and `LogoMark` all show the same mark; when
  the logo changes, update the SVGs and regenerate both raster icons (steps in `README.md`).
- Translated text varies in length (Spanish and Portuguese run ~20–30% longer); check all three
  locales at 360px.
- Global base styles in `globals.css` already handle reduced motion (`prefers-reduced-motion`),
  sticky-header scroll padding, `touch-action: manipulation`, and balanced heading wrap; don't
  re-implement them per component.
- Interactive menus close on Escape and outside click, and Escape returns focus to the toggle.
- Mobile-first; every page must work at 360px width.
- Accessible by default: semantic HTML, labelled controls, visible focus, sufficient contrast.
- Images use `next/image`. Achievement icons and cover art are placeholders or developer-uploaded;
  never official/ripped assets.
