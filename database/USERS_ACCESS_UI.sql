-- SMM Simplified — Phase 2 Users & Access UI
-- ADDITIVE ONLY. This file does not modify RLS on existing business tables.
-- Prerequisite: database/USER_ROLE_FOUNDATION.sql has already been applied.

-- Resolve one permission for the signed-in user inside SECURITY DEFINER admin RPCs.
-- Super Admin is intentionally always full-access to avoid accidental lockout.
create or replace function public.smm_has_access_permission(p_permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role_key text;
  v_override boolean;
begin
  if v_user_id is null then
    return false;
  end if;

  select r.key
    into v_role_key
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = v_user_id;

  if v_role_key = 'super_admin' then
    return true;
  end if;

  select upo.allowed
    into v_override
  from public.user_permission_overrides upo
  join public.permissions p on p.id = upo.permission_id
  where upo.user_id = v_user_id
    and p.key = p_permission_key;

  if found then
    return v_override;
  end if;

  return exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id and rp.allowed = true
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = v_user_id
      and p.key = p_permission_key
  );
end;
$$;

-- Return all data required by the Users & Access workspace in one request.
create or replace function public.smm_admin_access_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not (
    public.smm_has_access_permission('users.view')
    or public.smm_has_access_permission('users.manage')
  ) then
    raise exception 'Anda tidak memiliki izin untuk melihat Users & Access.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'email', pr.email,
          'full_name', pr.full_name,
          'avatar_url', pr.avatar_url,
          'status', pr.status,
          'role_key', r.key,
          'role_name', r.name,
          'brand_ids', coalesce((
            select jsonb_agg(uba.brand_id order by uba.brand_id)
            from public.user_brand_access uba
            where uba.user_id = pr.id
          ), '[]'::jsonb),
          'overrides', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'key', p.key,
                'allowed', upo.allowed
              )
              order by p.module, p.key
            )
            from public.user_permission_overrides upo
            join public.permissions p on p.id = upo.permission_id
            where upo.user_id = pr.id
          ), '[]'::jsonb)
        )
        order by coalesce(nullif(pr.full_name, ''), nullif(pr.email, ''), pr.id::text)
      )
      from public.profiles pr
      left join public.user_roles ur on ur.user_id = pr.id
      left join public.roles r on r.id = ur.role_id
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', r.key,
          'name', r.name,
          'description', r.description,
          'permissions', coalesce((
            select jsonb_agg(p.key order by p.module, p.key)
            from public.role_permissions rp
            join public.permissions p on p.id = rp.permission_id
            where rp.role_id = r.id
              and rp.allowed = true
          ), '[]'::jsonb)
        )
        order by case r.key
          when 'super_admin' then 1
          when 'manager' then 2
          when 'content_writer' then 3
          when 'designer' then 4
          when 'viewer' then 5
          else 99
        end,
        r.name
      )
      from public.roles r
      where r.key in ('super_admin', 'manager', 'content_writer', 'designer', 'viewer')
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', p.key,
          'module', p.module,
          'name', p.name,
          'description', p.description
        )
        order by p.module, p.key
      )
      from public.permissions p
    ), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name
        )
        order by b.name
      )
      from public.brands b
    ), '[]'::jsonb),
    'can_manage', public.smm_has_access_permission('users.manage'),
    'actor_user_id', auth.uid()
  ) into v_result;

  return v_result;
end;
$$;

-- Update one user's role, explicit brand scope, and per-user permission overrides.
create or replace function public.smm_admin_update_user_access(
  p_target_user_id uuid,
  p_role_key text,
  p_brand_ids uuid[],
  p_overrides jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid;
  v_current_role_key text;
  v_other_super_admins integer;
  v_overrides jsonb := coalesce(p_overrides, '[]'::jsonb);
begin
  if not public.smm_has_access_permission('users.manage') then
    raise exception 'Anda tidak memiliki izin untuk mengubah Users & Access.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'User tidak ditemukan.' using errcode = 'P0002';
  end if;

  select id
    into v_role_id
  from public.roles
  where key = p_role_key
    and key in ('super_admin', 'manager', 'content_writer', 'designer', 'viewer');

  if v_role_id is null then
    raise exception 'Role tidak valid.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_overrides) <> 'array' then
    raise exception 'Permission overrides harus berupa array.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_brand_ids, array[]::uuid[])) requested_brand_id
    left join public.brands b on b.id = requested_brand_id
    where b.id is null
  ) then
    raise exception 'Terdapat Brand Access yang tidak valid.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_overrides) as o(key text, allowed boolean)
    left join public.permissions p on p.key = o.key
    where p.id is null or o.allowed is null
  ) then
    raise exception 'Terdapat permission override yang tidak valid.' using errcode = '22023';
  end if;

  select r.key
    into v_current_role_key
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_target_user_id;

  -- Never permit the final Super Admin to be demoted.
  if v_current_role_key = 'super_admin' and p_role_key <> 'super_admin' then
    select count(*)::integer
      into v_other_super_admins
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.key = 'super_admin'
      and ur.user_id <> p_target_user_id;

    if v_other_super_admins = 0 then
      raise exception 'Super Admin terakhir tidak dapat diubah ke role lain.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.user_roles (user_id, role_id, assigned_at, updated_at)
  values (p_target_user_id, v_role_id, now(), now())
  on conflict (user_id) do update set
    role_id = excluded.role_id,
    updated_at = now();

  delete from public.user_brand_access
  where user_id = p_target_user_id;

  -- Super Admin is always All Brands; explicit rows are intentionally cleared.
  if p_role_key <> 'super_admin' then
    insert into public.user_brand_access (user_id, brand_id)
    select distinct p_target_user_id, requested_brand_id
    from unnest(coalesce(p_brand_ids, array[]::uuid[])) requested_brand_id
    join public.brands b on b.id = requested_brand_id
    on conflict (user_id, brand_id) do nothing;
  end if;

  delete from public.user_permission_overrides
  where user_id = p_target_user_id;

  -- Super Admin permissions cannot be denied. Other roles can be customized.
  if p_role_key <> 'super_admin' then
    insert into public.user_permission_overrides (user_id, permission_id, allowed, created_at, updated_at)
    select p_target_user_id, p.id, o.allowed, now(), now()
    from jsonb_to_recordset(v_overrides) as o(key text, allowed boolean)
    join public.permissions p on p.key = o.key
    on conflict (user_id, permission_id) do update set
      allowed = excluded.allowed,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'role_key', p_role_key,
    'updated_at', now()
  );
end;
$$;

revoke all on function public.smm_has_access_permission(text) from public;
revoke all on function public.smm_admin_access_snapshot() from public;
revoke all on function public.smm_admin_update_user_access(uuid, text, uuid[], jsonb) from public;

grant execute on function public.smm_has_access_permission(text) to authenticated;
grant execute on function public.smm_admin_access_snapshot() to authenticated;
grant execute on function public.smm_admin_update_user_access(uuid, text, uuid[], jsonb) to authenticated;

comment on function public.smm_admin_access_snapshot() is 'Phase 2 secure admin read model for Users & Access. Does not alter business-table RLS.';
comment on function public.smm_admin_update_user_access(uuid, text, uuid[], jsonb) is 'Phase 2 secure admin mutation for user role, brand scope, and permission overrides with last-Super-Admin protection.';
