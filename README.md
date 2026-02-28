# Research Navigator (Pilot)

Research Navigator is a pilot implementation of an AI-assisted research workflow:
`invite-only signup -> PDF upload -> Claude extraction -> knowledge graph -> paper detail -> recommendations`.

## Monorepo Layout

- `/Users/joao/Projects/research-navvv/apps/web`: React + TypeScript + Vite frontend.
- `/Users/joao/Projects/research-navvv/packages/shared-types`: shared contracts used by frontend and edge functions.
- `/Users/joao/Projects/research-navvv/supabase/migrations`: Postgres schema + RLS for pilot data model.
- `/Users/joao/Projects/research-navvv/supabase/functions`: Supabase Edge Functions for signup and ingestion pipeline.

## Frontend Setup

1. Create `/Users/joao/Projects/research-navvv/apps/web/.env` from `/Users/joao/Projects/research-navvv/apps/web/.env.example`.
   - Keep `VITE_ENABLE_DEV_AUTH=false` by default; only enable for local development.
2. Install dependencies from repo root: `npm install`.
3. Start web app: `npm run dev`.

## Supabase Setup

1. Create `/Users/joao/Projects/research-navvv/supabase/.env` from `/Users/joao/Projects/research-navvv/supabase/.env.example`.
   - Configure `ALLOWED_CORS_ORIGINS` explicitly for your frontend domains.
2. Apply migration in `/Users/joao/Projects/research-navvv/supabase/migrations/20260219233000_pilot_core.sql`.
3. Deploy edge functions:
   - `pilot-signup`
   - `upload-paper`
   - `process-paper-parse`
   - `process-paper-enrich`
   - `process-paper-graph`
   - `retry-paper-processing`

## Pilot Constraints

- Invite-only signup using `allowed_emails` table.
- PDF only, max 25 MB.
- Claude Sonnet extraction through `process-paper-parse`.
- Monthly AI cap enforced via `ai_usage_daily` and `AI_MONTHLY_CAP_USD`.
- Low-confidence extraction is flagged as `needs_review` and editable in `/lab/papers/:paperId`.
