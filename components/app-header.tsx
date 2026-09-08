"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace("/login"); }
  const navClass = (href: string) => `rounded-lg px-3 py-2 text-sm font-medium transition ${pathname === href ? "px-nav-selected" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`;
  return <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8"><div className="flex min-w-0 items-center gap-5"><Link href="/" className="flex items-center gap-3 whitespace-nowrap"><span aria-hidden="true" className="px-brand-mark grid h-9 w-9 place-items-center rounded-lg text-sm font-bold">P</span><span><strong className="block text-sm font-bold tracking-tight text-slate-950">Proxsis</strong><span className="block text-xs text-slate-500">SMM StoryBrief</span></span></Link><nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation"><Link href="/overview" className={navClass("/overview")}>Overview</Link><Link href="/" className={navClass("/")}>Buat Brief</Link><Link href="/calendar" className={navClass("/calendar")}>Content Calendar</Link></nav></div><div className="flex items-center gap-2"><Link href="/overview" className="px-secondary rounded-lg px-3 py-2 text-sm font-medium md:hidden">Overview</Link><button onClick={signOut} className="px-secondary rounded-lg px-3 py-2 text-sm font-medium">Sign out</button></div></div></header>;
}
