# AGENTS.md — recompachievements-web

Shared rules for any AI coding agent working in this repository. Subfolders have their own
`AGENTS.md` with stack-specific rules; those add to these and win when they conflict.

## Project context

RecompAchievements.org is a community achievement-tracking platform (like RetroAchievements) for
**native static recompilations and PC ports** (e.g. Zelda 64: Recompiled, BBPort). These run as
native executables, not inside emulators, so they integrate through a C/C++ SDK
(`librecompachievements`, separate repo) that calls this platform's API.

This repo contains the public web platform:

| Path | Purpose | Status |
|---|---|---|
| `frontend/` | Next.js 16 App Router site (React, TypeScript, Tailwind CSS v4) | Active |
| `backend/` | REST API: public `/api/v1/...` and game-client `/api/sdk/v1/...` | Planned (.NET 10 or Fastify, undecided) |
| `docker-compose.yml` | Local PostgreSQL 17 + Redis | Planned |

Read `README.md` for the full architecture and data model.

## Hard guardrails (never break these)

- **No copyrighted game content.** Never add game binaries, ROMs, recompiled executables, ripped
  assets, or official trophy/achievement icons. Use original or generated placeholder art.
- **No secrets in the repo.** API keys, HMAC secrets, DB credentials, and session keys come from
  environment variables. Commit only `.env.example` files with dummy values.
- **Unlocks must not be forgeable.** SDK unlock requests are verified with HMAC-SHA256 using a
  per-game secret, reject stale timestamps (> 60 s), and pass server-side sanity checks. Never
  weaken or bypass this, even for testing — use test fixtures instead.
- **One unlock per user per achievement.** Enforced by a unique constraint on
  `(user_id, achievement_id)`; code must tolerate duplicate submissions idempotently.
- **License is AGPL-3.0.** Don't add dependencies with incompatible licenses (e.g. proprietary or
  "non-commercial only") without flagging it.

## Working conventions

- Make the smallest change that solves the task; don't refactor unrelated code.
- Match the existing style of the file you're editing. Prefer clear names over comments.
- Keep each project's commands working before calling a task done (see the subfolder `AGENTS.md`).
- Don't add new top-level folders or tooling (package managers, linters, CI) without asking.
- Package manager: **npm** for JavaScript/TypeScript projects.

## Git

- Default branch is `main`. Work on feature branches (`feat/...`, `fix/...`, `chore/...`).
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat(frontend): add game detail page`). Scope with `frontend`, `backend`, or `repo`.
- Never commit `.env*` files (except `.env.example`), build output, or `node_modules`.
- Don't commit, push, or open PRs unless asked.

## Domain vocabulary

- **Recomp** — a native port produced by static recompilation of a console game.
- **Game** — a recomp registered on the platform, identified by `slug` (e.g. `bbport-pc`).
- **Achievement** — defined per game; `api_key_name` (e.g. `BOSS_GASCOIGNE`) is the identifier the
  SDK sends.
- **Unlock** — a user earning an achievement; records `build_hash` (SHA-256 of the executable) and
  `is_hardcore`.
- **Session** — a play session started by the SDK; powers live presence and minimum-playtime checks.
- **Rarity** — `unlocked_players / players_who_started_game × 100`.
