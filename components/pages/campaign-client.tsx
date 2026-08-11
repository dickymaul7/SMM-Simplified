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
        supabase
          .from("content_ideas")
          .select("*")
          .eq("campaign_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("research_cases")
          .select("id,company_name,case_title,confidence,selected")
          .eq("campaign_id", id),
      ]);
      if (campaignRes.error) setError(campaignRes.error.message);
      setCampaign(campaignRes.data);
      setIdeas((ideasRes.data ?? []) as IdeaRow[]);
      const caseRows = (casesRes.data ?? []) as CaseRow[];
      setCases(new Map(caseRows.map((c) => [c.id, c])));
      if (caseRows.length) {
        const sourceRes = await supabase
          .from("research_sources")
          .select("research_case_id,publisher,title,url")
          .in(
            "research_case_id",
            caseRows.map((c) => c.id),
          )
          .order("source_rank", { ascending: true });
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
      if (!response.ok || !payload?.ok)
        throw new Error(payload?.error || "Gagal generate brief.");
      router.push(`/brief/${payload.briefId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate brief.");
    } finally {
      setGeneratingId("");
    }
  }

  if (loading)
    return (
      <AuthGuard>
        <div className="min-h-screen grid place-items-center text-sm text-slate-500">
          Loading story angles...
        </div>
      </AuthGuard>
    );

  return (
    <AuthGuard>
      <AppHeader />
      <main className="app-workspace mx-auto max-w-[calc(72rem+16rem)] px-5 py-6 lg:px-8 lg:py-7">
        <button
          onClick={() => router.push("/")}
          className="no-print mb-4 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          ← Brief Studio
        </button>
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live research complete
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                5 Story Angles
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {campaign?.product_or_program} — {campaign?.objective}
              </p>
            </div>
            <div className="max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Audience
              </span>
              <span className="font-medium text-slate-800">
                {Array.isArray(campaign?.target_audience_override)
                  ? campaign.target_audience_override.join(", ")
                  : "—"}
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {ideas.map((idea, index) => {
            const researchCase = idea.research_case_id
              ? cases.get(idea.research_case_id)
              : undefined;
            const caseSources = sources
              .filter((s) => s.research_case_id === idea.research_case_id)
              .slice(0, 3);
            return (
              <article
                key={idea.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="grid lg:grid-cols-[4.5rem_minmax(0,1fr)_15rem]">
                  <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4 lg:block lg:border-b-0 lg:border-r lg:px-4 lg:py-6 lg:text-center">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Angle
                    </span>
                    <p className="mt-0 lg:mt-1 text-2xl font-bold text-slate-900">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                  </div>
                  <div className="min-w-0 p-5 md:p-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                          {researchCase?.company_name || "Corporate case"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="text-xs font-medium text-slate-500">
                          {idea.recommended_format || "carousel"}
                        </span>
                        {researchCase?.selected && (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Flagship case
                          </span>
                        )}
                      </div>
                      <h2 className="mt-3 text-xl font-bold leading-snug text-slate-950 md:text-2xl">
                        {idea.working_title}
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {idea.content_angle}
                      </p>

                      <div className="mt-5 grid gap-4 border-y border-slate-100 py-4 md:grid-cols-2">
                        <div className="md:border-r md:border-slate-100 md:pr-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Tension
                          </p>
                          <p className="mt-2 text-sm leading-6">
                            {idea.tension}
                          </p>
                        </div>
                        <div className="md:pl-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                            Core Insight
                          </p>
                          <p className="mt-2 text-sm leading-6">
                            {idea.core_insight}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Case & evidence
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-800">
                          {researchCase?.case_title || "Research case"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                          {caseSources.map((source) => (
                            <a
                              key={source.url}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {source.publisher || source.title || "Source"} ↗
                            </a>
                          ))}
                          <span>
                            {caseSources.length} verified source
                            {caseSources.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center border-t border-slate-100 bg-slate-50/50 p-5 lg:border-l lg:border-t-0">
                    <button
                      onClick={() => generate(idea.id)}
                      disabled={Boolean(generatingId)}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {generatingId === idea.id
                        ? "Generating full brief..."
                        : idea.status === "briefed"
                          ? "Open / Generate Brief →"
                          : "Generate Full Brief →"}
                    </button>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Membuat story sequence dan quality review tanpa mengubah
                      angle terpilih.
                    </p>
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
