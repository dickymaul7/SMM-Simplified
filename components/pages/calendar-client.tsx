"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

const APP_MARKER = "__storybrief_lite__";

type CalendarItem = {
  briefId: string;
  ideaId: string;
  campaignId: string;
  brandId: string;
  title: string;
  format: string | null;
  campaignName: string;
  brandName: string;
  scheduledFor: string;
  humanQcStatus: string | null;
  score: number;
  designStatus: "ready_to_design" | "designed";
  designFileUrl: string | null;
};

const weekdayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function localDateString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export default function CalendarClient() {
  const router = useRouter();
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
      const ideaIds = Array.from(
        new Set(briefRows.map((row: any) => row.content_idea_id).filter(Boolean)),
      );

      if (!ideaIds.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: ideas, error: ideaError } = await supabase
        .from("content_ideas")
        .select("id,campaign_id,working_title,recommended_format")
        .in("id", ideaIds);

      if (ideaError) throw ideaError;

      const ideaRows = ideas ?? [];
      const campaignIds = Array.from(
        new Set(ideaRows.map((row: any) => row.campaign_id).filter(Boolean)),
      );

      if (!campaignIds.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: campaigns, error: campaignError } = await supabase
        .from("campaigns")
        .select("id,brand_id,name,priority_topics")
        .in("id", campaignIds)
        .contains("priority_topics", [APP_MARKER]);

      if (campaignError) throw campaignError;

      const campaignRows = campaigns ?? [];
      const brandIds = Array.from(
        new Set(campaignRows.map((row: any) => row.brand_id).filter(Boolean)),
      );

      const { data: brands, error: brandError } = brandIds.length
        ? await supabase.from("brands").select("id,name").in("id", brandIds)
        : { data: [], error: null };

      if (brandError) throw brandError;

      const ideaMap = new Map<string, any>(ideaRows.map((row: any) => [row.id, row]));
      const campaignMap = new Map<string, any>(campaignRows.map((row: any) => [row.id, row]));
      const brandMap = new Map<string, any>((brands ?? []).map((row: any) => [row.id, row]));

      const result: CalendarItem[] = [];

      for (const row of briefRows as any[]) {
        const idea = ideaMap.get(row.content_idea_id);
        if (!idea) continue;

        const campaign = campaignMap.get(idea.campaign_id);
        if (!campaign) continue;

        const brand = brandMap.get(campaign.brand_id);

        result.push({
          briefId: row.id,
          ideaId: idea.id,
          campaignId: campaign.id,
          brandId: campaign.brand_id,
          title: idea.working_title || "Untitled content",
          format: idea.recommended_format,
          campaignName: campaign.name || "Campaign",
          brandName: brand?.name || "Brand",
          scheduledFor: row.scheduled_for,
          humanQcStatus: row.human_qc_status,
          score: Number(row.final_score || 0),
          designStatus:
            row.design_status === "designed" ? "designed" : "ready_to_design",
          designFileUrl: row.design_file_url || null,
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
    loadCalendar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const calendarCells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    // Monday = 0 ... Sunday = 6
    const leading = (firstDay.getDay() + 6) % 7;
    const total = Math.ceil((leading + daysInMonth) / 7) * 7;

    return Array.from({ length: total }, (_, index) => {
      const dayNumber = index - leading + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;

      const date = new Date(year, monthIndex, dayNumber);
      return {
        date,
        dateString: localDateString(date),
        dayNumber,
      };
    });
  }, [month]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const item of items) {
      const existing = map.get(item.scheduledFor) ?? [];
      existing.push(item);
      map.set(item.scheduledFor, existing);
    }

    return map;
  }, [items]);

  const selectedItem = items.find((item) => item.briefId === selectedId) ?? null;

  async function moveBrief(briefId: string, dateString: string) {
    const current = items.find((item) => item.briefId === briefId);
    if (!current || current.scheduledFor === dateString) {
      setDraggingId(null);
      setDragOverDate(null);
      return;
    }

    setMovingId(briefId);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("content_briefs")
        .update({ scheduled_for: dateString })
        .eq("id", briefId);

      if (updateError) throw updateError;

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.briefId === briefId ? { ...item, scheduledFor: dateString } : item,
        ),
      );

      if (selectedId === briefId) setQuickMoveDate(dateString);
      setMessage(`Jadwal dipindahkan ke ${formatShortDate(dateString)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memindahkan jadwal.");
    } finally {
      setMovingId(null);
      setDraggingId(null);
      setDragOverDate(null);
    }
  }

  function onCardDragStart(event: DragEvent<HTMLElement>, briefId: string) {
    setDraggingId(briefId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", briefId);
  }

  async function onDayDrop(event: DragEvent<HTMLElement>, dateString: string) {
    event.preventDefault();
    const briefId = event.dataTransfer.getData("text/plain") || draggingId;
    if (!briefId) return;
    await moveBrief(briefId, dateString);
  }

  function chooseItem(item: CalendarItem) {
    setSelectedId(item.briefId);
    setQuickMoveDate(item.scheduledFor);
    setDesignFileUrl(item.designFileUrl || "");
    setMessage("");
    setError("");
  }

  async function setDesignStatus(
    item: CalendarItem,
    nextStatus: "ready_to_design" | "designed",
  ) {
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

      setItems((currentItems) =>
        currentItems.map((current) =>
          current.briefId === item.briefId
            ? { ...current, designStatus: nextStatus }
            : current,
        ),
      );

      setMessage(
        nextStatus === "designed"
          ? "Status diubah menjadi Designed."
          : "Status diubah menjadi Ready to Design.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah design status.");
    } finally {
      setDesignSaving(false);
    }
  }

  async function saveDesignFile(item: CalendarItem) {
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

      setItems((currentItems) =>
        currentItems.map((current) =>
          current.briefId === item.briefId
            ? { ...current, designFileUrl: value || null }
            : current,
        ),
      );

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
  const monthItems = items.filter((item) => item.scheduledFor.startsWith(monthPrefix));

  return (
    <AuthGuard>
      <AppHeader />

      <main className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6 lg:py-10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Planning Workspace
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Content Calendar
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Brief yang sudah dijadwalkan akan muncul di sini. Drag kartu ke tanggal lain untuk
              mengubah jadwal tanpa membuka brief satu per satu.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={goPreviousMonth}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
            >
              ← Bulan lalu
            </button>
            <button
              onClick={goToday}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
            >
              Hari ini
            </button>
            <button
              onClick={goNextMonth}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
            >
              Bulan berikut →
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className="mt-5 space-y-2">
            {message && (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5">
              <div>
                <h2 className="text-xl font-bold capitalize">{monthTitle(month)}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {monthItems.length} content terjadwal bulan ini
                </p>
              </div>

              {loading && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Loading...
                </span>
              )}
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarCells.map((cell, index) => {
                if (!cell) {
                  return (
                    <div
                      key={`blank-${index}`}
                      className="min-h-32 border-b border-r border-slate-100 bg-slate-50/40 md:min-h-40"
                    />
                  );
                }

                const dayItems = itemsByDate.get(cell.dateString) ?? [];
                const today = cell.dateString === localDateString(new Date());

                return (
                  <div
                    key={cell.dateString}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverDate(cell.dateString);
                    }}
                    onDragLeave={() => {
                      if (dragOverDate === cell.dateString) setDragOverDate(null);
                    }}
                    onDrop={(event) => onDayDrop(event, cell.dateString)}
                    className={`min-h-32 border-b border-r border-slate-100 p-2 transition md:min-h-40 ${
                      dragOverDate === cell.dateString
                        ? "bg-blue-50 ring-2 ring-inset ring-blue-300"
                        : "bg-white"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
                          today ? "bg-blue-600 text-white" : "text-slate-500"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {dayItems.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-300">
                          {dayItems.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {dayItems.map((item) => (
                        <article
                          key={item.briefId}
                          draggable
                          onDragStart={(event) => onCardDragStart(event, item.briefId)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverDate(null);
                          }}
                          onClick={() => chooseItem(item)}
                          className={`cursor-grab rounded-xl border p-2.5 text-left shadow-sm transition ${
                            draggingId === item.briefId
                              ? "opacity-40"
                              : selectedId === item.briefId
                                ? "border-blue-400 bg-blue-50"
                                : "border-slate-200 bg-white hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                              {item.brandName}
                            </span>
                            {movingId === item.briefId && (
                              <span className="text-[9px] text-slate-400">saving...</span>
                            )}
                          </div>

                          <p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-4 text-slate-800">
                            {item.title}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500">
                              {item.format || "content"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] ${
                                item.humanQcStatus === "approved"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-amber-50 text-amber-600"
                              }`}
                            >
                              {item.humanQcStatus === "approved" ? "QC ✓" : "QC ulang"}
                            </span>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                item.designStatus === "designed"
                                  ? "bg-violet-50 text-violet-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {item.designStatus === "designed"
                                ? "Designed ✓"
                                : "Ready to Design"}
                            </span>

                            {item.designFileUrl && (
                              <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[9px] font-semibold text-white">
                                File ↗
                              </span>
                            )}
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
            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                Drag & Drop
              </p>
              <h2 className="mt-2 text-xl font-bold">Geser jadwal langsung di calendar.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Tarik kartu content dari satu tanggal ke tanggal lainnya. Perubahan langsung
                disimpan ke Supabase.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Quick Move</h2>
              {!selectedItem ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Klik salah satu kartu content untuk memindahkan ke tanggal lain, termasuk bulan
                  yang berbeda.
                </p>
              ) : (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    {selectedItem.brandName}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5">{selectedItem.title}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Saat ini: {formatShortDate(selectedItem.scheduledFor)}
                  </p>

                  <input
                    type="date"
                    value={quickMoveDate}
                    onChange={(event) => setQuickMoveDate(event.target.value)}
                    className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />

                  <button
                    onClick={() => moveBrief(selectedItem.briefId, quickMoveDate)}
                    disabled={!quickMoveDate || movingId === selectedItem.briefId}
                    className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {movingId === selectedItem.briefId ? "Memindahkan..." : "Pindahkan Tanggal"}
                  </button>

                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Design Status
                        </p>
                        <p
                          className={`mt-1 text-sm font-bold ${
                            selectedItem.designStatus === "designed"
                              ? "text-violet-700"
                              : "text-blue-700"
                          }`}
                        >
                          {selectedItem.designStatus === "designed"
                            ? "Designed ✓"
                            : "Ready to Design"}
                        </p>
                      </div>

                      {selectedItem.designStatus === "designed" ? (
                        <button
                          onClick={() => setDesignStatus(selectedItem, "ready_to_design")}
                          disabled={designSaving}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          Set Ready
                        </button>
                      ) : (
                        <button
                          onClick={() => setDesignStatus(selectedItem, "designed")}
                          disabled={designSaving}
                          className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          Mark Designed
                        </button>
                      )}
                    </div>

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Link File Design
                    </label>
                    <input
                      type="url"
                      value={designFileUrl}
                      onChange={(event) => setDesignFileUrl(event.target.value)}
                      placeholder="Figma / Canva / Google Drive / lainnya"
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    />

                    <button
                      onClick={() => saveDesignFile(selectedItem)}
                      disabled={designSaving}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      {designSaving ? "Menyimpan..." : "Simpan Link Design"}
                    </button>

                    {selectedItem.designFileUrl && (
                      <a
                        href={selectedItem.designFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block w-full rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Buka File Design ↗
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => router.push(`/brief/${selectedItem.briefId}`)}
                    className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    Buka Full Brief →
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Workflow</h2>
                <span className="text-xs text-slate-400">{items.length} scheduled</span>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-500">
                <p>1. Edit & urutkan slide di Full Brief.</p>
                <p>2. Tandai <strong className="text-slate-800">Lolos Human QC</strong>.</p>
                <p>3. Klik <strong className="text-slate-800">Jadwalkan Brief</strong>.</p>
                <p>4. Geser jadwal kapan pun dari Content Calendar.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </AuthGuard>
  );
}
