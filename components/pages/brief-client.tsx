"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useParams, useRouter } from "next/navigation";

import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type SectionRow = {
  id: string;
  sequence_no: number;
  section_type: string;
  purpose: string | null;
  headline: string | null;
  supporting_copy: string | null;
  evidence_needed: string | null;
  visual_direction: string | null;
  transition_to_next: string | null;
};

type SourceRow = {
  publisher: string | null;
  title: string | null;
  url: string;
  fact_notes: string | null;
};

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function BriefClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [brief, setBrief] = useState<any>(null);
  const [idea, setIdea] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [researchCase, setResearchCase] = useState<any>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [review, setReview] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [improving, setImproving] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SectionRow | null>(null);
  const [savingSlide, setSavingSlide] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [qcSaving, setQcSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const briefRes = await supabase
      .from("content_briefs")
      .select("*")
      .eq("id", id)
      .single();
    if (briefRes.error || !briefRes.data) {
      setError(briefRes.error?.message || "Brief tidak ditemukan.");
      setLoading(false);
      return;
    }

    const briefData = briefRes.data;
    setBrief(briefData);

    const sectionRes = await supabase
      .from("brief_sections")
      .select("*")
      .eq("content_brief_id", id)
      .order("sequence_no", { ascending: true });

    setSections((sectionRes.data ?? []) as SectionRow[]);

    const reviewRes = await supabase
      .from("quality_reviews")
      .select("*")
      .eq("content_brief_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    setReview(reviewRes.data?.[0] ?? null);

    const ideaRes = await supabase
      .from("content_ideas")
      .select("*")
      .eq("id", briefData.content_idea_id)
      .single();

    const ideaData = ideaRes.data;
    setIdea(ideaData);

    if (!ideaData) {
      setLoading(false);
      return;
    }

    const campaignRes = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", ideaData.campaign_id)
      .single();

    const campaignData = campaignRes.data;
    setCampaign(campaignData);

    if (campaignData) {
      const brandRes = await supabase
        .from("brands")
        .select("*")
        .eq("id", campaignData.brand_id)
        .single();
      setBrand(brandRes.data);
    }

    if (ideaData.research_case_id) {
      const caseRes = await supabase
        .from("research_cases")
        .select("*")
        .eq("id", ideaData.research_case_id)
        .single();

      setResearchCase(caseRes.data);

      const sourceRes = await supabase
        .from("research_sources")
        .select("publisher,title,url,fact_notes")
        .eq("research_case_id", ideaData.research_case_id)
        .order("source_rank", { ascending: true });

      setSources((sourceRes.data ?? []) as SourceRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullText = useMemo(() => {
    if (!brief) return "";

    const lines = [
      `FINAL STORYTELLING BRIEF`,
      `Brand: ${brand?.name || "—"}`,
      `Campaign: ${campaign?.name || "—"}`,
      `Format: ${idea?.recommended_format || "—"}`,
      `Quality Score: ${Number(brief.final_score || 0).toFixed(0)}/100`,
      brief?.human_qc_status === "approved"
        ? `Human QC: APPROVED`
        : `Human QC: PENDING`,
      brief?.scheduled_for
        ? `Scheduled: ${formatDateLabel(brief.scheduled_for)}`
        : `Scheduled: —`,
      ``,
      `WORKING TITLE`,
      idea?.working_title || "—",
      ``,
      `CONTENT OBJECTIVE`,
      brief.content_objective || "—",
      ``,
      `TARGET AUDIENCE`,
      brief.target_audience || "—",
      ``,
      `EDITORIAL THESIS`,
      brief.editorial_thesis || "—",
      ``,
      `CASE / EVIDENCE`,
      brief.case_evidence || "—",
      ``,
      `TENSION`,
      brief.tension || "—",
      ``,
      `CORE INSIGHT`,
      brief.core_insight || "—",
      ``,
      `BRAND POV`,
      brief.brand_pov || "—",
      ``,
      `CAPABILITY BRIDGE`,
      brief.capability_bridge || "—",
      ``,
      `STORY ARC`,
      brief.story_arc || "—",
      ``,
      `CTA`,
      brief.cta || "—",
      ``,
      `STORY SEQUENCE`,
      ...sections.flatMap((section) => [
        ``,
        `${section.section_type.toUpperCase()} ${section.sequence_no} — ${section.purpose || ""}`,
        `Headline: ${section.headline || "—"}`,
        `Copy: ${section.supporting_copy || "—"}`,
        `Evidence: ${section.evidence_needed || "—"}`,
        `Visual: ${section.visual_direction || "—"}`,
        `Transition: ${section.transition_to_next || "—"}`,
      ]),
      ``,
      `FACT CHECK NOTES`,
      brief.fact_check_notes || "—",
      ``,
      `SOURCES`,
      ...sources.map(
        (source, index) =>
          `[S${index + 1}] ${source.publisher || "Source"} — ${source.title || "Untitled"} — ${source.url}`,
      ),
    ];

    return lines.join("\n");
  }, [brief, brand, campaign, idea, sections, sources]);

  async function copyBrief() {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function invalidateHumanQc() {
    const supabase = createClient();
    const { error: qcError } = await supabase
      .from("content_briefs")
      .update({
        human_qc_status: "pending",
        human_qc_at: null,
      })
      .eq("id", id);

    if (qcError) throw qcError;

    setBrief((current: any) =>
      current
        ? {
            ...current,
            human_qc_status: "pending",
            human_qc_at: null,
          }
        : current,
    );
  }

  function beginEdit(section: SectionRow) {
    setEditingId(section.id);
    setEditDraft({ ...section });
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveSlide() {
    if (!editDraft) return;

    setSavingSlide(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const payload = {
        purpose: editDraft.purpose,
        headline: editDraft.headline,
        supporting_copy: editDraft.supporting_copy,
        evidence_needed: editDraft.evidence_needed,
        visual_direction: editDraft.visual_direction,
        transition_to_next: editDraft.transition_to_next,
      };

      const { error: updateError } = await supabase
        .from("brief_sections")
        .update(payload)
        .eq("id", editDraft.id);

      if (updateError) throw updateError;

      setSections((current) =>
        current.map((section) =>
          section.id === editDraft.id ? { ...section, ...payload } : section,
        ),
      );

      await invalidateHumanQc();
      setEditingId(null);
      setEditDraft(null);
      setMessage(
        "Slide berhasil disimpan. Human QC perlu dilakukan ulang sebelum final scheduling.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan slide.");
    } finally {
      setSavingSlide(false);
    }
  }

  async function persistOrder(nextSections: SectionRow[]) {
    if (!nextSections.length) {
      setSections([]);
      return;
    }

    setSavingOrder(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      // Temporary sequence numbers avoid the unique(content_brief_id, sequence_no) collision.
      const tempBase = 1000;
      const tempResults = await Promise.all(
        nextSections.map((section, index) =>
          supabase
            .from("brief_sections")
            .update({ sequence_no: tempBase + index })
            .eq("id", section.id),
        ),
      );

      const tempError = tempResults.find((result) => result.error)?.error;
      if (tempError) throw tempError;

      const finalResults = await Promise.all(
        nextSections.map((section, index) =>
          supabase
            .from("brief_sections")
            .update({ sequence_no: index + 1 })
            .eq("id", section.id),
        ),
      );

      const finalError = finalResults.find((result) => result.error)?.error;
      if (finalError) throw finalError;

      const normalized = nextSections.map((section, index) => ({
        ...section,
        sequence_no: index + 1,
      }));

      setSections(normalized);
      await invalidateHumanQc();
      setMessage(
        "Urutan slide diperbarui. Human QC ditandai perlu dilakukan ulang.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengubah urutan slide.",
      );
      await load();
    } finally {
      setSavingOrder(false);
      setDraggingId(null);
      setDragOverId(null);
    }
  }

  async function moveSection(sectionId: string, direction: -1 | 1) {
    const index = sections.findIndex((section) => section.id === sectionId);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= sections.length) return;

    const next = [...sections];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await persistOrder(next);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, sectionId: string) {
    if (editingId || savingOrder) {
      event.preventDefault();
      return;
    }

    setDraggingId(sectionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionId);
  }

  async function handleDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();

    const sourceId = event.dataTransfer.getData("text/plain") || draggingId;
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const sourceIndex = sections.findIndex(
      (section) => section.id === sourceId,
    );
    const targetIndex = sections.findIndex(
      (section) => section.id === targetId,
    );

    if (sourceIndex < 0 || targetIndex < 0) return;

    const next = [...sections];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);

    await persistOrder(next);
  }

  async function deleteSlide(section: SectionRow) {
    const confirmed = window.confirm(
      `Hapus Slide ${section.sequence_no}? Tindakan ini tidak dapat dibatalkan.`,
    );
    if (!confirmed) return;

    setSavingOrder(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("brief_sections")
        .delete()
        .eq("id", section.id);

      if (deleteError) throw deleteError;

      const remaining = sections.filter((item) => item.id !== section.id);
      if (remaining.length) {
        await persistOrder(remaining);
      } else {
        setSections([]);
        await invalidateHumanQc();
      }

      setMessage(
        "Slide dihapus dan urutan dinormalisasi. Human QC perlu dilakukan ulang.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus slide.");
      await load();
    } finally {
      setSavingOrder(false);
    }
  }

  async function approveHumanQc() {
    setQcSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error: qcError } = await supabase
        .from("content_briefs")
        .update({
          human_qc_status: "approved",
          human_qc_at: now,
          status: "approved",
        })
        .eq("id", id);

      if (qcError) throw qcError;

      setBrief((current: any) => ({
        ...current,
        human_qc_status: "approved",
        human_qc_at: now,
        status: "approved",
      }));

      setMessage("Human QC disetujui. Brief sekarang siap dijadwalkan.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan Human QC.",
      );
    } finally {
      setQcSaving(false);
    }
  }

  function openSchedule() {
    if (brief?.human_qc_status !== "approved") {
      setError("Brief harus lolos Human QC sebelum dijadwalkan.");
      return;
    }

    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    setScheduleDate(brief?.scheduled_for || local);
    setScheduleOpen(true);
    setError("");
    setMessage("");
  }

  async function saveSchedule() {
    if (!scheduleDate) {
      setError("Pilih tanggal publikasi.");
      return;
    }

    setScheduleSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: scheduleError } = await supabase
        .from("content_briefs")
        .update({
          scheduled_for: scheduleDate,
          status: "approved",
        })
        .eq("id", id);

      if (scheduleError) throw scheduleError;

      setBrief((current: any) => ({
        ...current,
        scheduled_for: scheduleDate,
        status: "approved",
      }));

      setScheduleOpen(false);
      setMessage(`Brief dijadwalkan untuk ${formatDateLabel(scheduleDate)}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menjadwalkan brief.",
      );
    } finally {
      setScheduleSaving(false);
    }
  }

  async function improve() {
    setImproving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: id, notes }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Improve gagal.");
      }

      if (payload.applied) {
        const supabase = createClient();
        await supabase
          .from("content_briefs")
          .update({
            human_qc_status: "pending",
            human_qc_at: null,
          })
          .eq("id", id);
      }

      setMessage(
        payload.message ||
          (payload.applied
            ? "Brief diperbaiki. Human QC perlu dilakukan ulang."
            : "Versi lama dipertahankan."),
      );

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Improve gagal.");
    } finally {
      setImproving(false);
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen grid place-items-center text-sm text-slate-500">
          Loading final brief...
        </div>
      </AuthGuard>
    );
  }

  if (!brief) {
    return (
      <AuthGuard>
        <div className="min-h-screen grid place-items-center text-red-600">
          {error || "Brief tidak ditemukan."}
        </div>
      </AuthGuard>
    );
  }

  const score = Number(brief.final_score || review?.total_score || 0);
  const qcApproved = brief?.human_qc_status === "approved";

  return (
    <AuthGuard>
      <AppHeader />

      <main className="app-workspace mx-auto max-w-[calc(72rem+16rem)] px-5 py-6 lg:px-8 lg:py-7">
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <button
            onClick={() => router.push(`/campaign/${idea?.campaign_id}`)}
            className="text-sm font-medium text-slate-500 transition hover:text-blue-600"
          >
            ← Story Angles
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyBrief}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied ✓" : "Copy Full Brief"}
            </button>

            <button
              onClick={() => window.print()}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </button>

            <button
              onClick={openSchedule}
              disabled={!qcApproved}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {brief?.scheduled_for ? "Ubah Jadwal" : "Jadwalkan Brief"}
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className="no-print mb-6 space-y-2">
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

        <section className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div>
              <div className="inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                Editorial production brief
              </div>
              <h1 className="mt-2 max-w-4xl text-2xl font-bold leading-snug tracking-tight text-slate-950 md:text-3xl">
                {idea?.working_title}
              </h1>
              <p className="mt-3 text-sm text-slate-500">
                {brand?.name} · {campaign?.product_or_program} ·{" "}
                {idea?.recommended_format}
              </p>
            </div>

            <div
              className={`min-w-24 rounded-xl border px-4 py-3 text-center ${
                score >= 90
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : score >= 85
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <div className="text-2xl font-bold">{score.toFixed(0)}</div>
              <div className="text-xs font-semibold">/100 AI Quality</div>
            </div>
          </div>

          <div className="mt-6 grid overflow-hidden rounded-xl border border-slate-200 md:grid-cols-2">
            {[
              ["Content Objective", brief.content_objective],
              ["Target Audience", brief.target_audience],
              ["Editorial Thesis", brief.editorial_thesis],
              ["Why This Case", brief.why_this_case],
              ["Tension", brief.tension],
              ["Core Insight", brief.core_insight],
              ["Brand POV", brief.brand_pov],
              ["Capability Bridge", brief.capability_bridge],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="border-b border-slate-100 p-4 last:border-b-0 md:odd:border-r"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-800">
                  {value || "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
              Case Evidence
            </p>
            <p className="mt-2 text-sm leading-6">{brief.case_evidence}</p>
          </div>
        </section>

        <section
          className={`no-print mt-5 rounded-2xl border p-5 shadow-sm md:p-6 ${qcApproved ? "border-emerald-200 bg-emerald-50/40" : "border-blue-200 bg-blue-50/40"}`}
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Human Quality Control
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    qcApproved
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {qcApproved ? "QC Approved ✓" : "Belum QC"}
                </span>
                {brief?.scheduled_for && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {formatDateLabel(brief.scheduled_for)}
                  </span>
                )}
              </div>

              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Final check sebelum masuk kalender.
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Setelah headline, body copy, evidence, visual direction, dan
                urutan slide sudah final, tandai Human QC. Setiap edit setelah
                QC akan otomatis mengembalikan status menjadi perlu QC ulang.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!qcApproved && (
                <button
                  onClick={approveHumanQc}
                  disabled={qcSaving}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {qcSaving ? "Menyimpan QC..." : "Tandai Lolos Human QC"}
                </button>
              )}

              {qcApproved && (
                <button
                  onClick={openSchedule}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {brief?.scheduled_for
                    ? "Ubah Jadwal Brief"
                    : "Jadwalkan Brief"}
                </button>
              )}

              {brief?.scheduled_for && (
                <button
                  onClick={() => router.push("/calendar")}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  Buka Content Calendar →
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Designer-ready · Human editable
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                Story Sequence{" "}
                <span className="font-medium text-slate-400">
                  ({sections.length})
                </span>
              </h2>
              <p className="no-print mt-2 text-sm text-slate-500">
                Drag & drop untuk mengubah urutan. Gunakan Edit untuk mengubah
                headline, body copy, evidence, visual direction, dan transition.
                Gunakan ↑ ↓ sebagai alternatif drag.
              </p>
            </div>

            {savingOrder && (
              <span className="no-print rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Menyimpan urutan...
              </span>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {sections.map((section, index) => {
              const editing = editingId === section.id && editDraft;

              return (
                <article
                  key={section.id}
                  draggable={!editingId && !savingOrder}
                  onDragStart={(event) => handleDragStart(event, section.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverId(section.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === section.id) setDragOverId(null);
                  }}
                  onDrop={(event) => handleDrop(event, section.id)}
                  className={`print-card overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                    draggingId === section.id
                      ? "opacity-50"
                      : dragOverId === section.id
                        ? "border-blue-400 ring-4 ring-blue-50"
                        : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                        {String(section.sequence_no).padStart(2, "0")}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                        {section.section_type}
                      </span>
                      {section.purpose && !editing && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                          {section.purpose}
                        </span>
                      )}
                    </div>

                    <div className="no-print flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => moveSection(section.id, -1)}
                        disabled={
                          index === 0 || savingOrder || Boolean(editingId)
                        }
                        title="Geser ke atas"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSection(section.id, 1)}
                        disabled={
                          index === sections.length - 1 ||
                          savingOrder ||
                          Boolean(editingId)
                        }
                        title="Geser ke bawah"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-30"
                      >
                        ↓
                      </button>

                      {!editing && (
                        <button
                          onClick={() => beginEdit(section)}
                          disabled={savingOrder}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Edit Slide
                        </button>
                      )}

                      <button
                        onClick={() => deleteSlide(section)}
                        disabled={savingOrder || Boolean(editingId)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-40"
                      >
                        Hapus
                      </button>

                      <span
                        title="Drag untuk mengurutkan"
                        className="hidden cursor-grab select-none rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-400 md:inline"
                      >
                        ⋮⋮
                      </span>
                    </div>
                  </div>

                  {editing && editDraft ? (
                    <div className="no-print space-y-4 p-5 md:p-6">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Purpose
                        </label>
                        <input
                          value={editDraft.purpose || ""}
                          onChange={(event) =>
                            setEditDraft({
                              ...editDraft,
                              purpose: event.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Headline
                        </label>
                        <textarea
                          value={editDraft.headline || ""}
                          onChange={(event) =>
                            setEditDraft({
                              ...editDraft,
                              headline: event.target.value,
                            })
                          }
                          className="min-h-24 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-base font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Body Copy
                        </label>
                        <textarea
                          value={editDraft.supporting_copy || ""}
                          onChange={(event) =>
                            setEditDraft({
                              ...editDraft,
                              supporting_copy: event.target.value,
                            })
                          }
                          className="min-h-36 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Evidence
                          </label>
                          <textarea
                            value={editDraft.evidence_needed || ""}
                            onChange={(event) =>
                              setEditDraft({
                                ...editDraft,
                                evidence_needed: event.target.value,
                              })
                            }
                            className="min-h-28 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Visual Direction
                          </label>
                          <textarea
                            value={editDraft.visual_direction || ""}
                            onChange={(event) =>
                              setEditDraft({
                                ...editDraft,
                                visual_direction: event.target.value,
                              })
                            }
                            className="min-h-28 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Transition to Next
                        </label>
                        <textarea
                          value={editDraft.transition_to_next || ""}
                          onChange={(event) =>
                            setEditDraft({
                              ...editDraft,
                              transition_to_next: event.target.value,
                            })
                          }
                          className="min-h-24 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                        />
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          disabled={savingSlide}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          onClick={saveSlide}
                          disabled={savingSlide}
                          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingSlide ? "Menyimpan..." : "Simpan Slide"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 md:p-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Headline
                      </p>
                      <h3 className="mt-2 text-xl font-bold leading-snug text-slate-950 md:text-2xl">
                        {section.headline}
                      </h3>
                      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Body copy
                      </p>
                      <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-700">
                        {section.supporting_copy}
                      </p>

                      <div className="mt-5 grid overflow-hidden rounded-xl border border-slate-200 md:grid-cols-3">
                        <div className="border-b border-slate-200 bg-emerald-50/40 p-4 md:border-b-0 md:border-r">
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                            Evidence
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-700">
                            {section.evidence_needed || "—"}
                          </p>
                        </div>

                        <div className="border-b border-slate-200 bg-blue-50/40 p-4 md:border-b-0 md:border-r">
                          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                            Visual direction
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-700">
                            {section.visual_direction || "—"}
                          </p>
                        </div>

                        <div className="bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Transition
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-700">
                            {section.transition_to_next || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_.9fr]">
          <div className="print-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Fact Check & Sources</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {brief.fact_check_notes || "—"}
            </p>

            <div className="mt-5 space-y-3">
              {sources.map((source, index) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-slate-200 p-4 hover:border-blue-300"
                >
                  <p className="text-xs font-semibold text-blue-600">
                    [S{index + 1}] {source.publisher || "Source"}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {source.title || source.url}
                  </p>
                  {source.fact_notes && (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {source.fact_notes}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>

          <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
              Improve with AI
            </p>
            <h2 className="mt-3 text-2xl font-bold">
              Perbaiki hanya bagian yang lemah.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              AI membaca score + reviewer notes + source evidence. Versi baru
              hanya diterapkan jika skornya tidak turun.
            </p>

            {review?.reviewer_notes && (
              <div className="mt-5 max-h-44 overflow-auto rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
                {review.reviewer_notes}
              </div>
            )}

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-4 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              placeholder="Opsional: contoh ‘perkuat Slide 4-5, jangan ubah hook, CTA lebih soft’."
            />

            <button
              onClick={improve}
              disabled={improving}
              className="mt-4 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {improving
                ? "Improving & re-scoring..."
                : "Improve Brief with AI"}
            </button>
          </div>
        </section>
      </main>

      {scheduleOpen && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                  Content Calendar
                </p>
                <h2 className="mt-2 text-2xl font-bold">Jadwalkan Brief</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Pilih tanggal publikasi. Setelah masuk calendar, jadwal masih
                  bisa digeser dengan drag & drop.
                </p>
              </div>

              <button
                onClick={() => setScheduleOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <label className="mt-6 block text-sm font-semibold">
              Tanggal publikasi
            </label>
            <input
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            />

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setScheduleOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={saveSchedule}
                disabled={scheduleSaving || !scheduleDate}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {scheduleSaving ? "Menjadwalkan..." : "Simpan ke Calendar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
