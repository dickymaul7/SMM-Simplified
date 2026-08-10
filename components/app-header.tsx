"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }
  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-semibold tracking-tight text-slate-950">SMM StoryBrief <span className="text-blue-600">Lite</span></Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-500 sm:inline">Quick brief → case research → final story</span>
          <button onClick={signOut} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Sign out</button>
        </div>
      </div>
    </header>
  );
}
