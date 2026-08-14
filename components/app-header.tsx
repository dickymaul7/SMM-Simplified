"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  ACTIVE_BRAND_ALL,
  ALL_BRANDS_SELECTION,
  readActiveBrandSelection,
  writeActiveBrandSelection,
} from "@/lib/active-brand";
import { useActiveBrandSelection } from "@/lib/use-active-brand";

type IconName = "overview" | "studio" | "calendar" | "analytics" | "brands" | "settings";
type BrandOption = { id: string; name: string };
type AccessScope = {
  foundationReady: boolean;
  roleKey: string | null;
  allBrands: boolean;
  brandIds: string[];
};

const navigation: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "Overview", href: "/overview", icon: "overview" },
  { label: "Brief Studio", href: "/", icon: "studio" },
  { label: "Content Calendar", href: "/calendar", icon: "calendar" },
  { label: "Analytics", href: "/analytics", icon: "analytics" },
  { label: "Brands", href: "/brands", icon: "brands" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    studio: <><path d="M4 19.5V6.7A2.7 2.7 0 0 1 6.7 4H18a2 2 0 0 1 2 2v12.5" /><path d="M7 8h9M7 12h7M7 16h5" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
    analytics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    brands: <><path d="M20 13c0 5-3.5 8-8 8s-8-3-8-8 3.6-9 8-9 8 4 8 9Z" /><path d="M8.5 9.5h.01M15.5 9.5h.01M8 15c1 .9 2.3 1.4 4 1.4s3-.5 4-1.4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.37.34.7.6 1 .3.28.7.42 1.1.4h.1v4h-.1c-.4-.02-.8.12-1.1.4-.26.3-.47.63-.6 1Z" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">{paths[name]}</svg>;
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { selection: activeBrand, hydrated } = useActiveBrandSelection();
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandLoading, setBrandLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessScope, setAccessScope] = useState<AccessScope | null>(null);
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBrandOptions() {
      setBrandLoading(true);
      setAccessLoading(true);
      setAccessMessage("");

      try {
        const supabase = createClient();
        const [brandResult, accessResponse] = await Promise.all([
          supabase.from("brands").select("id,name").order("name", { ascending: true }),
          fetch("/api/access/me", { cache: "no-store" }),
        ]);

        const accessPayload = await accessResponse.json().catch(() => ({}));
        if (!active) return;

        if (brandResult.error) throw brandResult.error;
        if (!accessResponse.ok || !accessPayload?.ok || !accessPayload?.access) {
          throw new Error(accessPayload?.error || "Gagal membaca scope akses user.");
        }

        const rawAccess = accessPayload.access;
        const scope: AccessScope = {
          foundationReady: Boolean(accessPayload.foundationReady),
          roleKey: typeof rawAccess?.role?.key === "string" ? rawAccess.role.key : null,
          allBrands: Boolean(rawAccess?.allBrands),
          brandIds: Array.isArray(rawAccess?.brandIds)
            ? rawAccess.brandIds.map((value: unknown) => String(value)).filter(Boolean)
            : [],
        };

        const canUseAllBrands =
          scope.roleKey === "super_admin" || (!scope.foundationReady && scope.allBrands);
        const allRows = (brandResult.data ?? []) as BrandOption[];
        const allowedIds = new Set(scope.brandIds);
        const scopedRows = canUseAllBrands
          ? allRows
          : allRows.filter((brand) => allowedIds.has(brand.id));

        setAccessScope(scope);
        setBrands(scopedRows);

        const stored = readActiveBrandSelection();
        const storedIsValid = Boolean(
          stored &&
            ((stored.id === ACTIVE_BRAND_ALL && canUseAllBrands) ||
              scopedRows.some((brand) => brand.id === stored.id)),
        );

        if (!storedIsValid) {
          if (canUseAllBrands) {
            writeActiveBrandSelection(ALL_BRANDS_SELECTION);
          } else if (scopedRows[0]) {
            writeActiveBrandSelection({ id: scopedRows[0].id, name: scopedRows[0].name });
          }
        }
      } catch (error) {
        if (!active) return;
        setAccessScope({
          foundationReady: true,
          roleKey: null,
          allBrands: false,
          brandIds: [],
        });
        setBrands([]);
        setAccessMessage(
          error instanceof Error ? error.message : "Gagal membaca Brand Access.",
        );
      } finally {
        if (active) {
          setBrandLoading(false);
          setAccessLoading(false);
        }
      }
    }

    void loadBrandOptions();

    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function changeActiveBrand(nextId: string) {
    if (!nextId) return;

    if (nextId === ACTIVE_BRAND_ALL) {
      if (!canUseAllBrands) return;
      writeActiveBrandSelection(ALL_BRANDS_SELECTION);
      return;
    }

    const brand = brands.find((item) => item.id === nextId);
    if (!brand) return;

    writeActiveBrandSelection({ id: brand.id, name: brand.name });
  }

  const canUseAllBrands = Boolean(
    accessScope?.roleKey === "super_admin" ||
      (accessScope && !accessScope.foundationReady && accessScope.allBrands),
  );
  const isSuperAdmin = accessScope?.roleKey === "super_admin";
  const contextLoading = brandLoading || accessLoading || !hydrated;
  const noBrandAccess = !contextLoading && !canUseAllBrands && brands.length === 0;

  const isActive = (href: string) => href === "/" ? pathname === "/" || pathname.startsWith("/campaign/") || pathname.startsWith("/brief/") : pathname === href || pathname.startsWith(`${href}/`);
  const current = navigation.find((item) => isActive(item.href))?.label ?? "SMM Simplified";

  const selectedValue = contextLoading
    ? ""
    : activeBrand.id === ACTIVE_BRAND_ALL
      ? canUseAllBrands
        ? ACTIVE_BRAND_ALL
        : brands[0]?.id ?? ""
      : brands.some((brand) => brand.id === activeBrand.id)
        ? activeBrand.id
        : canUseAllBrands
          ? ACTIVE_BRAND_ALL
          : brands[0]?.id ?? "";

  const sidebar = (
    <aside className="flex h-full flex-col bg-[#111827] text-white">
      <div className="flex h-[76px] items-center gap-3 border-b border-white/8 px-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/30">
          <span className="text-sm font-black tracking-tight">SM</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">SMM Simplified</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Content operations</p>
        </div>
      </div>

      <div className="border-b border-white/8 px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <label htmlFor="global-active-brand" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Active Brand</label>
          <span className="text-[10px] font-medium text-slate-600">
            {contextLoading
              ? "Loading..."
              : isSuperAdmin
                ? `${brands.length} brands · Super Admin`
                : `${brands.length} assigned`}
          </span>
        </div>
        <div className="relative">
          <select
            id="global-active-brand"
            aria-label="Select active brand"
            disabled={contextLoading || noBrandAccess}
            value={selectedValue}
            onChange={(event) => changeActiveBrand(event.target.value)}
            className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.06] py-2.5 pl-3 pr-9 text-[13px] font-semibold text-slate-100 outline-none transition hover:bg-white/[0.09] focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {contextLoading && <option value="" className="bg-slate-900 text-white">Loading brand access...</option>}
            {!contextLoading && canUseAllBrands && (
              <option value={ACTIVE_BRAND_ALL} className="bg-slate-900 text-white">All Brands</option>
            )}
            {!contextLoading && brands.map((brand) => (
              <option key={brand.id} value={brand.id} className="bg-slate-900 text-white">{brand.name}</option>
            ))}
            {noBrandAccess && <option value="" className="bg-slate-900 text-white">No brand access</option>}
          </select>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </div>
        {accessMessage ? (
          <p className="mt-2 px-1 text-[10px] leading-4 text-amber-400">{accessMessage}</p>
        ) : noBrandAccess ? (
          <p className="mt-2 px-1 text-[10px] leading-4 text-amber-400">Belum ada Brand Access untuk akun ini. Hubungi Super Admin.</p>
        ) : (
          <p className="mt-2 px-1 text-[10px] leading-4 text-slate-600">
            {canUseAllBrands
              ? "Super Admin dapat menggabungkan seluruh brand di Overview dan Calendar melalui All Brands."
              : "Hanya brand yang ditugaskan ke akun ini yang dapat dipilih."}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">Workspace</p>
        <nav aria-label="Main navigation" className="space-y-1">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${active ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}>
              <span className={active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}><NavIcon name={item.icon} /></span>
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
            </Link>;
          })}
        </nav>
      </div>

      <div className="border-t border-white/8 p-3">
        <div className="mb-2 rounded-xl bg-white/[0.035] px-3 py-3">
          <p className="text-xs font-semibold text-slate-200">Production workspace</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Research, briefs, scheduling, and design handoff.</p>
        </div>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></svg>
          Sign out
        </button>
      </div>
    </aside>
  );

  return <>
    <header className="no-print fixed inset-x-0 top-0 z-40 flex h-[60px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
      <button onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <p className="text-sm font-bold tracking-tight text-slate-900">{current}</p>
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-[10px] font-black text-white">SM</div>
    </header>
    <div className="no-print fixed inset-y-0 left-0 z-50 hidden w-64 lg:block">{sidebar}</div>
    {open && <div className="no-print fixed inset-0 z-50 lg:hidden">
      <button aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
      <div className="absolute inset-y-0 left-0 w-[min(18rem,86vw)] shadow-2xl">{sidebar}</div>
    </div>}
  </>;
}
