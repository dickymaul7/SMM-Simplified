"use client";

import { useEffect, useState } from "react";

import AppHeader from "@/components/app-header";
import AuthGuard from "@/components/auth-guard";
import OverviewClient from "@/components/pages/overview-client";
import TaskForcePanel from "@/components/task-force-panel";
import { createClient } from "@/lib/supabase/client";

function normalizeRole(role: string | null | undefined) {
  return (role ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

export default function RoleAwareOverview() {
  const [loading, setLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;

      if (!uid) {
        if (active) setLoading(false);
        return;
      }

      const { data: member } = await supabase
        .from("team_members")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();

      if (!active) return;
      setIsSuperadmin(normalizeRole(member?.role) === "superadmin");
      setLoading(false);
    }

    void loadRole();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <AppHeader />
        <main className="app-workspace px-5 py-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-7xl">
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </main>
      </AuthGuard>
    );
  }

  if (isSuperadmin) return <OverviewClient />;

  return (
    <AuthGuard>
      <AppHeader />
      <main className="app-workspace px-5 py-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 border-b border-slate-200 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Personal workspace
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">
              My Task Overview
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Overview ini hanya menampilkan tugas yang di-assign kepada akun kamu. Seluruh project dan production overview hanya tersedia untuk Superadmin.
            </p>
          </header>
          <TaskForcePanel />
        </div>
      </main>
    </AuthGuard>
  );
}
