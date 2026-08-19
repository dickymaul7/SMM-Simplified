"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type CalendarItem = { briefId: string; ideaId: string; campaignId: string; brandId: string; title: string; format: string | null; campaignName: string; brandName: string; scheduledFor: string; humanQcStatus: string | null; score: number };
type TeamMember = { id: string; user_id: string; display_name: string; role: string };
type TaskAssignment = { id: string; brief_id: string; assigned_to: string; status: "todo" | "in_progress" | "review" | "completed"; priority: "low" | "normal" | "high" | "urgent"; due_date: string | null };

const weekdayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
function localDateString(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); }
function monthTitle(date: Date) { return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }

export default function CalendarClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskFilter = searchParams.get("task");
  const taskId = searchParams.get("taskId");
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickMoveDate, setQuickMoveDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [assigning, setAssigning] = useState(false);

  const myMemberId = useMemo(() => members.find((member) => member.user_id === currentUserId)?.id ?? null, [members, currentUserId]);
  const isSuperadmin = useMemo(() => members.find((member) => member.user_id === currentUserId)?.role === "superadmin", [members, currentUserId]);

  async function loadCalendar() {
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const [{ data: sessionData }, { data: memberRows, error: memberError }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("team_members").select("id,user_id,display_name,role").eq("active", true).order("display_name"),
      ]);
      if (memberError) throw memberError;
      setCurrentUserId(sessionData.session?.user.id ?? null);
      setMembers((memberRows ?? []) as TeamMember[]);

      const { data: taskRows, error: taskError } = await supabase.from("task_assignments").select("id,brief_id,assigned_to,status,priority,due_date");
      if (taskError && taskError.code !== "42P01") throw taskError;
      setTasks((taskRows ?? []) as TaskAssignment[]);

      const { data: briefs, error: briefError } = await supabase.from("content_briefs").select("id,content_idea_id,scheduled_for,human_qc_status,final_score,status").not("scheduled_for", "is", null).order("scheduled_for", { ascending: true });
      if (briefError) throw briefError;
      const briefRows = briefs ?? [];
      const ideaIds = Array.from(new Set(briefRows.map((row: any) => row.content_idea_id).filter(Boolean)));
      if (!ideaIds.length) { setItems([]); setLoading(false); return; }
      const { data: ideas, error: ideaError } = await supabase.from("content_ideas").select("id,campaign_id,working_title,recommended_format").in("id", ideaIds);
      if (ideaError) throw ideaError;
      const ideaRows = ideas ?? [];
      const campaignIds = Array.from(new Set(ideaRows.map((row: any) => row.campaign_id).filter(Boolean)));
      if (!campaignIds.length) { setItems([]); setLoading(false); return; }
      const { data: campaigns, error: campaignError } = await supabase.from("campaigns").select("id,brand_id,name").in("id", campaignIds);
      if (campaignError) throw campaignError;
      const campaignRows = campaigns ?? [];
      const brandIds = Array.from(new Set(campaignRows.map((row: any) => row.brand_id).filter(Boolean)));
      const { data: brands, error: brandError } = brandIds.length ? await supabase.from("brands").select("id,name").in("id", brandIds) : { data: [], error: null };
      if (brandError) throw brandError;
      const ideaMap = new Map<string, any>(ideaRows.map((row: any) => [row.id, row]));
      const campaignMap = new Map<string, any>(campaignRows.map((row: any) => [row.id, row]));
      const brandMap = new Map<string, any>((brands ?? []).map((row: any) => [row.id, row]));
      const result: CalendarItem[] = [];
      for (const row of briefRows as any[]) {
        const idea = ideaMap.get(row.content_idea_id); if (!idea) continue;
        const campaign = campaignMap.get(idea.campaign_id); if (!campaign) continue;
        const brand = brandMap.get(campaign.brand_id);
        result.push({ briefId: row.id, ideaId: idea.id, campaignId: campaign.id, brandId: campaign.brand_id, title: idea.working_title || "Untitled content", format: idea.recommended_format, campaignName: campaign.name || "Campaign", brandName: brand?.name || "Brand", scheduledFor: row.scheduled_for, humanQcStatus: row.human_qc_status, score: Number(row.final_score || 0) });
      }
      setItems(result);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memuat content calendar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadCalendar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const focusBriefId = taskId ? tasks.find((task) => task.id === taskId)?.brief_id ?? null : null;
  const visibleItems = useMemo(() => {
    if (focusBriefId) return items.filter((item) => item.briefId === focusBriefId);
    if (!taskFilter) return items;
    return items.filter((item) => tasks.some((task) => task.brief_id === item.briefId && task.status === taskFilter && task.assigned_to === myMemberId));
  }, [items, tasks, taskFilter, taskId, focusBriefId, myMemberId]);

  useEffect(() => {
    if (focusBriefId) {
      const item = items.find((candidate) => candidate.briefId === focusBriefId);
      if (item) { setSelectedId(item.briefId); setQuickMoveDate(item.scheduledFor); }
    } else if (taskFilter && visibleItems.length) {
      const first = visibleItems[0]; setSelectedId(first.briefId); setQuickMoveDate(first.scheduledFor);
    }
  }, [focusBriefId, taskFilter, visibleItems, items]);

  const calendarCells = useMemo(() => {
    const year = month.getFullYear(); const monthIndex = month.getMonth(); const firstDay = new Date(year, monthIndex, 1); const daysInMonth = new Date(year, monthIndex + 1, 0).getDate(); const leading = (firstDay.getDay() + 6) % 7; const total = Math.ceil((leading + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, index) => { const dayNumber = index - leading + 1; if (dayNumber < 1 || dayNumber > daysInMonth) return null; const date = new Date(year, monthIndex, dayNumber); return { date, dateString: localDateString(date), dayNumber }; });
  }, [month]);
  const itemsByDate = useMemo(() => { const map = new Map<string, CalendarItem[]>(); for (const item of visibleItems) map.set(item.scheduledFor, [...(map.get(item.scheduledFor) ?? []), item]); return map; }, [visibleItems]);
  const selectedItem = items.find((item) => item.briefId === selectedId) ?? null;
  const selectedTasks = tasks.filter((task) => task.brief_id === selectedId);

  async function assignTask() {
    if (!selectedItem || !selectedAssignee || !currentUserId) return;
    setAssigning(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase.from("task_assignments").insert({ brief_id: selectedItem.briefId, assigned_to: selectedAssignee, assigned_by: currentUserId, due_date: selectedItem.scheduledFor, status: "todo", priority: "normal" }).select("id,brief_id,assigned_to,status,priority,due_date").single();
      if (insertError) throw insertError;
      setTasks((current) => [...current, data as TaskAssignment]); setSelectedAssignee(""); setMessage("Task berhasil di-assign. Task sekarang muncul di Overview akun penerima.");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal melakukan assignment."); }
    finally { setAssigning(false); }
  }
  async function moveBrief(briefId: string, dateString: string) {
    const current = items.find((item) => item.briefId === briefId); if (!current || current.scheduledFor === dateString) { setDraggingId(null); setDragOverDate(null); return; }
    setMovingId(briefId); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from("content_briefs").update({ scheduled_for: dateString }).eq("id", briefId); if (updateError) throw updateError;
      setItems((currentItems) => currentItems.map((item) => item.briefId === briefId ? { ...item, scheduledFor: dateString } : item));
      const { error: taskError } = await supabase.from("task_assignments").update({ due_date: dateString, updated_at: new Date().toISOString() }).eq("brief_id", briefId).neq("status", "completed");
      if (!taskError) setTasks((currentTasks) => currentTasks.map((task) => task.brief_id === briefId && task.status !== "completed" ? { ...task, due_date: dateString } : task));
      if (selectedId === briefId) setQuickMoveDate(dateString); setMessage(`Jadwal dipindahkan ke ${formatShortDate(dateString)}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memindahkan jadwal."); }
    finally { setMovingId(null); setDraggingId(null); setDragOverDate(null); }
  }
  function onCardDragStart(event: DragEvent<HTMLElement>, briefId: string) { setDraggingId(briefId); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", briefId); }
  async function onDayDrop(event: DragEvent<HTMLElement>, dateString: string) { event.preventDefault(); const briefId = event.dataTransfer.getData("text/plain") || draggingId; if (briefId) await moveBrief(briefId, dateString); }
  function chooseItem(item: CalendarItem) { setSelectedId(item.briefId); setQuickMoveDate(item.scheduledFor); setMessage(""); setError(""); }
  function goPreviousMonth() { setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)); }
  function goNextMonth() { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)); }
  function goToday() { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthItems = visibleItems.filter((item) => item.scheduledFor.startsWith(monthPrefix));

  return <AuthGuard><AppHeader /><main className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6 lg:py-10">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Planning Workspace</div><h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Content Calendar</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Brief terjadwal ada di sini. Superadmin dapat assign task langsung dari card calendar.</p></div><div className="flex flex-wrap gap-2"><button onClick={goPreviousMonth} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">← Bulan lalu</button><button onClick={goToday} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">Hari ini</button><button onClick={goNextMonth} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">Bulan berikut →</button></div></div>
    {(message || error) && <div className="mt-5 space-y-2">{message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}{error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}</div>}
    {taskFilter && <div className="mt-5 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Task Focus</p><p className="mt-1 text-sm font-semibold text-slate-800">Menampilkan task {taskFilter.replace("_", " ")} milik akun ini.</p></div><button onClick={() => router.push("/calendar")} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700">Clear Filter</button></div>}
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5"><div><h2 className="text-xl font-bold capitalize">{monthTitle(month)}</h2><p className="mt-1 text-xs text-slate-400">{monthItems.length} content tampil bulan ini</p></div>{loading && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Loading...</span>}</div><div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{weekdayLabels.map((label) => <div key={label} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>)}</div><div className="grid grid-cols-7">{calendarCells.map((cell, index) => { if (!cell) return <div key={`blank-${index}`} className="min-h-32 border-b border-r border-slate-100 bg-slate-50/40 md:min-h-40" />; const dayItems = itemsByDate.get(cell.dateString) ?? []; const today = cell.dateString === localDateString(new Date()); return <div key={cell.dateString} onDragOver={(event) => { event.preventDefault(); setDragOverDate(cell.dateString); }} onDragLeave={() => { if (dragOverDate === cell.dateString) setDragOverDate(null); }} onDrop={(event) => onDayDrop(event, cell.dateString)} className={`min-h-32 border-b border-r border-slate-100 p-2 transition md:min-h-40 ${dragOverDate === cell.dateString ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : "bg-white"}`}><div className="mb-2 flex items-center justify-between"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${today ? "bg-blue-600 text-white" : "text-slate-500"}`}>{cell.dayNumber}</span>{dayItems.length > 0 && <span className="text-[10px] font-semibold text-slate-300">{dayItems.length}</span>}</div><div className="space-y-2">{dayItems.map((item) => { const itemTasks = tasks.filter((task) => task.brief_id === item.briefId); const focused = focusBriefId === item.briefId; return <article key={item.briefId} draggable onDragStart={(event) => onCardDragStart(event, item.briefId)} onDragEnd={() => { setDraggingId(null); setDragOverDate(null); }} onClick={() => chooseItem(item)} className={`cursor-grab rounded-xl border p-2.5 text-left shadow-sm transition ${focused ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : draggingId === item.briefId ? "opacity-40" : selectedId === item.briefId ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold uppercase tracking-wide text-blue-600">{item.brandName}</span>{movingId === item.briefId && <span className="text-[9px] text-slate-400">saving...</span>}</div><p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-4 text-slate-800">{item.title}</p><div className="mt-2 flex flex-wrap gap-1"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500">{item.format || "content"}</span><span className={`rounded-full px-2 py-0.5 text-[9px] ${item.humanQcStatus === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{item.humanQcStatus === "approved" ? "QC ✓" : "QC ulang"}</span>{itemTasks.length > 0 && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-600">{itemTasks.length} assigned</span>}</div></article>; })}</div></div>; })}</div></section>
    <aside className="space-y-4"><div className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Task Assignment</p><h2 className="mt-2 text-xl font-bold">Assign pekerjaan dari calendar.</h2><p className="mt-2 text-sm leading-6 text-slate-300">Klik content, pilih anggota tim, lalu assign. Penerima akan melihat task di Overview.</p></div><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Selected Content</h2>{!selectedItem ? <p className="mt-3 text-sm leading-6 text-slate-500">Klik kartu content untuk melihat detail.</p> : <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{selectedItem.brandName}</p><p className="mt-1 text-sm font-semibold leading-5">{selectedItem.title}</p><p className="mt-2 text-xs text-slate-400">Jadwal: {formatShortDate(selectedItem.scheduledFor)}</p><input type="date" value={quickMoveDate} onChange={(event) => setQuickMoveDate(event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /><button onClick={() => moveBrief(selectedItem.briefId, quickMoveDate)} disabled={!quickMoveDate || movingId === selectedItem.briefId} className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{movingId === selectedItem.briefId ? "Memindahkan..." : "Pindahkan Tanggal"}</button>{isSuperadmin && <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assign Task</p><div className="mt-3 flex gap-2"><select value={selectedAssignee} onChange={(event) => setSelectedAssignee(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"><option value="">Pilih anggota tim...</option>{members.filter((member) => member.user_id !== currentUserId || member.role !== "superadmin").map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.role}</option>)}</select><button onClick={assignTask} disabled={!selectedAssignee || assigning} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{assigning ? "..." : "Assign"}</button></div></div>}{selectedTasks.length > 0 && <div className="mt-5 space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Tasks</p>{selectedTasks.map((task) => { const member = members.find((m) => m.id === task.assigned_to); return <div key={task.id} className="rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{member?.display_name || "Team member"}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{task.status.replace("_", " ")}</span></div><p className="mt-1 text-xs text-slate-400">Due {task.due_date ? formatShortDate(task.due_date) : "-"}</p></div>; })}</div>}<button onClick={() => router.push(`/brief/${selectedItem.briefId}`)} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">Buka Full Brief →</button></div>}</div><div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Workflow</h2><span className="text-xs text-slate-400">{visibleItems.length} visible</span></div><div className="mt-4 space-y-3 text-sm leading-6 text-slate-500"><p>1. Edit & urutkan slide di Full Brief.</p><p>2. Tandai Lolos Human QC.</p><p>3. Klik Jadwalkan Brief.</p><p>4. Superadmin assign task dari calendar.</p><p>5. Penerima klik To-do di Overview untuk kembali ke task yang perlu dikerjakan.</p></div></div></aside></div>
  </main></AuthGuard>;
}
