"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; user_id: string; display_name: string; role: string };
type Brief = { id: string; title: string; scheduled_for: string | null };
type Task = { id: string; brief_id: string; assigned_to: string; status: "todo" | "in_progress" | "review" | "completed"; priority: string; due_date: string | null };

export default function TaskAssignmentPanel() {
  const params = useSearchParams();
  const filter = params.get("task");
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefId, setBriefId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    const [{ data: me }, { data: team }, { data: taskRows }] = await Promise.all([
      supabase.from("team_members").select("id,user_id,display_name,role").eq("user_id", uid).maybeSingle(),
      supabase.from("team_members").select("id,user_id,display_name,role").eq("active", true).order("display_name"),
      supabase.from("task_assignments").select("id,brief_id,assigned_to,status,priority,due_date"),
    ]);
    setMember((me ?? null) as Member | null); setMembers((team ?? []) as Member[]); setTasks((taskRows ?? []) as Task[]);
    const { data: rows } = await supabase.from("content_briefs").select("id,scheduled_for,content_idea_id").not("scheduled_for", "is", null).order("scheduled_for", { ascending: true });
    const ideaIds = (rows ?? []).map((r: any) => r.content_idea_id).filter(Boolean);
    const { data: ideas } = ideaIds.length ? await supabase.from("content_ideas").select("id,working_title").in("id", ideaIds) : { data: [] };
    const titleMap = new Map((ideas ?? []).map((i: any) => [i.id, i.working_title || "Untitled content"]));
    setBriefs((rows ?? []).map((r: any) => ({ id: r.id, title: titleMap.get(r.content_idea_id) || "Untitled content", scheduled_for: r.scheduled_for })) as Brief[]);
  }
  useEffect(() => { void load(); }, []);

  const isSuperadmin = member?.role === "superadmin";
  const focusedTasks = useMemo(() => filter ? tasks.filter(t => t.status === filter && t.assigned_to === member?.id) : [], [tasks, filter, member]);
  if (!member) return null;

  async function assign() {
    if (!briefId || !assignee) return;
    setError(""); setMessage("");
    const selected = briefs.find(b => b.id === briefId);
    const supabase = createClient();
    const { data, error: insertError } = await supabase.from("task_assignments").insert({ brief_id: briefId, assigned_to: assignee, assigned_by: member!.user_id, status: "todo", priority: "normal", due_date: selected?.scheduled_for ?? null }).select("id,brief_id,assigned_to,status,priority,due_date").single();
    if (insertError) { setError(insertError.message); return; }
    setTasks(current => [...current, data as Task]); setMessage("Task berhasil di-assign."); setBriefId(""); setAssignee("");
  }

  async function changeStatus(id: string, status: Task["status"]) {
    const supabase = createClient();
    const { error: updateError } = await supabase.from("task_assignments").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) { setError(updateError.message); return; }
    setTasks(current => current.map(t => t.id === id ? { ...t, status } : t));
  }

  return <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Task Assignment</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{filter ? `My ${filter.replace("_", " ")} Tasks` : "Assign & Track"}</h2></div>
    {isSuperadmin && !filter && <div className="mt-5 space-y-3"><select value={briefId} onChange={e => setBriefId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Pilih content...</option>{briefs.map(b => <option key={b.id} value={b.id}>{b.title} · {b.scheduled_for}</option>)}</select><select value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Assign ke...</option>{members.filter(m => m.role !== "superadmin").map(m => <option key={m.id} value={m.id}>{m.display_name} · {m.role.replaceAll("_", " ")}</option>)}</select><button disabled={!briefId || !assignee} onClick={assign} className="w-full rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Assign Task</button></div>}
    {(message || error) && <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}
    {filter && <div className="mt-5 space-y-2">{focusedTasks.length === 0 ? <p className="text-sm text-slate-500">Tidak ada task dengan status ini.</p> : focusedTasks.map(task => <div key={task.id} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-900">Content #{task.brief_id.slice(0,8)}</p><p className="mt-1 text-[11px] text-slate-400">Deadline: {task.due_date || "No deadline"}</p><select value={task.status} onChange={e => changeStatus(task.id, e.target.value as Task["status"])} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"><option value="todo">To-do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="completed">Completed</option></select></div>)}</div>}
  </aside>;
}
