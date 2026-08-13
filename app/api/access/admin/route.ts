import { NextResponse } from "next/server";

import {
  isPermissionKey,
  isRoleKey,
  type PermissionOverride,
} from "@/lib/access-control";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isMissingPhase2Rpc(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = String(error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("smm_admin_access_snapshot") ||
    message.includes("smm_admin_update_user_access") ||
    (message.includes("function") && message.includes("does not exist"))
  );
}

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return jsonError("Session login tidak valid.", 401);

    const result = await supabase.rpc("smm_admin_access_snapshot");

    if (result.error) {
      if (isMissingPhase2Rpc(result.error)) {
        return jsonError(
          "Phase 2 database RPC belum diaktifkan. Jalankan database/USERS_ACCESS_UI.sql di Supabase SQL Editor.",
          409,
        );
      }

      const forbidden = result.error.code === "42501";
      return jsonError(result.error.message, forbidden ? 403 : 500);
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal memuat Users & Access.", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return jsonError("Session login tidak valid.", 401);

    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body?.targetUserId ?? "").trim();
    const roleKey = body?.roleKey;
    const rawBrandIds = body?.brandIds;
    const rawOverrides = body?.overrides;

    if (!targetUserId) return jsonError("targetUserId wajib diisi.");
    if (!isRoleKey(roleKey)) return jsonError("Role tidak valid.");
    if (!Array.isArray(rawBrandIds) || rawBrandIds.some((item) => typeof item !== "string")) {
      return jsonError("Brand Access tidak valid.");
    }
    if (!Array.isArray(rawOverrides)) return jsonError("Permission overrides tidak valid.");

    const overrides: PermissionOverride[] = [];
    for (const item of rawOverrides) {
      if (!item || !isPermissionKey(item.key) || typeof item.allowed !== "boolean") {
        return jsonError("Terdapat permission override yang tidak valid.");
      }
      overrides.push({ key: item.key, allowed: item.allowed });
    }

    const updateResult = await supabase.rpc("smm_admin_update_user_access", {
      p_target_user_id: targetUserId,
      p_role_key: roleKey,
      p_brand_ids: rawBrandIds,
      p_overrides: overrides,
    });

    if (updateResult.error) {
      if (isMissingPhase2Rpc(updateResult.error)) {
        return jsonError(
          "Phase 2 database RPC belum diaktifkan. Jalankan database/USERS_ACCESS_UI.sql di Supabase SQL Editor.",
          409,
        );
      }

      const forbidden = updateResult.error.code === "42501";
      return jsonError(updateResult.error.message, forbidden ? 403 : 400);
    }

    const snapshotResult = await supabase.rpc("smm_admin_access_snapshot");
    if (snapshotResult.error) {
      return NextResponse.json({ ok: true, updated: updateResult.data });
    }

    return NextResponse.json({ ok: true, updated: updateResult.data, data: snapshotResult.data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal menyimpan Users & Access.", 500);
  }
}
