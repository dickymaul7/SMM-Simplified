"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type SectionRow = {
  sequence_no: number;
  section_type: string;
  purpose: string | null;
  headline: string | null;
  supporting_copy: string | null;
  evidence_needed: string | null;
  visual_direction: string | null;
  transition_to_next: string | null;
};

type SourceRow = { publisher: string | null; title: string | null; url: string; fact_notes: string | null };

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

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const briefRes = await supabase.from("content_briefs").select("*").eq("id", id).single();
    if (briefRes.error || !briefRes.data) {
      setError(briefRes.error?.message || "Brief tidak ditemukan.");
      setLoading(false);
      return;
    }
    const briefData = briefRes.data;
    setBrief(briefData);

    const sectionRes = await supabase.from("brief_sections").select("*").eq("content_brief_id", id).order("sequence_no", { ascending: true });
    setSections((sectionRes.data ?? []) as SectionRow[]);
    const reviewRes = await supabase.from("quality_reviews").select("*").eq("content_brief_id", id).order("created_at", { ascending: false }).limit(1);
    setReview(reviewRes.data?.[0] ?? null);

    const ideaRes = await supabase.from("content_ideas").select("*").eq("id", briefData.content_idea_id).single();
    const ideaData = ideaRes.data;
    setIdea(ideaData);
    if (!ideaData) {
      setLoading(false);
      return;
    }
    const campaignRes = await supabase.from("campaigns").select("*").eq("id", ideaData.campaign_id).single();
    const campaignData = campaignRes.data;
    setCampaign(campaignData);
    if (campaignData) {
      const brandRes = await supabase.from("brands").select("*").eq("id", campaignData.brand_id).single();
      setBrand(brandRes.data);
    }
    if (ideaData.research_case_id) {
      const caseRes = await supabase.from("research_cases").select("*").eq("id", ideaData.research_case_id).single();
      setResearchCase(caseRes.data);
      const sourceRes = await supabase.from("research_sources").select("publisher,title,url,fact_notes").eq("research_case_id", ideaData.research_case_id).order("source_rank", { ascending: true });
      setSources((sourceRes.data ?? []) as SourceRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullText = useMemo(() => {
    if (!brief) return "";
    const lines = [
      `FINAL STORYTELLING BRIEF`,
      `Brand: ${brand?.name || "—"}`,
      `Campaign: ${campaign?.name || "—"}`,
      `Format: ${idea?.recommended_format || "—"}`,
      `Quality Score: ${Number(brief.final_score || 0).toFixed(0)}/100`,
      ``,
      `WORKING TITLE`,
      idea?.working_title || "—",
      ``,
      `CONTENT OBJECTIVE`, brief.content_objective || "—",
      ``,
      `TARGET AUDIENCE`, brief.target_audience || "—",
      ``,
      `EDITORIAL THESIS`, brief.editorial_thesis || "—",
      ``,
      `CASE / EVIDENCE`, brief.case_evidence || "—",
      ``,
      `TENSION`, brief.tension || "—",
      ``,
      `CORE INSIGHT`, brief.core_insight || "—",
      ``,
      `BRAND POV`, brief.brand_pov || "—",
      ``,
      `CAPABILITY BRIDGE`, brief.capability_bridge || "—",
      ``,
      `STORY ARC`, brief.story_arc || "—",
      ``,
      `CTA`, brief.cta || "—",
      ``,
      `STORY SEQUENCE`,
      ...sections.flatMap((s) => [
        ``,
        `${s.section_type.toUpperCase()} ${s.sequence_no} — ${s.purpose || ""}`,
        `Headline: ${s.headline || "—"}`,
        `Copy: ${s.supporting_copy || "—"}`,
        `Evidence: ${s.evidence_needed || "—"}`,
        `Visual: ${s.visual_direction || "—"}`,
        `Transition: ${s.transition_to_next || "—"}`,
      ]),
      ``,
      `FACT CHECK NOTES`, brief.fact_check_notes || "—",
      ``,
      `SOURCES`,
      ...sources.map((s, index) => `[S${index + 1}] ${s.publisher || "Source"} — ${s.title || "Untitled"} — ${s.url}`),
    ];
    return lines.join("\n");
  }, [brief, brand, campaign, idea, sections, sources]);

  async function copyBrief() {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Improve gagal.");
      setMessage(payload.message || (payload.applied ? "Brief diperbaiki." : "Versi lama dipertahankan."));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Improve gagal.");
    } finally {
      setImproving(false);
    }
  }

  if (loading) return <AuthGuard><div className="min-h-screen grid place-items-center text-sm text-slate-500">Loading final brief...</div></AuthGuard>;
  if (!brief) return <AuthGuard><div className="min-h-screen grid place-items-center text-red-600">{error || "Brief tidak ditemukan."}</div></AuthGuard>;

  const score = Number(brief.final_score || review?.total_score || 0);

  return (
    <AuthGuard>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 lg:py-12">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => router.push(`/campaign/${idea?.campaign_id}`)} className="text-sm font-medium text-blue-600">← Story Angles</button>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyBrief} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">{copied ? "Copied ✓" : "Copy Full Brief"}</button>
            <button onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Export PDF</button>
          </div>
        </div>

        <section className="print-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div>
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Final Storytelling Brief</div>
              <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">{idea?.working_title}</h1>
              <p className="mt-3 text-sm text-slate-500">{brand?.name} · {campaign?.product_or_program} · {idea?.recommended_format}</p>
            </div>
            <div className={`rounded-3xl px-5 py-4 text-center ${score >= 90 ? "bg-emerald-50 text-emerald-800" : score >= 85 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}>
              <div className="text-3xl font-black">{score.toFixed(0)}</div>
              <div className="text-xs font-semibold">/100 Quality</div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
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
              <div key={label as string} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-800">{value || "—"}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Case Evidence</p>
            <p className="mt-2 text-sm leading-6">{brief.case_evidence}</p>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Designer-ready</p>
              <h2 className="mt-2 text-2xl font-bold">Story Sequence ({sections.length})</h2>
            </div>
            <p className="hidden text-xs text-slate-400 md:block">Case-first by default</p>
          </div>
          <div className="mt-5 space-y-4">
            {sections.map((section) => (
              <article key={section.sequence_no} className="print-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-600">{section.section_type} {section.sequence_no}</span>
                  {section.purpose && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{section.purpose}</span>}
                </div>
                <h3 className="mt-3 text-2xl font-bold leading-tight">{section.headline}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{section.supporting_copy}</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-emerald-50/70 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Evidence</p><p className="mt-2 text-xs leading-5 text-slate-700">{section.evidence_needed || "—"}</p></div>
                  <div className="rounded-2xl bg-violet-50/70 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Visual Direction</p><p className="mt-2 text-xs leading-5 text-slate-700">{section.visual_direction || "—"}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Transition</p><p className="mt-2 text-xs leading-5 text-slate-700">{section.transition_to_next || "—"}</p></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_.9fr]">
          <div className="print-card rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold">Fact Check & Sources</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{brief.fact_check_notes || "—"}</p>
            <div className="mt-5 space-y-3">
              {sources.map((source, index) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 p-4 hover:border-blue-300">
                  <p className="text-xs font-semibold text-blue-600">[S{index + 1}] {source.publisher || "Source"}</p>
                  <p className="mt-1 text-sm font-medium">{source.title || source.url}</p>
                  {source.fact_notes && <p className="mt-2 text-xs leading-5 text-slate-500">{source.fact_notes}</p>}
                </a>
              ))}
            </div>
          </div>

          <div className="no-print rounded-3xl bg-slate-950 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Improve with AI</p>
            <h2 className="mt-3 text-2xl font-bold">Perbaiki hanya bagian yang lemah.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">AI membaca score + reviewer notes + source evidence. Versi baru hanya diterapkan jika skornya tidak turun.</p>
            {review?.reviewer_notes && <div className="mt-5 max-h-44 overflow-auto rounded-2xl bg-white/10 p-4 text-xs leading-6 text-slate-300">{review.reviewer_notes}</div>}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-4 min-h-28 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Opsional: contoh ‘perkuat Slide 4-5, jangan ubah hook, CTA lebih soft’." />
            {message && <div className="mt-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">{message}</div>}
            {error && <div className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</div>}
            <button onClick={improve} disabled={improving} className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{improving ? "Improving & re-scoring..." : "Improve Brief with AI"}</button>
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
