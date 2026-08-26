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
  const [activeBriefId, setActiveBriefId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // The calendar card is rendered asynchronously. Wait for the actual
  // schedule button instead of giving up after a fixed number of retries.
  // The observer disconnects as soon as the target is found, so it cannot
  // create a render loop or freeze the page.
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let observer: MutationObserver | null = null;

    const resolveTarget = () => {
      if (disposed) return;
      const target = findScheduleTarget();
      if (target) {
        setPortalTarget(target);
        observer?.disconnect();
        return;
      }
      frame = window.requestAnimationFrame(resolveTarget);
    };

    observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    resolveTarget();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleCalendarCardClick = (event: MouseEvent) => {
      const article = (event.target as HTMLElement | null)?.closest("article");
      if (!article) return;

      const title = Array.from(article.querySelectorAll("p"))[0]?.textContent?.trim();
      if (!title) return;

      const matched = briefs.find((brief) => brief.title.trim() === title);
      if (matched) {
        setActiveBriefId(matched.id);
        setMessage("");
        setError("");
      }
    };

    document.addEventListener("click", handleCalendarCardClick);
    return () => document.removeEventListener("click", handleCalendarCardClick);
  }, [briefs]);

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

  const normalizedRole = member?.role?.toLowerCase().replace(/[\s_-]/g, "");
  const isSuperadmin = normalizedRole === "superadmin";
  const activeBrief = briefs.find((brief) => brief.id === activeBriefId) ?? null;
  const focusedTasks = useMemo(() => {
    const mine = tasks.filter((task) => task.assigned_to === member?.id);
    if (filter === "active") return mine.filter((task) => task.status !== "completed");
    if (filter) return mine.filter((task) => task.status === filter);
    return [];
  }, [filter, tasks, member?.id]);

  async function assignTask() {
    if (!activeBriefId || !assignee) {
      setError("Klik brief di Content Calendar lalu pilih member terlebih dahulu.");
      return;
    }

    const brief = briefs.find((item) => item.id === activeBriefId);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("task_assignments").upsert(
      {
        brief_id: activeBriefId,
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

    setMessage(`Task berhasil di-assign ke ${members.find((item) => item.id === assignee)?.display_name || "member"}.`);
    setError("");
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
            {isSuperadmin ? "Assign brief yang sedang kamu pilih langsung ke member tim." : "Task yang diberikan kepada akun ini."}
          </p>
        </div>
        {filter && <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">{focusedTasks.length} task aktif</span>}
      </div>

      {isSuperadmin && (
        <div className="mt-4 grid gap-3">
          <div className={`rounded-xl border px-3 py-2.5 ${activeBrief ? "border-blue-200 bg-blue-50" : "border-dashed border-slate-300 bg-slate-50"}`}>
            {activeBrief ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Brief terpilih</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">{activeBrief.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">Due: {activeBrief.scheduled_for || "Belum dijadwalkan"}</p>
              </>
            ) : (
              <p className="text-xs leading-5 text-slate-500">Klik salah satu card brief di calendar terlebih dahulu. Brief yang diklik akan otomatis dipilih di sini.</p>
            )}
          </div>

          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            disabled={!activeBrief}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Assign ke member</option>
            {members
              .filter((item) => item.role.toLowerCase().replace(/[\s_-]/g, "") !== "superadmin")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.display_name} · {item.role}
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={assignTask}
            disabled={!activeBrief || !assignee}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
