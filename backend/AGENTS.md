# AGENTS.md — backend

Rules for AI agents working in `backend/`. They add to the root [`AGENTS.md`](../AGENTS.md), whose
numbered rules (RULE-001 to RULE-007) and guardrails always apply. Setup and commands for people
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
- Public endpoints are mapped on the `/api/v1` route group in `Program.cs`. The website's internal
  key is enforced for that whole path by middleware (`app.UseInternalKey("/api/v1")`), so callers
  without it are rejected before any body is read or validated. SDK endpoints will use
  `/api/sdk/v1` (create that group with its first endpoint, not before — RULE-005).
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
- Outgoing email goes through `IEmailSender` (`Infrastructure/Email/`): the transactional email API
  when `Brevo:ApiKey` is set, console logging in Development. User-facing email text is localized
  (en, es, pt) and every value inserted into HTML is encoded. Email failures are logged, never shown
  as API errors.
- Store secrets as hashes when only comparison is needed: confirmation links, password links, and
  session tokens all come from `SecureToken` (`Infrastructure/SecureToken.cs`, SHA-256 stored).
- Use the injected `TimeProvider` for "now", never `DateTime.UtcNow` directly.
- Endpoints with writes or abuse risk get a named rate-limit policy (`RequireRateLimiting`) on top of
  the global limit (see Security).
- Use `async` all the way, pass `CancellationToken` to every EF and I/O call, never block on tasks.

## Database and migrations

- `AppDbContext` is pooled and uses **no-tracking** queries by default; call `AsTracking()` only
  where an entity is loaded to be modified.
- Table and column names are snake_case automatically; don't set names by hand unless required.
- `AddDatabase` turns off Npgsql's GSS (Kerberos) encryption: our databases don't use it, and the
  chiseled image lacks the library it needs (which made every new container log "Cannot load
  library libgssapi_krb5"). Keep it off unless a database ever requires Kerberos.
- Each entity has an `IEntityTypeConfiguration<T>` in its feature folder; `AppDbContext` applies them
  all with `ApplyConfigurationsFromAssembly` and exposes a `DbSet` per entity.
- Migrations are applied at startup when `Database:ApplyMigrationsOnStartup` is true (Development,
  tests, hosted); there is no separate migration step.
- Change the schema only through `dotnet ef migrations add <PascalCaseName>`; commit the migration
  and the updated snapshot together. Never hand-edit the snapshot. If an analyzer flags the
  generated code (e.g. CA1861 on column arrays), add a `#pragma warning disable` with a reason at
  the top of that migration instead of rewriting it.
- Production holds real user data (alpha sign-ups, accounts), so RULE-005 exception 2 applies: applied
  migrations are never edited or deleted, and every schema change is a new forward migration that
  fills in existing rows. `ApiFactory` applies the full migration chain, so CI tests it.
- No lazy loading. Select only the columns an endpoint needs (`Select` into a response record).
- Text shown in several languages is a `LocalizedText` (`en` required, `es`/`pt` optional) mapped
  as a JSON complex property (`ComplexProperty(...).ToJson()`, a `jsonb` column); endpoints take a
  `lang` query value and return resolved strings with `LocalizedText.For(lang)`.
- Uniqueness and integrity live in the database (unique indexes, foreign keys), not only in code:
  e.g. the unique `(user_id, achievement_id)` unlock rule from the root guardrails.

## Game catalog

- Until the developer portal exists, games, core sets, and achievements come only from
  `Catalog/Games/<slug>.json`, imported at startup (`Catalog:ImportOnStartup`) by
  `Features/Games/CatalogImporter.cs`. No endpoint writes game data.
- Catalog text is **original**: never copy official trophy or achievement names, descriptions, or
  icons. Game `art` comes only from SteamGridDB, referenced by link with its page and artist
  (root guardrail); `Catalog.Validate` allows only its CDN and pages. Art for games without
  catalog art is picked once by `GameArtFiller` through `SteamGridDbClient` (official API only,
  never crawling the website); catalog art and `{}` opt-outs always win. Every set follows
  `docs/achievement-system.md` (points 1–10, a `win_condition`, rarity
  caps); `Catalog.Validate` enforces it and `Shipped_catalog_is_valid` runs it in CI.
- The import matches by `slug` and `apiKeyName` and deletes entries removed from the catalog. That
  is safe only while every set is a preview with no unlocks; once unlocks exist, removing an
  achievement needs its own rule (see the spec's open questions).
- When the developer portal lands, it replaces the catalog and the importer is deleted (RULE-005).
  That must happen before the first real unlock is accepted (the bbport launch integration), and
  the catalog and the portal must never both edit games (README roadmap).

## Accounts

`Features/Accounts/` holds users, sessions, emailed links, and Discord/GitHub sign-in. Its rules
are security rules; keep every one when changing the code:

- **Identity.** An account has up to three identities, each unique where set: `Email`, `DiscordId`,
  `GithubId`. Only a platform's ID finds an account for a platform sign-in; emails never find,
  link, or merge accounts. Connecting a platform never changes `Email`.
- **Collecting achievements needs an enabled account with a confirmed email**
  (`User.CanCollectAchievements`). A platform
  email is used only when the platform marks it verified and no confirmed account has it; an
  unverified one is never stored. Every other email is confirmed through our own link. The SDK
  unlock endpoints must check `CanCollectAchievements`.
- **Passwords.** Email sign-in needs a confirmed email and a set `PasswordHash`; a null hash never
  matches anything. A password is set only through the emailed set-password link
  (`forgot-password` → `reset-password`), never directly by a signed-in request, and setting one
  revokes every session. Every sign-in failure returns the same `invalid_credentials` problem and
  must stay indistinguishable from the others (keep `DummyPassword` in place).
- **Disabled accounts** (`IsEnabled` false) are kept, never deleted automatically, so their email
  and platform IDs stay reserved. Every new way in (sign-in, session, emailed link, future SDK
  token) must refuse them. Email sign-in answers with the usual `invalid_credentials`.
- **`EditedAt`** is set only by the `UserEditStamp` interceptor on saved changes; don't set it by
  hand. `ExecuteUpdate` bypasses it, so account data is changed through tracked entities.
- **`LastActivityAt`** is the exception: `Sessions` moves it forward with a direct update, so
  activity never counts as an edit. Future activity (SDK sessions) updates this same column.
- **Sessions.** Read the signed-in user only with `Sessions.ResolveAsync` (bearer token from the
  website). Signed-in endpoints return `AccountProblems.NotSignedIn()` without a valid session.
- **No enumeration.** Register, resend, and forgot-password always answer `202`; links are sent
  only through `AccountLinks`, whose abuse protection never changes the answer.
- **Disconnecting** a platform must leave a way to sign in (confirmed email with a password, or the
  other platform).
- **Public player data** comes only from `PlayerEndpoints` (`PublicPlayerResponse`,
  `PublicByUsername`). Never add an email, platform ID, alpha status, exact activity time, or other
  private field; disabled accounts and unconfirmed registrations stay `404`.
- **Reserved usernames** include every page directly under `/account` (`AccountText`): when adding
  such a page, reserve its name in the same change.
- **Walls** (`Features/Walls/`): anyone reads; posting needs `CanCollectAchievements` and no active
  mute; only the
  author or the wall's owner deletes, and anyone else gets `404`. Bodies are plain text, checked by
  `WallText`, and must never be rendered as HTML or Markdown.
- **Profile photos** (`PhotoEndpoints`, `AvatarImages`): never store or serve an upload as received.
  Decode it, refuse anything but a static JPEG, PNG, or WebP, and store only the re-encoded WebP
  files. Storage goes through `IMediaStore`; photo URLs come from `AvatarImages.Urls`.
- **Pending platform sign-ups** are never stored: `PendingSignupTokens` signs them (HMAC, short
  lifetime) until the welcome step creates the account.
- Errors the website must tell apart carry a `code` extension (`AccountProblems`); add new codes
  there and to the website's `AuthError` list together.

## Moderation

`Features/Moderation/` holds reports and staff actions; keep every rule when changing it:

- **Access.** Staff endpoints are in the `/moderation` group, whose filter re-reads the role from the
  database and answers `404` to everyone else. Check `StaffMember.CanActOn` before every action:
  nobody acts on themselves, moderators act only on players, and only admins change roles.
- **Audit.** Every staff change and its `ModerationAction` commit in one transaction. The log is
  append-only (only expired text evidence is erased). User IDs there aren't foreign keys, so records
  survive account deletion.
- **After the commit:** emails and file cleanup run only once the change is saved, and their failure
  never undoes it. A removed image must also be purged from the CDN; report a failed purge to staff.
- **Mute** is stored only as `MutedUntil` and read through `User.IsMutedAt`. It blocks social
  features and must never block earning achievements.
- **Privacy.** Staff responses never include an email or platform ID. A legal hold's evidence
  location is never returned, and its owner isn't emailed.

## Tests

- Every endpoint gets integration tests through `ApiFactory` (real PostgreSQL in a container):
  success, validation failure, and error paths. Test names use `Behavior_under_condition`.
- Tests run in the `Testing` environment (API docs off). `ApiFactory` applies migrations at
  startup, captures emails in `CapturingEmailSender`, replaces Discord and GitHub with
  `FakeOAuthProvider` (tests issue codes for any identity), stores media in `FakeMediaStore`, and `CreateWebsiteClient()` calls like
  the website does, isolated per test. Use unique emails per test; account tests share helpers in
  `Accounts/AccountTestKit.cs`.
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
