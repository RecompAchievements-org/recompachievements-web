# Achievement system

How achievements, scores, completion badges, and titles work on RecompAchievements. This is the
reference for players, recomp developers, and contributors; the database schema, the API, and the
`librecompachievements` SDK follow it.

> **Status:** agreed design, not yet implemented. Values marked *initial* can be tuned later
> without changing the model.

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
- Sets are tracked separately: each has its own completion and completion badges.
- A gameplay-changing mod played against the **core** set makes the session softcore; played with
  **its own subset** (with the declared requirements met), it can be hardcore.

## Achievements

| Field | Meaning |
|---|---|
| Identifier | `api_key_name` (e.g. `BOSS_GASCOIGNE`), the name the SDK sends |
| Title, description, icon | Shown on the site; icons are original or supplied by the developer |
| **Points** | **1–10**, set by the developer: 1 = easiest, 10 = hardest |
| **Rarity tier** | Set by the developer and fixed: Common, Uncommon, Rare, Epic, Legendary |
| **Kind** | `progression` (required story milestone), `win_condition` (finishing the game), or `standard` |
| Progress target | Optional, e.g. `50` for "Collect 50 feathers" (display only) |

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

## Hardcore and softcore

Every play **session** is hardcore or softcore. A session is **hardcore** only if all of these hold
for the entire session:

1. **Verified build:** the executable's SHA-256 hash is one of the game's official builds registered
   by its developer (per platform: Windows, Linux, macOS).
2. **No assists:** every game toggle the developer classified as an **assist** (infinite health,
   save anywhere, slow motion, level select, cheats) is off. Toggles classified as **allowed**
   (60 fps, widescreen, UI options) don't matter.
3. **Allowed mods only:** every active mod (identified by mod ID and version) is on the game's
   **allowlist** of cosmetic and quality-of-life mods, or is required by the subset being played.

Otherwise the session is **softcore**. Once a session becomes softcore it **stays softcore** until
the game restarts; turning an assist off mid-session doesn't restore hardcore.

### Upgrading unlocks

An achievement unlocked in softcore can be **upgraded** by unlocking it again in a hardcore session.
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
- Completion badges, site awards, and titles **never add points**; points come only from achievements.
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

## Completion badges

Badges are for display only and give no points.

### Core set

| Badge | Condition |
|---|---|
| **Silver** | Finished: every `progression` achievement plus at least one `win_condition`, with **at least one of them in softcore** |
| **Gold** | Finished, with **all** of those achievements in hardcore. A Silver becomes Gold as soon as its softcore achievements are upgraded. |
| **Platinum** | **Every** core-set achievement unlocked in hardcore. Awarded automatically with the last one. |

A player holds at most one of Silver or Gold for a set; Platinum implies Gold.

### Subsets

| Badge | Condition |
|---|---|
| **Beaten** | Every achievement in the subset unlocked, at least one of them in softcore |
| **Mastered** | Every achievement in the subset unlocked in hardcore |

Beaten becomes Mastered once the remaining unlocks are upgraded.

## Progress tracking

An achievement with a progress target shows the player's progress ("32 / 50") on their profile and
the game page. Games report progress through the SDK. Progress is **display only**: reaching the
target never unlocks the achievement; the game still sends its own signed unlock.

## Rich presence

Profiles show what a player is doing right now, such as "Playing World 3-2, 4 lives".

- The game sends a **presence key plus values** through the SDK every 30–60 seconds, which also
  serves as the session heartbeat.
- The developer defines a **template** per key in each site language, for example
  `Playing World {world}, {lives} lives`, so presence appears in English, Spanish, and Portuguese.
- Presence is short-lived: a player with no heartbeat for a few minutes is shown as offline.

## Site awards, events, and titles

- **Event awards** come from community events (for example a seasonal marathon) and
  **achievement-of-the-week** challenges: one highlighted achievement per week, earned in hardcore
  during that week.
- Awards add **badges to the profile** and may grant a **title**. They never add points.
- **Titles** come from two sources:
  - **Event titles**, earned from events, such as *"2027 Recompgeddon"* or *"Winter 2027 Ice-Recomp"*
  - **Role titles**, granted by the site, such as *Admin*, *Developer*, *Moderator*
- A player chooses **up to three** of their titles to display, in the order they pick, next to
  their nickname in the mini-profile and on their profile page. Choosing none is allowed.

## Integrity

| Layer | Rule |
|---|---|
| **Signed unlocks** | Every unlock is signed with HMAC-SHA256 using the game's secret, carries a unique ID, and is rejected if older than 60 seconds or already seen |
| **Sanity checks** | Minimum play time (for example, the final boss can't be reached minutes after the session starts) and progression order (a progression achievement can't precede an earlier one) |
| **Anomaly flags** | Automatic flags for suspicious patterns, such as many Legendary unlocks in a short time, unlocks from several builds at once, or a new account clearing a set |
| **Reports and moderation** | Players can report profiles or unlocks; moderators review flags and reports and can reset unlocks, remove hardcore status, or ban accounts |

## Data model impact

The schema (to be built with the backend features) follows from this design:

| Table | Key fields |
|---|---|
| `games` | `slug`, `title`, `platform_origin`, `repo_url`, `dev_user_id`, `hmac_secret` (encrypted) |
| `achievement_sets` | `game_id`, `kind` (`core` / `subset`), `subset_type` (`dlc`, `mod`, `randomizer`, `challenge`), `requirements`, `status` (draft, in review, published) |
| `achievements` | `set_id`, `api_key_name`, `title`, `description`, `points` (1–10), `rarity_tier`, `kind` (`progression`, `win_condition`, `standard`), `progress_target`, `icon_url`, `display_order` |
| `game_builds` | `game_id`, `platform`, `sha256`, `label` (verified builds) |
| `game_toggles` | `game_id`, `key`, `classification` (`allowed` / `assist`) |
| `mod_allowlist` | `game_id`, `mod_id`, `version` |
| `game_sessions` | `user_id`, `game_id`, `set_id`, `build_hash`, `is_hardcore`, `downgraded_at`, `started_at`, `last_heartbeat_at` |
| `user_unlocks` | `user_id`, `achievement_id`, `softcore_unlocked_at`, `hardcore_unlocked_at`, `session_id`, `build_hash`; unique on `(user_id, achievement_id)` |
| `achievement_stats` | `achievement_id`, `hardcore_unlockers`, `share`, `elo_bonus`, `calculated_at` (nightly) |
| `user_set_badges` | `user_id`, `set_id`, `badge` (`silver`, `gold`, `platinum`, `beaten`, `mastered`), `awarded_at` |
| `titles`, `user_titles` | Title text (per language), source (`event` / `role`); which titles a user holds, and for up to three of them a display position (1–3) |

## SDK contract (summary)

The `librecompachievements` SDK will expose these operations; exact signatures are defined with the
SDK.

| Operation | Purpose |
|---|---|
| Start session | Sends the build hash, toggle states, and active mods; the server decides hardcore or softcore and returns the set's achievements and the player's unlocks |
| Report assist / mod change | Downgrades the session to softcore for the rest of the run |
| Unlock | Signed unlock of one achievement |
| Update progress | Reports progress toward a target (display only) |
| Presence heartbeat | Presence key and values; keeps the session alive |

## Initial values

| Setting | Value |
|---|---|
| Points range | 1–10 |
| Rarity multipliers | ×1, ×1.5, ×2, ×3, ×5 |
| Rarity caps per set | Legendary 10%, Epic 20%, Rare 30% |
| Elo minimum sample | 25 hardcore players in the set |
| Elo recalculation | Nightly |
| Unlock signature window | 60 seconds |
| Presence heartbeat | Every 30–60 seconds |

## Open questions

- **Editing a published set:** if a developer changes an achievement's points or tier (after
  review), are existing unlocks revalued immediately or at the next nightly recalculation?
- **Moderator resets and badges:** when a reset removes an unlock that a Gold, Platinum, or Mastered
  badge depended on, is the badge revoked or downgraded (for example Gold → Silver)?
- **Removed achievements:** if an achievement is removed from a set, do players keep its points, and
  are completion badges recalculated?
