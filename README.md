# RecompAchievements

**Community-driven achievement tracking for native static recompilations.**

🌐 **[recompachievements.org](https://recompachievements.org/)** · 🐙 [GitHub organization](https://github.com/RecompAchievements-org) · 💬 [Reddit](https://www.reddit.com/user/RecompAchievements/) · ▶️ [YouTube](https://www.youtube.com/@RecompAchievements)

RecompAchievements brings RetroAchievements-style progression, leaderboards, and social profiles to
native PC ports built via **static recompilation** — such as N64, GameCube, PS2, PS3, and PS4
recomp projects (e.g. *Zelda 64: Recompiled*, *bbport* for Bloodborne) — that run outside
traditional emulators.

> 🚧 **Status: alpha (v0.1).** The website and the API are live, with the alpha tester sign-up
> open, a game directory of preview achievement sets, and player accounts (email and password,
> Discord, or GitHub) with public profiles, profile photos, comment walls, and community
> moderation. The developer portal and the C/C++ SDK come next.

---

## Why

[RetroAchievements](https://retroachievements.org/) works by reading emulator memory through
`rcheevos`. Static recompilations translate console code into **native x86_64/ARM executables**, so
there is no emulator to hook into — players who prefer native ports (high frame rates, widescreen,
mods) have no achievement tracking.

Recompilations also make something better possible: because developers control the native code, an
achievement can fire from the **exact game function** that matters (e.g. the frame a boss-death
routine runs) instead of watching memory addresses.

## Goals

1. **A standard for recomp achievements.** One lightweight, open SDK any recomp can drop in:
   `RA_UnlockAchievement("BOSS_GASCOIGNE")`.
2. **A home for players.** Profiles, completion percentages, rarity stats, recent unlocks, and
   (later) leaderboards and live "currently playing" presence.
3. **Tools for recomp developers.** A portal to register a recomp, define achievement sets, and
   manage API keys.
4. **Mod-friendly by design.** Support quality-of-life mods and randomizers, with a hardcore mode
   tied to verified builds for players who want it.
5. **Open and trustworthy.** Fully open-source platform; security comes from cryptographic signing,
   not obscurity.

## Launch target: bbport (Bloodborne 🩸)

[bbport](https://github.com/deadinside28/bloodborne_pc), the native Linux and Windows port of
*Bloodborne*, is the **first recomp the platform will support** and the goal for its public
launch. It is the SDK's reference integration and the end-to-end test of the whole system: signed
unlocks, hardcore rules, presence, and scoring all have to work in it first. If needed, the
integration will be contributed to bbport by this project, in agreement with its maintainers.

What that means for design decisions:

- The SDK must build into a C++ project on Windows, Linux, and the Steam Deck.
- bbport is licensed under GPL-2.0, so the SDK must stay usable from GPL-2.0 code (its MIT option
  allows that; Apache-2.0 alone would not).
- bbport has online co-op, so co-op achievements and sessions with other players are first-class
  cases, not edge cases.

## Ecosystem

| Repository | Visibility | Purpose | License |
|---|---|---|---|
| **recompachievements-web** (this repo) | Public | Website, REST API, database migrations | AGPL-3.0 |
| `librecompachievements` | Public (planned) | C/C++ client SDK embedded in recomps | MIT / Apache-2.0 (MIT keeps it usable from GPL-2.0 recomps such as bbport) |
| `api-docs` | Public (planned) | OpenAPI specs for bots, overlays, Steam Deck plugins | — |
| `infra` | Private | Deployment configuration | — |

## Architecture

```
 ┌────────────────────┐   HMAC-signed    ┌──────────────────────┐      ┌──────────────┐
 │ Recomp executable  │  /api/sdk/v1/*   │                      │─────▶│ PostgreSQL   │
 │ + librecompachieve │ ───────────────▶ │     Backend API      │      └──────────────┘
 └────────────────────┘                  │ (.NET 10, EF Core)   │      ┌──────────────┐
                                         │                      │─────▶│ Redis (later)│
 ┌────────────────────┐   /api/v1/*      │                      │      └──────────────┘
 │ Next.js frontend   │ ───────────────▶ │                      │      ┌──────────────┐
 │ (SSR, OG embeds)   │                  └──────────────────────┘      │ Media storage│
 └────────────────────┘                                                │ (photos, CDN)│
          ▲  browsers, Discord embeds          ▲  community bots       └──────────────┘
```

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 | Server rendering for SEO and Discord/OpenGraph embeds; English, Spanish, and Portuguese (Brazil) |
| Backend API | .NET 10 (LTS) · ASP.NET Core Minimal APIs · EF Core | Raw performance for the high-frequency SDK telemetry API; strong typing; built-in OpenAPI |
| Database | PostgreSQL 17 | Relational integrity; unique constraints prevent duplicate unlocks |
| Cache / rate limit | Redis (or Valkey), added when needed | Live presence heartbeats, cross-instance rate limits, cached rarity (in-memory rate limiting until then) |
| Media storage | S3-compatible object storage behind a CDN | Player profile photos, processed by the API and served from a separate media address |
| Hosting (frontend) | Vercel | First-party support for Next.js 16 features (proxy, Cache Components, partial prerendering); preview deploy per PR |

### API surfaces

- **Public & web API — `/api/v1/...`**: called by the website's server with its internal key;
  signed-in visitors are identified by an opaque session token that the website keeps in an
  HttpOnly cookie (the browser never calls the API). API keys for community tools come later.
  e.g. `GET /api/v1/games/{slug}`, `POST /api/v1/auth/sign-in`, `GET /api/v1/auth/me`.
- **Game client / SDK API — `/api/sdk/v1/...`**:
  - `POST /session/start` — authenticates the player's client token, records the executable's
    build hash, toggles, and active mods, returns achievement definitions and unlock state.
  - `POST /unlock` — accepts only requests signed with the game's secret key, then applies
    server-side integrity checks before recording the unlock.

Both APIs are versioned in the path. Once a version is in use by released recomps or community
tools, breaking changes go to a new version and the old one stays supported until it is retired with
a published notice.

### Achievements, scoring, and data model

Achievements belong to **sets** (a core set per game plus DLC, mod, randomizer, and challenge
subsets). Each has developer-set **points** (1–10) and a fixed **rarity tier**; only **hardcore**
unlocks (verified build, no assists, allowlisted mods) count toward the **global score**, which adds
a nightly-recalculated **Elo bonus** for achievements few players have. Core sets award **Silver,
Gold, and Platinum** medals; subsets award **Beaten** and **Mastered**. Medals can be upgraded but
never downgraded by gameplay, even when playing later with in-game hacks. If achievements weren't
legitimately earned (forged unlocks, or earned with a hidden hack), a moderator can remove them,
which also removes their points and lowers or removes the medal. Removed achievements can be earned
again legitimately; repeat or serious cheaters have their accounts disabled.

Until the developer portal exists, games and their **preview sets** (original achievement text,
not active until a recomp integrates the SDK) come from a curated catalog in
`backend/src/RecompAchievements.Api/Catalog/Games/`, one JSON file per game. The catalog also
marks which games are **featured** on the homepage and their latest version and release date.

The full design, including the data model and the SDK operations, is in
[`docs/achievement-system.md`](docs/achievement-system.md).

### Accounts

A player account can be identified by up to three things, each unique: an **email**, a **Discord
ID**, and a **GitHub ID**. People sign up with email and password (confirmed by email) or with
Discord or GitHub; the other methods can be connected later from Settings.

- **Only accounts with a confirmed email can collect achievements.** A Discord/GitHub sign-up uses
  the platform's verified email when it gives one (and no other account has it); otherwise the
  account starts without an email, and the player adds and confirms one through our own email.
- Only the platform's ID finds an account; emails never link or merge accounts. Connecting a
  platform never changes the account email.
- Signing in with email needs a confirmed email and a password. Accounts created through Discord or
  GitHub get their first password through the emailed "set or reset your password" link.
- Alpha testers are recognized when their confirmed account email matches a confirmed alpha
  sign-up; nothing extra is stored.
- Every player has a **public profile** at `/account/<username>` with a comment **wall**. Anyone
  can read it; accounts with a confirmed email can post; a comment's author or the wall's owner can
  delete it. Profiles show only the username, join date, last active day, and score fields, and
  stay out of search engines for now. Email and sign-in details live in private Settings.
- An account can be **disabled** without deleting it: it can't sign in or use its sessions or
  emailed links, and its email and platform IDs stay reserved.
- Established accounts with a confirmed email can upload a **profile photo**, confirming they may
  use the image. The API re-creates every upload as a square WebP without metadata.

Data: `users` (username, email, confirmation, Discord and GitHub IDs, password hash, enabled flag,
role, mute end, profile photo, created, edited, and last activity dates), `user_sessions`
(hashed session tokens), `user_tokens` (hashed single-use email links), `wall_comments`
(plain-text comments on public profiles), `moderation_reports`, and the append-only
`moderation_actions` audit log. Endpoints are listed in
[`backend/README.md`](backend/README.md#endpoints).

### Community moderation

Photos and comments are public as soon as they're posted. Signed-in players can **report** a
profile, photo, or comment, and **moderators** review the queue. They can remove content, **mute**
an account (no comments or photo changes until a set date, but it can still earn achievements), or
disable it. Each decision needs a reason, is recorded in an audit log, and is emailed to the player
with how to appeal. **Admins** also manage roles. Copyright complaints use notice and takedown:
valid requests to `contact@recompachievements.org` are handled within 5 business days, and repeat
infringers are disabled. The public rules are at `/rules`.

### Website pages (v0.1)

| Route | Page |
|---|---|
| `/` | Home: alpha sign-up, featured recomps slider, and games |
| `/alpha` | Alpha tester sign-up (email confirmation required) |
| `/sign-up`, `/sign-in` | Create an account or sign in: email and password, Discord, or GitHub |
| `/confirm-email` | Confirms an account email with the emailed link |
| `/forgot-password`, `/reset-password` | Set or reset a password through an emailed link |
| `/welcome` | After a Discord/GitHub sign-up: shows the account email (or that there is none yet) and picks the username |
| `/account` | Sends signed-in players to their own profile |
| `/account/[username]` | Public player profile: a compact badges card (one to six featured, with the total earned; up to three also shown on the photo's bottom edge), Platinum, Gold, and Silver medal counters (up to three featured Platinum games, one each for Gold and Silver), last achievements earned, subsets earned (Mastered and Beaten), completion, and last game played (labeled sample data for now) beside a card with the username on top, photo, points, Elo, ranking, last activity, member since, and the progress, settings, and report buttons at the bottom; full-width comment wall below |
| `/account/settings` | Private settings: profile photo, email, connected platforms, password, sign out |
| `/account/messages` | Placeholder for messages between players (future feature) |
| `/progress/[username]` | Public completion progress of a player; shows labeled sample data until real unlocks exist |
| `/privacy` | Privacy notice |
| `/content-policy` | What the site hosts, image sources, and removal requests |
| `/rules` | Community rules: allowed content, copyright, reports, consequences, and appeals |
| `/moderation` | Staff only: report queue, report and account reviews, and the audit log |
| `/games` | Game directory |
| `/games/[slug]` | Game detail — achievements, points, rarity |
| `/dev` | Developer portal — register a recomp, manage achievements and keys |

The site is available in **English** (unprefixed URLs), **Spanish** (`/es/...`), and **Portuguese,
Brazil** (`/pt/...`). See [`frontend/README.md`](frontend/README.md#internationalization).

## Repository structure

```
recompachievements-web/
├── .agents/            # Reviewed agent skills and their Python requirements (see .agents/skills/README.md)
├── .github/workflows/   # CI (ci.yml): backend and frontend checks on every PR, summarized as "CI result"
├── frontend/            # Next.js 16 website (see frontend/README.md)
├── backend/             # .NET 10 REST API (see backend/README.md)
├── docker-compose.yml   # Local PostgreSQL 17 for development
├── docs/                # Design docs (achievement-system.md)
├── AGENTS.md            # Rules for AI coding agents
├── SECURITY.md          # How to report vulnerabilities
└── LICENSE              # AGPL-3.0
```

## Getting started

Requirements: **Node.js 20.9+** (developed on Node 24) and npm; **.NET 10 SDK** and **Docker**
for the backend.

```bash
# Website
cd frontend
npm install
cp .env.example .env.local   # local API address, internal key, and test human-check keys
npm run dev                  # http://localhost:3000

# Database + API (from the repository root)
docker compose up -d         # PostgreSQL 17 on localhost:5432
dotnet watch --no-hot-reload --project backend/src/RecompAchievements.Api   # http://localhost:5080, restarts on changes
```

More commands (tests, migrations, Docker image) are in [`frontend/README.md`](frontend/README.md)
and [`backend/README.md`](backend/README.md).

## Deployment

The website is live at **[recompachievements.org](https://recompachievements.org/)**, hosted on
Vercel:

- Every merge to `main` deploys to production.
- Every pull request gets a preview deployment.
- The Vercel project builds the `frontend/` folder with the default Next.js settings.

The API runs as a container built from `backend/` (its `Dockerfile`), deploys from `main`, and
applies pending database migrations at startup.

Account, DNS, and email configuration are kept outside this repository.

## Roadmap

- [x] Project setup and Next.js scaffold
- [x] Website live on recompachievements.org (Vercel), with robots.txt, sitemap, and social preview images
- [x] Frontend foundations: design system, layout, and English/Spanish/Portuguese translations
- [x] Backend foundations: .NET 10 API, PostgreSQL, integration tests, container image, and CI
- [x] Alpha tester sign-up: the first end-to-end feature, with the API deployed
- [x] Game directory and game pages backed by the API, with preview achievement sets
- [x] Accounts and sign-in: email and password, Discord, and GitHub, with the confirmed email
  required to collect achievements
- [x] Public player profiles with comment walls (scores are placeholders until real unlocks exist)
- [x] Profile photos and community moderation: reports, roles, content removal, mutes, disabled
  accounts, an audit log, and public community rules
- [ ] Saved game comments (the game page has a not-saved preview) and developer portal. The portal **replaces the JSON game catalog**: games and achievements are then edited
  only through it and stored only in PostgreSQL, and the catalog importer is deleted.
- [ ] `librecompachievements` C/C++ SDK
- [ ] Launch integration: bbport (Bloodborne), the first supported recomp and the SDK's reference
  integration (see [Launch target](#launch-target-bbport-bloodborne-)). **Requires the catalog to be
  replaced first:** its import deletes achievements removed from the files, which would erase
  players' unlocks once real unlocks exist.
- [ ] Moderator tools for removing achievements not legitimately earned, later assisted by an
  automated bot
- [ ] Leaderboards, live presence, and the public API docs

## Legal & content policy

RecompAchievements tracks **achievement definitions and player progress only**. It does **not**
host or link to game binaries, ROMs, or recompiled executables, and it never uses game logos or
official trophy icons. Achievement text is original. Game art (covers, backgrounds, icons) comes
from [SteamGridDB](https://www.steamgriddb.com/), chosen by hand or picked from its top-rated
images through its official API, loaded from its servers rather than stored here, and credited on each game page with the artist and a link; it is used only to
identify the game. Games without art get generated artwork.

All trademarks belong to their respective owners. RecompAchievements is not affiliated with any game
publisher, platform holder, or with RetroAchievements.

If you believe content on the platform infringes your rights, contact
[contact@recompachievements.org](mailto:contact@recompachievements.org); valid requests are
handled within 5 business days. Profile photos are uploaded by players, who confirm they may use
them, and repeat infringers are disabled. The full policy is on the website's
[content policy](https://recompachievements.org/content-policy) and
[community rules](https://recompachievements.org/rules) pages.

## Contributing

The project is in its early stages. Issues and ideas are welcome. Before opening a pull request,
please open an issue to discuss larger changes. Write code, comments, docs, and commit messages in
English, and update any documentation your change affects in the same pull request. AI-assisted
contributions should follow [`AGENTS.md`](AGENTS.md).

**On AI assistance:** AI tools are used in the development of this project. Every change is
reviewed and committed by a human maintainer, and only people are credited as contributors.

## Contact

- **General questions, recomp developer partnerships, press:**
  [contact@recompachievements.org](mailto:contact@recompachievements.org)
- **Security vulnerabilities:** please **do not** open a public issue — see
  [`SECURITY.md`](SECURITY.md).
- **Bugs and feature requests:** [GitHub Issues](https://github.com/RecompAchievements-org/recompachievements-web/issues)
- **News and announcements:** [u/RecompAchievements on Reddit](https://www.reddit.com/user/RecompAchievements/)
  and [@RecompAchievements on YouTube](https://www.youtube.com/@RecompAchievements)

## License

[GNU Affero General Public License v3.0](LICENSE). If you run a modified version of this platform
as a network service, you must make your source code available to its users.
