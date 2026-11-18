# AGENTS.md — backend

Rules for AI agents working in `backend/`. They add to the root [`AGENTS.md`](../AGENTS.md), whose
numbered rules (RULE-001 to RULE-006) and guardrails always apply. Setup and commands for people
are in [`README.md`](README.md).

Stack: .NET 10 (LTS) · ASP.NET Core Minimal APIs · EF Core 10 · PostgreSQL 17 (Npgsql) · xUnit v3 +
Testcontainers.

## Commands that must pass (run from `backend/`)

- `dotnet build` — zero warnings (warnings are errors)
- `dotnet test` — all tests green (Docker must be running)
- `dotnet ef migrations has-pending-model-changes --project src/RecompAchievements.Api` — no changes
- `docker build -t recompachievements-api .` when the Dockerfile, project files, or packages change

## Structure and conventions

- `Program.cs` is only the composition root: it calls `Add…`/`Use…`/`Map…` extension methods.
  Cross-cutting setup lives in `Infrastructure/`, one concern per file.
- Each feature lives in `Features/<Feature>/`: `<Feature>Endpoints.cs` with a
  `Map<Feature>Endpoints(this RouteGroupBuilder group)` method, its request/response records, and its
  EF entity configuration (`IEntityTypeConfiguration<T>`). No controllers, no MVC.
- Public endpoints are mapped on the `/api/v1` route group in `Program.cs`, which requires the
  website's internal key (`RequireInternalKey()`); SDK endpoints will use `/api/sdk/v1` (create that
  group with its first endpoint, not before — RULE-005).
- Resolve the client's address only with `ClientAddress.Resolve(context)`; never read request
  headers for it directly.
- Endpoints return `TypedResults` (`Results<Ok<T>, NotFound, …>`) so OpenAPI knows every response.
  Errors are ProblemDetails; never return bare strings or anonymous error objects.
- Requests and responses are `sealed record` types. Never return EF entities from endpoints.
- Validation uses .NET 10's built-in Minimal API validation (`AddValidation()`): DataAnnotations
  on request records, plus `IValidatableObject` for rules attributes can't express. Invalid
  requests get `400` ValidationProblemDetails automatically.
- Every request and response type is listed in `AppJsonContext` (`Infrastructure/Json.cs`,
  source-generated, camelCase). No reflection-based serialization on hot paths.
- Responses must not reveal whether a person exists (e.g. the sign-up endpoint answers `202` with
  the same body for new, pending, and confirmed emails).
- Outgoing email goes through `IEmailSender` (`Infrastructure/Email/`): Brevo when `Brevo:ApiKey` is
  set, console logging in Development. User-facing email text is localized (en, es, pt) and every
  value inserted into HTML is encoded. Email failures are logged, never shown as API errors.
- Store secrets as hashes when only comparison is needed (e.g. confirmation tokens: SHA-256).
- Use the injected `TimeProvider` for "now", never `DateTime.UtcNow` directly.
- Endpoints with writes or abuse risk get a named rate-limit policy (`RequireRateLimiting`) on top of
  the global limit (see Security).
- Use `async` all the way, pass `CancellationToken` to every EF and I/O call, never block on tasks.

## Database and migrations

- `AppDbContext` is pooled and uses **no-tracking** queries by default; call `AsTracking()` only
  where an entity is loaded to be modified.
- Table and column names are snake_case automatically; don't set names by hand unless required.
- Each entity has an `IEntityTypeConfiguration<T>` in its feature folder; `AppDbContext` applies them
  all with `ApplyConfigurationsFromAssembly` and exposes a `DbSet` per entity.
- Migrations are applied at startup when `Database:ApplyMigrationsOnStartup` is true (Development,
  tests, hosted); there is no separate migration step.
- Change the schema only through `dotnet ef migrations add <PascalCaseName>`; commit the migration
  and the updated snapshot together. Never hand-edit the snapshot.
- Before launch, migrations may be rewritten (RULE-005). Once production holds real data, applied
  migrations are never edited or deleted, and every schema change is a forward migration
  (RULE-005, exception 2).
- No lazy loading. Select only the columns an endpoint needs (`Select` into a response record).
- Uniqueness and integrity live in the database (unique indexes, foreign keys), not only in code:
  e.g. the unique `(user_id, achievement_id)` unlock rule from the root guardrails.

## Tests

- Every endpoint gets integration tests through `ApiFactory` (real PostgreSQL in a container):
  success, validation failure, and error paths. Test names use `Behavior_under_condition`.
- Tests run in the `Testing` environment (API docs off). `ApiFactory` applies migrations at
  startup, captures emails in `CapturingEmailSender`, and `CreateWebsiteClient()` calls like the
  website does, isolated per test. Use unique emails per test.
- Don't mock EF Core or the database.

## Performance

- The goal is raw throughput for the SDK telemetry path: Minimal APIs, pooled contexts, compiled
  queries for the hottest reads when measurements justify them, no per-request reflection.
- Native AOT is **not** used: EF Core's AOT support is still experimental. Revisit only with
  measurements and the owner's agreement.
- Redis is not used yet; add it only when a feature needs it (presence, cross-instance limits).

## Security

- Abuse protection lives in code (`Infrastructure/RateLimiting.cs`, the feature endpoints, and their
  tests). Read it before changing an endpoint, keep it at least as strict, and give every new
  endpoint that writes data or sends email protection comparable to the existing ones. Per the root
  guardrail, never describe limits, thresholds, or detection methods in docs.
- Only endpoints that touch nothing may use `DisableRateLimiting()`; anything that queries the
  database stays limited.
- Configuration and secrets come from environment variables (`ConnectionStrings__Database`, …).
  `appsettings.Development.json` holds local-only credentials matching `docker-compose.yml`; never
  put real credentials anywhere in the repo. Document every new variable in `.env.example` and
  `README.md` (RULE-003).
- The browser never calls the API directly (the Next.js server does), so CORS stays off. Don't
  enable it without the owner's agreement.
- `ForwardedHeaders:TrustAllProxies` is only for hosts where the API is reachable solely through
  their proxy.
- SDK unlocks follow the root guardrail: signed with a per-game secret, server-side integrity
  checks, idempotent duplicate handling.

## Packages

- Versions live only in `Directory.Packages.props` (central package management); project files
  reference packages without versions.
- Stay on the **10.0.x** line for Microsoft packages (.NET 10 LTS); don't upgrade to 11.x without
  the owner's agreement.
- Ask before adding any package, and check its license is AGPL-compatible (MIT, Apache-2.0, BSD,
  PostgreSQL are fine).

## Comments

C# follows RULE-002: single-line `//` comments, and `/** **/` paragraph blocks for anything longer
(not stacked `//` lines or `///` XML docs).
