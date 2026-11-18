# AGENTS.md — recompachievements-web

Shared rules for any AI coding agent working in this repository. Subfolders have their own
`AGENTS.md` with stack-specific rules; those add to these and win when they conflict.

## Project context

RecompAchievements.org is a community achievement-tracking platform (like RetroAchievements) for
**native static recompilations and PC ports** (e.g. Zelda 64: Recompiled, bbport). These run as
native executables, not inside emulators, so they integrate through a C/C++ SDK
(`librecompachievements`, separate repo) that calls this platform's API.

**Launch target: bbport** (Bloodborne, `bbport-pc` in the catalog) is the first recomp the platform
will support and the SDK's reference integration. Check every SDK, API, and scoring decision
against it: a C++ project on Windows, Linux, and Steam Deck, licensed GPL-2.0 (the SDK must stay
usable from it), with online co-op. See README "Launch target".

This repo contains the public web platform:

| Path | Purpose | Status |
|---|---|---|
| `frontend/` | Next.js 16 App Router site (React, TypeScript, Tailwind CSS v4) | Active; live at recompachievements.org (Vercel, deploys from `main`) |
| `backend/` | .NET 10 Minimal APIs + EF Core: public `/api/v1/...` and game-client `/api/sdk/v1/...` | Active: health checks, the alpha sign-up, and the game directory; live, deploys from `main` |
| `docker-compose.yml` | Local PostgreSQL 17 for development | Active |
| `.github/workflows/ci.yml` | CI on PRs into `develop`/`main` (and manual runs): backend build/tests, frontend lint/build, summarized by the `CI result` check | Active |

Read `README.md` for the full architecture and data model.

## Hard guardrails (never break these)

- **No copyrighted game content.** Never add game binaries, ROMs, recompiled executables, ripped
  assets, official box or key art, game logos, or official trophy/achievement icons. The only game
  images allowed are screenshots and banners published by a recomp project **with its
  permission**, and our own gameplay screenshots of a recomp, each with a credit. Everything else
  uses original or generated art.
- **No secrets in the repo.** API keys, HMAC secrets, DB credentials, and session keys come from
  environment variables. Commit only `.env.example` files with dummy values.
- **No infrastructure details.** Docs, code, and comments never include DNS records, IP addresses,
  registrar or email-provider names, hosting account, team, project, or plan names, or dashboard
  settings beyond "hosted on Vercel, deploys from `main`". That information is kept outside this
  public repository.
- **No personal or account email addresses.** The only public addresses are
  `contact@recompachievements.org` (general, legal, takedowns) and
  `security@recompachievements.org` (vulnerabilities). Use these in docs, the website, and metadata.
- **Unlocks must not be forgeable.** SDK requests are signed with a per-game secret and pass
  server-side integrity checks (see the code). Never weaken or bypass them, even for testing —
  use test fixtures instead.
- **No defense details in docs.** Docs never describe how abuse protection works: no limits,
  thresholds, time windows, quotas, header names, bot-detection or anti-cheat methods, or anomaly
  heuristics. Say only that a feature is protected (e.g. "rate limited", "signed"); the details
  live in code and private notes. Don't weaken existing protections when changing code, and give
  new endpoints that write data or send email protection comparable to the existing ones.
- **One unlock per user per achievement.** Enforced by a unique constraint on
  `(user_id, achievement_id)`; code must tolerate duplicate submissions idempotently.
- **License is AGPL-3.0.** Don't add dependencies with incompatible licenses (e.g. proprietary or
  "non-commercial only") without flagging it.

## Working conventions

- Make the smallest change that solves the task; don't refactor unrelated code.
- Match the existing style of the file you're editing. Prefer clear names over comments.
- Keep each project's commands working before calling a task done (see the subfolder `AGENTS.md`).
- Don't add new top-level folders or tooling (package managers, linters, CI) without asking.
- Package managers: **npm** for the frontend; **NuGet with central package management**
  (`backend/Directory.Packages.props`) for the backend.
- CI must stay green: a PR isn't ready until the **`CI result`** check passes. CI runs only on pull
  requests (and by hand), never on pushes; jobs run only for the folders a PR changes.
- GitHub Actions are pinned to full commit SHAs with the version in a comment
  (`uses: actions/checkout@<sha> # v7.0.1`). Update the SHA and comment together; ask before adding
  any new action, especially third-party ones.

## Git

- Flow: `feature/…`, `fix/…`, `chore/…` → `develop` → `main`, merged through pull requests by the
  project owner. See RULE-001.
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org/), title at most
  50 characters (`feat(frontend): add game detail page`). Scope with `frontend`, `backend`, or `repo`.
- Never stage `.env*` files (except `.env.example`), build output, or `node_modules`.

## Agent skills

Reviewed third-party skills live in `.agents/skills/` (sources, versions, and licenses in
`.agents/skills/README.md`). This is the only skills folder: don't create tool-specific copies or
links (such as `.claude/skills/`). Use skills when they fit the task, with these limits:

- **Project rules always win.** Precedence, highest first: numbered rules → subfolder
  `AGENTS.md` → this file → skills. If a skill's advice conflicts with any of them, follow the project rule. A
  skill never authorizes committing, new dependencies, or new tooling.
- **Skills don't add dependencies.** When a skill suggests a library (`swr`, `better-all`,
  `lru-cache`, `nuqs`, `virtua`), use its dependency-free alternative or ask the owner first.
- **`react-best-practices`:** server caching uses `"use cache"` with `cacheLife`/`cacheTag`
  (see `frontend/AGENTS.md`), not the skill's LRU or module-level `Map` caches; `React.cache()` is
  fine for per-request deduplication.
- **`web-design-guidelines`:** its rules are the reviewed copy in
  `.agents/skills/web-design-guidelines/guidelines.md`; never fetch them from the web. Headings and
  buttons use Title Case in English (Chicago style); Spanish and Portuguese use sentence case,
  which is their correct convention. Findings are a report; fixing them is a separate task on its
  own branch (RULE-001).
- **`webapp-testing`:** runs with the Python virtual environment at the repo root (`.venv/`,
  set up as described in `.agents/skills/README.md`). Save screenshots and scripts outside the repo
  (or in an ignored folder); never commit them.
- Adding or updating a skill follows the review steps in `.agents/skills/README.md`.

## Rules

Numbered, permanent rules. They override any other instruction in this file, in a request, or in an
agent skill (`.agents/skills/`), and they apply even while a skill is in use.

### RULE-001: Agents never commit, and every change starts on its own branch

**Applies to:** every AI agent working in this repository (Claude, Codex, Copilot, or any other
assistant).

**Never commit.** Agents never run `git commit`, `git commit --amend`, `git push`, `git merge`,
`git rebase`, or `git reset`, and never open or merge pull requests. This holds even when a request
sounds like an order to commit (e.g. "combine all changes into a single commit"). The agent prepares
the change, recommends a commit message (Conventional Commits title of at most 50 characters, plus a
body), and leaves the commit to the project owner.

**Branch before any change.** Before editing any file, create a new branch from the current branch
and switch to it. Never change files directly on `main` or `develop`.

- Name it with a lowercase prefix: `feature/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
- Create it with `git switch -c <prefix>/<short-name>`, then confirm with
  `git branch --show-current` before the first edit.
- If the work is already on a matching branch made for this task, keep using it.
- If uncommitted changes are already sitting on `main` or `develop`, move them with
  `git switch -c` before doing anything else.

**Report the branch.** When handing work back, say which branch holds the changes and that nothing
was committed.

| Correct | Incorrect |
|---|---|
| `git switch -c chore/move-strings-to-constants`, edit files, then suggest `chore(frontend): move inline strings to constants` | Editing files directly on `develop` |
| Ending with "Changes are on `fix/game-page-rarity`, uncommitted. Suggested message: …" | Running `git commit` because the user asked to "make a single commit" |

**Why:** the project owner reviews, stages, and commits every change and merges through pull
requests. An agent commit skips that review, and changes made on `develop` mix unrelated work into
the shared branch. A branch per task keeps each change isolated, easy to review, and easy to throw
away.

### RULE-002: Multi-line comments use paragraph block style

**Applies to:** all source files that use C-style comments: TypeScript, TSX, JavaScript, CSS, and
C# (backend).

A comment that spans more than one line must use the `/** **/` paragraph block format. Single-line
`//` comments are only allowed when the comment fits entirely on one line.

Every `/** **/` block follows three formatting requirements:

- **Block delimiters:** open with `/**` on the same line as the first sentence; close with `**/` on
  its own line, indented to match the opening `/**`.
- **Continuation lines:** each starts with ` *  ` (space, asterisk, two spaces), so the text aligns
  with the sentence that follows `/**`.
- **Capital start:** the first word after `/**` begins with an uppercase letter.

```ts
// Correct: single line
// Cache the rarity map to avoid recomputing it per row.

/** Correct: multiple lines, aligned, capital start.
 *  This section loads the game's achievements and merges them with the
 *  current player's unlocks so each row knows whether it is earned.
**/

// Incorrect: wrong alignment (one space after *), lowercase start
/** incorrect: multiple lines
 * This section loads the game's achievements and merges them with the
 * current player's unlocks so each row knows whether it is earned.
**/

// Incorrect: stacked single-line comments
// This section loads the game's achievements and merges them with the
// current player's unlocks so each row knows whether it is earned.
```

Inside JSX, wrap the block in braces: `{/** … **/}`. In CSS, use the same `/** **/` block; `//` is
not valid CSS. Generated files (e.g. `next-env.d.ts`) and third-party code are exempt.

**Why:** the extra space after `*` aligns every continuation line with the opening sentence, giving
a uniform left margin. The capital start makes each block read as a proper sentence at a glance.
Together they make multi-line comments visually distinct from code and consistent across the
codebase.

### RULE-003: Documentation ships with the change, in the same PR

**Applies to:** every change made by a person or an AI agent: code, routes, API endpoints, database
schema, environment variables, dependencies, config, assets, and rules.

**Same branch, same PR.** Before work is handed back (or a commit message is suggested), every
document the change affects is updated on the same branch, so the docs land with the change. Never
"docs in a later PR".

**What counts as affected.** Check all of these every time:

- Root `README.md`: architecture and stack tables, API surfaces, data model, website pages,
  repository structure, getting started, roadmap
- Root `AGENTS.md`: project context table, guardrails, Git section, rules (examples that quote
  changed code), domain vocabulary
- `frontend/README.md` and `frontend/AGENTS.md`: commands, routes, folder structure, rendering and
  data rules
- `backend/README.md` and `backend/AGENTS.md`: commands, configuration and environment variables,
  endpoints, project structure, database and migration rules
- `SECURITY.md`: scope, API surfaces, signing and timestamp rules
- `docs/achievement-system.md`: sets, hardcore rules, scoring and Elo, badges, titles, integrity,
  data model, and SDK operations
- `.env.example` files: every new, renamed, or removed environment variable (except abuse-protection
  tuning settings, which have safe defaults in code and stay undocumented per the "No defense
  details in docs" guardrail)
- Code comments and JSDoc that describe the changed behaviour
- An AI agent's own memory notes, when it keeps any

**The roadmap moves with the work.** When a change finishes a roadmap item in `README.md`, tick its
box in the same branch. When it changes the plan (new scope, a dropped item, a different stack
choice), update the roadmap and the sections that describe that plan.

**No stale text.** Before handing back, search the docs for every name, number, or behaviour that
changed (old function names, routes, endpoints, table columns, limits) and fix each hit.

**Read, don't only search.** For each affected doc, read the parts the change touches (and the whole
`README.md` and `AGENTS.md` when a larger feature or roadmap item finishes) and ask what it should
now say that it doesn't: new pages, endpoints, commands, environment variables, workflow. Searching
catches stale text, not missing text.

**Say what was updated.** The hand-off message lists the documents that were updated.

| Correct | Incorrect |
|---|---|
| Adding `/leaderboards` and, on the same branch, updating the README pages table, the routes in `frontend/AGENTS.md`, and the roadmap | Shipping the page and leaving both route lists without it |
| Renaming `getGame()` → `getGameBySlug()` and searching every doc for `getGame` | A rule example still quoting a function that no longer exists |
| Changing alpha confirmation links from 7 to 3 days and updating the code, tests, email text, privacy notice, and README together | Updating the code and leaving the email and privacy notice saying 7 days |
| Finishing frontend v0.1 by reading README in full and adding the commands and env vars it never mentioned | Searching README for the new route name, finding nothing, and calling it "not affected" |

**Why:** docs that lag behind the code mislead the next person or agent, who reads them before
working. Updating them in the same PR is the only time the details are fresh, and the reviewer sees
the change and its explanation together.

### RULE-004: Everything in the project is written in English

**Applies to:** every file in the repository, written by a person or an AI agent: code, comments,
documentation, data, and Git history.

Everything that goes into the project is written in English, never in another language.

- **Code:** identifiers (components, functions, types, variables, enums, modules), file and folder
  names, route segments and URL slugs, API endpoints and JSON fields, database tables and columns,
  environment variable names, and string constants.
- **Comments and docs:** code comments, JSDoc, `README.md` and `AGENTS.md` files, `SECURITY.md`,
  and CI or workflow files.
- **Data and output:** mock and seed data, UI text, `alt` text and ARIA labels, page metadata,
  error messages, and log messages.
- **Git:** branch names, commit messages, and PR titles and descriptions.

The language used to chat with a person, an AI agent, or a bot does not matter. A request written in
Spanish (or any other language) still produces English code, comments, and docs. When text in
another language is pasted in (an error message, a design note), translate it before it goes into
the project.

The website is localized: translations live only in the locale message files
(`frontend/src/i18n/messages/`); the message keys and the default (English) text stay in English.
Content that users submit through the platform (usernames, achievement text written by recomp
developers) is data, not project files, and is not covered by this rule.

| Correct | Incorrect |
|---|---|
| `const unlockedCount = unlocks.length;` | `const logrosDesbloqueados = unlocks.length;` |
| `// Skip unlocks sent from unverified builds.` | `// Omitir desbloqueos enviados desde builds no verificadas.` |
| Branch `fix/rarity-rounding`, commit `fix(frontend): round rarity to one decimal` | Branch `fix/redondeo-rareza`, commit `fix(frontend): redondear rareza a un decimal` |
| A chat request in Spanish answered with English code and docs | Writing the README section in Spanish because the request was in Spanish |

**Why:** one language keeps the codebase searchable and consistent: a search for a concept finds
every hit, and names never mix two languages. English is the language of the frameworks, tools,
and most collaborators and recomp developers, so anyone (or any agent) can read and review any file
without translating it first.

### RULE-005: Changed code replaces the old code entirely

**Applies to:** every change to code, components, routes, API contracts, database schema, data
shapes, mock data, and tests, made by a person or an AI agent.

When a function, component, route, API contract, or data shape changes, the new version replaces
the old one completely, in the same PR. Nothing from the old version is carried over unless it is
still used.

- **Delete what the change makes unused.** The old code path, its tests, types, constants, mock
  data, styles, assets, and doc mentions all go (docs per RULE-003).
- **No compatibility layers.** No fallbacks to the old behaviour, no `Old`/`Legacy`/`V1` copies, no
  feature flags or environment switches that turn the old version back on, no `@deprecated` members
  left in place, no parameters or props kept only for old callers, no adapters that map an old data
  shape to the new one.
- **No migration code for unreleased formats.** Until the exception below applies, change API
  payloads, types, mock data, and the database schema in place, and replace the code and tests that
  read and write them.
- **Delete, don't comment out.** Old code is removed, not left behind in comments. Git history
  keeps it.

**Exception 1: code kept commented out by the owner's explicit request.** Only when the project
owner explicitly asks to keep a piece of code, it stays commented out below a `/** **/` block
(RULE-002) that says why it is kept, who asked and when, and what would let it be deleted or
restored.

**Exception 2: contracts that outside parties already rely on.** These become "shipped" once they
are live on recompachievements.org for people outside the team (local, preview, and CI deployments
don't count):

- **SDK API (`/api/sdk/vN`).** Once an SDK version ships inside any released recomp, its API version
  is supported until the owner retires it with a published notice, because players can't easily
  update a game binary. A breaking change goes to a new version (`/api/sdk/v2/...`); additive,
  optional fields don't need one.
- **Public API (`/api/v1`).** Once community tools use it, a breaking change goes to a new version;
  the old one stays until the owner retires it with a published deprecation notice.
- **Database schema.** Once production holds real user data, every schema change is a new forward
  migration that moves or fills in existing data (a sensible default for anything new). Applied
  migrations are never edited or deleted, and a test runs the full migration chain in CI.
- **Public page URLs.** Once a route is live, renaming it adds a permanent (308) redirect from the
  old path, because profile and game links are shared on Discord and indexed by search engines.

Unknown or newer API versions are refused, not guessed at. Versioning, migrations, and redirects are
written when the first breaking change after release needs them, not before, so nothing unused is
added ahead of time. Anything that never shipped publicly still gets none of these.

**Unused code that predates the change.** If an agent finds unused code that its change didn't
create, it reports it to the owner instead of deleting it in an unrelated PR.

```ts
// Correct: kept only because the owner asked, with the reason on record
/** Kept by the owner's request (YYYY-MM-DD): live presence is off until the backend
 *  heartbeat endpoint exists. Restore it then, or delete it if presence is dropped.
**/
// const presence = await getLivePresence(user.id);

// Incorrect: the old version kept alongside the new one "just in case"
export function getLegacyRarity(gameId: string) { /* … */ } // nothing calls it any more
```

| Correct | Incorrect |
|---|---|
| Before launch, games gain a cover image: add `cover_url` to the entity and a new migration, then update the API response and page in place | Adding a `LegacyGame` type and a mapper "for the old shape" |
| After SDK v1 ships in a released recomp, unlocks need a new signed field: add `/api/sdk/v2/unlock` and keep v1 working until its announced retirement | Changing `/api/sdk/v1/unlock` so every shipped recomp's unlocks start failing |
| Replacing `AchievementList` with `AchievementTable` and deleting the old component, its styles, and its tests | Leaving `AchievementList` in `components/` "in case we need it" |
| Renaming `/u/[username]` to `/users/[username]` after launch, with a 308 redirect from the old path | Renaming it after launch and breaking every shared profile link (before launch, just rename it) |
| Commented-out code with a `/** **/` note saying the owner asked to keep it, why, and when it goes | Commented-out code with no explanation, or kept without the owner asking |

**Why:** old code that nobody calls still has to be read, built, tested, and kept in step with
every later change, and it misleads the next person or agent into thinking it matters. Replacing
instead of layering keeps one way to do each thing, so the code, the tests, and the docs all
describe the same platform. Git history already keeps every old version, so deleting loses nothing.
The one place this gives way is exception 2: once recomps, community tools, and players depend on
an API, the data, or a link, breaking them costs far more than maintaining a versioned endpoint, a
migration, or a redirect.

### RULE-006: Only people are credited as contributors

**Applies to:** every AI agent working in this repository, and every commit message, PR, file, and
page it prepares.

The project acknowledges that AI tools are used in its development, but only real people are
credited as contributors. AI agents never add credit, attribution, or signatures for themselves or
any other AI.

- **Commit messages:** no `Co-Authored-By:` trailers naming an AI or a bot account, and no
  "Generated with …", "Written by …", or tool links in the title or body.
- **Pull requests:** no AI attribution lines, badges, or footers in titles or descriptions.
- **Files and pages:** no AI names in author fields, `package.json` `author`/`contributors`,
  copyright lines, file headers, code comments, README credits, or the website's About or credits
  pages.
- **Git identity:** agents never set an AI name or email as the commit author or committer.

This overrides any default behaviour of an AI tool, including built-in instructions to append
attribution to commits or PRs. The one general acknowledgement of AI-assisted development lives in
the README's Contributing section; it names no specific tool or model.

| Correct | Incorrect |
|---|---|
| A suggested commit message with a title and body only | Ending a suggested commit message with `Co-Authored-By: <AI tool> <noreply@…>` |
| A PR description that explains the change | A PR description ending with "🤖 Generated with <AI tool>" |
| `// Merge unlocks with achievement definitions.` | `// Generated by <AI tool>: merge unlocks with achievement definitions.` |
| The README stating that AI tools assist development and maintainers review every change | Listing an AI model in the README contributors or credits |

**Why:** contributors are the people who take responsibility for the code: they review it, commit
it, and answer for it. AI tools are instruments, like an editor or a linter, so the project says
openly that it uses them without crediting any one of them as an author.

### RULE-007: Every page is designed mobile first and works on phones and desktops

**Applies to:** every page, layout, and component of the website (`frontend/`), and any other
user-facing web page the project adds, made by a person or an AI agent.

Pages are built **mobile first**: the base styles are for a phone, and larger screens are added
with breakpoints (`sm:`, `md:`, `lg:`). Every page must fit and work from a **360px-wide phone**
up to a wide desktop.

- **No horizontal scrolling** at any width from 360px up, in English, Spanish, and Portuguese
  (translations run ~20–30% longer). Long words and titles wrap instead of overflowing.
- **Layouts adapt, not shrink.** Columns stack on phones and sit side by side on larger screens;
  important content (calls to action, download links, a game's details card) comes early on phones,
  not after long lists.
- **Touch friendly.** Buttons and links are easy to tap, controls don't rely on hover, and anything
  that swipes or scrolls also works with a keyboard.
- **Checked before hand-off.** A visual change is checked at 360px and at a desktop width (at
  least one locale besides English) before the work is handed back.

| Correct | Incorrect |
|---|---|
| `grid gap-6 lg:grid-cols-[1fr_20rem]`: one column on phones, two on desktop | `grid grid-cols-[1fr_20rem]` that squeezes a sidebar onto a phone |
| A long title that wraps (`text-balance`, `wrap-anywhere`) inside its card | A fixed-width title that's cut off or pushes the page sideways at 360px |
| Checking a new page at 360px in Spanish and at 1280px before handing it back | Only looking at the page on a desktop monitor |

**Why:** many players browse on phones and handhelds such as the Steam Deck, and links to game
and profile pages are mostly opened from Discord and social media on mobile. Starting from the
smallest screen keeps every page usable everywhere; adding desktop space later is easy, while
fixing a desktop-only layout for phones usually means rebuilding it.

## Domain vocabulary

- **Recomp** — a native port produced by static recompilation of a console game.
- **Game** — a recomp registered on the platform, identified by `slug` (e.g. `bbport-pc`).
- **Set** — a group of a game's achievements: one **core set** (the base game) plus **subsets**
  (`dlc`, `mod`, `randomizer`, `challenge`). A **preview** set is shown but accepts no unlocks
  until the recomp integrates the SDK.
- **Featured** — a catalog flag that puts a game in the homepage slider; "New Release" is shown
  when its `releasedAt` is within the last 30 days.
- **Catalog** — the curated JSON files (`backend/.../Catalog/Games/`) that define games and preview
  sets until the developer portal exists.
- **Achievement** — belongs to a set; `api_key_name` (e.g. `BOSS_GASCOIGNE`) is the identifier the
  SDK sends. Has developer-set **points** (1–10) and a fixed **rarity tier** (Common → Legendary).
- **Hardcore / softcore** — an unlock is hardcore only when its session has had a verified build,
  no assist toggles, and allowlisted mods; only hardcore unlocks count toward the ranking.
- **Unlock** — a user earning an achievement, in softcore and/or hardcore (a softcore unlock can be
  upgraded); records `build_hash` (SHA-256 of the executable).
- **Session** — one player playing one game, started by the SDK; records the build, toggles, and
  mods that decide whether each unlock is hardcore, and powers live presence and minimum-playtime
  checks.
- **Global score** — Σ over hardcore unlocks of `points × rarity multiplier + Elo bonus`.
- **Elo bonus** — `base value × (1 − share)`, where share = hardcore players with the achievement ÷
  hardcore players with at least one unlock in its set; recalculated nightly.
- **Completion badges** — Silver / Gold / Platinum for core sets, Beaten / Mastered for subsets;
  display only.

The full rules are in `docs/achievement-system.md`; scoring and badge code must follow it.
