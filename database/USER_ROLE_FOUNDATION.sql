-- SMM Simplified — Phase 1 User Role Foundation
-- ADDITIVE ONLY. This file does not modify RLS on existing business tables.
-- Apply once in Supabase SQL Editor when ready to activate the foundation tables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  module text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- Phase 1 intentionally uses one preset role per user.
-- Granular exceptions live in user_permission_overrides.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_brand_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  allowed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

create index if not exists idx_user_brand_access_brand_id
  on public.user_brand_access(brand_id);
create index if not exists idx_role_permissions_permission_id
  on public.role_permissions(permission_id);
create index if not exists idx_user_permission_overrides_permission_id
  on public.user_permission_overrides(permission_id);

-- Keep profiles in sync with Supabase Auth without changing the existing login flow.
create or replace function public.sync_smm_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

-- Create our auth trigger only if it does not already exist.
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'smm_sync_profile_from_auth_user'
  ) then
    create trigger smm_sync_profile_from_auth_user
      after insert or update of email, raw_user_meta_data on auth.users
      for each row execute function public.sync_smm_profile_from_auth_user();
  end if;
end
$$;

-- Backfill profiles for existing accounts.
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
  updated_at = now();

-- Preset roles agreed for SMM Simplified.
insert into public.roles (key, name, description, is_system)
values
  ('super_admin', 'Super Admin', 'Full workspace, user, brand, and system access.', true),
  ('manager', 'Manager / Social Media Lead', 'Runs content operations, QC, calendar, brand intelligence, and analytics.', true),
  ('content_writer', 'Content Writer / Strategist', 'Researches, generates, and edits storytelling briefs.', true),
  ('designer', 'Designer', 'Reads briefs and manages design production status and links.', true),
  ('viewer', 'Viewer / Client', 'Read-only access to permitted brand workspaces.', true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  updated_at = now();

-- Granular permission catalog.
insert into public.permissions (key, module, name, description)
values
  ('overview.view', 'overview', 'View Overview', 'View production overview and brand summaries.'),
  ('brief.view', 'brief', 'View Briefs', 'Open Story Angles and Full Briefs.'),
  ('brief.create', 'brief', 'Create Brief', 'Create a new Quick Brief workflow.'),
  ('brief.ai_generate', 'brief', 'Generate with AI', 'Run AI research, Story Angles, and brief generation.'),
  ('brief.edit', 'brief', 'Edit Brief', 'Edit Full Brief content and slide sequence.'),
  ('brief.improve', 'brief', 'Improve Brief', 'Run AI Improve on an existing brief.'),
  ('brief.qc', 'brief', 'Human QC', 'Approve or re-approve Human QC.'),
  ('calendar.view', 'calendar', 'View Calendar', 'View scheduled content.'),
  ('calendar.schedule', 'calendar', 'Schedule Brief', 'Set a publication date from a brief.'),
  ('calendar.reschedule', 'calendar', 'Reschedule Content', 'Drag, drop, or Quick Move scheduled content.'),
  ('design.view', 'design', 'View Design Workflow', 'View design production status and links.'),
  ('design.update_status', 'design', 'Update Design Status', 'Move content between Ready to Design and Designed.'),
  ('design.update_link', 'design', 'Update Design Link', 'Add or change the external design-file URL.'),
  ('brand.view', 'brand', 'View Brand Intelligence', 'Read brand intelligence and positioning.'),
  ('brand.edit', 'brand', 'Edit Brand Intelligence', 'Edit saved brand intelligence fields.'),
  ('brand.upload', 'brand', 'Upload Brand Sources', 'Upload source files for AI extraction.'),
  ('brand.create', 'brand', 'Create Brand', 'Add a new client brand.'),
  ('brand.delete', 'brand', 'Delete Brand', 'Delete a brand when explicitly allowed.'),
  ('analytics.view', 'analytics', 'View Analytics', 'View analytics workspace and metrics.'),
  ('analytics.export', 'analytics', 'Export Analytics', 'Export analytics reports.'),
  ('users.view', 'users', 'View Users', 'View user and access assignments.'),
  ('users.invite', 'users', 'Invite Users', 'Invite new dashboard users.'),
  ('users.manage', 'users', 'Manage Users & Access', 'Change roles, brand access, and permission overrides.'),
  ('settings.manage', 'settings', 'Manage Settings', 'Change system-level settings.')
on conflict (key) do update set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description;

-- Reset only the five system preset matrices, never user overrides.
delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.key in ('super_admin', 'manager', 'content_writer', 'designer', 'viewer');

-- Super Admin gets every permission.
insert into public.role_permissions (role_id, permission_id, allowed)
select r.id, p.id, true
from public.roles r
cross join public.permissions p
where r.key = 'super_admin'
on conflict (role_id, permission_id) do update set allowed = excluded.allowed;

-- Manager / Social Media Lead.
insert into public.role_permissions (role_id, permission_id, allowed)
select r.id, p.id, true
from public.roles r
join public.permissions p on p.key = any(array[
  'overview.view',
  'brief.view', 'brief.create', 'brief.ai_generate', 'brief.edit', 'brief.improve', 'brief.qc',
  'calendar.view', 'calendar.schedule', 'calendar.reschedule',
  'design.view', 'design.update_status', 'design.update_link',
  'brand.view', 'brand.edit', 'brand.upload', 'brand.create',
  'analytics.view', 'analytics.export'
])
where r.key = 'manager'
on conflict (role_id, permission_id) do update set allowed = excluded.allowed;

-- Content Writer / Strategist.
insert into public.role_permissions (role_id, permission_id, allowed)
select r.id, p.id, true
from public.roles r
join public.permissions p on p.key = any(array[
  'overview.view',
  'brief.view', 'brief.create', 'brief.ai_generate', 'brief.edit', 'brief.improve',
  'calendar.view',
  'design.view',
  'brand.view'
])
where r.key = 'content_writer'
on conflict (role_id, permission_id) do update set allowed = excluded.allowed;

-- Designer.
insert into public.role_permissions (role_id, permission_id, allowed)
select r.id, p.id, true
from public.roles r
join public.permissions p on p.key = any(array[
  'overview.view',
  'brief.view',
  'calendar.view',
  'design.view', 'design.update_status', 'design.update_link',
  'brand.view'
])
where r.key = 'designer'
on conflict (role_id, permission_id) do update set allowed = excluded.allowed;

-- Viewer / Client.
insert into public.role_permissions (role_id, permission_id, allowed)
select r.id, p.id, true
from public.roles r
join public.permissions p on p.key = any(array[
  'overview.view',
  'brief.view',
  'calendar.view',
  'design.view',
  'brand.view',
  'analytics.view'
])
where r.key = 'viewer'
on conflict (role_id, permission_id) do update set allowed = excluded.allowed;

-- Safe bootstrap: only when the project currently has exactly one Auth user and no role assignment.
-- This prevents the original owner account from being stranded before the Users & Access UI exists.
do $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  if (select count(*) from auth.users) = 1
     and not exists (select 1 from public.user_roles) then
    select id into v_user_id from auth.users order by created_at asc limit 1;
    select id into v_role_id from public.roles where key = 'super_admin';

    if v_user_id is not null and v_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (v_user_id, v_role_id)
      on conflict (user_id) do nothing;
    end if;
  end if;
end
$$;

-- RLS applies ONLY to the new access-control tables.
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_brand_access enable row level security;
alter table public.user_permission_overrides enable row level security;

-- Read-only foundation policies. Admin write policies / secure admin RPCs are Phase 2+.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own') then
    create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_read_catalog') then
    create policy roles_read_catalog on public.roles for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'permissions' and policyname = 'permissions_read_catalog') then
    create policy permissions_read_catalog on public.permissions for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'role_permissions' and policyname = 'role_permissions_read_catalog') then
    create policy role_permissions_read_catalog on public.role_permissions for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname = 'user_roles_select_own') then
    create policy user_roles_select_own on public.user_roles for select to authenticated using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_brand_access' and policyname = 'user_brand_access_select_own') then
    create policy user_brand_access_select_own on public.user_brand_access for select to authenticated using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_permission_overrides' and policyname = 'user_permission_overrides_select_own') then
    create policy user_permission_overrides_select_own on public.user_permission_overrides for select to authenticated using (user_id = auth.uid());
  end if;
end
$$;

comment on table public.profiles is 'SMM Simplified user profile metadata linked 1:1 to Supabase Auth.';
comment on table public.roles is 'Preset roles. Role is the default permission bundle, not the final security boundary.';
comment on table public.permissions is 'Granular permission catalog used by UI/API/RLS enforcement in later phases.';
comment on table public.user_brand_access is 'Explicit brand scope per user. Super Admin bypass is resolved by application access logic.';
comment on table public.user_permission_overrides is 'Per-user allow/deny overrides applied after the preset role matrix.';
