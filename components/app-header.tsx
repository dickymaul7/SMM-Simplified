"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type IconName = "overview" | "studio" | "calendar" | "analytics" | "brands" | "settings";

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
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const isActive = (href: string) => href === "/" ? pathname === "/" || pathname.startsWith("/campaign/") || pathname.startsWith("/brief/") : pathname === href || pathname.startsWith(`${href}/`);
  const current = navigation.find((item) => isActive(item.href))?.label ?? "SMM Simplified";

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
