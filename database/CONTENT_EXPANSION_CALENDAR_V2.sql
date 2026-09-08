-- SMM Simplified — Content Expansion Calendar v2
-- ADDITIVE ONLY. Extends content_expansions so approved LinkedIn/SEO derivatives
-- can have their own publication date and appear as independent calendar items.
-- Prerequisite: database/CONTENT_EXPANSION_V1.sql has already been applied.

alter table public.content_expansions
  add column if not exists scheduled_for date;

create index if not exists content_expansions_scheduled_idx
  on public.content_expansions(scheduled_for)
  where scheduled_for is not null;

comment on column public.content_expansions.scheduled_for is
  'Independent publication date for the derivative channel. This is separate from the Master Social Brief schedule.';
