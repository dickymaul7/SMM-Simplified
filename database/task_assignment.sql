-- Task assignment layer for the Overview + Content Calendar workflow.
-- Run this migration in Supabase SQL Editor.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('superadmin','content_writer','designer','video_editor','member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.content_briefs(id) on delete cascade,
  assigned_to uuid not null references public.team_members(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'todo' check (status in ('todo','in_progress','review','completed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_assignments_assigned_to_status_idx on public.task_assignments(assigned_to, status);
create index if not exists task_assignments_brief_idx on public.task_assignments(brief_id);

alter table public.team_members enable row level security;
alter table public.task_assignments enable row level security;

-- Team members can be read by authenticated users so assignment dropdowns can work.
drop policy if exists team_members_select_authenticated on public.team_members;
create policy team_members_select_authenticated on public.team_members
for select to authenticated using (active = true);

-- Authenticated users can see tasks assigned to them; superadmins can see all tasks.
drop policy if exists task_assignments_select on public.task_assignments;
create policy task_assignments_select on public.task_assignments
for select to authenticated using (
  assigned_to in (select id from public.team_members where user_id = auth.uid())
  or exists (select 1 from public.team_members where user_id = auth.uid() and role = 'superadmin' and active = true)
);

-- Superadmins can create assignments.
drop policy if exists task_assignments_insert_superadmin on public.task_assignments;
create policy task_assignments_insert_superadmin on public.task_assignments
for insert to authenticated with check (
  assigned_by = auth.uid()
  and exists (select 1 from public.team_members where user_id = auth.uid() and role = 'superadmin' and active = true)
);

-- Assignees can update their own task status; superadmins can update any task.
drop policy if exists task_assignments_update on public.task_assignments;
create policy task_assignments_update on public.task_assignments
for update to authenticated using (
  assigned_to in (select id from public.team_members where user_id = auth.uid())
  or exists (select 1 from public.team_members where user_id = auth.uid() and role = 'superadmin' and active = true)
) with check (
  assigned_to in (select id from public.team_members where user_id = auth.uid())
  or exists (select 1 from public.team_members where user_id = auth.uid() and role = 'superadmin' and active = true)
);
