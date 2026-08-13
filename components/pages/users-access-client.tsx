"use client";

import { useEffect, useMemo, useState } from "react";

import AppHeader from "@/components/app-header";
import AuthGuard from "@/components/auth-guard";
import {
  PERMISSION_KEYS,
  type PermissionKey,
  type RoleKey,
} from "@/lib/access-control";

type UserOverride = { key: PermissionKey; allowed: boolean };

type AccessUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: "active" | "inactive" | string;
  role_key: RoleKey | null;
  role_name: string | null;
  brand_ids: string[];
  overrides: UserOverride[];
};

type RoleOption = {
  key: RoleKey;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
};

type PermissionOption = {
  key: PermissionKey;
  module: string;
  name: string;
  description: string | null;
};

type BrandOption = { id: string; name: string };

type AccessSnapshot = {
  users: AccessUser[];
  roles: RoleOption[];
  permissions: PermissionOption[];
  brands: BrandOption[];
  can_manage: boolean;
  actor_user_id: string;
};

const MODULE_ORDER = [
  "overview",
  "brief",
  "calendar",
  "design",
  "brand",
  "analytics",
  "users",
  "settings",
];

const MODULE_LABELS: Record<string, string> = {
  overview: "Overview",
  brief: "Brief Studio & Human QC",
  calendar: "Content Calendar",
  design: "Design Workflow",
  brand: "Brand Intelligence",
  analytics: "Analytics",
  users: "Users & Access",
  settings: "Settings",
};

function initials(user: AccessUser) {
  const source = user.full_name || user.email || "U";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeSnapshot(value: unknown): AccessSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AccessSnapshot>;
  if (!Array.isArray(raw.users) || !Array.isArray(raw.roles) || !Array.isArray(raw.permissions) || !Array.isArray(raw.brands)) {
    return null;
  }
  return {
    users: raw.users,
    roles: raw.roles,
    permissions: raw.permissions,
    brands: raw.brands,
    can_manage: Boolean(raw.can_manage),
    actor_user_id: String(raw.actor_user_id ?? ""),
  };
}

export default function UsersAccessClient() {
  const [snapshot, setSnapshot] = useState<AccessSnapshot | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [draftRoleKey, setDraftRoleKey] = useState<RoleKey | "">("");
  const [draftBrands, setDraftBrands] = useState<string[]>([]);
  const [draftOverrides, setDraftOverrides] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/access/admin", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Gagal memuat Users & Access.");
      const next = normalizeSnapshot(payload?.data);
      if (!next) throw new Error("Format data Users & Access tidak valid.");
      setSnapshot(next);
      setSelectedUserId((current) => {
        if (current && next.users.some((user) => user.id === current)) return current;
        return next.users[0]?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat Users & Access.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedUser = useMemo(
    () => snapshot?.users.find((user) => user.id === selectedUserId) ?? null,
    [snapshot, selectedUserId],
  );

  const selectedRole = useMemo(
    () => snapshot?.roles.find((role) => role.key === draftRoleKey) ?? null,
    [snapshot, draftRoleKey],
  );

  useEffect(() => {
    if (!selectedUser) {
      setDraftRoleKey("");
      setDraftBrands([]);
      setDraftOverrides({});
      return;
    }
    setDraftRoleKey(selectedUser.role_key ?? "");
    setDraftBrands(selectedUser.brand_ids ?? []);
    const nextOverrides: Record<string, boolean> = {};
    for (const override of selectedUser.overrides ?? []) nextOverrides[override.key] = override.allowed;
    setDraftOverrides(nextOverrides);
    setMessage("");
    setError("");
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!snapshot) return [];
    if (!query) return snapshot.users;
    return snapshot.users.filter((user) =>
      [user.full_name, user.email, user.role_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [snapshot, search]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionOption[]>();
    for (const permission of snapshot?.permissions ?? []) {
      if (!PERMISSION_KEYS.includes(permission.key)) continue;
      const items = groups.get(permission.module) ?? [];
      items.push(permission);
      groups.set(permission.module, items);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const ai = MODULE_ORDER.indexOf(a);
      const bi = MODULE_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
  }, [snapshot]);

  const rolePermissionSet = useMemo(
    () => new Set<PermissionKey>(selectedRole?.permissions ?? []),
    [selectedRole],
  );

  function effectivePermission(key: PermissionKey) {
    if (draftRoleKey === "super_admin") return true;
    if (Object.prototype.hasOwnProperty.call(draftOverrides, key)) return draftOverrides[key];
    return rolePermissionSet.has(key);
  }

  function togglePermission(key: PermissionKey) {
    if (!snapshot?.can_manage || !draftRoleKey || draftRoleKey === "super_admin") return;
    const base = rolePermissionSet.has(key);
    const nextValue = !effectivePermission(key);
    setDraftOverrides((current) => {
      const next = { ...current };
      if (nextValue === base) delete next[key];
      else next[key] = nextValue;
      return next;
    });
  }

  function changeRole(value: string) {
    const next = value as RoleKey | "";
    setDraftRoleKey(next);
    setDraftOverrides({});
    setMessage("");
  }

  function toggleBrand(brandId: string) {
    if (!snapshot?.can_manage || draftRoleKey === "super_admin") return;
    setDraftBrands((current) =>
      current.includes(brandId) ? current.filter((id) => id !== brandId) : [...current, brandId],
    );
  }

  async function saveAccess() {
    if (!selectedUser || !draftRoleKey || !snapshot?.can_manage) return;
    if (draftRoleKey !== "super_admin" && draftBrands.length === 0) {
      setError("Pilih minimal satu Brand Access untuk role non-Super Admin.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const overrides = Object.entries(draftOverrides).map(([key, allowed]) => ({ key, allowed }));
      const response = await fetch("/api/access/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          roleKey: draftRoleKey,
          brandIds: draftRoleKey === "super_admin" ? [] : draftBrands,
          overrides,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Gagal menyimpan akses user.");
      const next = normalizeSnapshot(payload?.data);
      if (next) setSnapshot(next);
      setMessage("Role, Brand Access, dan permission user berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan akses user.");
    } finally {
      setSaving(false);
    }
  }

  const totalUsers = snapshot?.users.length ?? 0;
  const superAdmins = snapshot?.users.filter((user) => user.role_key === "super_admin").length ?? 0;
  const assignedUsers = snapshot?.users.filter((user) => Boolean(user.role_key)).length ?? 0;
  const customUsers = snapshot?.users.filter((user) => (user.overrides?.length ?? 0) > 0).length ?? 0;
  const canSave = Boolean(
    snapshot?.can_manage &&
      selectedUser &&
      draftRoleKey &&
      (draftRoleKey === "super_admin" || draftBrands.length > 0),
  );

  return (
    <AuthGuard>
      <AppHeader />
      <main className="app-workspace px-5 py-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Settings</p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">Users & Access</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
                Atur siapa yang dapat melakukan apa, dan brand mana yang dapat mereka akses. Enforcement workspace tetap belum diaktifkan pada Phase 2.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Refresh Users
              </button>
              <button
                type="button"
                disabled={!snapshot?.can_manage}
                onClick={() => setInviteOpen(true)}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Invite User
              </button>
            </div>
          </header>

          {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
            </div>
          ) : snapshot ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Total Users", totalUsers, "Supabase Auth profiles"],
                  ["Super Admin", superAdmins, "Full workspace access"],
                  ["Role Assigned", assignedUsers, `${Math.max(totalUsers - assignedUsers, 0)} belum memiliki role`],
                  ["Custom Permissions", customUsers, "User dengan override"],
                ].map(([label, value, helper]) => (
                  <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
                    <p className="mt-1 text-xs text-slate-500">{helper}</p>
                  </div>
                ))}
              </section>

              {!snapshot.can_manage && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Akun ini memiliki akses lihat saja. Perubahan Role, Brand Access, dan Permission membutuhkan permission <strong>users.manage</strong>.
                </div>
              )}

              <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace users</p>
                        <h2 className="mt-1 font-semibold text-slate-950">Pilih user</h2>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{filteredUsers.length}</span>
                    </div>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Cari nama, email, role..."
                      className="mt-4 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="max-h-[680px] divide-y divide-slate-100 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="p-5 text-sm text-slate-500">Tidak ada user yang cocok.</p>
                    ) : filteredUsers.map((user) => {
                      const active = user.id === selectedUserId;
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={`flex w-full items-start gap-3 px-4 py-4 text-left transition ${active ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                        >
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{initials(user)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">{user.full_name || user.email || "Unnamed user"}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{user.email || "No email"}</span>
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{user.role_name || "No role"}</span>
                              {user.role_key === "super_admin" ? (
                                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">All Brands</span>
                              ) : (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{user.brand_ids.length} brands</span>
                              )}
                              {user.overrides.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{user.overrides.length} custom</span>}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {!selectedUser ? (
                    <div className="p-8 text-center text-sm text-slate-500">Pilih user untuk melihat access configuration.</div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                        <div className="flex items-center gap-3">
                          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-sm font-bold text-white">{initials(selectedUser)}</span>
                          <div>
                            <h2 className="font-semibold text-slate-950">{selectedUser.full_name || selectedUser.email || "Unnamed user"}</h2>
                            <p className="mt-0.5 text-sm text-slate-500">{selectedUser.email || "No email"}</p>
                          </div>
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${selectedUser.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{selectedUser.status}</span>
                      </div>

                      <div className="space-y-7 p-5 md:p-6">
                        <div>
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Role</p>
                              <h3 className="mt-1 text-base font-semibold text-slate-950">Preset akses utama</h3>
                            </div>
                            {draftRoleKey === "super_admin" && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">Protected full access</span>}
                          </div>
                          <select
                            value={draftRoleKey}
                            onChange={(event) => changeRole(event.target.value)}
                            disabled={!snapshot.can_manage}
                            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                          >
                            <option value="">Pilih role...</option>
                            {snapshot.roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                          </select>
                          {selectedRole?.description && <p className="mt-2 text-xs leading-5 text-slate-500">{selectedRole.description}</p>}
                        </div>

                        <div className="border-t border-slate-100 pt-6">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Brand Access</p>
                              <h3 className="mt-1 text-base font-semibold text-slate-950">Di brand mana user dapat bekerja?</h3>
                            </div>
                            {draftRoleKey !== "super_admin" && snapshot.can_manage && (
                              <div className="flex gap-2 text-xs font-semibold">
                                <button type="button" onClick={() => setDraftBrands(snapshot.brands.map((brand) => brand.id))} className="text-blue-600 hover:text-blue-700">Select all</button>
                                <span className="text-slate-300">·</span>
                                <button type="button" onClick={() => setDraftBrands([])} className="text-slate-500 hover:text-slate-700">Clear</button>
                              </div>
                            )}
                          </div>

                          {draftRoleKey === "super_admin" ? (
                            <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">Super Admin otomatis memiliki akses ke <strong>All Brands</strong>. Brand mapping individual diabaikan untuk role ini.</div>
                          ) : (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {snapshot.brands.map((brand) => {
                                const checked = draftBrands.includes(brand.id);
                                return (
                                  <label key={brand.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${checked ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                                    <input type="checkbox" disabled={!snapshot.can_manage} checked={checked} onChange={() => toggleBrand(brand.id)} className="h-4 w-4 rounded border-slate-300" />
                                    <span className="font-medium text-slate-800">{brand.name}</span>
                                  </label>
                                );
                              })}
                              {snapshot.brands.length === 0 && <p className="text-sm text-slate-500">Belum ada brand di workspace.</p>}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 pt-6">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Granular Permissions</p>
                            <h3 className="mt-1 text-base font-semibold text-slate-950">Customize permission per user</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Role menjadi preset. Perubahan checkbox disimpan sebagai override hanya ketika berbeda dari preset role.</p>
                          </div>

                          {draftRoleKey === "super_admin" && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">Permission Super Admin selalu penuh dan tidak dapat dinonaktifkan, untuk mencegah workspace terkunci.</div>}

                          <div className="mt-4 space-y-3">
                            {groupedPermissions.map(([module, permissions]) => (
                              <div key={module} className="overflow-hidden rounded-xl border border-slate-200">
                                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{MODULE_LABELS[module] || module}</p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {permissions.map((permission) => {
                                    const checked = effectivePermission(permission.key);
                                    const customized = Object.prototype.hasOwnProperty.call(draftOverrides, permission.key);
                                    return (
                                      <label key={permission.key} className="flex items-start gap-3 px-4 py-3.5">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!snapshot.can_manage || !draftRoleKey || draftRoleKey === "super_admin"}
                                          onChange={() => togglePermission(permission.key)}
                                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-850">
                                            {permission.name}
                                            {customized && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Custom</span>}
                                          </span>
                                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{permission.description || permission.key}</span>
                                        </span>
                                        <code className="hidden text-[10px] text-slate-400 md:block">{permission.key}</code>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                        <p className="text-xs leading-5 text-slate-500">Phase 2 menyimpan konfigurasi. Pembatasan menu/API bisnis baru diaktifkan pada Phase 3.</p>
                        <button
                          type="button"
                          disabled={!canSave || saving}
                          onClick={() => void saveAccess()}
                          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {saving ? "Saving..." : "Save Access"}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </div>
      </main>

      {inviteOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Invite User</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Tambahkan akun Supabase Auth</h2>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">×</button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Untuk Phase 2, Supabase Auth tetap menjadi source of truth dan tidak ada service-role secret yang disimpan di aplikasi. Buat akun baru melalui dashboard Supabase, lalu profile akan tersinkron otomatis.</p>
            <ol className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <li><strong>1.</strong> Supabase → Authentication → Users.</li>
              <li><strong>2.</strong> Klik Add user dan buat akun user.</li>
              <li><strong>3.</strong> Kembali ke halaman ini lalu klik Refresh Users.</li>
              <li><strong>4.</strong> Pilih user baru → assign Role, Brand Access, dan Permission.</li>
            </ol>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setInviteOpen(false)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Mengerti</button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
