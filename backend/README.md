# RecompAchievements — Backend

The REST API behind [recompachievements.org](https://recompachievements.org/): the public web API
(`/api/v1`) used by the website and community tools, and later the game-client API
(`/api/sdk/v1`) used by `librecompachievements`. For the project overview see the
[root README](../README.md); coding rules for this folder live in [`AGENTS.md`](AGENTS.md).

> **Status:** live in production with health checks, the alpha tester sign-up (with double
> opt-in email), the game directory (preview achievement sets from the catalog), and player
> accounts (email and password, Discord, GitHub), profile photos, walls, and moderation. SDK
> endpoints come next.

## Stack

- **.NET 10 (LTS)**, ASP.NET Core **Minimal APIs**
- **EF Core 10** with **PostgreSQL 17** (Npgsql), snake_case table and column names
- **xUnit v3** integration tests against a real PostgreSQL container (Testcontainers)
- **SkiaSharp** to re-create uploaded photos and the **AWS S3 SDK** for S3-compatible media storage
- Built-in ASP.NET Core rate limiting, ProblemDetails errors, OpenAPI, and health checks
- Container image on Microsoft's minimal "chiseled" runtime (no shell, non-root)

## Getting started

Requirements: **.NET 10 SDK** (pinned in `global.json`) and **Docker**.

```bash
# From the repository root: start PostgreSQL 17 (local-only credentials)
docker compose up -d

# Run the API; restarts by itself after any code or catalog change
dotnet watch --no-hot-reload --project backend/src/RecompAchievements.Api   # http://localhost:5080
```

Then open `http://localhost:5080/health/ready`, or the API reference at
`http://localhost:5080/scalar` (Development only). Sample requests are in
`src/RecompAchievements.Api/RecompAchievements.Api.http`.

## Commands (run from `backend/`)

| Command | Purpose |
|---|---|
| `dotnet build` | Build; any warning fails the build |
| `dotnet test` | Integration tests (needs Docker running) |
| `dotnet tool restore` | Install the pinned `dotnet-ef` tool |
| `dotnet ef migrations add <Name> --project src/RecompAchievements.Api` | Create a migration after changing the model |
| `dotnet ef migrations has-pending-model-changes --project src/RecompAchievements.Api` | Check no model change is missing a migration (CI runs this) |
| `docker build -t recompachievements-api .` | Build the production container image |

When `Database:ApplyMigrationsOnStartup` is `true` (Development, tests, and the hosted
instance), pending migrations are applied when the API starts; EF Core locks the database while
migrating, so two instances starting together can't apply the same migration twice.

## Project structure

```
backend/
├── RecompAchievements.slnx           # Solution
├── global.json                       # .NET SDK pin; enables Microsoft.Testing.Platform for dotnet test
├── Directory.Build.props             # Shared build settings (warnings as errors, server GC, analyzers)
├── Directory.Packages.props          # Central package versions
├── dotnet-tools.json                 # Local tools (dotnet-ef)
├── Dockerfile                        # Multi-stage build, ReadyToRun, chiseled non-root runtime
├── .env.example                      # Environment variables for hosted environments (dummy values)
├── src/RecompAchievements.Api/
│   ├── Program.cs                    # Composition root: wires the pieces below
│   ├── Infrastructure/               # Database, error handling, rate limiting, proxy, security, API docs
│   ├── Infrastructure/Email/         # IEmailSender: transactional email API (hosted) or console logging (Development)
│   ├── Infrastructure/Media/         # IMediaStore: S3-compatible storage and CDN purge, or a local folder (Development)
│   ├── Data/                         # AppDbContext and Migrations/
│   ├── Catalog/Games/                # Curated game catalog: one JSON file per game, imported at startup
│   └── Features/<Feature>/           # One folder per feature: endpoints, contracts, entity config
│       ├── Accounts/                 # Users, sessions, email links, Discord/GitHub sign-in, profile photos, account emails, cleanup
│       ├── Comments/                 # Comments on profile walls and game pages (one shared table)
│       ├── Moderation/               # Reports, staff actions, and the audit log
│       ├── AlphaSignups/             # Sign-up, confirmation email, expired sign-up cleanup
│       └── Games/                    # Games, sets, achievements; catalog import; SteamGridDB art picking
└── tests/RecompAchievements.Api.Tests/
    ├── ApiFactory.cs                 # In-memory API + throwaway PostgreSQL container
    └── <Area>/…Tests.cs
```

## Configuration

Settings come from `appsettings*.json` and environment variables (environment wins). Hosted
environments set these (see `.env.example`):

| Variable | Purpose |
|---|---|
| `ConnectionStrings__Database` | PostgreSQL connection string (required) |
| `ASPNETCORE_ENVIRONMENT` | `Production` when hosted; `Development` locally |
| `ASPNETCORE_HTTP_PORTS` | Listening port inside the container (`8080`) |
| `ForwardedHeaders__TrustAllProxies` | `true` only where the API is reachable solely through the host's proxy |
| `Database__ApplyMigrationsOnStartup` | `true` to apply pending migrations at startup |
| `Catalog__ImportOnStartup` | `true` to import the game catalog at startup (after migrations) |
| `InternalApi__Key` | Shared secret between the website and the API; required for `/api/v1` (long random value). Also the base of the key that signs pending Discord/GitHub sign-ups, so changing it cancels sign-ups in progress |
| `Brevo__ApiKey` | Transactional email API key. Required outside Development; without it, Development logs emails to the console instead |
| `Email__FromAddress`, `Email__FromName` | Sender of outgoing email (`contact@recompachievements.org`, `RecompAchievements`) |
| `Discord__ClientId`, `Discord__ClientSecret` | Optional. The Discord application used for "Continue with Discord"; without both, Discord isn't offered |
| `GitHub__ClientId`, `GitHub__ClientSecret` | Optional. The GitHub OAuth app used for "Continue with GitHub"; without both, GitHub isn't offered |
| `SteamGridDb__ApiKey` | Optional. SteamGridDB API key: games whose catalog file has no `art` get art picked once after startup. Empty: nothing is fetched |
| `MediaStorage__BucketName`, `__ServiceUrl`, `__AccessKey`, `__SecretKey`, `__PublicBaseUrl` | S3-compatible bucket for profile photos and its public CDN address. Without a bucket, Development uses an ignored `.local-media/` folder and other environments turn uploads off |
| `MediaStorage__PurgeUrl`, `MediaStorage__PurgeToken` | CDN purge endpoint and token; required with a bucket outside Development, so removed images leave the CDN |
| `MediaStorage__EvidenceBucketName` | Optional private bucket for evidence kept under a legal hold |
| `Site__BaseUrl` | Website address used in email links (`https://recompachievements.org`; `http://localhost:3000` locally) |

`appsettings.Development.json` holds local-only values (database credentials matching
`docker-compose.yml`, a development internal key); real secrets never go in the repository.
Abuse-protection settings have safe defaults in code and are intentionally not listed here.

**Emails in development:** with no `Brevo__ApiKey`, every email (alpha and account confirmations,
password links, notices) is written to the API's console, so you can copy links from there.

**Discord and GitHub sign-in:** each platform's app must list the website's callback as its
redirect URL: `{Site__BaseUrl}/auth/callback/discord` and `{Site__BaseUrl}/auth/callback/github`
(for local testing, `http://localhost:3000/auth/callback/…`). The Discord app needs the `identify`
and `email` scopes; the GitHub app asks for `user:email`. Both use the authorization code flow
with PKCE; client secrets stay on the API.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /health/live` | The process is running (no dependencies checked) |
| `GET /health/ready` | The database is reachable; `503` otherwise |
| `GET /openapi/v1.json`, `GET /scalar` | OpenAPI document and reference UI (Development only) |
| `POST /api/v1/alpha-signups` | Sign up for the alpha; stores a pending sign-up and emails a confirmation link. Always `202` with the same body, so it can't reveal who signed up. Rate limited |
| `POST /api/v1/alpha-signups/confirm` | Confirms with the emailed token: `200` (also if already confirmed), `410` expired (links last 7 days), `404` unknown |
| `GET /api/v1/games?lang=en` | Games in display order, with their core set's status, achievement count, total points, featured flag, latest version, release date, and image |
| `GET /api/v1/games/{slug}?lang=en` | One game (including original game, repository, and license) with its core-set achievements in order; `404` if unknown |

**Accounts** (`/api/v1/auth`). Signed-in requests send the session token as
`Authorization: Bearer <token>`; errors carry a machine-readable `code` (e.g. `username_taken`)
next to the ProblemDetails fields.

| Route | Purpose |
|---|---|
| `POST /register` | Email + password account; emails a confirmation link. Always `202` (the owner of an already registered email gets an email instead), `409 username_taken`. Rate limited |
| `POST /confirm-email` | Confirms an email with the emailed token (after registering or `email/add`): `200`, `404` unknown or used, `410` expired (links last 24 hours), `409 email_in_use` |
| `POST /resend-confirmation` | Sends the confirmation link again for an unconfirmed registration. Always `202` |
| `POST /sign-in` | Email and password; returns `{ token, expiresAt }`. Every failure is the same `401 invalid_credentials` (unknown email, wrong password, no password set, unconfirmed email). Rate limited |
| `POST /sign-out` | Ends the current session (`204`) |
| `GET /me` | The signed-in account: username, email and whether it's confirmed, password set, connected platforms, `canCollectAchievements`, `isAlphaTester`, `createdAt`, `lastActivityAt`, `role`, `isMuted`, `mutedUntil`, and `avatar` |
| `POST /forgot-password` | Emails a single-use link (1 hour) to set or reset the password, only to a confirmed email. Always `202`. This is also how platform-created accounts set their first password |
| `POST /reset-password` | Sets the password with that link; signs out every session and sends a notice. `404`, `410` |
| `GET /usernames/available?username=` | Whether a username can be chosen |
| `POST /email/add` | Signed in, no confirmed email yet: emails a confirmation link for this address. `409 email_in_use`, `409 email_already_set` |
| `GET /providers` | Platforms configured for sign-in (`discord`, `github`) |
| `POST /oauth/{provider}/start` | The platform's authorize URL, `state`, and PKCE `codeVerifier` (the website keeps the last two) |
| `POST /oauth/{provider}/complete` | Exchanges the code: `403 account_disabled` if the platform ID's account is disabled; `signed-in` with a session when it has an account, else `pending` with a short-lived signed `pendingToken`, the email the new account will use (or `null`), and a suggested username |
| `POST /oauth/complete-signup` | Creates the pending account with the chosen username; returns a session. `409 username_taken`, `400 signup_expired` |
| `POST /oauth/{provider}/connect` | Signed in: connects the platform if its ID isn't on another account (`409 platform_linked_elsewhere`); returns an `emailOffer` (the platform's verified email) only for accounts without a confirmed email |
| `DELETE /connections/{provider}` | Signed in: disconnects a platform, only if a confirmed email with a password or the other platform remains (`409 last_sign_in_method`) |
| `PUT /photo?rightsConfirmed=true` | Uploads or replaces the player's photo (raw image body). Needs a confirmed email, an established account, no active mute, and the rights confirmation. Accepts static JPEG, PNG, or WebP and stores new square WebP files. `400 photo_invalid`, `400 photo_rights_required`, `403 account_muted`, `403 photo_not_allowed_yet`, `503 photos_unavailable`. Rate limited |
| `DELETE /photo` | Deletes the player's photo (`204`). Rate limited |

A **disabled** account (`users.is_enabled = false`) keeps its data, and its email and platform IDs
stay reserved, but it can't use anything: its sessions stop working on the next request, email
sign-in gets the usual `401 invalid_credentials`, platform sign-in gets `403 account_disabled`, and
no emailed link is sent or accepted. `users.edited_at` is null until the account's data first
changes. `users.last_activity_at` starts at creation and moves forward on sign-in and session use;
it survives sign-out and session cleanup and doesn't count as an edit.

**Players and walls** (`/api/v1/users/{username}`, matched ignoring case; `404` for unknown names,
disabled accounts, and unconfirmed registrations). Names of pages under `/account` are reserved.

| Route | Purpose |
|---|---|
| `GET /` | Public information only: `username`, `createdAt`, `lastActiveOn` (a UTC date, never a time), and `avatar` (`small` and `large` URLs, or `null`) |
| `GET /wall?before=<id>` | A page of comments, newest first, with each author’s username, join date, and photo, `canDelete` for the signed-in viewer, and a `nextCursor`. Comments by disabled accounts are hidden |
| `POST /wall` | Signed in with a confirmed email (`403 email_required`) and not muted (`403 account_muted`): posts plain text, up to 1000 characters. Rate limited |
| `DELETE /wall/{id}` | The comment's author or the wall's owner (`204`); anyone else gets `404`. Rate limited |

**Game comments** (`/api/v1/games/{slug}/comments`; `404` for unknown games) share the wall's
rules and response shape: anyone reads, posting needs a confirmed email and no active mute, and the
posting limit is shared with walls. `DELETE /{id}` is for the comment's author only (anyone else
gets `404`); staff remove others through moderation. Removing a game from the catalog deletes its
comments.

**Moderation.** `POST /api/v1/reports` lets a signed-in player report a `profile`, `photo`, or
`comment` (`202`, also for a repeated open report; `400 cannot_report_self`; rate limited).
Everything under `/api/v1/moderation` is for staff: anyone else gets `404`, and the role is read
from the database on every request. Writes need a reason, are rate limited, commit with their audit
entry, and answer `403 moderation_forbidden` when the target isn't allowed.

| Route | Purpose |
|---|---|
| `GET /reports?status=&before=`, `GET /reports/{id}` | The report queue and one report with its target and account summary |
| `POST /reports/{id}/resolve`, `/dismiss` | Closes a report and tells the reporter the outcome |
| `GET /users/{username}` | Account summary for staff, with no email or platform IDs |
| `GET /log?before=` | The append-only audit log |
| `POST /comments/{id}/remove` | Removes a comment (wall or game page) and emails its author the reason; report reviews include `commentLocation` to open it in context |
| `POST /users/{username}/photo/remove` | Deletes a photo, purges it from the CDN, and emails the reason |
| `POST /users/{username}/mute`, `/unmute` | Mutes until a date, or ends the mute |
| `POST /users/{username}/disable`, `/enable` | Disables an account (ends its sessions and removes its photo) or enables it |
| `PUT /users/{username}/role` | Admin only: changes a role |
| `POST /users/{username}/photo/legal-hold` | Admin only, for serious illegal content: preserves a private copy, unpublishes the image, and disables the account without emailing its owner |

Pending alpha sign-ups whose link expired are deleted automatically, and so are expired sessions
and email links, email + password registrations never confirmed before their link expired, and
moderation text evidence after 90 days (except legal holds). `lang` is `en`, `es`, or `pt`
(default `en`); text without a translation falls back to English.

### Conventions for all endpoints

- Public endpoints live under `/api/v1`; the game-client SDK will use `/api/sdk/v1`.
- `/api/v1` is called only by the website's server code and requires the shared internal key
  (`401` otherwise).
- Errors are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) ProblemDetails
  (`application/problem+json`) with a `traceId`, including `404` and `429`.
- Requests are rate limited; exceeding a limit returns `429` with a `Retry-After` header.
- Request bodies are limited to 1 MB; responses send `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`.
- Logs are structured JSON outside Development.

## Game catalog

Until the developer portal exists, games come from `src/RecompAchievements.Api/Catalog/Games/`,
one `<slug>.json` file per game (see an existing file for the format). At startup the API
validates every file and makes the database match the catalog in one transaction: games and
achievements are matched by `slug` and `apiKeyName` (ids stay stable), new ones are added, and
ones removed from the catalog are deleted. An invalid catalog stops startup with a list of every
problem.

Every game names its `originalGame` (the game players need their own copy of, shown on its page).
Optional fields: `license` (the project's SPDX id; leave it out when the repository has none),
`featured` (shown in the homepage slider), `latestVersion` and
`releasedAt` (the recomp's latest release; the date can't be in the future), `art` with an
optional `cover` (2:3 grid), `hero` (wide background), and `icon` from SteamGridDB, each as
`{ url, sourceUrl, author }`, and `steamGridDbId` (the game's SteamGridDB id, when searching by
`originalGame` would find the wrong game).

**Where a game's art comes from:**

| `art` in the catalog file | Result |
|---|---|
| With images | Curated: used as is, never fetched |
| `{}` (empty) | Opted out: generated art, never fetched (use it for takedowns or wrong matches) |
| Missing | Picked automatically once after startup through SteamGridDB's API (needs `SteamGridDb__ApiKey`): the best-rated static, safe-for-work cover, hero (3840×1240 when available, since the slider enlarges it), and icon; kept across restarts, picked again only if `steamGridDbId` changes. Lookups that fail are retried on the next start |

**Adding or editing a game:**

1. Add or edit `Catalog/Games/<slug>.json`. Write **original** achievement text in English (Spanish
   and Portuguese optional but expected); never copy official trophy lists or icons.
2. Follow the rules in [`docs/achievement-system.md`](../docs/achievement-system.md): points 1–10,
   at least one `win_condition`, rarity caps per set, and `progressionStep` on story milestones.
3. Run `dotnet test`: `Shipped_catalog_is_valid` checks every file. With the API running under
   `dotnet watch --no-hot-reload`, saving the file restarts it and re-imports the catalog.
4. **Art:** leave `art` out to have it picked automatically, or curate it: on SteamGridDB, open
   the game and pick a 600×900 grid (`cover`), a hero (`hero`), and optionally an icon. For each, copy the image link (on `cdn2.steamgriddb.com`) as `url`, the
   asset's page (`https://www.steamgriddb.com/grid/…`, `/hero/…`, `/icon/…`) as `sourceUrl`, and
   the uploader's name as `author`. Never download the files into the repository, and never use
   logos.
5. After the change is deployed, the website shows it within a few hours (its cache lifetime).

## Performance notes

Chosen for raw performance: Minimal APIs (no MVC), pooled `DbContext`, no-tracking queries by
default, server GC with Dynamic PGO, and ReadyToRun compilation in the container for fast startup.
Native AOT isn't used yet because EF Core's AOT support is still experimental.
