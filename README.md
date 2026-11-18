# RecompAchievements

**Community-driven achievement tracking for native static recompilations.**

🌐 **[recompachievements.org](https://recompachievements.org/)** · 🐙 [GitHub organization](https://github.com/RecompAchievements-org) · 💬 [Reddit](https://www.reddit.com/user/RecompAchievements/) · ▶️ [YouTube](https://www.youtube.com/@RecompAchievements)

RecompAchievements brings RetroAchievements-style progression, leaderboards, and social profiles to
native PC ports built via **static recompilation** — such as N64, GameCube, PS2, PS3, and PS4
recomp projects (e.g. *Zelda 64: Recompiled*, *bbport* for Bloodborne) — that run outside
traditional emulators.

> 🚧 **Status: alpha (v0.1).** The website and the API are live, with the alpha tester sign-up
> open and a game directory of preview achievement sets. Accounts and the C/C++ SDK come next.

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
 │ (SSR, OG embeds)   │                  └──────────────────────┘      │ Cloudflare R2│
 └────────────────────┘                                                │ (icons, art) │
          ▲  browsers, Discord embeds          ▲  community bots       └──────────────┘
```

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 | Server rendering for SEO and Discord/OpenGraph embeds; English, Spanish, and Portuguese (Brazil) |
| Backend API | .NET 10 (LTS) · ASP.NET Core Minimal APIs · EF Core | Raw performance for the high-frequency SDK telemetry API; strong typing; built-in OpenAPI |
| Database | PostgreSQL 17 | Relational integrity; unique constraints prevent duplicate unlocks |
| Cache / rate limit | Redis (or Valkey), added when needed | Live presence heartbeats, cross-instance rate limits, cached rarity (in-memory rate limiting until then) |
| Asset storage | Cloudflare R2 (S3-compatible) | Badge icons and cover art with zero egress fees |
| Hosting (frontend) | Vercel | First-party support for Next.js 16 features (proxy, Cache Components, partial prerendering); preview deploy per PR |

### API surfaces

- **Public & web API — `/api/v1/...`**: cookie/JWT auth for the website, API keys for community
  tools. e.g. `GET /api/v1/games/{slug}`, `GET /api/v1/users/{username}/progress`.
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
Gold, and Platinum** badges; subsets award **Beaten** and **Mastered**.

Until the developer portal exists, games and their **preview sets** (original achievement text,
not active until a recomp integrates the SDK) come from a curated catalog in
`backend/src/RecompAchievements.Api/Catalog/Games/`, one JSON file per game. The catalog also
marks which games are **featured** on the homepage and their latest version and release date.

The full design, including the data model and the SDK operations, is in
[`docs/achievement-system.md`](docs/achievement-system.md).

### Website pages (v0.1)

| Route | Page |
|---|---|
| `/` | Home: alpha sign-up, featured recomps slider, and games |
| `/alpha` | Alpha tester sign-up (email confirmation required) |
| `/privacy` | Privacy notice |
| `/content-policy` | What the site hosts, image sources, and removal requests |
| `/games` | Game directory |
| `/games/[slug]` | Game detail — achievements, points, rarity |
| `/u/[username]` | Player profile — completion, recent unlocks |
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
- [ ] Authentication, player profiles, game comments (the game page has a not-saved preview), and
  developer portal. The portal **replaces the JSON game catalog**: games and achievements are then
  edited only through it and stored only in PostgreSQL, and the catalog importer is deleted.
- [ ] `librecompachievements` C/C++ SDK
- [ ] Launch integration: bbport (Bloodborne), the first supported recomp and the SDK's reference
  integration (see [Launch target](#launch-target-bbport-bloodborne-)). **Requires the catalog to be
  replaced first:** its import deletes achievements removed from the files, which would erase
  players' unlocks once real unlocks exist.
- [ ] Leaderboards, live presence, and the public API docs

## Legal & content policy

RecompAchievements tracks **achievement definitions and player progress only**. It does **not**
host or link to game binaries, ROMs, or recompiled executables, and it never uses official box
art, key art, game logos, or trophy icons. Achievement text is original. Game images are either
screenshots and banners published by the recomp project and used with its permission, or our own
gameplay screenshots of the recomp, each credited; games without one get generated artwork.

All trademarks belong to their respective owners. RecompAchievements is not affiliated with any game
publisher, platform holder, or with RetroAchievements.

If you believe content on the platform infringes your rights, contact
[contact@recompachievements.org](mailto:contact@recompachievements.org); valid requests are
handled within 5 business days. The full policy is on the website's
[content policy](https://recompachievements.org/content-policy) page.

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
