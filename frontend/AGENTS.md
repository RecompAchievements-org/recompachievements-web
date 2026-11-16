<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend rules

Stack: Next.js 16 (App Router, Turbopack, Cache Components + Partial Prefetching enabled),
React 19, TypeScript (strict), Tailwind CSS v4 (CSS-first config in `src/app/globals.css`).

### Commands (run from `frontend/`)

- `npm run dev` — local dev server
- `npm run lint` — ESLint; must pass
- `npm run build` — production build; must pass before a task is done

### Rendering & data

- **Server Components by default.** Add `"use client"` only to leaf components that need state,
  effects, or browser APIs. Never put `"use client"` on a page or layout.
- **All data access goes through `src/lib/api/`.** Pages and components never call `fetch` on the
  backend directly. Until the backend exists, this layer returns typed mock data with the same
  shape as the planned `/api/v1` responses.
- **Caching uses `"use cache"`** in data functions, always paired with `cacheLife(...)`, and
  `cacheTag(...)` where the data can be invalidated (e.g. `game:${slug}`). Do not use the legacy
  `fetch` `next: { revalidate }` options or `export const revalidate`.
- Wrap slow or per-user sections in `<Suspense>` with a skeleton fallback so the shell streams.
- Mutations (forms, settings, dev portal) use **Server Actions**, validated on the server.
- Secrets and backend URLs are read only in server code. Only `NEXT_PUBLIC_*` vars reach the client.

### Routes (v0.1)

- `/` — game directory
- `/games/[slug]` — game detail: achievements, points, rarity
- `/u/[username]` — user profile: completion %, recent unlocks
- `/dev` — developer portal: register a recomp, manage achievements and keys

Every public page exports `generateMetadata`; game and profile pages also provide an
`opengraph-image` for Discord/social embeds.

### Structure

```
src/
├── app/            # routes only: page, layout, loading, error, not-found, opengraph-image
├── components/
│   ├── ui/         # generic primitives (Button, Card, Badge, ProgressBar)
│   └── <feature>/  # feature components (game/, profile/, achievement/)
└── lib/
    ├── api/        # data access layer (mock now, backend later)
    └── types/      # domain types shared across the app
```

### Styling

- Tailwind utilities only; no CSS modules or CSS-in-JS.
- Use theme tokens defined in `@theme` (`bg-surface`, `text-muted`, `text-accent`), not raw hex
  values or arbitrary colors.
- Mobile-first; every page must work at 360px width.
- Accessible by default: semantic HTML, labelled controls, visible focus, sufficient contrast.
- Images use `next/image`. Achievement icons and cover art are placeholders or developer-uploaded;
  never official/ripped assets.
