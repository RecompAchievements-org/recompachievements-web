# Agent skills

Third-party [Agent Skills](https://agentskills.io) (folders with a `SKILL.md`) vendored into this
repository so every contributor and AI agent uses the same reviewed version. Skills give agents
extra know-how but **never override project rules**: the numbered rules, the subfolder
`AGENTS.md` files, and the root [`AGENTS.md`](../../AGENTS.md) (which lists per-skill overrides)
always win.

## Installed skills

| Skill | Purpose | Source | Version | License |
|---|---|---|---|---|
| `react-best-practices` (`vercel-react-best-practices`) | 70 React/Next.js performance rules, ranked by impact | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | `1a2c79d` (2026-10-27) | MIT |
| `web-design-guidelines` | Reviews UI code against Vercel's Web Interface Guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines); rules from [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | `1a2c79d` (2026-10-27); rules `434b7f9` | MIT |
| `webapp-testing` | Drives the running site with Playwright (Python) for checks and screenshots | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | `e4bb5d9` (2026-11-16) | Apache-2.0 (`webapp-testing/LICENSE.txt`) |

All three were reviewed on 2026-11-16 and copied without the upstream `.zip` bundles. Only
`web-design-guidelines` is modified (see below); the others are unmodified.

## Tool support

`.agents/skills/` is the project's only skills folder, read by tools that support the shared
location (Codex, Cursor, Gemini CLI, Copilot). No tool-specific copies or links are kept; Claude
Code, which only loads `.claude/skills/`, doesn't load these skills automatically, so point it at
the relevant `SKILL.md` when needed.

## Notes per skill

- **`web-design-guidelines`** (modified): upstream fetches its rules from the web on every run.
  Here they are vendored as `guidelines.md` (a reviewed copy of `command.md` at commit `434b7f9`)
  and `SKILL.md` reads that file instead, so reviews are reproducible and nothing is downloaded.
  It only reviews code; it doesn't edit files.
- **`webapp-testing`** needs Python 3 with Playwright. Its helper `scripts/with_server.py` starts
  the dev server locally, waits for the port, runs a script, and stops the server.

## Setting up `webapp-testing`

Once per machine, from the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r .agents/requirements.txt   # Playwright, pinned
.venv/bin/playwright install chromium               # ~100 MB, stored in the user cache
```

`.venv/` is git-ignored. Run checks with the venv's Python, for example:

```bash
.venv/bin/python .agents/skills/webapp-testing/scripts/with_server.py \
  --server "npm --prefix frontend run dev" --port 3000 -- .venv/bin/python my_check.py
```

Keep check scripts and screenshots outside the repo or in the ignored `.agents/tmp/` folder.

## Updating a skill

1. Download the new upstream version to a temporary folder (not into this repo).
2. Read every changed file, including scripts, before copying.
3. Copy it over the old folder, update the version and date in the table above, and check the
   project overrides in the root `AGENTS.md` still apply.
4. For `web-design-guidelines`, re-apply the local `SKILL.md` change and refresh `guidelines.md`
   from the reviewed `command.md` commit. For `webapp-testing`, bump the pin in
   `.agents/requirements.txt` if needed.
