"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import AppHeader from "@/components/app-header";
import AuthGuard from "@/components/auth-guard";
import { createClient } from "@/lib/supabase/client";

type Channel = "linkedin" | "seo_article";

type AlignmentReport = {
  overall: number;
  core_message: number;
  audience: number;
  brand_pov: number;
  facts_claims: number;
  channel_fit: number;
  verdict: string;
  risks: string[];
  recommendations: string[];
};

type ExpansionRow = {
  id: string;
  content_brief_id: string;
  channel: Channel;
  status: "draft" | "needs_review" | "final";
  content: Record<string, any>;
  alignment_report: AlignmentReport | null;
  master_qc_at: string | null;
  human_qc_status: "pending" | "approved";
  human_qc_at: string | null;
  updated_at: string;
};

function isChannel(value: string): value is Channel {
  return value === "linkedin" || value === "seo_article";
}

function sameMoment(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function linesToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function FieldLabel({ title, helper }: { title: string; helper?: string }) {
  return (
    <div className="mb-2">
      <label className="text-sm font-semibold text-slate-800">{title}</label>
      {helper && <p className="mt-0.5 text-xs leading-5 text-slate-500">{helper}</p>}
    </div>
  );
}

function scoreClass(score: number) {
  if (score >= 90) return "bg-emerald-50 text-emerald-700";
  if (score >= 85) return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-700";
}

export default function ContentExpansionEditor() {
  const { id, channel: channelParam } = useParams<{ id: string; channel: string }>();
  const router = useRouter();
  const channel = isChannel(channelParam) ? channelParam : null;

  const [brief, setBrief] = useState<any>(null);
  const [idea, setIdea] = useState<any>(null);
  const [expansion, setExpansion] = useState<ExpansionRow | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!channel) {
      setError("Channel Content Expansion tidak valid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const briefResult = await supabase
      .from("content_briefs")
      .select("id,content_idea_id,human_qc_status,human_qc_at,status")
      .eq("id", id)
      .single();

    if (briefResult.error || !briefResult.data) {
      setError(briefResult.error?.message || "Master brief tidak ditemukan.");
      setLoading(false);
      return;
    }

    const expansionResult = await supabase
      .from("content_expansions")
      .select("*")
      .eq("content_brief_id", id)
      .eq("channel", channel)
      .single();

    if (expansionResult.error || !expansionResult.data) {
      setError(
        expansionResult.error?.code === "42P01"
          ? "Content Expansion belum aktif. Jalankan database/CONTENT_EXPANSION_V1.sql terlebih dahulu."
          : expansionResult.error?.message || "Derivative brief belum dibuat.",
      );
      setLoading(false);
      return;
    }

    setBrief(briefResult.data);
    setExpansion(expansionResult.data as ExpansionRow);
    setDraft((expansionResult.data.content ?? {}) as Record<string, any>);
    setDirty(false);

    if (briefResult.data.content_idea_id) {
      const ideaResult = await supabase
        .from("content_ideas")
        .select("working_title,recommended_format")
        .eq("id", briefResult.data.content_idea_id)
        .maybeSingle();
      setIdea(ideaResult.data ?? null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id, channelParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const masterApproved = brief?.human_qc_status === "approved" && Boolean(brief?.human_qc_at);
  const outOfSync = Boolean(
    expansion && (!masterApproved || !sameMoment(expansion.master_qc_at, brief?.human_qc_at)),
  );
  const alignmentScore = Number(expansion?.alignment_report?.overall ?? 0);
  const canFinalize = Boolean(
    expansion &&
      masterApproved &&
      !outOfSync &&
      !dirty &&
      alignmentScore >= 85 &&
      expansion.human_qc_status !== "approved",
  );

  const statusText = useMemo(() => {
    if (!expansion) return "—";
    if (dirty) return "Editing";
    if (expansion.status === "final" && expansion.human_qc_status === "approved") return "Final";
    if (expansion.status === "needs_review") return "Needs Review";
    return "Draft";
  }, [dirty, expansion]);

  function updateField(key: string, value: any) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage("");
    setError("");
  }

  async function persistDraft(silent = false) {
    if (!expansion) return false;
    setSaving(true);
    if (!silent) {
      setMessage("");
      setError("");
    }

    try {
      const supabase = createClient();
      const { error: saveError } = await supabase
        .from("content_expansions")
        .update({
          content: draft,
          status: "needs_review",
          human_qc_status: "pending",
          human_qc_at: null,
          alignment_report: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expansion.id);

      if (saveError) throw saveError;

      setExpansion((current) =>
        current
          ? {
              ...current,
              content: draft,
              status: "needs_review",
              human_qc_status: "pending",
              human_qc_at: null,
              alignment_report: null,
            }
          : current,
      );
      setDirty(false);
      if (!silent) {
        setMessage("Draft tersimpan. Karena konten berubah, Alignment Check dan Human QC derivative perlu dilakukan ulang.");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan draft.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function checkAlignment() {
    if (!channel || !expansion) return;
    setChecking(true);
    setError("");
    setMessage("");

    try {
      if (dirty) {
        const saved = await persistDraft(true);
        if (!saved) return;
      }

      const response = await fetch("/api/ai/expansion/alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: id, channel }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Alignment Check gagal.");
      }

      setExpansion((current) =>
        current
          ? {
              ...current,
              alignment_report: payload.alignment,
              master_qc_at: payload.masterQcAt,
            }
          : current,
      );
      setMessage(
        Number(payload.alignment?.overall ?? 0) >= 85
          ? "Alignment Check lolos. Derivative siap untuk Human QC final."
          : "Alignment belum mencapai 85. Review rekomendasi lalu edit kembali sebelum final.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Alignment Check gagal.");
    } finally {
      setChecking(false);
    }
  }

  async function approveFinal() {
    if (!expansion || !canFinalize) return;
    setApproving(true);
    setError("");
    setMessage("");

    try {
      const now = new Date().toISOString();
      const supabase = createClient();
      const { error: approveError } = await supabase
        .from("content_expansions")
        .update({
          status: "final",
          human_qc_status: "approved",
          human_qc_at: now,
          updated_at: now,
        })
        .eq("id", expansion.id);

      if (approveError) throw approveError;

      setExpansion((current) =>
        current
          ? {
              ...current,
              status: "final",
              human_qc_status: "approved",
              human_qc_at: now,
            }
          : current,
      );
      setMessage("Human QC derivative disetujui. Brief channel sekarang berstatus Final.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memfinalkan derivative brief.");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen grid place-items-center text-sm text-slate-500">Loading Content Expansion...</div>
      </AuthGuard>
    );
  }

  if (!channel || !expansion) {
    return (
      <AuthGuard>
        <AppHeader />
        <main className="app-workspace mx-auto max-w-5xl px-5 py-8 lg:px-8">
          <button onClick={() => router.push(`/brief/${id}`)} className="text-sm font-semibold text-blue-600">← Kembali ke Master Brief</button>
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "Derivative brief tidak ditemukan."}</div>
        </main>
      </AuthGuard>
    );
  }

  const isLinkedIn = channel === "linkedin";
  const researchGaps = stringList(draft.research_gaps);
  const alignment = expansion.alignment_report;

  return (
    <AuthGuard>
      <AppHeader />
      <main className="app-workspace mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end">
          <div>
            <button onClick={() => router.push(`/brief/${id}`)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">← Master Social Brief</button>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Content Expansion · Human Editable</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              {isLinkedIn ? "LinkedIn Content Brief" : "SEO Content Brief + Article"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {idea?.working_title || "Master content derivative"}. Semua field di bawah bisa diedit sebelum menjadi Final Brief.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{statusText}</span>
            {alignmentScore > 0 && <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${scoreClass(alignmentScore)}`}>Alignment {alignmentScore}/100</span>}
            {expansion.human_qc_status === "approved" && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Human QC ✓</span>}
          </div>
        </div>

        {(message || error) && (
          <div className="mt-5 space-y-2">
            {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          </div>
        )}

        {outOfSync && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <strong>Master Content Changed.</strong> Master Social Brief sudah berubah sejak derivative ini terakhir dibuat/dicek. Setelah Master Human QC kembali approved, jalankan <strong>Check Alignment</strong> untuk menyinkronkan review terhadap versi terbaru, atau regenerate dari halaman Master Brief.
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Editable Draft</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{isLinkedIn ? "LinkedIn Structure" : "SEO Strategy & Article"}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Edit manual tidak pernah mengubah Master Social Brief.</p>
            </div>

            {isLinkedIn ? (
              <div className="space-y-5">
                <div><FieldLabel title="Hook" helper="1-3 kalimat pembuka native LinkedIn." /><textarea rows={3} value={draft.hook || ""} onChange={(e) => updateField("hook", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Main Angle" /><textarea rows={3} value={draft.main_angle || ""} onChange={(e) => updateField("main_angle", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Body Copy" helper="Draft post LinkedIn lengkap dan tetap editable." /><textarea rows={18} value={draft.body_copy || ""} onChange={(e) => updateField("body_copy", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-7 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Key Takeaway" /><textarea rows={3} value={draft.key_takeaway || ""} onChange={(e) => updateField("key_takeaway", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="CTA" /><textarea rows={3} value={draft.cta || ""} onChange={(e) => updateField("cta", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Suggested Visual" /><textarea rows={4} value={draft.visual_direction || ""} onChange={(e) => updateField("visual_direction", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Hashtags" helper="Satu hashtag per baris." /><textarea rows={5} value={stringList(draft.hashtags).join("\n")} onChange={(e) => updateField("hashtags", linesToList(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div><FieldLabel title="Primary Keyword" /><input value={draft.primary_keyword || ""} onChange={(e) => updateField("primary_keyword", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                  <div><FieldLabel title="Search Intent" /><input value={draft.search_intent || ""} onChange={(e) => updateField("search_intent", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                </div>
                <div><FieldLabel title="Secondary Keywords" helper="Satu keyword per baris." /><textarea rows={5} value={stringList(draft.secondary_keywords).join("\n")} onChange={(e) => updateField("secondary_keywords", linesToList(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="SEO Title" /><input value={draft.seo_title || ""} onChange={(e) => updateField("seo_title", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Meta Description" /><textarea rows={3} value={draft.meta_description || ""} onChange={(e) => updateField("meta_description", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Slug" /><input value={draft.slug || ""} onChange={(e) => updateField("slug", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Article Angle" /><textarea rows={4} value={draft.article_angle || ""} onChange={(e) => updateField("article_angle", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="H1" /><input value={draft.h1 || ""} onChange={(e) => updateField("h1", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Article Outline" helper="Gunakan format H2: ... dan H3: ...; outline bisa diubah sebelum artikel difinalkan." /><textarea rows={12} value={draft.outline || ""} onChange={(e) => updateField("outline", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="Internal Link Suggestions" helper="Satu topik/halaman per baris. Tidak mengarang URL." /><textarea rows={5} value={stringList(draft.internal_link_suggestions).join("\n")} onChange={(e) => updateField("internal_link_suggestions", linesToList(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="CTA" /><textarea rows={3} value={draft.cta || ""} onChange={(e) => updateField("cta", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                <div><FieldLabel title="SEO Article Draft" helper="Full article draft. Kamu bebas mengedit headline, paragraf, struktur, dan wording sebelum Final." /><textarea rows={32} value={draft.article_draft || ""} onChange={(e) => updateField("article_draft", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-7 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-6">
              <FieldLabel title="Additional Research Required" helper="AI tidak boleh mengarang fakta tambahan. Kebutuhan data/source baru dicatat di sini." />
              <textarea rows={5} value={researchGaps.join("\n")} onChange={(e) => updateField("research_gaps", linesToList(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              <button type="button" onClick={() => void persistDraft(false)} disabled={!dirty || saving} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving..." : "Save Draft"}</button>
              <button type="button" onClick={() => void checkAlignment()} disabled={checking || saving || !masterApproved} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40">{checking ? "Checking Alignment..." : "Check Alignment"}</button>
              <button type="button" onClick={() => void approveFinal()} disabled={!canFinalize || approving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{approving ? "Finalizing..." : "Approve as Final Brief"}</button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Source Lineage</p>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-800">Master Social Brief</p><p className={`mt-1 text-xs ${masterApproved ? "text-emerald-700" : "text-amber-700"}`}>{masterApproved ? "Human QC Approved ✓" : "Human QC Pending"}</p></div>
                <div className="pl-4 text-slate-300">↓</div>
                <div className="rounded-xl bg-blue-50 p-3"><p className="font-semibold text-blue-900">{isLinkedIn ? "LinkedIn" : "SEO Article"}</p><p className="mt-1 text-xs text-blue-700">{statusText}</p></div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Content Alignment</p>{alignment && <span className={`rounded-full px-2 py-1 text-xs font-bold ${scoreClass(alignment.overall)}`}>{alignment.overall}</span>}</div>
              {!alignment ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">Belum ada alignment terbaru. Setelah mengedit, klik <strong>Check Alignment</strong> sebelum Final.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {[
                    ["Core Message", alignment.core_message],
                    ["Audience", alignment.audience],
                    ["Brand POV", alignment.brand_pov],
                    ["Facts & Claims", alignment.facts_claims],
                    ["Channel Fit", alignment.channel_fit],
                  ].map(([label, score]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><strong className="text-slate-900">{Number(score)}/100</strong></div>
                  ))}
                  <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">{alignment.verdict}</p>
                </div>
              )}
            </section>

            {alignment && (alignment.risks?.length > 0 || alignment.recommendations?.length > 0) && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {alignment.risks?.length > 0 && <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600">Risks</p><ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">{alignment.risks.map((item, index) => <li key={index}>• {item}</li>)}</ul></div>}
                {alignment.recommendations?.length > 0 && <div className={alignment.risks?.length ? "mt-4 border-t border-slate-100 pt-4" : ""}><p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">Recommendations</p><ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">{alignment.recommendations.map((item, index) => <li key={index}>• {item}</li>)}</ul></div>}
              </section>
            )}

            <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-xs leading-5 text-violet-800">
              <strong>Final gate:</strong> setelah ada edit, Alignment Check wajib diulang. Tombol Final hanya aktif jika Master masih Human-QC-approved, derivative sinkron, dan alignment minimal 85/100.
            </section>
          </aside>
        </div>
      </main>
    </AuthGuard>
  );
}
