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
    <main className="px-app-canvas relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border-[42px] border-red-100 opacity-60" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full border-[32px] border-slate-200 opacity-70" />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg md:p-10">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="px-brand-mark grid h-11 w-11 place-items-center rounded-lg text-base font-bold">P</span>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-950">Proxsis</p>
            <p className="text-xs text-slate-500">SMM StoryBrief</p>
          </div>
        </div>
        <p className="px-eyebrow mt-8">Workspace access</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Masuk ke workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Gunakan akun yang sudah memiliki akses ke workspace untuk melanjutkan pekerjaan content planning dan StoryBrief.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-800">Email</span>
            <input className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 outline-none" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-800">Password</span>
            <input className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 outline-none" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {message && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}
          <button disabled={loading} className="px-action-primary h-12 w-full rounded-lg px-5 font-semibold shadow-sm">{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </main>
  );
}
