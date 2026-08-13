import { NextResponse } from "next/server";

import {
  ACCESS_CONTROL_ENFORCEMENT_ENABLED,
  applyPermissionOverrides,
  isPermissionKey,
  isRoleKey,
  legacyUnrestrictedAccess,
  type PermissionKey,
  type PermissionOverride,
  type UserAccessSnapshot,
} from "@/lib/access-control";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function looksLikeMissingFoundation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Session login tidak valid." }, { status: 401 });
  }

  const roleAssignment = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (looksLikeMissingFoundation(roleAssignment.error)) {
    return NextResponse.json({
      ok: true,
      foundationReady: false,
      enforcementEnabled: false,
      mode: "legacy_unrestricted",
      access: legacyUnrestrictedAccess(user.id),
    });
  }

  if (roleAssignment.error) {
    return NextResponse.json({ ok: false, error: roleAssignment.error.message }, { status: 500 });
  }

  const roleId = String(roleAssignment.data?.role_id ?? "");

  const [profileResult, roleResult, permissionCatalogResult, rolePermissionResult, overrideResult, brandAccessResult] =
    await Promise.all([
      supabase.from("profiles").select("id,email,full_name,avatar_url,status").eq("id", user.id).maybeSingle(),
      roleId
        ? supabase.from("roles").select("id,key,name").eq("id", roleId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("permissions").select("id,key"),
      roleId
        ? supabase.from("role_permissions").select("permission_id,allowed").eq("role_id", roleId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("user_permission_overrides").select("permission_id,allowed").eq("user_id", user.id),
      supabase.from("user_brand_access").select("brand_id").eq("user_id", user.id),
    ]);

  const firstError = [
    profileResult.error,
    roleResult.error,
    permissionCatalogResult.error,
    rolePermissionResult.error,
    overrideResult.error,
    brandAccessResult.error,
  ].find(Boolean);

  if (firstError) {
    if (looksLikeMissingFoundation(firstError)) {
      return NextResponse.json({
        ok: true,
        foundationReady: false,
        enforcementEnabled: false,
        mode: "legacy_unrestricted",
        access: legacyUnrestrictedAccess(user.id),
      });
    }

    return NextResponse.json({ ok: false, error: firstError.message }, { status: 500 });
  }

  const permissionKeyById = new Map<string, PermissionKey>();
  for (const row of permissionCatalogResult.data ?? []) {
    if (isPermissionKey(row.key)) permissionKeyById.set(String(row.id), row.key);
  }

  const basePermissions: PermissionKey[] = [];
  for (const row of rolePermissionResult.data ?? []) {
    if (!row.allowed) continue;
    const key = permissionKeyById.get(String(row.permission_id));
    if (key) basePermissions.push(key);
  }

  const overrides: PermissionOverride[] = [];
  for (const row of overrideResult.data ?? []) {
    const key = permissionKeyById.get(String(row.permission_id));
    if (key) overrides.push({ key, allowed: Boolean(row.allowed) });
  }

  const roleKey = isRoleKey(roleResult.data?.key) ? roleResult.data.key : null;
  const role = roleKey
    ? {
        key: roleKey,
        name: String(roleResult.data?.name ?? roleKey),
      }
    : null;

  const configuredAccess: UserAccessSnapshot = {
    foundationReady: true,
    enforcementEnabled: ACCESS_CONTROL_ENFORCEMENT_ENABLED,
    userId: user.id,
    role,
    permissions: applyPermissionOverrides(basePermissions, overrides),
    brandIds: (brandAccessResult.data ?? []).map((row) => String(row.brand_id)).filter(Boolean),
    allBrands: roleKey === "super_admin",
  };

  return NextResponse.json({
    ok: true,
    foundationReady: true,
    enforcementEnabled: ACCESS_CONTROL_ENFORCEMENT_ENABLED,
    mode: ACCESS_CONTROL_ENFORCEMENT_ENABLED ? "enforced" : "legacy_unrestricted",
    profile: profileResult.data ?? null,
    access: configuredAccess,
  });
}
