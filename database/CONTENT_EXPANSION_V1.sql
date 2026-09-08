-- SMM Simplified — Content Expansion v1
-- ADDITIVE ONLY. Does not alter existing business-table RLS or delete existing data.
-- Prerequisite: existing SMM Simplified schema is already active.

create table if not exists public.content_expansions (
  id uuid primary key default gen_random_uuid(),
  content_brief_id uuid not null references public.content_briefs(id) on delete cascade,
  channel text not null check (channel in ('linkedin', 'seo_article')),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'final')),
  content jsonb not null default '{}'::jsonb,
  alignment_report jsonb,
  master_qc_at timestamptz,
  human_qc_status text not null default 'pending' check (human_qc_status in ('pending', 'approved')),
  human_qc_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_brief_id, channel)
);

create index if not exists content_expansions_brief_idx
  on public.content_expansions(content_brief_id);

create index if not exists content_expansions_status_idx
  on public.content_expansions(status);

alter table public.content_expansions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_expansions'
      and policyname = 'content_expansions_authenticated_select'
  ) then
    create policy content_expansions_authenticated_select
      on public.content_expansions
      for select
      to authenticated
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_expansions'
      and policyname = 'content_expansions_authenticated_insert'
  ) then
    create policy content_expansions_authenticated_insert
      on public.content_expansions
      for insert
      to authenticated
      with check (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_expansions'
      and policyname = 'content_expansions_authenticated_update'
  ) then
    create policy content_expansions_authenticated_update
      on public.content_expansions
      for update
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null);
  end if;
end $$;

grant select, insert, update on public.content_expansions to authenticated;

comment on table public.content_expansions is
  'Channel derivative briefs generated from Human-QC-approved master social briefs. Content is editable and requires its own Human QC before final.';
comment on column public.content_expansions.master_qc_at is
  'Timestamp of the master brief Human QC version this derivative was last generated or alignment-checked against.';
comment on column public.content_expansions.alignment_report is
  'Latest AI alignment review against the current Human-QC-approved master brief.';
