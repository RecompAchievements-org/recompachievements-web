# RecompAchievements — Backend

The REST API behind [recompachievements.org](https://recompachievements.org/): the public web API
(`/api/v1`) used by the website and community tools, and later the game-client API
(`/api/sdk/v1`) used by `librecompachievements`. For the project overview see the
[root README](../README.md); coding rules for this folder live in [`AGENTS.md`](AGENTS.md).

> **Status:** live in production with health checks and the alpha tester sign-up (with double
> opt-in email). Game, account, and SDK endpoints come next.

## Stack

- **.NET 10 (LTS)**, ASP.NET Core **Minimal APIs**
- **EF Core 10** with **PostgreSQL 17** (Npgsql), snake_case table and column names
- **xUnit v3** integration tests against a real PostgreSQL container (Testcontainers)
- Built-in ASP.NET Core rate limiting, ProblemDetails errors, OpenAPI, and health checks
- Container image on Microsoft's minimal "chiseled" runtime (no shell, non-root)

## Getting started

Requirements: **.NET 10 SDK** (pinned in `global.json`) and **Docker**.

```bash
# From the repository root: start PostgreSQL 17 (local-only credentials)
docker compose up -d

# Run the API
dotnet run --project backend/src/RecompAchievements.Api      # http://localhost:5080
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
│   ├── Data/                         # AppDbContext and Migrations/
│   └── Features/<Feature>/           # One folder per feature: endpoints, contracts, entity config
│       └── AlphaSignups/             # Sign-up, confirmation email, expired sign-up cleanup
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
| `InternalApi__Key` | Shared secret between the website and the API; required for `/api/v1` (long random value) |
| `Brevo__ApiKey` | Transactional email API key. Required outside Development; without it, Development logs emails to the console instead |
| `Email__FromAddress`, `Email__FromName` | Sender of outgoing email (`contact@recompachievements.org`, `RecompAchievements`) |
| `Site__BaseUrl` | Website address used in email links (`https://recompachievements.org`; `http://localhost:3000` locally) |

`appsettings.Development.json` holds local-only values (database credentials matching
`docker-compose.yml`, a development internal key); real secrets never go in the repository.
Abuse-protection settings have safe defaults in code and are intentionally not listed here.

**Emails in development:** with no `Brevo__ApiKey`, confirmation emails are written to the API's
console, so you can copy the confirmation link from there.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /health/live` | The process is running (no dependencies checked) |
| `GET /health/ready` | The database is reachable; `503` otherwise |
| `GET /openapi/v1.json`, `GET /scalar` | OpenAPI document and reference UI (Development only) |
| `POST /api/v1/alpha-signups` | Sign up for the alpha; stores a pending sign-up and emails a confirmation link. Always `202` with the same body, so it can't reveal who signed up. Rate limited |
| `POST /api/v1/alpha-signups/confirm` | Confirms with the emailed token: `200` (also if already confirmed), `410` expired (links last 7 days), `404` unknown |

Pending sign-ups whose link expired are deleted automatically.

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

## Performance notes

Chosen for raw performance: Minimal APIs (no MVC), pooled `DbContext`, no-tracking queries by
default, server GC with Dynamic PGO, and ReadyToRun compilation in the container for fast startup.
Native AOT isn't used yet because EF Core's AOT support is still experimental.
