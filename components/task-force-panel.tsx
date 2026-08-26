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
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const workspace = document.querySelector("main.app-workspace > div");
    if (!workspace) return;
    const slot = document.createElement("div");
    slot.id = "overview-task-force-slot";
    workspace.insertBefore(slot, workspace.firstChild);
    setTarget(slot);
    return () => slot.remove();
  }, []);

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
        setMember(memberRow as Member);
        setTasks((rows ?? []) as Task[]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat task force.");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => ({
    todo: tasks.filter(t => t.status === "todo").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    review: tasks.filter(t => t.status === "review").length,
    completed: tasks.filter(t => t.status === "completed").length,
  }), [tasks]);

  const activeCount = counts.todo + counts.in_progress + counts.review;
  if (!member && !error) return null;

  const panel = (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 md:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Task Force</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Pekerjaan {member?.display_name}</h2>
          <p className="mt-1 text-xs text-slate-400">Role: {member?.role.replaceAll("_", " ")}</p>
        </div>
        <button onClick={() => router.push("/calendar?task=active")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
          Buka Semua Task →
        </button>
      </div>

      {error ? <div className="px-5 py-5 text-sm text-red-600">{error}</div> : (
        <div className="grid gap-3 p-5 md:grid-cols-[1.25fr_repeat(4,minmax(0,1fr))] md:p-6">
          <button
            onClick={() => router.push("/calendar?task=active")}
            className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">My Tasks</p>
            <p className="mt-1 text-4xl font-bold text-slate-950">{activeCount}</p>
            <p className="mt-1 text-xs font-medium text-slate-600">tugas yang masih harus diselesaikan</p>
            <p className="mt-3 text-xs font-semibold text-blue-700">Lihat di Content Calendar →</p>
          </button>

          {(["todo","in_progress","review","completed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => router.push(`/calendar?task=${status}`)}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{labels[status]}</p>
              <p className="mt-1 text-3xl font-bold text-slate-950">{counts[status]}</p>
              <p className="mt-1 text-xs text-slate-500">
                {status === "todo" ? "Belum dimulai" : status === "in_progress" ? "Sedang dikerjakan" : status === "review" ? "Menunggu review" : "Sudah selesai"}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  return target ? <>{panel}</> : null;
}
