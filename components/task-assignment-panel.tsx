"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; display_name: string; role: string };
type Brief = { id: string; title: string; scheduled_for: string | null };
type Task = {
  id: string;
  brief_id: string;
  assigned_to: string;
  status: "todo" | "in_progress" | "review" | "completed";
  priority: string;
  due_date: string | null;
};
type TaskFilter = Task["status"] | "active" | null;

const labels = {
  todo: "To-do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

function findScheduleTarget(): HTMLElement | null {
  const button = Array.from(document.querySelectorAll("button")).find(
    (node) => node.textContent?.trim() === "Pindahkan Tanggal",
  );
  return button?.parentElement ?? null;
}

export default function TaskAssignmentPanel() {
  const params = useSearchParams();
  const filter = params.get("task") as TaskFilter;
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefId, setBriefId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const refreshTarget = () => setPortalTarget(findScheduleTarget());
    refreshTarget();
    const timer = window.setTimeout(refreshTarget, 250);
    return () => window.clearTimeout(timer);
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;

    const [{ data: me, error: meError }, { data: team, error: teamError }, { data: taskRows, error: taskError }] = await Promise.all([
      supabase.from("team_members").select("id,user_id,display_name,role").eq("user_id", uid).maybeSingle(),
      supabase.from("team_members").select("id,user_id,display_name,role").eq("active", true).order("display_name"),
      supabase.from("task_assignments").select("id,brief_id,assigned_to,status,priority,due_date"),
    ]);

    if (meError || teamError || taskError) {
      setError((meError || teamError || taskError)?.message || "Gagal memuat task assignment.");
      return;
    }

    setMember((me ?? null) as Member | null);
    setMembers((team ?? []) as Member[]);
    setTasks((taskRows ?? []) as Task[]);

    const { data: rows, error: briefError } = await supabase
      .from("content_briefs")
      .select("id,scheduled_for,content_idea_id")
      .not("scheduled_for", "is", null)
      .order("scheduled_for", { ascending: true });

    if (briefError) {
      setError(briefError.message);
      return;
    }

    const ideaIds = (rows ?? []).map((row: any) => row.content_idea_id).filter(Boolean);
    const { data: ideas, error: ideaError } = ideaIds.length
      ? await supabase.from("content_ideas").select("id,working_title").in("id", ideaIds)
      : { data: [], error: null };

    if (ideaError) {
      setError(ideaError.message);
      return;
    }

    const titleMap = new Map((ideas ?? []).map((idea: any) => [idea.id, idea.working_title || "Untitled content"]));
    setBriefs(
      (rows ?? []).map((row: any) => ({
        id: row.id,
        title: titleMap.get(row.content_idea_id) || "Untitled content",
        scheduled_for: row.scheduled_for,
      })) as Brief[],
    );
  }

  useEffect(() => {
    void load();
  }, []);

  const isSuperadmin = member?.role === "superadmin";
  const focusedTasks = useMemo(() => {
    const mine = tasks.filter((task) => task.assigned_to === member?.id);
    if (filter === "active") return mine.filter((task) => task.status !== "completed");
    if (filter) return mine.filter((task) => task.status === filter);
    return [];
  }, [filter, tasks, member?.id]);

  async function assignTask() {
    if (!briefId || !assignee) {
      setError("Pilih content dan member terlebih dahulu.");
      return;
    }

    const brief = briefs.find((item) => item.id === briefId);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("task_assignments").upsert(
      {
        brief_id: briefId,
        assigned_to: assignee,
        assigned_by: member?.id ?? null,
        status: "todo",
        priority: "normal",
        due_date: brief?.scheduled_for ?? null,
      },
      { onConflict: "brief_id,assigned_to" },
    );

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setMessage("Task berhasil di-assign.");
    setError("");
    setBriefId("");
    setAssignee("");
    await load();
  }

  async function updateStatus(taskId: string, status: Task["status"]) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("task_assignments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  const panel = (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Task Assignment</p>
          <p className="mt-1 text-xs text-slate-500">
            {isSuperadmin ? "Assign brief ini langsung ke member tim." : "Task yang diberikan kepada akun ini."}
          </p>
        </div>
        {filter && <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">{focusedTasks.length} task aktif</span>}
      </div>

      {isSuperadmin && (
        <div className="mt-4 grid gap-3">
          <select
            value={briefId}
            onChange={(event) => setBriefId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="">Pilih content calendar</option>
            {briefs.map((brief) => (
              <option key={brief.id} value={brief.id}>
                {brief.title}
              </option>
            ))}
          </select>

          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="">Assign ke member</option>
            {members
              .filter((item) => item.role !== "superadmin")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.display_name} · {item.role}
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={assignTask}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Assign Task
          </button>
        </div>
      )}

      {message && <p className="mt-3 text-xs font-medium text-emerald-600">{message}</p>}
      {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      {focusedTasks.length > 0 && (
        <div className="mt-4 space-y-2">
          {focusedTasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-800">
                  {briefs.find((brief) => brief.id === task.brief_id)?.title || "Assigned content"}
                </p>
                <select
                  value={task.status}
                  onChange={(event) => updateStatus(task.id, event.target.value as Task["status"])}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600"
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!portalTarget) return null;
  return createPortal(panel, portalTarget);
}
