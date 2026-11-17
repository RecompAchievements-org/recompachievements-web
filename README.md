# RecompAchievements

**Community-driven achievement tracking for native static recompilations.**

🌐 **[recompachievements.org](https://recompachievements.org/)** · 🐙 [GitHub organization](https://github.com/RecompAchievements-org)

RecompAchievements brings RetroAchievements-style progression, leaderboards, and social profiles to
native PC ports built via **static recompilation** — such as N64, GameCube, PS2, PS3, and PS4
recomp projects (e.g. *Zelda 64: Recompiled*, *BBPort*) — that run outside traditional emulators.

> 🚧 **Status: early development (v0.1).** The web frontend is being built first; the backend API
> and C/C++ SDK will follow.

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

## Ecosystem

| Repository | Visibility | Purpose | License |
|---|---|---|---|
| **recompachievements-web** (this repo) | Public | Website, REST API, database migrations | AGPL-3.0 |
| `librecompachievements` | Public (planned) | C/C++ client SDK embedded in recomps | MIT / Apache-2.0 |
| `api-docs` | Public (planned) | OpenAPI specs for bots, overlays, Steam Deck plugins | — |
| `infra` | Private | Deployment config, secrets, rate-limit rules | — |

## Architecture

```
 ┌────────────────────┐   HMAC-signed    ┌──────────────────────┐      ┌──────────────┐
 │ Recomp executable  │  /api/sdk/v1/*   │                      │─────▶│ PostgreSQL   │
 │ + librecompachieve │ ───────────────▶ │     Backend API      │      └──────────────┘
 └────────────────────┘                  │ (.NET 10 or Fastify) │      ┌──────────────┐
                                         │                      │─────▶│ Redis        │
 ┌────────────────────┐   /api/v1/*      │                      │      └──────────────┘
 │ Next.js frontend   │ ───────────────▶ │                      │      ┌──────────────┐
 │ (SSR, OG embeds)   │                  └──────────────────────┘      │ Cloudflare R2│
 └────────────────────┘                                                │ (icons, art) │
          ▲  browsers, Discord embeds          ▲  community bots       └──────────────┘
```

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 | Server rendering for SEO and Discord/OpenGraph embeds; English, Spanish, and Portuguese (Brazil) |
| Backend API | .NET 10 Minimal APIs *or* Node.js (Fastify) — *to be decided* | High-throughput, strongly typed telemetry API with OpenAPI |
| Database | PostgreSQL 17 | Relational integrity; unique constraints prevent duplicate unlocks |
| Cache / rate limit | Redis (or Valkey) | Rate limiting, live presence heartbeats, cached rarity |
| Asset storage | Cloudflare R2 (S3-compatible) | Badge icons and cover art with zero egress fees |
| Hosting (frontend) | Vercel | First-party support for Next.js 16 features (proxy, Cache Components, partial prerendering); preview deploy per PR |

### API surfaces

- **Public & web API — `/api/v1/...`**: cookie/JWT auth for the website, API keys for community
  tools. e.g. `GET /api/v1/games/{slug}`, `GET /api/v1/users/{username}/progress`.
- **Game client / SDK API — `/api/sdk/v1/...`**:
  - `POST /session/start` — authenticates the player's client token, records the executable's
    build hash, returns achievement definitions and unlock state.
  - `POST /unlock` — verifies `HMAC_SHA256(game_secret, payload)`, rejects timestamps older than
    60 seconds, and applies server-side sanity checks (e.g. minimum playtime).

Both APIs are versioned in the path. Once a version is in use by released recomps or community
tools, breaking changes go to a new version and the old one stays supported until it is retired with
a published notice.

### Data model (MVP)

| Table | Key fields |
|---|---|
| `users` | `username`, `email`, `password_hash`, `api_key`, `client_token` |
| `games` | `slug`, `title`, `platform_origin` (N64, PS4…), `repo_url`, `dev_user_id`, `hmac_secret` (encrypted) |
| `achievements` | `game_id`, `api_key_name`, `title`, `description`, `points`, `icon_url`, `is_secret`, `display_order` |
| `user_unlocks` | `user_id`, `achievement_id`, `unlocked_at`, `build_hash`, `is_hardcore` — unique on `(user_id, achievement_id)` |
| `game_sessions` | `user_id`, `game_id`, `started_at`, `last_heartbeat_at`, `build_hash` |

**Rarity** = players who unlocked the achievement ÷ players who started the game × 100.

### Website pages (v0.1)

| Route | Page |
|---|---|
| `/` | Game directory |
| `/games/[slug]` | Game detail — achievements, points, rarity |
| `/u/[username]` | Player profile — completion, recent unlocks |
| `/dev` | Developer portal — register a recomp, manage achievements and keys |

The site is available in **English** (unprefixed URLs), **Spanish** (`/es/...`), and **Portuguese,
Brazil** (`/pt/...`). See [`frontend/README.md`](frontend/README.md#internationalization).

## Repository structure

```
recompachievements-web/
├── .agents/            # Reviewed agent skills and their Python requirements (see .agents/skills/README.md)
├── frontend/            # Next.js 16 website (see frontend/README.md)
├── backend/             # REST API (planned)
├── docker-compose.yml   # Local PostgreSQL + Redis (planned)
├── AGENTS.md            # Rules for AI coding agents
├── SECURITY.md          # How to report vulnerabilities
└── LICENSE              # AGPL-3.0
```

## Getting started

Requirements: **Node.js 20.9+** (developed on Node 24) and npm.

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run lint`, `npm run build`, `npm run start`.

Backend and database setup will be documented here once they land.

## Deployment

The website is live at **[recompachievements.org](https://recompachievements.org/)**, hosted on
Vercel:

- Every merge to `main` deploys to production.
- Every pull request gets a preview deployment.
- The Vercel project builds the `frontend/` folder with the default Next.js settings.

Account, DNS, and email configuration are kept outside this repository.

## Roadmap

- [x] Project setup and Next.js scaffold
- [x] Website live on recompachievements.org (Vercel), with robots.txt, sitemap, and social preview images
- [ ] Frontend v0.1: design system, game, profile, and directory pages on mock data
- [ ] Backend API, database schema, and migrations
- [ ] Authentication and developer portal
- [ ] `librecompachievements` C/C++ SDK
- [ ] Reference integration with an open-source recomp
- [ ] Leaderboards, live presence, and the public API docs

## Legal & content policy

RecompAchievements tracks **achievement definitions and player progress only**. It does **not**
host or link to game binaries, ROMs, recompiled executables, or copyrighted assets such as official
trophy icons. Achievement art is original or supplied by recomp developers who hold the rights to
use it.

All trademarks belong to their respective owners. RecompAchievements is not affiliated with any game
publisher, platform holder, or with RetroAchievements.

If you believe content on the platform infringes your rights, contact
[contact@recompachievements.org](mailto:contact@recompachievements.org) and we will review it
promptly.

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

## License

[GNU Affero General Public License v3.0](LICENSE). If you run a modified version of this platform
as a network service, you must make your source code available to its users.
