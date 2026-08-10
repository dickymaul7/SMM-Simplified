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
    <main className="min-h-screen bg-slate-950 px-5 py-12 grid place-items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">SMM StoryBrief Lite</div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Masuk ke workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Versi ringkas: cukup isi quick campaign brief, lalu AI mencari kasus dan menyusun storytelling.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Email</span>
            <input className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Password</span>
            <input className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {message && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}
          <button disabled={loading} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </main>
  );
}
