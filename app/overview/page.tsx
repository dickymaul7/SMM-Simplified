"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; display_name: string; role: string };
type Task = { id: string; brief_id: string; assigned_to: string; status: "todo" | "in_progress" | "review" | "completed"; priority: string; due_date: string | null };

const labels: Record<Task["status"], string> = { todo: "To-do", in_progress: "In Progress", review: "Review", completed: "Completed" };

function formatDate(value: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export default function OverviewPage() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;
      const { data: memberRow, error: memberError } = await supabase.from("team_members").select("id,user_id,display_name,role").eq("user_id", userId).maybeSingle();
      if (memberError) throw memberError;
      if (!memberRow) throw new Error("Akun ini belum terdaftar sebagai team member. Tambahkan user ke public.team_members di Supabase.");
      setMember(memberRow as Member);
      const { data: taskRows, error: taskError } = await supabase.from("task_assignments").select("id,brief_id,assigned_to,status,priority,due_date").order("due_date", { ascending: true, nullsFirst: false });
      if (taskError) throw taskError;
      setTasks((taskRows ?? []) as Task[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat task overview.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const myTasks = useMemo(() => member ? tasks.filter((task) => task.assigned_to === member.id) : [], [tasks, member]);
  const counts = useMemo(() => ({
    todo: myTasks.filter((task) => task.status === "todo").length,
    in_progress: myTasks.filter((task) => task.status === "in_progress").length,
    review: myTasks.filter((task) => task.status === "review").length,
    completed: myTasks.filter((task) => task.status === "completed").length,
  }), [myTasks]);
  const overdue = useMemo(() => myTasks.filter((task) => task.status !== "completed" && task.due_date && task.due_date < new Date().toISOString().slice(0, 10)).length, [myTasks]);

  async function updateStatus(taskId: string, status: Task["status"]) {
    const supabase = createClient();
    const { error: updateError } = await supabase.from("task_assignments").update({ status, updated_at: new Date().toISOString() }).eq("id", taskId);
    if (updateError) { setError(updateError.message); return; }
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
  }

  return (
    <AuthGuard>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 lg:py-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Team Command Center</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Overview</h1>
            <p className="mt-2 text-sm text-slate-500">{member ? `Halo, ${member.display_name}. Berikut task force kamu.` : "Memuat task force..."}</p>
          </div>
          {member && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-xs uppercase tracking-wider text-slate-400">Role</p><p className="font-semibold capitalize text-slate-800">{member.role.replace("_", " ")}</p></div>}
        </div>

        {error && <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading task force...</div>}

        {!loading && member && <>
          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button onClick={() => router.push("/calendar?task=todo")} className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">To-do</p><p className="mt-2 text-4xl font-bold text-slate-950">{counts.todo}</p><p className="mt-1 text-sm text-slate-500">Pekerjaan yang harus dikerjakan</p><p className="mt-4 text-xs font-semibold text-blue-700">Buka task di Calendar →</p></button>
            <button onClick={() => router.push("/calendar?task=in_progress")} className="rounded-3xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-amber-600">In Progress</p><p className="mt-2 text-4xl font-bold text-slate-950">{counts.in_progress}</p><p className="mt-1 text-sm text-slate-500">Sedang dikerjakan</p></button>
            <button onClick={() => router.push("/calendar?task=review")} className="rounded-3xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Review</p><p className="mt-2 text-4xl font-bold text-slate-950">{counts.review}</p><p className="mt-1 text-sm text-slate-500">Menunggu review</p></button>
            <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Completed</p><p className="mt-2 text-4xl font-bold text-slate-950">{counts.completed}</p><p className="mt-1 text-sm text-slate-500">Task selesai</p><p className={`mt-4 text-xs font-semibold ${overdue ? "text-red-600" : "text-slate-400"}`}>{overdue ? `${overdue} overdue` : "Tidak ada overdue"}</p></div>
          </section>

          <section className="mt-7 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5"><div><h2 className="text-xl font-bold">My Tasks</h2><p className="mt-1 text-xs text-slate-400">Task yang di-assign ke akun ini</p></div><button onClick={() => router.push("/calendar?task=todo")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Open Calendar</button></div>
            <div className="divide-y divide-slate-100">
              {myTasks.length === 0 && <div className="p-6 text-sm text-slate-500">Belum ada task yang di-assign.</div>}
              {myTasks.map((task) => <div key={task.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{task.priority}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${task.status === "todo" ? "bg-blue-50 text-blue-700" : task.status === "in_progress" ? "bg-amber-50 text-amber-700" : task.status === "review" ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>{labels[task.status]}</span></div><p className="mt-2 text-sm font-semibold text-slate-900">Task untuk content #{task.brief_id.slice(0, 8)}</p><p className="mt-1 text-xs text-slate-400">Deadline: {formatDate(task.due_date)}</p></div><div className="flex flex-wrap gap-2"><select value={task.status} onChange={(event) => updateStatus(task.id, event.target.value as Task["status"])} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><option value="todo">To-do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="completed">Completed</option></select><button onClick={() => router.push(`/calendar?taskId=${task.id}`)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Open Content →</button></div></div>)}
            </div>
          </section>
        </>}
      </main>
    </AuthGuard>
  );
}
