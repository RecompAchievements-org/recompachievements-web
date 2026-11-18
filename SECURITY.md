# Security Policy

RecompAchievements relies on the integrity of player unlocks and on keeping developer secrets safe.
We appreciate responsible reports and will work with you to fix issues quickly.

## Reporting a vulnerability

**Please do not report security issues through public GitHub issues, discussions, or pull requests.**

Report privately through either channel:

- **GitHub:** [Report a vulnerability](https://github.com/RecompAchievements-org/recompachievements-web/security/advisories/new)
  (private security advisory)
- **Email:** [security@recompachievements.org](mailto:security@recompachievements.org)

Please include:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Affected component (website, `/api/v1`, `/api/sdk/v1`, SDK) and version or commit, if known

## What to expect

- Acknowledgement within **3 business days**
- An initial assessment and next steps within **10 business days**
- Credit in the release notes once fixed, if you'd like it

This is a volunteer-run project, so timelines are best effort.

## Scope

In scope:

- The website and its APIs (`recompachievements.org`)
- Forging, replaying, or tampering with achievement unlocks (e.g. bypassing request signing)
- Authentication, session, or API-key weaknesses
- Exposure of user data or developer secrets

Out of scope:

- Cheating within a game by modifying your local executable or memory — report suspicious
  unlocks to [contact@recompachievements.org](mailto:contact@recompachievements.org) instead
- Denial-of-service or volumetric attacks
- Social engineering of maintainers or users
- Findings from automated scanners without a demonstrated impact

## Safe harbor

We will not pursue action against research done in good faith that respects user privacy, avoids
data destruction and service disruption, and stays within this policy. Only test against accounts
you own.

## Supported versions

The project is pre-1.0; only the latest version on `main` receives security fixes.
