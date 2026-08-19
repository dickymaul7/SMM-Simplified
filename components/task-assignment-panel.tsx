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

const labels = {
  todo: "To-do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

function findQuickMoveTarget() {
  const heading = Array.from(document.querySelectorAll("h2")).find(
    (node) => node.textContent?.trim() === "Quick Move",
  );
  return heading?.closest("div.rounded-3xl") ?? null;
}

function hideWorkflowCard() {
  const heading = Array.from(document.querySelectorAll("h2")).find(
    (node) => node.textContent?.trim() === "Workflow",
  );
  const card = heading?.closest("div.rounded-3xl") as HTMLElement | null;
  if (card) card.style.display = "none";
}

export default function TaskAssignmentPanel() {
  const params = useSearchParams();
  const filter = params.get("task") as Task["status"] | null;
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
    setPortalTarget(findQuickMoveTarget());
    hideWorkflowCard();
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
  const focusedTasks = useMemo(
    () =>
      filter
        ? tasks.filter((task) => task.status === filter && task.assigned_to === member?.id)
        : [],
    [tasks, filter, member],
  );

  if (!portalTarget || !member) return null;

  async function assign() {
    if (!briefId || !assignee || !isSuperadmin) return;

    setError("");
    setMessage("");

    const selected = briefs.find((brief) => brief.id === briefId);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("task_assignments")
      .insert({
        brief_id: briefId,
        assigned_to: assignee,
        assigned_by: member.user_id,
        status: "todo",
        priority: "normal",
        due_date: selected?.scheduled_for ?? null,
      })
      .select("id,brief_id,assigned_to,status,priority,due_date")
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTasks((current) => [...current, data as Task]);
    setMessage("Task berhasil di-assign ke member.");
    setBriefId("");
    setAssignee("");
  }

  async function changeStatus(id: string, status: Task["status"]) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("task_assignments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setTasks((current) => current.map((task) => (task.id === id ? { ...task, status } : task)));
  }

  const content = (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Task Assignment</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">
            {filter ? `My ${labels[filter]} Tasks` : "Assign Task"}
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
          {isSuperadmin ? "Superadmin" : member.role.replaceAll("_", " ")}
        </span>
      </div>

      {isSuperadmin && !filter && (
        <div className="mt-4 space-y-2.5">
          <select
            value={briefId}
            onChange={(event) => setBriefId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Pilih content...</option>
            {briefs.map((brief) => (
              <option key={brief.id} value={brief.id}>
                {brief.title} · {brief.scheduled_for}
              </option>
            ))}
          </select>

          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Assign ke member...</option>
            {members
              .filter((memberRow) => memberRow.role !== "superadmin")
              .map((memberRow) => (
                <option key={memberRow.id} value={memberRow.id}>
                  {memberRow.display_name} · {memberRow.role.replaceAll("_", " ")}
                </option>
              ))}
          </select>

          <button
            disabled={!briefId || !assignee}
            onClick={assign}
            className="w-full rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Assign Task
          </button>
        </div>
      )}

      {(message || error) && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      {filter && (
        <div className="mt-4 space-y-2">
          {focusedTasks.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada task dengan status ini.</p>
          ) : (
            focusedTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-900">Content #{task.brief_id.slice(0, 8)}</p>
                <p className="mt-1 text-[11px] text-slate-400">Deadline: {task.due_date || "No deadline"}</p>
                <select
                  value={task.status}
                  onChange={(event) => changeStatus(task.id, event.target.value as Task["status"])}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <option value="todo">To-do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return createPortal(content, portalTarget);
}
