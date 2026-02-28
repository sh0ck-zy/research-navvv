# Navvv Architecture

## Quick Start

1. Install dependencies (repo root):
   - `npm install`
2. Run development server:
   - `npm run dev`
3. Build production bundle:
   - `npm run build`
4. Regenerate sample galaxy data:
   - `make demo`
   - `SEED=123 make demo` (optional deterministic variation)

## Source of Truth

- Frontend app (single source of truth): `apps/web`
- Shared TS contracts: `packages/shared-types`

## Active Runtime Paths

- Router: `apps/web/src/App.tsx`
- Landing page: `apps/web/src/pages/Landing.tsx`
- Galaxy page: `apps/web/src/pages/Galaxy.tsx`
- Galaxy renderer/components: `apps/web/src/components/galaxy/*`
- Galaxy data schema/loader: `apps/web/src/lib/galaxy/*`
- Static demo dataset served by Vite: `apps/web/public/demo/nodes.json`
- Demo dataset generator: `engine/build_demo.py`
- Make target: `Makefile` (`demo`)

## Route Map

- `/` -> Landing
- `/galaxy` -> Galaxy explorer
- `/lab` -> Redirects to `/galaxy`
- `/lab/papers/:paperId` -> Redirects to `/galaxy`
- `/login`, `/signup` -> Existing auth pages (non-core path)

## Legacy Archived Code

- Non-core placeholder lab experience was moved to `archive/legacy-lab`.
- Purpose: keep repo history while making current product path unambiguous.
