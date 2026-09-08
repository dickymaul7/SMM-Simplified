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

  useEffect(() => {
    let active = true;

    async function loadBrandOptions() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("brands")
        .select("id,name")
        .order("name", { ascending: true });

      if (!active) return;

      const rows = error ? [] : ((data ?? []) as BrandOption[]);
      setBrands(rows);

      const stored = readActiveBrandSelection();
      const storedIsValid =
        stored?.id === ACTIVE_BRAND_ALL || rows.some((brand) => brand.id === stored?.id);

      if (stored && !storedIsValid) {
        writeActiveBrandSelection(ALL_BRANDS_SELECTION);
      }

      setBrandLoading(false);
    }

    void loadBrandOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || activeBrand.id === ACTIVE_BRAND_ALL) return;
    setBrands((current) => {
      if (current.some((brand) => brand.id === activeBrand.id)) return current;
      return [...current, { id: activeBrand.id, name: activeBrand.name }].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, [activeBrand, hydrated]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function changeActiveBrand(nextId: string) {
    if (nextId === ACTIVE_BRAND_ALL) {
      writeActiveBrandSelection(ALL_BRANDS_SELECTION);
      return;
    }

    const brand = brands.find((item) => item.id === nextId);
    if (!brand) return;

    writeActiveBrandSelection({ id: brand.id, name: brand.name });
  }

  const isActive = (href: string) => href === "/" ? pathname === "/" || pathname.startsWith("/campaign/") || pathname.startsWith("/brief/") : pathname === href || pathname.startsWith(`${href}/`);
  const current = navigation.find((item) => isActive(item.href))?.label ?? "SMM Simplified";
  const selectedValue = !hydrated || (activeBrand.id !== ACTIVE_BRAND_ALL && !brands.some((brand) => brand.id === activeBrand.id))
    ? ACTIVE_BRAND_ALL
    : activeBrand.id;

  const sidebar = (
    <aside className="flex h-full flex-col bg-[#1e171a] text-[#eee]">
      <div className="flex items-center gap-[11px] px-5 pb-6 pt-[22px]">
        <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[#8d1730] text-sm font-extrabold text-white">
          <span>SM</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-white">SMM Simplified</p>
          <p className="mt-[3px] text-[11px] text-[#aaa1a5]">Content Operations</p>
        </div>
      </div>

      <div className="border-y border-[#332a2d] px-[14px] py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <label htmlFor="global-active-brand" className="text-[10px] font-medium uppercase tracking-[1.2px] text-[#82777b]">Active Brand</label>
          <span className="text-[10px] text-[#82777b]">{brandLoading ? "Loading..." : `${brands.length} brands`}</span>
        </div>
        <div className="relative">
          <select
            id="global-active-brand"
            aria-label="Select active brand"
            disabled={brandLoading || !hydrated}
            value={selectedValue}
            onChange={(event) => changeActiveBrand(event.target.value)}
            className="w-full appearance-none rounded-lg border border-[#3b3135] bg-[#2a2225] py-2.5 pl-3 pr-9 text-[12px] font-medium text-[#eee] outline-none transition hover:border-[#514348] focus:border-[#8d1730] disabled:cursor-wait disabled:opacity-60"
          >
            <option value={ACTIVE_BRAND_ALL} className="bg-[#1e171a] text-white">All Brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id} className="bg-[#1e171a] text-white">{brand.name}</option>
            ))}
          </select>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82777b]">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </div>
        <p className="mt-2 px-2 text-[10px] leading-4 text-[#82777b]">Pilihan ini menjadi context global untuk workspace.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-[14px] py-5">
        <p className="mb-[9px] px-[10px] text-[10px] font-medium uppercase tracking-[1.2px] text-[#82777b]">Workspace</p>
        <nav aria-label="Main navigation">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`my-[2px] flex w-full items-center gap-[11px] rounded-lg px-3 py-[11px] text-[13px] font-medium transition ${active ? "bg-[#8d1730] text-white" : "text-[#bdb4b7] hover:bg-[#2a2225] hover:text-white"}`}>
              <span className="shrink-0"><NavIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </Link>;
          })}
        </nav>
      </div>

      <div className="border-t border-[#332a2d] px-[14px] pb-[14px] pt-[10px]">
        <div className="mb-2 rounded-lg bg-[#2a2225] px-3 py-3">
          <p className="text-xs font-semibold text-[#eee]">Production workspace</p>
          <p className="mt-1 text-[10px] leading-4 text-[#aaa1a5]">Research, briefs, scheduling, and design handoff.</p>
        </div>
        <button onClick={signOut} className="my-[2px] flex w-full items-center gap-[11px] rounded-lg px-3 py-[11px] text-left text-[13px] font-medium text-[#bdb4b7] transition hover:bg-[#2a2225] hover:text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></svg>
          Sign out
        </button>
      </div>
    </aside>
  );

  return <>
    <header className="no-print fixed inset-x-0 top-0 z-40 flex h-[60px] items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
      <button onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <p className="text-sm font-bold tracking-tight text-slate-900">{current}</p>
      <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[#8d1730] text-[10px] font-black text-white">SM</div>
    </header>
    <div className="no-print fixed inset-y-0 left-0 z-50 hidden w-[258px] lg:block">{sidebar}</div>
    {open && <div className="no-print fixed inset-0 z-50 lg:hidden">
      <button aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#1e171a]/60" />
      <div className="absolute inset-y-0 left-0 w-[min(258px,86vw)] shadow-2xl">{sidebar}</div>
    </div>}
  </>;
}
