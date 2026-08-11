"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type IdeaRow = {
  id: string;
  research_case_id: string | null;
  working_title: string;
  content_angle: string | null;
  tension: string | null;
  core_insight: string | null;
  recommended_format: string | null;
  campaign_relevance: string | null;
  status: string;
};

type CaseRow = {
  id: string;
  company_name: string | null;
  case_title: string;
  confidence: string | null;
  selected: boolean;
};

type SourceRow = {
  research_case_id: string;
  publisher: string | null;
  title: string | null;
  url: string;
};

export default function CampaignClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [cases, setCases] = useState<Map<string, CaseRow>>(new Map());
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [campaignRes, ideasRes, casesRes] = await Promise.all([
        supabase.from("campaigns").select("*").eq("id", id).single(),
        supabase.from("content_ideas").select("*").eq("campaign_id", id).order("created_at", { ascending: true }),
        supabase.from("research_cases").select("id,company_name,case_title,confidence,selected").eq("campaign_id", id),
      ]);
      if (campaignRes.error) setError(campaignRes.error.message);
      setCampaign(campaignRes.data);
      setIdeas((ideasRes.data ?? []) as IdeaRow[]);
      const caseRows = (casesRes.data ?? []) as CaseRow[];
      setCases(new Map(caseRows.map((c) => [c.id, c])));
      if (caseRows.length) {
        const sourceRes = await supabase.from("research_sources").select("research_case_id,publisher,title,url").in("research_case_id", caseRows.map((c) => c.id)).order("source_rank", { ascending: true });
        setSources((sourceRes.data ?? []) as SourceRow[]);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function generate(ideaId: string) {
    setGeneratingId(ideaId);
    setError("");
    try {
      const response = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Gagal generate brief.");
      router.push(`/brief/${payload.briefId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate brief.");
    } finally {
      setGeneratingId("");
    }
  }

  if (loading) return <AuthGuard><div className="min-h-screen grid place-items-center text-sm text-slate-500">Loading story angles...</div></AuthGuard>;

  return (
    <AuthGuard>
      <AppHeader />
      <main className="app-workspace mx-auto max-w-[calc(72rem+16rem)] px-5 py-8 lg:px-8 lg:py-9">
        <button onClick={() => router.push("/")} className="no-print mb-4 text-sm font-medium text-slate-500 hover:text-blue-600">← Brief Studio</button>
        <div className="ui-page-header">
          <div>
            <div className="ui-badge ui-badge-success"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live research complete</div>
            <h1 className="ui-page-title">Pilih Story Angle</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{campaign?.product_or_program} — {campaign?.objective}</p>
          </div>
          <div className="max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Audience</span>
            <strong className="mt-1 block text-xs leading-5 text-slate-700">{Array.isArray(campaign?.target_audience_override) ? campaign.target_audience_override.join(", ") : "—"}</strong>
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-4">
          {ideas.map((idea, index) => {
            const researchCase = idea.research_case_id ? cases.get(idea.research_case_id) : undefined;
            const caseSources = sources.filter((s) => s.research_case_id === idea.research_case_id).slice(0, 3);
            return (
              <article key={idea.id} className="ui-card overflow-hidden p-5 md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ui-badge ui-badge-info">Angle {index + 1}</span>
                      <span className="ui-badge ui-badge-neutral">{idea.recommended_format || "carousel"}</span>
                      {researchCase?.selected && <span className="ui-badge ui-badge-warning">Flagship case</span>}
                    </div>
                    <div className="mt-4 border-l-2 border-blue-500 pl-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{researchCase?.company_name || "Corporate case"}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{researchCase?.case_title || "Research case"}</p>
                    </div>
                    <h2 className="mt-4 text-xl font-bold leading-snug tracking-tight text-slate-950">{idea.working_title}</h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{idea.content_angle}</p>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tension</p>
                        <p className="mt-2 text-sm leading-6">{idea.tension}</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Core Insight</p>
                        <p className="mt-2 text-sm leading-6">{idea.core_insight}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">Confidence: {researchCase?.confidence || "—"}</span>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {caseSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{source.publisher || source.title || "Source"} ↗</a>)}
                        <span>{caseSources.length}+ verified source</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 lg:w-56">
                    <button onClick={() => generate(idea.id)} disabled={Boolean(generatingId)} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
                      {generatingId === idea.id ? "Generating full brief..." : idea.status === "briefed" ? "Open / Generate Brief →" : "Generate Full Brief →"}
                    </button>
                    <p className="mt-3 text-xs leading-5 text-slate-400">AI akan membuat story sequence + quality review. Draft di bawah 90 otomatis direvisi sekali.</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </AuthGuard>
  );
}
