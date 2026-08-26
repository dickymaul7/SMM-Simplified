"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; display_name: string; role: string };
type Task = { id: string; brief_id: string; assigned_to: string; status: "todo" | "in_progress" | "review" | "completed"; priority: string; due_date: string | null; created_at?: string | null };
type BriefTitle = { id: string; title: string };
const labels = { todo: "To-do", in_progress: "In Progress", review: "Review", completed: "Completed" };

export default function TaskForcePanel() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefTitles, setBriefTitles] = useState<BriefTitle[]>([]);
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
        const { data: rows, error: taskError } = await supabase.from("task_assignments").select("id,brief_id,assigned_to,status,priority,due_date,created_at").eq("assigned_to", memberRow.id).order("due_date", { ascending: true, nullsFirst: false });
        if (taskError) throw taskError;

        const briefIds = Array.from(new Set((rows ?? []).map((row: any) => row.brief_id).filter(Boolean)));
        let titleRows: BriefTitle[] = [];
        if (briefIds.length) {
          const { data: briefs, error: briefError } = await supabase.from("content_briefs").select("id,content_idea_id").in("id", briefIds);
          if (briefError) throw briefError;
          const ideaIds = Array.from(new Set((briefs ?? []).map((row: any) => row.content_idea_id).filter(Boolean)));
          const { data: ideas, error: ideaError } = ideaIds.length
            ? await supabase.from("content_ideas").select("id,working_title").in("id", ideaIds)
            : { data: [], error: null };
          if (ideaError) throw ideaError;
          const ideaMap = new Map((ideas ?? []).map((idea: any) => [idea.id, idea.working_title || "Untitled content"]));
          titleRows = (briefs ?? []).map((brief: any) => ({ id: brief.id, title: ideaMap.get(brief.content_idea_id) || "Untitled content" }));
        }

        if (!active) return;
        setMember(memberRow as Member);
        setTasks((rows ?? []) as Task[]);
        setBriefTitles(titleRows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat task force.");
      }
    }
    void load();
    const refresh = () => void load();
    window.addEventListener("task-assignment-updated", refresh);
    return () => { active = false; window.removeEventListener("task-assignment-updated", refresh); };
  }, []);

  const counts = useMemo(() => ({
    todo: tasks.filter(t => t.status === "todo").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    review: tasks.filter(t => t.status === "review").length,
    completed: tasks.filter(t => t.status === "completed").length,
  }), [tasks]);

  const activeTasks = useMemo(() => tasks.filter(t => t.status !== "completed"), [tasks]);
  const activeCount = activeTasks.length;
  const titleMap = useMemo(() => new Map(briefTitles.map((brief) => [brief.id, brief.title])), [briefTitles]);

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
        <>
          {activeTasks.length > 0 && (
            <button
              type="button"
              onClick={() => router.push("/calendar?task=active")}
              className="mx-5 mt-5 w-[calc(100%-2.5rem)] rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-100 md:mx-6 md:w-[calc(100%-3rem)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">!</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Assignment masuk</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Kamu punya {activeCount} tugas yang perlu diselesaikan.
                  </p>
                  <div className="mt-2 space-y-1">
                    {activeTasks.slice(0, 3).map((task) => (
                      <p key={task.id} className="truncate text-xs text-slate-600">
                        • {titleMap.get(task.brief_id) || "Assigned content"} · {labels[task.status]}
                      </p>
                    ))}
                    {activeTasks.length > 3 && <p className="text-xs font-semibold text-blue-700">+ {activeTasks.length - 3} assignment lainnya</p>}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-blue-700">Klik untuk membuka task →</p>
                </div>
              </div>
            </button>
          )}

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
        </>
      )}
    </section>
  );

  return target ? <>{panel}</> : null;
}
