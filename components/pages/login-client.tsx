"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#F1F0EE] px-5 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border-[42px] border-[#FFD8DC] opacity-60" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full border-[32px] border-[#E3E1DE] opacity-70" />
      <div className="relative w-full max-w-md rounded-xl border border-[#E3E1DE] bg-white p-8 shadow-lg md:p-10">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-lg bg-[#DE0016] text-base font-bold text-white">SM</span>
          <div>
            <p className="text-sm font-bold tracking-tight text-[#2F2F2E]">SMM Simplified</p>
            <p className="text-xs text-[#777674]">Content operations workspace</p>
          </div>
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.03em] text-[#B90012]">Workspace access</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2F2F2E]">Masuk ke workspace</h1>
        <p className="mt-2 text-sm leading-6 text-[#5C5B59]">Gunakan akun yang sudah memiliki akses untuk melanjutkan content planning, research, dan StoryBrief.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#454545]">Email</span>
            <input className="h-11 w-full rounded-lg border border-[#CBC8C4] bg-white px-4 outline-none focus:border-[#B90012]" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#454545]">Password</span>
            <input className="h-11 w-full rounded-lg border border-[#CBC8C4] bg-white px-4 outline-none focus:border-[#B90012]" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {message && <div role="alert" className="rounded-lg border border-[#FFB3BA] bg-[#FFF0F1] px-4 py-3 text-sm text-[#8C000E]">{message}</div>}
          <button disabled={loading} className="h-12 w-full rounded-lg bg-[#DE0016] px-5 font-semibold text-white shadow-sm hover:bg-[#B90012] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </main>
  );
}
