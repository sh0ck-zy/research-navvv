# Navvv Architecture

## Quick Start

1. Install dependencies (repo root):
   - `npm install`
2. Run development server:
   - `npm run dev`
3. Build production bundle:
   - `npm run build`
4. Regenerate arXiv galaxy data:
   - `make arxiv_demo`
   - `DATASET_PATH=/absolute/path/to/arxiv-metadata-oai-snapshot.json make arxiv_demo`
   - `SEED=123 COUNT=5000 make arxiv_demo`

`make demo` is an alias of `make arxiv_demo`.

## Source of Truth

- Frontend app (single source of truth): `apps/web`
- Shared TS contracts: `packages/shared-types`

## Active Runtime Paths

- Router: `apps/web/src/App.tsx`
- Main galaxy page: `apps/web/src/pages/GalaxyLanding.tsx`
- Legacy wrapper route page: `apps/web/src/pages/Galaxy.tsx`
- Galaxy shell/search/card UI: `apps/web/src/components/galaxy/GalaxyShell.tsx`, `GalaxySearch.tsx`, `PaperCard.tsx`
- Galaxy renderer (Three-only): `apps/web/src/components/galaxy/GalaxyCanvas.tsx`
- Galaxy data schema/loader: `apps/web/src/lib/galaxy/*`
- Queue store (localStorage): `apps/web/src/lib/store/queue.ts`
- Static dataset served by Vite: `apps/web/public/demo/nodes.json`
- arXiv data generator: `engine/arxiv_build.py`
- Make targets: `Makefile` (`arxiv_demo`, `demo`)

## Route Map

- `/` -> Galaxy landing experience
- `/galaxy` -> Galaxy landing experience (same page)
- `/lab` -> Redirects to `/galaxy`
- `/lab/papers/:paperId` -> Redirects to `/galaxy`
- `/login`, `/signup` -> Existing auth pages

## UI Extension Boundary

Antigravity should edit only UI-layer files:

- `GalaxyShell.tsx`
- `GalaxySearch.tsx`
- `PaperCard.tsx`
- `uiTokens.ts`
- CSS (`index.css`)

Three logic and camera behavior remain in `GalaxyCanvas.tsx`.

## Semantic vs Ambient Layers

- Semantic data source (`nodes.json`) contains real arXiv papers only.
- Atmospheric background particles are generated procedurally inside `GalaxyCanvas.tsx`.
- Search, selection, card, queue, and fly-to operate only on semantic paper nodes.
