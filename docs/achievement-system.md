# Achievement system

How achievements, scores, completion medals, badges, and titles work on RecompAchievements. This is the
reference for players, recomp developers, and contributors; the database schema, the API, and the
`librecompachievements` SDK follow it.

> **Status:** agreed design. Games, core sets, and achievements are implemented as **preview
> sets** (see [Preview sets](#preview-sets)); unlocks, scoring, medals, badges, and titles are not yet.
> Values marked *initial* can be tuned later without changing the model.

## Principles

1. **Hardcore is what counts.** Only hardcore unlocks earn ranking score. Softcore is tracked for
   the player, never ranked.
2. **Developers define value; players define rarity.** Each achievement's points and rarity tier
   are set by its developer and never change on their own; the live share of players who have it
   adds a bonus on top.
3. **Mods are welcome.** Cosmetic and quality-of-life mods keep hardcore on; gameplay-changing mods
   get their own achievement sets.
4. **Unlocks must be earned.** Signed unlocks, verified builds, sanity checks, and moderation protect
   the ranking.
5. **Everything is visible.** Recomps are ports of classic games most players already know, so
   there are no hidden or secret achievements: every title, description, and icon is shown before
   it's unlocked.

## Games and sets

A **game** is one recomp registered on the platform. Its achievements are grouped into **sets**:

```
Game (e.g. Zelda 64: Recompiled)
├── Core set               ← the base game
├── Subset (dlc)           ← official extra content
├── Subset (mod)           ← achievements for a specific mod
├── Subset (randomizer)    ← achievements designed for randomized runs
└── Subset (challenge)     ← extra challenges for the base game
```

- Every game has exactly **one core set** and any number of **subsets**.
- Each subset has a **type** (`dlc`, `mod`, `randomizer`, `challenge`) and declares the **mods and
  settings it requires** (for example, a specific randomizer mod and version).
- Sets are tracked separately: each has its own completion and completion medal.
- A gameplay-changing mod makes **core-set** unlocks softcore; with **its own subset** (and the
  declared requirements met), that subset's unlocks can be hardcore.

## Achievements

| Field | Meaning |
|---|---|
| Identifier | `api_key_name` (e.g. `BOSS_GASCOIGNE`), the name the SDK sends |
| Title, description, icon | Shown on the site in English, Spanish, and Portuguese (English is required; missing translations fall back to it); icons are original or supplied by the developer |
| **Points** | **1–10**, set by the developer: 1 = easiest, 10 = hardest |
| **Rarity tier** | Set by the developer and fixed: Common, Uncommon, Rare, Epic, Legendary |
| **Kind** | `progression` (required story milestone), `win_condition` (finishing the game), or `standard` |
| Progression step | Optional position in the story (1, 2, 3…), set by the developer. Used by integrity checks; sequence breaks are legitimate and never block an unlock by themselves |

### Rarity tiers and multipliers

| Tier | Multiplier |
|---|---|
| Common | ×1 |
| Uncommon | ×1.5 |
| Rare | ×2 |
| Epic | ×3 |
| Legendary | ×5 |

The tier describes how rare the developer *intends* the achievement to be. It never changes based on
player data; the live data is reflected in the Elo bonus instead.

### Rarity caps and review

To keep developer-assigned tiers honest, each set must respect these caps (*initial*), enforced by
the developer portal:

| Tier | Maximum share of a set's achievements |
|---|---|
| Legendary | 10% |
| Epic | 20% |
| Rare | 30% |
| Uncommon, Common | No limit |

Every new set, and every change to a published set, is **reviewed by a moderator** before it goes
live.

### Preview sets

Until a recomp integrates the SDK, its set is shown as a **preview**: a community draft with
original achievement text, labeled on the site as not active and not endorsed by the recomp's
developers. Preview sets show points and rarity tiers but accept no unlocks, so they have no
shares, Elo bonus, or medals.

Until the developer portal exists, games and preview sets come from a curated **catalog** in the
repository (one file per game, reviewed through pull requests and checked against the rules
above, including the rarity caps). The portal replaces it.

## Hardcore and softcore

A **session** covers one player playing one game, from launch until the game closes. It records the
game's state: the build, the toggles, and the active mods, updated whenever the game reports a
change. Each **unlock** is judged hardcore or softcore from that state at the moment it happens. An
unlock is **hardcore** only if all of these have held since the session started:

1. **Verified build:** the executable's SHA-256 hash is one of the game's official builds registered
   by its developer (per platform: Windows, Linux, macOS).
2. **No assists:** every game toggle the developer classified as an **assist** (infinite health,
   save anywhere, slow motion, level select, cheats) is off. Toggles classified as **allowed**
   (60 fps, widescreen, UI options) don't matter.
3. **Allowed mods only:** every active mod (identified by mod ID and version) is on the game's
   **allowlist** of cosmetic and quality-of-life mods, or is required by the subset the achievement
   belongs to.

Otherwise the unlock is **softcore**. Once a session's state breaks a rule, every later unlock in it
is softcore until the game restarts; turning an assist off mid-session doesn't restore hardcore.
Unlocks earned **before** the change stay hardcore.

### Upgrading unlocks

An achievement unlocked in softcore can be **upgraded** by unlocking it again in hardcore.
Upgrades are never retroactive: using no assists later doesn't convert past unlocks.

## Scoring

### Achievement value

```
base value = points × rarity multiplier           (1 to 50)
```

### Elo bonus (hardcore only)

```
share     = hardcore players who unlocked the achievement
            ÷ hardcore players who unlocked at least one achievement in that set
Elo bonus = base value × (1 − share)
```

- The bonus rewards achievements few players actually have, and can never exceed the base value.
- Shares and bonuses are **recalculated nightly**, so a player's score can move as more people play.
- **Minimum sample** (*initial*: 25): until a set has at least 25 hardcore players with one or more
  unlocks, its achievements give **no Elo bonus**.

### Player totals

| Total | Formula | Ranked? |
|---|---|---|
| **Global score** | Σ over **hardcore** unlocks of (base value + Elo bonus) | **Yes**, the site-wide ranking |
| **Softcore total** | Σ over **softcore-only** unlocks of base value (no Elo bonus) | **No**, shown on the profile only |

- Core sets and subsets count the same way.
- When an unlock is upgraded, it moves from the softcore total to the global score.
- Completion medals, badges, and titles **never add points**; points come only from achievements.
- Values are stored with two decimals and displayed rounded to whole numbers.

### Example

An achievement with 5 points and tier Rare (×2) has a base value of **10**.

| Share of the set's hardcore players who have it | Elo bonus | Hardcore value |
|---|---|---|
| 80% | 10 × 0.2 = 2 | **12** |
| 10% | 10 × 0.9 = 9 | **19** |
| 1% | 10 × 0.99 = 9.9 | **19.9** |
| (set below the minimum sample) | 0 | **10** |

In softcore the same achievement is worth **10** in the softcore total, regardless of share.

## Completion medals

Medals reward completing a set. They are for display only and give no points.

### Core set

| Medal | Condition |
|---|---|
| **Silver** | Finished: every `progression` achievement plus at least one `win_condition`, with **at least one of them in softcore** |
| **Gold** | Finished, with **all** of those achievements in hardcore. A Silver becomes Gold as soon as its softcore achievements are upgraded. |
| **Platinum** | **Every** core-set achievement unlocked in hardcore. Awarded automatically with the last one. |

### Subsets

| Medal | Condition |
|---|---|
| **Beaten** | Every achievement in the subset unlocked, at least one of them in softcore |
| **Mastered** | Every achievement in the subset unlocked in hardcore |

Beaten becomes Mastered once the remaining unlocks are upgraded.

### Upgrades and permanence

- A player holds **one medal per set**, at its highest tier reached: Silver → Gold → Platinum, or
  Beaten → Mastered. A tier can be skipped (a fully hardcore first run goes straight to Platinum).
- **Gameplay never downgrades a medal.** Playing afterwards in softcore, with assists, mods, or
  in-game hacks (such as infinite health) doesn't change a medal already earned.
- **Achievements not legitimately earned are the one exception.** That covers unlocks that were
  forged or triggered by hand, and unlocks earned with a **hidden in-game hack** (an assist the game
  reports already makes the unlock softcore). Recomps run on the player's own machine, so verified
  builds make cheating harder but can't rule it out.
- **Removal is a moderator's decision.** Once a moderator confirms a case, they remove those
  achievements in one audited action. That removes the unlocks and their points from the player's
  totals, and the set's medal is recalculated from the unlocks that remain: it's lowered, or removed
  if it no longer qualifies. Automation may assist moderators later.
- **Removed achievements can be earned again** through legitimate play, under the normal rules.
  For repeat or serious cheating, a moderator **disables the account**, which blocks all further
  use while keeping its records.
- **Set changes don't take a medal away.** A player keeps it if achievements are added or removed
  later. When achievements are added after a medal was earned, the profile can show that new ones
  are available.
- **Profile counters** show Platinum, Gold, and Silver for core sets. Each set counts once, at its
  current tier. A player chooses the games each card features: **up to three** for Platinum and
  **one** each for Gold and Silver. Until they choose, each card features the most recently
  upgraded games. Upgrading a game removes it from the lower tier's featured spot.

### How medals are stored

`user_set_medals` holds each player's current medal per set, and `user_medal_events` is its
append-only history. After a new or upgraded unlock, the server recalculates the set's tier from
`user_unlocks` and saves the unlock, the medal, and the event in **one transaction**. The medal write
is an upsert that only applies when the new tier is higher, so repeated or simultaneous requests
are safe and gameplay can't lower a medal (moderator removals use their own audited path):

```sql
INSERT INTO user_set_medals AS m
  (user_id, set_id, kind, tier, tier_1_at, tier_2_at, tier_3_at, upgraded_at, earned_set_revision)
VALUES (@user, @set, @kind, @tier, @tier_1_at, @tier_2_at, @tier_3_at, @now, @set_revision)
ON CONFLICT (user_id, set_id) DO UPDATE SET
  tier                = EXCLUDED.tier,
  tier_1_at           = COALESCE(m.tier_1_at, EXCLUDED.tier_1_at),
  tier_2_at           = COALESCE(m.tier_2_at, EXCLUDED.tier_2_at),
  tier_3_at           = COALESCE(m.tier_3_at, EXCLUDED.tier_3_at),
  upgraded_at         = EXCLUDED.upgraded_at,
  earned_set_revision = EXCLUDED.earned_set_revision,
  featured_position   = NULL
WHERE m.tier < EXCLUDED.tier;
```

Counters and featured games are read from this table through an index on
`(user_id, kind, tier, upgraded_at DESC)`, so there are no separate counter columns to drift.

A **moderator removal** runs in one transaction: it records each removed unlock in
`unlock_removals`, deletes it from `user_unlocks`, recalculates the set's medal (clearing the dates
of tiers no longer held, or deleting the row), and adds a `moderation` event. Scores reflect the
removal right away; shares and Elo bonuses update at the next nightly recalculation.

## Progress counters

Counters such as "32 / 50 feathers" are shown **only inside the game**, which tracks them itself.
The platform never receives or stores progress toward an achievement; it only receives the unlock
once the game decides it is earned.

## Rich presence

Profiles show what a player is doing right now, such as "Playing World 3-2, 4 lives".

- The game sends a **presence key plus values** through the SDK every 30–60 seconds, which also
  serves as the session heartbeat.
- The developer defines a **template** per key in each site language, for example
  `Playing World {world}, {lives} lives`, so presence appears in English, Spanish, and Portuguese.
- Presence is short-lived: a player with no heartbeat for a few minutes is shown as offline.

## Badges, site awards, events, and titles

- **Event awards** come from community events (for example a seasonal marathon) and
  **achievement-of-the-week** challenges: one highlighted achievement per week, earned in hardcore
  during that week.
- Awards add **badges to the profile** and may grant a **title**. They never add points.
- **Badges** recognize what a player does for the community, separately from completing games.
  Their kinds are **awards**, **recognitions**, **site roles**, **events**, and **contributions**.
- Each badge has a fixed **rarity**, on the same five tiers as achievements, set by the level of the
  goal or contribution:

  | Rarity | Level | Example |
  |---|---|---|
  | **Common** | Joining or taking a simple first step | Community member |
  | **Uncommon** | A useful, repeatable contribution | Confirmed bug reports |
  | **Rare** | A sustained role or a notable event result | Translating the site, a seasonal event |
  | **Epic** | A major contribution to the project | Significant SDK work |
  | **Legendary** | An exceptional or foundational contribution | Helping launch the platform |

- A player chooses which badges to feature, in the order they pick: **one to six** in the profile's
  badges card, which also shows the total earned, and **up to three** on the bottom edge of their
  profile photo. A player with no badges shows an empty state.
- Hovering, tapping, or focusing a badge shows its name, kind, rarity, description, and unlock date.
- **Titles** come from two sources:
  - **Event titles**, earned from events, such as *"2027 Recompgeddon"* or *"Winter 2027 Ice-Recomp"*
  - **Role titles**, granted by the site, such as *Admin*, *Developer*, *Moderator*
- A player chooses **up to three** of their titles to display, in the order they pick, next to
  their nickname in the mini-profile and on their profile page. Choosing none is allowed.

## Integrity

| Layer | Rule |
|---|---|
| **Signed requests** | Every SDK request is signed with the game's secret key; unsigned, altered, stale, or repeated requests are rejected |
| **Integrity checks** | Server-side checks on every unlock that impossible or implausible play is rejected or flagged |
| **Anomaly flags** | Automatic flags for suspicious activity, reviewed by moderators |
| **Reports and moderation** | Players can report profiles or unlocks; moderators review flags and reports and can remove achievements not legitimately earned, with their points and medals (audited), remove hardcore status, or disable accounts for repeat or serious cheating |

## Data model impact

The schema follows from this design. Tables marked *built* exist today with the fields shown;
the rest, and fields marked *later*, arrive with their features.

| Table | Key fields |
|---|---|
| `users` (*built*) | `username` (unique ignoring case), `email` (unique), `email_confirmed`, `discord_id` and `github_id` (each unique), `password_hash` (null until a password is set), `locale`, `is_enabled`, `created_at`, `edited_at` (null until first edited), `last_activity_at`; only enabled accounts with a confirmed email can collect achievements; `role` (`player`, `moderator`, `admin`), `muted_until`, `avatar_key`, `avatar_terms_accepted_at` |
| `wall_comments` (*built*) | `wall_user_id`, `author_id`, `body` (plain text, up to 1000 characters), `created_at` (comments on public profiles) |
| `moderation_reports` (*built*) | `reporter_id`, `reported_user_id`, `target_type` (`profile`, `photo`, `wall_comment`), `target_key`, `reason`, `details`, `snapshot`, `status` (`open`, `resolved`, `dismissed`), `resolved_by_id`, `resolved_at`, `resolution_note`, `created_at`; one open report per reporter and target |
| `moderation_actions` (*built*) | `moderator_id`, `target_user_id`, `action`, `report_id`, `reason`, `evidence`, `expires_at`, `created_at`; append-only audit log of staff actions |
| `user_sessions` (*built*) | `user_id`, `token_hash`, `last_seen_at`, `expires_at` (website sign-ins, not game sessions) |
| `user_tokens` (*built*) | `user_id`, `purpose` (`confirm_email`, `set_password`), `email`, `token_hash`, `expires_at` (single-use emailed links) |
| `games` (*built*) | `slug`, `title`, `original_platform`, `original_game`, `license`, `platforms`, `summary` (localized), `repo_url`, `display_order`, `featured`, `latest_version`, `released_at`, `art` (SteamGridDB cover, hero, and icon links with their pages and artists; curated or picked automatically), `steam_grid_db_id`; *later:* `dev_user_id`, `hmac_secret` (encrypted) |
| `achievement_sets` (*built*) | `game_id`, `kind` (`core` / `subset`), `status` (`preview`; *later:* draft, in review, published); *later:* `subset_type` (`dlc`, `mod`, `randomizer`, `challenge`), `requirements`, `revision` (raised when achievements are added or removed) |
| `achievements` (*built*) | `set_id`, `api_key_name`, `title` and `description` (localized), `points` (1–10), `rarity_tier`, `kind` (`progression`, `win_condition`, `standard`), `progression_step` (optional), `display_order`; *later:* `icon_url` |
| `game_builds` | `game_id`, `platform`, `sha256`, `label` (verified builds) |
| `game_toggles` | `game_id`, `key`, `classification` (`allowed` / `assist`) |
| `mod_allowlist` | `game_id`, `mod_id`, `version` |
| `game_sessions` | `user_id`, `game_id`, `build_hash`, `state` (JSON snapshot of toggles and active mods), `downgraded_at`, `started_at`, `last_heartbeat_at` |
| `user_unlocks` | `user_id`, `achievement_id`, `softcore_unlocked_at`, `hardcore_unlocked_at`, `session_id`, `build_hash`; unique on `(user_id, achievement_id)` |
| `unlock_removals` | `user_id`, `achievement_id`, `softcore_unlocked_at`, `hardcore_unlocked_at`, `session_id`, `build_hash`, `points_removed`, `moderator_id`, `reason`, `removed_at`; append-only record of each unlock a moderator removed |
| `sdk_request_nonces` | `nonce` (primary key), `received_at`; signed requests already accepted, recorded in the same transaction as their effect so none can be replayed; old rows are cleaned up |
| `achievement_stats` | `achievement_id`, `hardcore_unlockers`, `share`, `elo_bonus`, `calculated_at` (nightly) |
| `user_set_medals` | `user_id` + `set_id` (primary key), `kind` (`core` / `subset`), `tier` (core: 1 Silver, 2 Gold, 3 Platinum; subset: 1 Beaten, 2 Mastered; enforced by a check), `tier_1_at`, `tier_2_at`, `tier_3_at` (when each tier was reached; a skipped tier stays empty), `upgraded_at`, `earned_set_revision`, `featured_position` (core sets only; 1–3 for Platinum, 1 for Gold and Silver; unique per user and tier, null when not chosen) |
| `user_medal_events` | `user_id`, `set_id`, `from_tier`, `to_tier`, `reason` (`earned`, `upgraded`, `moderation`), `session_id`, `actor_id` (the moderator, if any), `created_at`; append-only |
| `badges` | `key`, `name` and `description` (localized), `kind` (`award`, `recognition`, `role`, `event`, `contribution`), `rarity_tier`, `icon` |
| `user_badges` | `user_id` + `badge_id` (primary key), `granted_at`, `granted_by` (if granted by staff), `banner_position` (1–6) and `photo_position` (1–3), each unique per user and null when not featured there |
| `titles`, `user_titles` | Title text (per language), source (`event` / `role`); which titles a user holds, and for up to three of them a display position (1–3) |

## SDK contract (summary)

The `librecompachievements` SDK will expose these operations; exact signatures are defined with the
SDK. Its first integration, and the launch test of this whole design, is **bbport** (Bloodborne),
which also has online co-op.

| Operation | Purpose |
|---|---|
| Start session | Sends the build hash, toggle states, and active mods; returns the game's achievements and the player's unlocks. Only enabled accounts with a confirmed email can collect achievements |
| Report assist / mod change | Updates the session's state; later unlocks in the run are judged against it |
| Unlock | Signed unlock of one achievement; the server judges it hardcore or softcore from the session's state |
| Presence heartbeat | Presence key and values; keeps the session alive |

## Initial values

| Setting | Value |
|---|---|
| Points range | 1–10 |
| Rarity multipliers | ×1, ×1.5, ×2, ×3, ×5 |
| Rarity caps per set | Legendary 10%, Epic 20%, Rare 30% |
| Elo minimum sample | 25 hardcore players in the set |
| Elo recalculation | Nightly |
| Presence heartbeat | Every 30–60 seconds |

## Open questions

- **Editing a published set:** if a developer changes an achievement's points or tier (after
  review), are existing unlocks revalued immediately or at the next nightly recalculation?
- **Collections:** a recomp that bundles several games (e.g. the Uncharted collection port) is one
  game with one core set for now, whose win condition is finishing every game. Should each game in
  a collection get its own set, with its own completion medal?
- **Removed achievements:** if an achievement is removed from a set, do players keep its points?
  (Medals already earned are kept.)
