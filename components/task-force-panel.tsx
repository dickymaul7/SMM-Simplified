"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; display_name: string; role: string };
type Task = { id: string; brief_id: string; assigned_to: string; status: "todo" | "in_progress" | "review" | "completed"; priority: string; due_date: string | null };
const labels = { todo: "To-do", in_progress: "In Progress", review: "Review", completed: "Completed" };

export default function TaskForcePanel() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user.id;
        if (!userId) return;
        const { data: memberRow, error: memberError } = await supabase.from("team_members").select("id,user_id,display_name,role").eq("user_id", userId).maybeSingle();
        if (memberError) throw memberError;
        if (!memberRow) return;
        const { data: rows, error: taskError } = await supabase.from("task_assignments").select("id,brief_id,assigned_to,status,priority,due_date").eq("assigned_to", memberRow.id).order("due_date", { ascending: true, nullsFirst: false });
        if (taskError) throw taskError;
        if (!active) return;
        setMember(memberRow as Member); setTasks((rows ?? []) as Task[]);
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "Gagal memuat task force."); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => ({ todo: tasks.filter(t => t.status === "todo").length, in_progress: tasks.filter(t => t.status === "in_progress").length, review: tasks.filter(t => t.status === "review").length, completed: tasks.filter(t => t.status === "completed").length }), [tasks]);
  if (!member && !error) return null;

  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 md:px-6"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Task Force</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{member ? `Pekerjaan ${member.display_name}` : "Task Force"}</h2><p className="mt-1 text-xs text-slate-400">Role: {member?.role.replaceAll("_", " ")}</p></div><button onClick={() => router.push("/calendar?task=todo")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Open My Tasks →</button></div>
    {error ? <div className="px-5 py-5 text-sm text-red-600">{error}</div> : <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 md:p-6">
      {(["todo","in_progress","review","completed"] as const).map((status) => <button key={status} onClick={() => router.push(`/calendar?task=${status}`)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{labels[status]}</p><p className="mt-1 text-3xl font-bold text-slate-950">{counts[status]}</p><p className="mt-1 text-xs text-slate-500">{status === "todo" ? "Pekerjaan yang harus dikerjakan" : status === "in_progress" ? "Sedang dikerjakan" : status === "review" ? "Menunggu review" : "Sudah selesai"}</p></button>)}
    </div>}
  </section>;
}
