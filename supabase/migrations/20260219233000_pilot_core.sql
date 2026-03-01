create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists public.allowed_emails (
  email text primary key,
  invited_by uuid,
  invited_at timestamptz not null default now(),
  used_at timestamptz,
  status text not null default 'invited' check (status in ('invited', 'used', 'disabled'))
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  research_interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  abstract text,
  summary text,
  doi text,
  year integer,
  venue text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'needs_review', 'failed')),
  processing_stage text not null default 'parse' check (processing_stage in ('parse', 'enrich', 'graph', 'done')),
  processing_error text,
  processing_attempts integer not null default 0,
  checksum text not null,
  storage_path text not null,
  file_name text,
  mime_type text not null,
  size_bytes bigint not null,
  page_count integer,
  citations_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paper_extractions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  raw_json jsonb not null,
  confidence numeric(5,4) not null default 0,
  model text not null,
  token_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.paper_entities (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  type text not null check (type in ('paper', 'author', 'topic', 'method', 'dataset', 'metric')),
  canonical_name text not null,
  raw_name text not null,
  confidence numeric(5,4) not null default 0,
  source text not null check (source in ('claude', 'openalex', 'crossref', 'user')),
  external_id text,
  created_at timestamptz not null default now(),
  unique (paper_id, type, canonical_name, source)
);

create table if not exists public.paper_relations (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  relation_type text not null check (relation_type in ('authored_by', 'mentions', 'uses', 'evaluates_on', 'cites')),
  source_entity_id uuid not null references public.paper_entities(id) on delete cascade,
  target_entity_id uuid not null references public.paper_entities(id) on delete cascade,
  confidence numeric(5,4) not null default 0,
  source text not null check (source in ('claude', 'openalex', 'crossref', 'user')),
  created_at timestamptz not null default now()
);

create table if not exists public.kg_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('paper', 'author', 'topic', 'method', 'dataset', 'metric')),
  canonical_name text not null,
  paper_id uuid references public.papers(id) on delete cascade,
  aliases_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(owner_id, type, canonical_name)
);

create table if not exists public.kg_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('authored_by', 'mentions', 'uses', 'evaluates_on', 'cites')),
  source_node_id uuid not null references public.kg_nodes(id) on delete cascade,
  target_node_id uuid not null references public.kg_nodes(id) on delete cascade,
  weight numeric(8,3) not null default 1,
  provenance_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(owner_id, type, source_node_id, target_node_id)
);

create table if not exists public.paper_corrections (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  field text not null check (field in ('title', 'year', 'abstract', 'summary')),
  old_value text,
  new_value text not null,
  corrected_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  paper_id uuid not null references public.papers(id) on delete cascade,
  candidate_paper_id uuid not null references public.papers(id) on delete cascade,
  score numeric(8,3) not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, paper_id, candidate_paper_id)
);

create table if not exists public.ai_usage_daily (
  day date not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(day, owner_id)
);

create index if not exists papers_owner_created_idx on public.papers(owner_id, created_at desc);
create index if not exists papers_title_trgm_idx on public.papers using gin (title gin_trgm_ops);
create index if not exists paper_entities_paper_type_idx on public.paper_entities(paper_id, type);
create index if not exists paper_relations_paper_idx on public.paper_relations(paper_id);
create index if not exists kg_nodes_owner_type_idx on public.kg_nodes(owner_id, type);
create index if not exists kg_nodes_paper_id_idx on public.kg_nodes(paper_id);
create index if not exists kg_edges_owner_source_target_idx on public.kg_edges(owner_id, source_node_id, target_node_id);
create index if not exists recommendations_owner_score_idx on public.recommendations(owner_id, score desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_papers_updated_at on public.papers;
create trigger trg_papers_updated_at
before update on public.papers
for each row execute function public.set_updated_at();

drop trigger if exists trg_ai_usage_daily_updated_at on public.ai_usage_daily;
create trigger trg_ai_usage_daily_updated_at
before update on public.ai_usage_daily
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.papers enable row level security;
alter table public.paper_extractions enable row level security;
alter table public.paper_entities enable row level security;
alter table public.paper_relations enable row level security;
alter table public.kg_nodes enable row level security;
alter table public.kg_edges enable row level security;
alter table public.paper_corrections enable row level security;
alter table public.recommendations enable row level security;
alter table public.ai_usage_daily enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles upsert own" on public.profiles;
create policy "profiles upsert own"
on public.profiles for all
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "papers own" on public.papers;
create policy "papers own"
on public.papers for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "paper_extractions own" on public.paper_extractions;
create policy "paper_extractions own"
on public.paper_extractions for all
using (exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid()));

drop policy if exists "paper_entities own" on public.paper_entities;
create policy "paper_entities own"
on public.paper_entities for all
using (exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid()));

drop policy if exists "paper_relations own" on public.paper_relations;
create policy "paper_relations own"
on public.paper_relations for all
using (exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid()))
with check (exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid()));

drop policy if exists "kg_nodes own" on public.kg_nodes;
create policy "kg_nodes own"
on public.kg_nodes for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "kg_edges own" on public.kg_edges;
create policy "kg_edges own"
on public.kg_edges for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "paper_corrections own" on public.paper_corrections;
create policy "paper_corrections own"
on public.paper_corrections for all
using (
  corrected_by = auth.uid()
  and exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid())
)
with check (
  corrected_by = auth.uid()
  and exists (select 1 from public.papers p where p.id = paper_id and p.owner_id = auth.uid())
);

drop policy if exists "recommendations own" on public.recommendations;
create policy "recommendations own"
on public.recommendations for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "ai_usage_daily own" on public.ai_usage_daily;
create policy "ai_usage_daily own"
on public.ai_usage_daily for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "papers bucket read own" on storage.objects;
create policy "papers bucket read own"
on storage.objects for select
using (
  bucket_id = 'papers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "papers bucket write own" on storage.objects;
create policy "papers bucket write own"
on storage.objects for insert
with check (
  bucket_id = 'papers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "papers bucket update own" on storage.objects;
create policy "papers bucket update own"
on storage.objects for update
using (
  bucket_id = 'papers'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'papers'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "papers bucket delete own" on storage.objects;
create policy "papers bucket delete own"
on storage.objects for delete
using (
  bucket_id = 'papers'
  and auth.uid()::text = (storage.foldername(name))[1]
);
