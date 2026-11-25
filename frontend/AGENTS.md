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
  built end to end (database → API → page), so there is no mock-data layer. The exceptions, by
  the owner's request, are `components/progress/sampleProgress.ts` (used by `/progress` and public
  profiles) and `components/profile/sampleBadges.ts`: they must stay labeled "sample data" on
  screen, those pages stay `noindex`, and they're deleted when real data exists.
- `src/lib/api/client.ts` (`apiPost`, typed `ApiResult`, ProblemDetails) is the only place that
  attaches the website's API credentials and request context. Every file under `src/lib/api/` starts
  with `import "server-only"`.
- Forms post to **Server Actions** (`actions.ts` next to the page) and use `useActionState` in a
  small client component. Actions receive the locale as a hidden field (root params aren't
  available there), return error **codes** that the client translates, and never return secrets.
  Validate on the server even when the input has native constraints.
- Mutations triggered by emailed links happen on a button press (POST), never on page load.
- Forms that send email to a typed address (account sign-up, forgot-password)
  include a human-verification challenge (`HumanCheck`, or `HumanCheckSubmit` in account forms).
  Its token must be verified on the server (`verifyHumanToken` in `src/lib/turnstile.ts`) with
  that form's action name before the API is called; never skip or weaken that check, and keep it
  failing closed when its secret is missing.
- **Caching uses `"use cache"`** in data functions, always paired with `cacheLife(...)`, and
  `cacheTag(...)` where the data can be invalidated (e.g. `game:${slug}`). Do not use the legacy
  `fetch` `next: { revalidate }` options or `export const revalidate`.
- Wrap slow or per-user sections in `<Suspense>` with a skeleton fallback so the shell streams.
  Every skeleton **matches the real layout**: same grid, padding, aspect ratios, and line heights,
  built from `ui/Skeleton` (`Skeleton` blocks, `SkeletonText` lines that take the real text's
  classes), so nothing shifts when the content arrives. Keep a component's skeleton next to it
  (`GameCardSkeleton` in `GameCard.tsx`) and update both together. Images fade in over a
  `Skeleton` once loaded (`FadeInImage`, used by `GameArt` and `GameBackdrop`), so they never pop in.
- **The build never needs the API.** Components that render API data call `await connection()`
  first and sit inside `<Suspense>`; the cached data function makes later requests instant. Pages
  with params the build doesn't list (`/games/[slug]`) read `params` inside `<Suspense>` too, and
  anything in the shared layout that reads the URL (`LocaleSwitcher`) has its own boundary.
- Mutations (forms, settings, dev portal) use **Server Actions**, validated on the server.
- Secrets and backend URLs are read only in server code. Only `NEXT_PUBLIC_*` vars reach the client.

### Accounts and sessions

- The session token, the pending Discord/GitHub sign-up, the OAuth `state`/PKCE verifier, and the
  email offer live only in HttpOnly cookies managed by `src/lib/auth/session.ts`. Nothing else
  reads or writes them, and they are never passed to Client Components or put in URLs.
- Read the signed-in account with `getCurrentAccount()` (deduplicated per request) inside
  `<Suspense>`; never outside a boundary, or the page stops being prerendered. Pages that need a
  signed-in visitor redirect to `/sign-in` from inside that boundary.
- Calls made for a visitor use `apiSend` with `visitor()` (session and IP); never cache them.
- `/auth/callback/[provider]` must keep checking the returned `state` against the saved flow
  before sending the code to the API, and each flow is used once (`takeOAuthFlow`).
- The welcome step reads the pending sign-up from its cookie, never from the form.
- Forms that create or replace a password (sign-up, reset) use `NewPasswordFields`: it asks twice
  and shows live whether the two match, and the server still compares them
  (`checkPasswordConfirmation`); the repeated value is never sent to the API. Sign-in asks once.
- Account forms use `EmailField` and `UsernameField` (`components/auth/LiveFields.tsx`) for live
  feedback: format as you type (problems shown after leaving the field, or at once for characters
  that are never allowed) and, for usernames, availability checked after a short pause. Feedback
  lines use the shared `FieldStatus`, which takes no space until it has something to say. The
  server always validates again on submit.
- Account error codes come from the API's `code` field; the list is `AuthError` in
  `src/lib/auth/forms.ts`, translated from `auth.errors`. Add new codes in both places.
- Account pages are `noindex` and stay out of `publicPaths`, including public profiles for now.
- `/account/[username]` is public: it renders only `getPublicPlayer` data and never passes the
  `/me` account to its UI. Anything private belongs in `/account/settings`. A new page directly
  under `/account` must also be added to the API's reserved usernames.
- Profile photos render through `ProfilePhoto` with `unoptimized`, so removed images keep no copy in
  the image cache. Uploads go through the Settings Server Action; the API is what validates them.
- `/moderation` pages call `requireStaff()` inside `<Suspense>` and are `noindex`. That guard only
  hides the page; every permission is enforced by the API. New comment sections offer `ReportButton`
  once their comments are saved.
- Forum posts render only through `components/forum/Markdown.tsx` (headings, paragraphs, lists,
  bold, italic, code, and links to `https://` or site paths). Never render post text as HTML or
  add a Markdown library without asking. The editor preview uses the same renderer.
- Comment UI is shared through `components/comments/CommentThread.tsx` and always renders plain
  text. Every comment section, including future ones, uses it, so each comment shows its author
  column (`CommentAuthor`: photo with profile preview, username, join date). A muted viewer gets
  `blockedNotice` instead of the composer in every section; the API refuses their posts too. Saved threads (walls and game
  pages) use `SavedComments` with a `CommentThreadRef` and show one numbered page at a time
  (`CommentPagination`, `?commentsPage=`; posting returns to page 1, a page past the end redirects
  to the last); reads and writes go through
  `lib/api/comments.ts`, are per visitor, and are never cached.

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
  Counts use `plural()`; numbers and dates use `formatNumber/formatDate`
  from `@/i18n/format`, never `toFixed` or manual formatting.
- Every page's metadata sets `alternates: localeAlternates(locale, "/path")` (canonical + hreflang).
- Translations are written in the target language's gaming vocabulary (`logros`, `conquistas`);
  Portuguese is Brazilian.
- **Copy style:** English headings and buttons use Title Case (Chicago: "I Build a Recomp",
  "Back to Home"); Spanish and Portuguese use sentence case. Use typographic characters in every
  language: `’` and `“ ”`, not `'` and `"`; `…`, not `...` (loading text ends with `…`).
- Brand names and code tokens (`RecompAchievements`, `GitHub`, `AGPL-3.0`) are wrapped in
  `translate="no"` so browser auto-translation leaves them intact.

### Routes (v1.0)

Paths below are unprefixed (English); each also exists under `/es` and `/pt`. Pages live in
`src/app/[lang]/`.

- `/` — home: featured recomps slider (`FeaturedSlider`), games, and the news `CategoryCard`
  (Latest News) at full width at the bottom; primary call to action: Join the Alpha, which opens
  `/sign-up`
- `/privacy` — privacy notice; update its `lastUpdated` date and translations whenever data
  handling changes
- `/content-policy` — what the site hosts, image sources, removal requests; keep it in step with the
  image guardrail
- `/games` — game directory (`GameGrid`)
- `/games/[slug]` — game detail: info, preview notice, and achievements on the left; a sticky
  `GameDetailsCard` on the right (download and repository links, what the player must own,
  platforms, version, license); on phones the card follows the header. Below both, saved player
  comments (`GameCommentsSection`) in their own `<Suspense>`, so the cached game details never wait
  for per-visitor comments
- `/sign-up`, `/sign-in` — create an account or sign in (email and password, Discord, GitHub)
- `/confirm-email` — confirms an account email with the emailed token (button POST)
- `/forgot-password`, `/reset-password` — set or reset a password through an emailed link
- `/welcome` — after a Discord/GitHub sign-up: the account email (or that there is none yet) and
  the username
- `/account` — redirects to the signed-in player's profile, or to `/sign-in`
- `/account/[username]` — public profile: a compact badges card (one to six featured with the
  total earned; two rows of three on phones, one row of six from tablets up; up to three also
  overlap the photo's bottom edge), medal counters with
  featured games (icon, name, platform; up to three in the large Platinum square, one each in the
  Gold and Silver rows beside it; original medal icon, never official
  trophy icons), last achievements earned, subsets
  earned (Mastered and Beaten counters with a list; medals, achievements, and subsets each
  show a short "none earned" legend when empty), completion, and last game played on the left
  (`ProfileSampleSections`, labeled sample data); `ProfileCard` on the right (first on phones) with
  the username on top, photo (staff accounts get a small `StaffRibbon` tab hanging from the middle of its top edge,
  with a thin line along that edge in the same color: Admin in purple, Moderator in gold, named the
  same in every language; the comment preview card shows the same role as a `StaffTag`), points, Elo, ranking (empty until scoring exists), last
  active day, member since, and the progress, settings, and report buttons at the bottom; the comment wall
  below at full width. `noindex`; other casings redirect to the real username
- `/account/settings` — private: profile information (username, account type, member since, last
  activity), account standing (an active mute, or "None"), profile photo (upload, replace, remove), email (add and confirm one when missing), connected platforms,
  password (worded as "change" or "set" depending on whether one exists), sign out
- `/rules` — public community rules; keep them in step with moderation behavior and the content policy
- `/forum` — forum home: each category with its Pinned and Recent Posts sections (skeletons match);
  `/forum/[category]` lists published posts in numbered pages of 25
  (`?page=`), and admins also see drafts and New Post; `/forum/[category]/[slug]` shows a post;
  `/forum/[category]/new` and `/forum/[category]/[slug]/edit` are the admin editor (`requireAdmin`,
  `noindex`). Published reads are cached with the `forum` tag; editor actions call `updateTag`
  (`CategoryCard` is shared with the home page's Latest News). The header's `ReleaseBadge` opens
  `siteConfig.releasePost`; point it at the new announcement with each release
- `/moderation` — staff report queue; `/moderation/reports/[id]`, `/moderation/users/[username]`, and
  `/moderation/log` review a report, an account, and the audit log
- `/account/messages` — placeholder for messages between players; nothing is sent or stored
- `/progress/[username]` — public completion progress; only real, active players (`notFound()`
  otherwise). Sample data, labeled on screen and `noindex`, until real unlocks exist
- `/auth/callback/[provider]` — Route Handler where Discord and GitHub return (unprefixed path,
  registered with each platform)
- `/dev` — developer portal: register a recomp, manage achievements and keys

`/`, `/privacy`, `/content-policy`, `/games`,
and `/games/[slug]` are live in production:
renaming any of them needs a permanent (308) redirect from the old path (RULE-005, exception 2).
Once accounts deploy, the same applies to `/confirm-email` and `/reset-password` (linked from sent
emails), the other account pages, and `/auth/callback/[provider]`, which is also registered with
Discord and GitHub (renaming it means updating both apps too).

Every public page defines its metadata (`metadata` or `generateMetadata`), building on the
defaults and title template in the root layout and including `localeAlternates`.

SEO files (details in `README.md`):

- **Every new public page is added to `publicPaths` in `src/app/sitemap.ts`** in the same change
  (RULE-003); pages that shouldn't be indexed (e.g. `/dev`) are left out.
- `src/app/[lang]/opengraph-image.tsx` is the site-wide social card; game pages have their own in
  `games/[slug]/` (profiles will too). Image routes use `next/og`, inline styles, and the shared
  `socialColors`, fonts, and logo from `src/lib/socialImage.tsx` (they can't read Tailwind tokens);
  keep those colors in sync with `globals.css`.
- Game pages are listed in the sitemap from the API at request time; don't add them to
  `publicPaths`.
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
│   ├── layout/     # site chrome (SiteHeader, SiteFooter, Logo, LocaleSwitcher, SocialLinks)
│   ├── seo/        # JsonLd for schema.org structured data
│   ├── ui/         # generic primitives (Button, Card, Badge, ExternalLink, Skeleton, HumanCheck)
│   └── <feature>/  # feature components (alpha/, auth/, comments/, game/, moderation/, profile/)
├── lib/
│   ├── api/        # data access layer: server-only calls to the .NET API and their response types
│   ├── auth/       # session.ts (account cookies, current account); forms.ts (form rules, error codes)
│   ├── clientIp.ts # visitor IP from proxy headers (server-only)
│   ├── turnstile.ts # server-side human-verification check (server-only)
│   ├── socialImage.tsx # shared pieces of the opengraph-image routes
│   ├── cx.ts       # class-name join helper
│   └── site.ts     # site name, URLs, contact address, social links (never hard-code these)
├── i18n/
│   ├── config.ts   # locales, localizePath, localeAlternates (safe for proxy, server, client)
│   ├── server.ts   # getLocale, getMessages (pages); loadMessages(locale) (route handlers only)
│   ├── format.ts   # interpolate, plural, number/date formatting
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
  sticky-header scroll padding, `touch-action: manipulation`, balanced heading wrap, and the pointer
  cursor on enabled buttons (Tailwind v4 dropped it); don't re-implement them per component.
- Discord and GitHub buttons show the platform's official mark through `PlatformIcon` (simple-icons,
  CC0). Disconnecting a platform uses a red button and a confirmation dialog (`DisconnectButton`).
- Language choices show a country flag (`LocaleFlag`: United States, Spain, Brazil) next to the
  language name. Flags and the footer's official GitHub, Discord, Reddit, and YouTube marks (`SocialLinks`,
  from simple-icons, CC0) are fixed artwork, so they keep their own colors instead of theme tokens.
- Interactive menus close on Escape and outside click, and Escape returns focus to the toggle.
- `BadgeDetails` shows a badge's name, kind, rarity, description, and unlock date on mouse hover,
  tap, and keyboard focus (Escape closes). It renders on `document.body` so cards can't
  clip it, and its button name carries the same details for screen readers.
- `PlayerPreview` is a player’s photo that links to their profile. Its preview opens on mouse hover,
  keyboard focus, or the first tap on touch screens (a second tap follows the link), and loads public
  player data only when opened, once per player in each comment section. It also lists up to three
  featured badges (sample data until real badges exist; by the owner's choice the card has no
  label, and the profile page carries the sample-data notice). It and `BadgeDetails` share `ui/useFloatingPanel`.
- Below `lg`, the header's main links (Games, Forum, GitHub) move into `SiteMenu`, a menu button that
  opens on tap or click and closes on Escape, an outside press, or choosing a link. The release
  badge is always visible: beside the logo from `lg`, and in a strip below the header row before
  that (the sticky header's `scroll-padding-top` in `globals.css` covers both heights).
- The signed-in header menu (`AccountMenu`) opens on mouse hover (a click goes to the profile), on
  the first tap on touch screens (a second tap goes to the profile), and on keyboard focus. Each entry
  has a `MenuIcon`; for staff, Moderation sits in its own separated section.
- Anything that moves on its own (the featured slider) has a pause button, pauses on hover and
  keyboard focus, and doesn't move at all when the visitor prefers reduced motion (`globals.css`
  shortens every animation then, so never drive timing from an animation in that mode).
- Mobile first, per RULE-007: base styles for a 360px phone, breakpoints add desktop layouts, no
  horizontal scrolling at any width, and every visual change is checked at 360px and on desktop.
- Accessible by default: semantic HTML, labelled controls, visible focus, sufficient contrast.
- Images use `next/image`. Game art follows the root guardrail: SteamGridDB images referenced on
  its CDN (the only allowed remote host in `next.config.ts`), shown through `GameArt` (generated
  art when missing), and credited: the slider's overlay and the game page's `GameArtCredits`
  legend. Never commit game images, logos, trophy icons, or ripped assets.
- Above-the-fold images use `loading="eager"`, and the page's main image (its Largest Contentful
  Paint) also `fetchPriority="high"`; never the deprecated `priority` prop. Everything else stays
  lazy. The development-only LCP warning can name a lazy copy of an image that's also shown
  eagerly higher up (same source); that's expected.
