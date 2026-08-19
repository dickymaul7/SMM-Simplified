"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace("/login"); }
  const navClass = (href: string) => `rounded-xl px-3 py-2 text-sm font-medium transition ${pathname === href ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`;
  return <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="flex min-w-0 items-center gap-4"><Link href="/" className="whitespace-nowrap font-semibold tracking-tight text-slate-950">SMM StoryBrief <span className="text-blue-600">Lite</span></Link><nav className="hidden items-center gap-1 md:flex"><Link href="/overview" className={navClass("/overview")}>Overview</Link><Link href="/" className={navClass("/")}>Buat Brief</Link><Link href="/calendar" className={navClass("/calendar")}>Content Calendar</Link></nav></div><div className="flex items-center gap-2"><Link href="/overview" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium md:hidden">Overview</Link><button onClick={signOut} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Sign out</button></div></div></header>;
}
