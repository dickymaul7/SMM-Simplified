"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { ACTIVE_BRAND_ALL } from "@/lib/active-brand";
import { createClient } from "@/lib/supabase/client";
import { useActiveBrandSelection } from "@/lib/use-active-brand";

type SourceType = "master" | "linkedin" | "seo_article";

type CalendarItem = {
  calendarId: string;
  sourceType: SourceType;
  sourceId: string;
  briefId: string;
  expansionId: string | null;
  ideaId: string;
  brandId: string;
  title: string;
  format: string | null;
  campaignName: string;
  brandName: string;
  scheduledFor: string;
  humanQcStatus: string | null;
  score: number;
  designStatus: "ready_to_design" | "designed" | null;
  designFileUrl: string | null;
};

const weekdayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function localDateString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function channelLabel(sourceType: SourceType) {
  if (sourceType === "linkedin") return "LinkedIn";
  if (sourceType === "seo_article") return "SEO Article";
  return "Instagram";
}

function channelTone(sourceType: SourceType) {
  if (sourceType === "linkedin") return "bg-blue-50 text-blue-700";
  if (sourceType === "seo_article") return "bg-violet-50 text-violet-700";
  return "bg-slate-100 text-slate-600";
}

export default function CalendarExpansionClient() {
  const router = useRouter();
  const { selection: activeBrand, hydrated: activeBrandHydrated } = useActiveBrandSelection();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickMoveDate, setQuickMoveDate] = useState("");
  const [designFileUrl, setDesignFileUrl] = useState("");
  const [designSaving, setDesignSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCalendar() {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: briefs, error: briefError } = await supabase
        .from("content_briefs")
        .select("id,content_idea_id,scheduled_for,human_qc_status,final_score,status,design_status,design_file_url")
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true });

      if (briefError) throw briefError;

      const briefRows = briefs ?? [];
      const ideaIds = Array.from(new Set(briefRows.map((row: any) => row.content_idea_id).filter(Boolean)));

      const { data: expansions, error: expansionError } = await supabase
        .from("content_expansions")
        .select("id,content_brief_id,channel,status,human_qc_status,scheduled_for")
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true });

      if (expansionError && expansionError.code !== "42P01") throw expansionError;

      const expansionRows = expansions ?? [];
      const allIdeaIds = Array.from(
        new Set([...ideaIds, ...briefRows.map((row: any) => row.content_idea_id).filter(Boolean)]),
      );

      if (!allIdeaIds.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: ideas, error: ideaError } = await supabase
        .from("content_ideas")
        .select("id,campaign_id,working_title,recommended_format")
        .in("id", allIdeaIds);

      if (ideaError) throw ideaError;

      const ideaRows = ideas ?? [];
      const campaignIds = Array.from(new Set(ideaRows.map((row: any) => row.campaign_id).filter(Boolean)));

      if (!campaignIds.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: campaigns, error: campaignError } = await supabase
        .from("campaigns")
        .select("id,brand_id,name")
        .in("id", campaignIds);

      if (campaignError) throw campaignError;

      const campaignRows = campaigns ?? [];
      const brandIds = Array.from(new Set(campaignRows.map((row: any) => row.brand_id).filter(Boolean)));
      const { data: brands, error: brandError } = brandIds.length
        ? await supabase.from("brands").select("id,name").in("id", brandIds)
        : { data: [], error: null };

      if (brandError) throw brandError;

      const ideaMap = new Map<string, any>(ideaRows.map((row: any) => [row.id, row]));
      const campaignMap = new Map<string, any>(campaignRows.map((row: any) => [row.id, row]));
      const brandMap = new Map<string, any>((brands ?? []).map((row: any) => [row.id, row]));
      const briefMap = new Map<string, any>(briefRows.map((row: any) => [row.id, row]));
      const result: CalendarItem[] = [];

      for (const row of briefRows as any[]) {
        const idea = ideaMap.get(row.content_idea_id);
        const campaign = idea ? campaignMap.get(idea.campaign_id) : null;
        if (!idea || !campaign) continue;
        const brand = brandMap.get(campaign.brand_id);

        result.push({
          calendarId: `master:${row.id}`,
          sourceType: "master",
          sourceId: row.id,
          briefId: row.id,
          expansionId: null,
          ideaId: idea.id,
          brandId: campaign.brand_id,
          title: idea.working_title || "Untitled content",
          format: idea.recommended_format,
          campaignName: campaign.name || "Campaign",
          brandName: brand?.name || "Brand",
          scheduledFor: row.scheduled_for,
          humanQcStatus: row.human_qc_status,
          score: Number(row.final_score || 0),
          designStatus: row.design_status === "designed" ? "designed" : "ready_to_design",
          designFileUrl: row.design_file_url || null,
        });
      }

      for (const row of expansionRows as any[]) {
        const brief = briefMap.get(row.content_brief_id);
        if (!brief) continue;
        const idea = ideaMap.get(brief.content_idea_id);
        const campaign = idea ? campaignMap.get(idea.campaign_id) : null;
        if (!idea || !campaign || !row.scheduled_for) continue;
        const brand = brandMap.get(campaign.brand_id);
        const sourceType: SourceType = row.channel === "linkedin" ? "linkedin" : "seo_article";

        result.push({
          calendarId: `expansion:${row.id}`,
          sourceType,
          sourceId: row.id,
          briefId: brief.id,
          expansionId: row.id,
          ideaId: idea.id,
          brandId: campaign.brand_id,
          title: idea.working_title || "Untitled content",
          format: sourceType === "linkedin" ? "LinkedIn" : "SEO Article",
          campaignName: campaign.name || "Campaign",
          brandName: brand?.name || "Brand",
          scheduledFor: row.scheduled_for,
          humanQcStatus: row.human_qc_status,
          score: 0,
          designStatus: null,
          designFileUrl: null,
        });
      }

      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat content calendar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCalendar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleItems = useMemo(() => {
    if (!activeBrandHydrated) return [];
    if (activeBrand.id === ACTIVE_BRAND_ALL) return items;
    return items.filter((item) => item.brandId === activeBrand.id);
  }, [activeBrand.id, activeBrandHydrated, items]);

  const calendarCells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leading = (firstDay.getDay() + 6) % 7;
    const total = Math.ceil((leading + daysInMonth) / 7) * 7;

    return Array.from({ length: total }, (_, index) => {
      const dayNumber = index - leading + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      const date = new Date(year, monthIndex, dayNumber);
      return { date, dateString: localDateString(date), dayNumber };
    });
  }, [month]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of visibleItems) {
      const existing = map.get(item.scheduledFor) ?? [];
      existing.push(item);
      map.set(item.scheduledFor, existing);
    }
    return map;
  }, [visibleItems]);

  const selectedItem = visibleItems.find((item) => item.calendarId === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId || !selectedItem) {
      if (selectedId && !selectedItem) setSelectedId(null);
      return;
    }
    setQuickMoveDate(selectedItem.scheduledFor);
    setDesignFileUrl(selectedItem.designFileUrl || "");
  }, [selectedId, selectedItem?.calendarId]);

  async function moveItem(itemId: string, dateString: string) {
    const current = items.find((item) => item.calendarId === itemId);
    if (!current || current.scheduledFor === dateString) {
      setDraggingId(null);
      setDragOverDate(null);
      return;
    }

    setMovingId(itemId);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const table = current.sourceType === "master" ? "content_briefs" : "content_expansions";
      const idColumn = "id";
      const { error: updateError } = await supabase
        .from(table)
        .update({ scheduled_for: dateString })
        .eq(idColumn, current.sourceId);

      if (updateError) throw updateError;

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.calendarId === itemId ? { ...item, scheduledFor: dateString } : item,
        ),
      );
      setMessage(`${channelLabel(current.sourceType)} dipindahkan ke ${formatShortDate(dateString)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memindahkan jadwal.");
    } finally {
      setMovingId(null);
      setDraggingId(null);
      setDragOverDate(null);
    }
  }

  function onCardDragStart(event: DragEvent<HTMLElement>, calendarId: string) {
    setDraggingId(calendarId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", calendarId);
  }

  async function onDayDrop(event: DragEvent<HTMLElement>, dateString: string) {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggingId;
    if (!itemId) return;
    await moveItem(itemId, dateString);
  }

  function chooseItem(item: CalendarItem) {
    setSelectedId(item.calendarId);
    setQuickMoveDate(item.scheduledFor);
    setDesignFileUrl(item.designFileUrl || "");
    setMessage("");
    setError("");
  }

  async function setDesignStatus(item: CalendarItem, nextStatus: "ready_to_design" | "designed") {
    if (item.sourceType !== "master") return;
    setDesignSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("content_briefs")
        .update({ design_status: nextStatus })
        .eq("id", item.briefId);
      if (updateError) throw updateError;
      setItems((currentItems) => currentItems.map((current) => current.calendarId === item.calendarId ? { ...current, designStatus: nextStatus } : current));
      setMessage(nextStatus === "designed" ? "Status Instagram diubah menjadi Designed." : "Status Instagram diubah menjadi Ready to Design.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah design status.");
    } finally {
      setDesignSaving(false);
    }
  }

  async function saveDesignFile(item: CalendarItem) {
    if (item.sourceType !== "master") return;
    const value = designFileUrl.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      setError("Link design harus diawali http:// atau https://");
      return;
    }
    setDesignSaving(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("content_briefs")
        .update({ design_file_url: value || null })
        .eq("id", item.briefId);
      if (updateError) throw updateError;
      setItems((currentItems) => currentItems.map((current) => current.calendarId === item.calendarId ? { ...current, designFileUrl: value || null } : current));
      setMessage(value ? "Link file design tersimpan." : "Link file design dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan link design.");
    } finally {
      setDesignSaving(false);
    }
  }

  function goPreviousMonth() {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function goToday() {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthItems = visibleItems.filter((item) => item.scheduledFor.startsWith(monthPrefix));
  const contextLabel = activeBrand.id === ACTIVE_BRAND_ALL ? "All Brands" : activeBrand.name;

  return (
    <AuthGuard>
      <AppHeader />
      <main className="app-workspace mx-auto max-w-[calc(1500px+16rem)] px-4 py-8 lg:px-6 lg:py-9">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Planning Workspace</div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{activeBrandHydrated ? contextLabel : "Loading brand context..."}</div>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Content Calendar</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Satu calendar untuk Instagram, LinkedIn, dan SEO Article. Setiap channel memiliki status Human QC dan jadwal publikasi sendiri.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={goPreviousMonth} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">← Bulan lalu</button>
            <button onClick={goToday} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">Hari ini</button>
            <button onClick={goNextMonth} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">Bulan berikut →</button>
          </div>
        </div>

        {(message || error) && <div className="mt-5 space-y-2">{message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}{error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}</div>}

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5">
              <div><h2 className="text-xl font-bold capitalize">{monthTitle(month)}</h2><p className="mt-1 text-xs text-slate-400">{monthItems.length} content terjadwal · {contextLabel}</p></div>
              {loading && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Loading...</span>}
            </div>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{weekdayLabels.map((label) => <div key={label} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>)}</div>
            <div className="grid grid-cols-7">
              {calendarCells.map((cell, index) => {
                if (!cell) return <div key={`blank-${index}`} className="min-h-32 border-b border-r border-slate-100 bg-slate-50/40 md:min-h-40" />;
                const dayItems = itemsByDate.get(cell.dateString) ?? [];
                const today = cell.dateString === localDateString(new Date());
                return (
                  <div key={cell.dateString} onDragOver={(event) => { event.preventDefault(); setDragOverDate(cell.dateString); }} onDragLeave={() => { if (dragOverDate === cell.dateString) setDragOverDate(null); }} onDrop={(event) => onDayDrop(event, cell.dateString)} className={`min-h-32 border-b border-r border-slate-100 p-2 transition md:min-h-40 ${dragOverDate === cell.dateString ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : "bg-white"}`}>
                    <div className="mb-2 flex items-center justify-between"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${today ? "bg-blue-600 text-white" : "text-slate-500"}`}>{cell.dayNumber}</span>{dayItems.length > 0 && <span className="text-[10px] font-semibold text-slate-300">{dayItems.length}</span>}</div>
                    <div className="space-y-2">
                      {dayItems.map((item) => (
                        <article key={item.calendarId} draggable onDragStart={(event) => onCardDragStart(event, item.calendarId)} onDragEnd={() => { setDraggingId(null); setDragOverDate(null); }} onClick={() => chooseItem(item)} className={`cursor-grab rounded-xl border p-2.5 text-left shadow-sm transition ${draggingId === item.calendarId ? "opacity-40" : selectedId === item.calendarId ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"}`}>
                          <div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold uppercase tracking-wide text-blue-600">{item.brandName}</span>{movingId === item.calendarId && <span className="text-[9px] text-slate-400">saving...</span>}</div>
                          <p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-4 text-slate-800">{item.title}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${channelTone(item.sourceType)}`}>{channelLabel(item.sourceType)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] ${item.humanQcStatus === "approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{item.humanQcStatus === "approved" ? "QC ✓" : "QC ulang"}</span>
                            {item.sourceType === "master" && <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${item.designStatus === "designed" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{item.designStatus === "designed" ? "Designed ✓" : "Ready to Design"}</span>}
                            {item.sourceType !== "master" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">{item.humanQcStatus === "approved" ? "Final" : "Needs Review"}</span>}
                            {item.designFileUrl && <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[9px] font-semibold text-white">File ↗</span>}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Active Context</p><h2 className="mt-2 text-xl font-bold">{contextLabel}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{activeBrand.id === ACTIVE_BRAND_ALL ? "Semua scheduled content dari seluruh brand ditampilkan dalam satu calendar." : "Hanya scheduled content milik brand aktif yang ditampilkan."}</p></div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Quick Move</h2>
              {!selectedItem ? <p className="mt-3 text-sm leading-6 text-slate-500">Klik kartu untuk memindahkan jadwal. Instagram, LinkedIn, dan SEO dapat digeser secara independen.</p> : (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${channelTone(selectedItem.sourceType)}`}>{channelLabel(selectedItem.sourceType)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">{selectedItem.brandName}</span></div>
                  <p className="mt-2 text-sm font-semibold leading-5">{selectedItem.title}</p>
                  <p className="mt-2 text-xs text-slate-400">Saat ini: {formatShortDate(selectedItem.scheduledFor)}</p>
                  <input type="date" value={quickMoveDate} onChange={(event) => setQuickMoveDate(event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" />
                  <button onClick={() => moveItem(selectedItem.calendarId, quickMoveDate)} disabled={!quickMoveDate || movingId === selectedItem.calendarId} className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{movingId === selectedItem.calendarId ? "Memindahkan..." : "Pindahkan Tanggal"}</button>

                  {selectedItem.sourceType === "master" ? (
                    <div className="mt-5 border-t border-slate-200 pt-5">
                      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Design Status</p><p className={`mt-1 text-sm font-bold ${selectedItem.designStatus === "designed" ? "text-violet-700" : "text-blue-700"}`}>{selectedItem.designStatus === "designed" ? "Designed ✓" : "Ready to Design"}</p></div>{selectedItem.designStatus === "designed" ? <button onClick={() => setDesignStatus(selectedItem, "ready_to_design")} disabled={designSaving} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">Set Ready</button> : <button onClick={() => setDesignStatus(selectedItem, "designed")} disabled={designSaving} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">Mark Designed</button>}</div>
                      <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">Link File Design</label>
                      <input type="url" value={designFileUrl} onChange={(event) => setDesignFileUrl(event.target.value)} placeholder="Figma / Canva / Google Drive / lainnya" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" />
                      <button onClick={() => saveDesignFile(selectedItem)} disabled={designSaving} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{designSaving ? "Menyimpan..." : "Simpan Link Design"}</button>
                      {selectedItem.designFileUrl && <a href={selectedItem.designFileUrl} target="_blank" rel="noreferrer" className="mt-2 block w-full rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800">Buka File Design ↗</a>}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Derivative QC</p><p className="mt-2 text-sm leading-6 text-violet-900">{selectedItem.humanQcStatus === "approved" ? "Human QC derivative approved. Item siap dijadwalkan/dipublikasikan." : "Derivative belum Human QC approved."}</p></div>
                  )}

                  <button onClick={() => router.push(selectedItem.sourceType === "master" ? `/brief/${selectedItem.briefId}` : `/brief/${selectedItem.briefId}/expansion/${selectedItem.sourceType}`)} className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">Buka {channelLabel(selectedItem.sourceType)} Brief →</button>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Workflow</h2><span className="text-xs text-slate-400">{visibleItems.length} scheduled</span></div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-500"><p>1. Finalkan Master Social Brief + Human QC.</p><p>2. Buat LinkedIn / SEO derivative.</p><p>3. Edit → Check Alignment → Human QC derivative.</p><p>4. Simpan jadwal masing-masing channel.</p><p>5. Geser jadwal kapan pun dari calendar.</p></div>
            </div>
          </aside>
        </div>
      </main>
    </AuthGuard>
  );
}
