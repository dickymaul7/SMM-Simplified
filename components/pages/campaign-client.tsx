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
        <button onClick={() => router.push("/")} className="no-print mb-5 text-sm font-medium text-blue-600">← Quick Brief</button>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live research complete</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Pilih satu story angle</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{campaign?.product_or_program} — {campaign?.objective}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span className="text-slate-500">Audience:</span> <strong>{Array.isArray(campaign?.target_audience_override) ? campaign.target_audience_override.join(", ") : "—"}</strong>
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-8 grid gap-5">
          {ideas.map((idea, index) => {
            const researchCase = idea.research_case_id ? cases.get(idea.research_case_id) : undefined;
            const caseSources = sources.filter((s) => s.research_case_id === idea.research_case_id).slice(0, 3);
            return (
              <article key={idea.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
                <div className="flex flex-col gap-6 md:flex-row md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Angle {index + 1}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{idea.recommended_format || "carousel"}</span>
                      {researchCase?.selected && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Flagship case</span>}
                    </div>
                    <h2 className="mt-4 text-2xl font-bold leading-tight text-slate-950">{idea.working_title}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{idea.content_angle}</p>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tension</p>
                        <p className="mt-2 text-sm leading-6">{idea.tension}</p>
                      </div>
                      <div className="rounded-2xl bg-blue-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Core Insight</p>
                        <p className="mt-2 text-sm leading-6">{idea.core_insight}</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Real case</p>
                      <p className="mt-2 font-semibold">{researchCase?.company_name || "Corporate case"} — {researchCase?.case_title || "Research case"}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                        {caseSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{source.publisher || source.title || "Source"} ↗</a>)}
                        <span>{caseSources.length}+ verified source</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:w-56">
                    <button onClick={() => generate(idea.id)} disabled={Boolean(generatingId)} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
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
