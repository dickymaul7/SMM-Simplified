"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppHeader from "@/components/app-header";
import AuthGuard from "@/components/auth-guard";
import {
  ACTIVE_BRAND_ALL,
  writeActiveBrandSelection,
} from "@/lib/active-brand";
import { createClient } from "@/lib/supabase/client";
import { useActiveBrandSelection } from "@/lib/use-active-brand";

type BrandRow = {
  id: string;
  name: string;
};

type CampaignRow = {
  id: string;
  brand_id: string;
  name: string;
};

type IdeaRow = {
  id: string;
  campaign_id: string;
  working_title: string | null;
  recommended_format: string | null;
};

type BriefRow = {
  id: string;
  content_idea_id: string;
  status: string | null;
  human_qc_status: string | null;
  final_score: number | null;
  design_status: string | null;
  scheduled_for: string | null;
};

type OverviewItem = {
  briefId: string;
  ideaId: string;
  campaignId: string;
  brandId: string;
  brandName: string;
  campaignName: string;
  title: string;
  format: string;
  status: string | null;
  humanQcStatus: string | null;
  finalScore: number;
  designStatus: string | null;
  scheduledFor: string | null;
};

type Metrics = {
  draft: number;
  final: number;
  revision: number;
  waitingDesign: number;
  designed: number;
};

function isFinal(item: OverviewItem) {
  return item.humanQcStatus === "approved";
}

function isRevision(item: OverviewItem) {
  return item.status === "approved" && item.humanQcStatus === "pending";
}

function isDraft(item: OverviewItem) {
  return !isFinal(item) && !isRevision(item);
}

function isWaitingDesign(item: OverviewItem) {
  return isFinal(item) && item.designStatus !== "designed";
}

function isDesigned(item: OverviewItem) {
  return isFinal(item) && item.designStatus === "designed";
}

function metricsFor(items: OverviewItem[]): Metrics {
  return {
    draft: items.filter(isDraft).length,
    final: items.filter(isFinal).length,
    revision: items.filter(isRevision).length,
    waitingDesign: items.filter(isWaitingDesign).length,
    designed: items.filter(isDesigned).length,
  };
}

function localDateString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function OverviewClient() {
  const { selection, hydrated } = useActiveBrandSelection();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [items, setItems] = useState<OverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();
        const [brandsRes, campaignsRes, ideasRes, briefsRes] = await Promise.all([
          supabase.from("brands").select("id,name").order("name", { ascending: true }),
          supabase.from("campaigns").select("id,brand_id,name"),
          supabase
            .from("content_ideas")
            .select("id,campaign_id,working_title,recommended_format"),
          supabase
            .from("content_briefs")
            .select(
              "id,content_idea_id,status,human_qc_status,final_score,design_status,scheduled_for",
            ),
        ]);

        const firstError =
          brandsRes.error || campaignsRes.error || ideasRes.error || briefsRes.error;
        if (firstError) throw firstError;
        if (!active) return;

        const brandRows = (brandsRes.data ?? []) as BrandRow[];
        const campaignRows = (campaignsRes.data ?? []) as CampaignRow[];
        const ideaRows = (ideasRes.data ?? []) as IdeaRow[];
        const briefRows = (briefsRes.data ?? []) as BriefRow[];

        const brandMap = new Map(brandRows.map((brand) => [brand.id, brand]));
        const campaignMap = new Map(
          campaignRows.map((campaign) => [campaign.id, campaign]),
        );
        const ideaMap = new Map(ideaRows.map((idea) => [idea.id, idea]));

        const mapped: OverviewItem[] = [];

        for (const brief of briefRows) {
          const idea = ideaMap.get(brief.content_idea_id);
          if (!idea) continue;

          const campaign = campaignMap.get(idea.campaign_id);
          if (!campaign) continue;

          const brand = brandMap.get(campaign.brand_id);
          if (!brand) continue;

          mapped.push({
            briefId: brief.id,
            ideaId: idea.id,
            campaignId: campaign.id,
            brandId: brand.id,
            brandName: brand.name,
            campaignName: campaign.name || "Campaign",
            title: idea.working_title || "Untitled content",
            format: idea.recommended_format || "content",
            status: brief.status,
            humanQcStatus: brief.human_qc_status,
            finalScore: Number(brief.final_score || 0),
            designStatus: brief.design_status,
            scheduledFor: brief.scheduled_for,
          });
        }

        setBrands(brandRows);
        setItems(mapped);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat Brand Overview.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, []);

  const scopedItems = useMemo(() => {
    if (selection.id === ACTIVE_BRAND_ALL) return items;
    return items.filter((item) => item.brandId === selection.id);
  }, [items, selection.id]);

  const metrics = useMemo(() => metricsFor(scopedItems), [scopedItems]);

  const revisions = useMemo(
    () => scopedItems.filter(isRevision).slice(0, 5),
    [scopedItems],
  );

  const waitingDesign = useMemo(
    () => scopedItems.filter(isWaitingDesign).slice(0, 5),
    [scopedItems],
  );

  const upcoming = useMemo(() => {
    const today = localDateString(new Date());
    return scopedItems
      .filter((item) => item.scheduledFor && item.scheduledFor >= today)
      .sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)))
      .slice(0, 6);
  }, [scopedItems]);

  const brandBreakdown = useMemo(
    () =>
      brands.map((brand) => {
        const brandItems = items.filter((item) => item.brandId === brand.id);
        return {
          brand,
          total: brandItems.length,
          ...metricsFor(brandItems),
        };
      }),
    [brands, items],
  );

  const scopeLabel =
    selection.id === ACTIVE_BRAND_ALL ? "All Brands" : selection.name;
  const todayLabel = formatLongDate(new Date());

  const kpis = [
    {
      label: "Draft Brief",
      value: metrics.draft,
      helper: "Belum lolos Human QC",
      tone: "slate",
      icon: "D",
    },
    {
      label: "Final Brief",
      value: metrics.final,
      helper: "Human QC approved",
      tone: "emerald",
      icon: "F",
    },
    {
      label: "Perlu Revisi",
      value: metrics.revision,
      helper: "Final yang berubah & perlu QC ulang",
      tone: "amber",
      icon: "R",
    },
    {
      label: "Belum Didesain",
      value: metrics.waitingDesign,
      helper: "Final & siap ke design",
      tone: "blue",
      icon: "→",
    },
    {
      label: "Sudah Didesain",
      value: metrics.designed,
      helper: "Final + Designed",
      tone: "violet",
      icon: "✓",
    },
  ] as const;

  return (
    <AuthGuard>
      <AppHeader />

      <main className="app-workspace px-5 py-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                  Production command center
                </p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {scopeLabel}
                </span>
              </div>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">
                Brand Overview
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
                Pantau kondisi produksi brief, revisi, design handoff, dan jadwal konten dari satu workspace.
              </p>
            </div>
            <div className="text-sm text-slate-400">{todayLabel}</div>
          </header>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!hydrated || loading ? (
            <OverviewLoading />
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {kpis.map((kpi) => (
                  <MetricCard key={kpi.label} {...kpi} />
                ))}
              </section>

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Production pipeline
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">
                      Dari brief sampai design
                    </h2>
                  </div>
                  <p className="max-w-xl text-xs leading-5 text-slate-400">
                    Final Brief adalah checkpoint Human QC. Angka Ready to Design dan Designed adalah bagian dari brief final.
                  </p>
                </div>

                <div className="mt-5 grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
                  <PipelineStep label="Draft" value={metrics.draft} note="Masih dikerjakan" />
                  <PipelineArrow />
                  <PipelineStep label="Revision" value={metrics.revision} note="QC ulang" emphasis="amber" />
                  <PipelineArrow />
                  <PipelineStep label="Final" value={metrics.final} note="Human QC approved" emphasis="emerald" />
                  <PipelineArrow />
                  <PipelineStep label="Ready to Design" value={metrics.waitingDesign} note="Belum designed" emphasis="blue" />
                  <PipelineArrow />
                  <PipelineStep label="Designed" value={metrics.designed} note="Design selesai" emphasis="violet" />
                </div>
              </section>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-5 md:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">
                          Needs attention
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-950">
                          Yang perlu ditindaklanjuti
                        </h2>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                        {metrics.revision + metrics.waitingDesign} item
                      </span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2">
                    <AttentionColumn
                      title="Perlu Revisi"
                      count={metrics.revision}
                      empty="Tidak ada brief yang perlu QC ulang."
                      items={revisions}
                      badge="QC ulang"
                      badgeClass="bg-amber-50 text-amber-700"
                    />
                    <AttentionColumn
                      title="Menunggu Design"
                      count={metrics.waitingDesign}
                      empty="Semua brief final sudah didesain."
                      items={waitingDesign}
                      badge="Ready to Design"
                      badgeClass="bg-blue-50 text-blue-700"
                      border
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                        Upcoming content
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        Jadwal terdekat
                      </h2>
                    </div>
                    <Link
                      href="/calendar"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Calendar →
                    </Link>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {upcoming.length === 0 ? (
                      <p className="px-5 py-8 text-sm leading-6 text-slate-500">
                        Belum ada content mendatang yang terjadwal untuk scope ini.
                      </p>
                    ) : (
                      upcoming.map((item) => (
                        <Link
                          key={item.briefId}
                          href={`/brief/${item.briefId}`}
                          className="block px-5 py-4 transition hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-blue-600">
                                {formatDate(item.scheduledFor!)}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                                {item.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-400">
                                {item.brandName} · {item.format}
                              </p>
                            </div>
                            <StatusBadge item={item} />
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {selection.id === ACTIVE_BRAND_ALL && (
                <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-5 md:px-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      All Brands
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">
                      Brand production breakdown
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Lihat brand mana yang punya backlog draft, revisi, atau design paling besar.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-5 py-3">Brand</th>
                          <th className="px-4 py-3 text-center">Draft</th>
                          <th className="px-4 py-3 text-center">Revision</th>
                          <th className="px-4 py-3 text-center">Final</th>
                          <th className="px-4 py-3 text-center">Belum Design</th>
                          <th className="px-4 py-3 text-center">Designed</th>
                          <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {brandBreakdown.map((row) => (
                          <tr key={row.brand.id} className="hover:bg-slate-50/70">
                            <td className="px-5 py-4">
                              <p className="font-semibold text-slate-900">{row.brand.name}</p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {row.total} total brief
                              </p>
                            </td>
                            <NumberCell value={row.draft} />
                            <NumberCell value={row.revision} attention={row.revision > 0} />
                            <NumberCell value={row.final} />
                            <NumberCell value={row.waitingDesign} attention={row.waitingDesign > 0} />
                            <NumberCell value={row.designed} />
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  writeActiveBrandSelection({
                                    id: row.brand.id,
                                    name: row.brand.name,
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                Focus Brand
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "slate" | "emerald" | "amber" | "blue" | "violet";
  icon: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-400">{helper}</p>
    </div>
  );
}

function PipelineStep({
  label,
  value,
  note,
  emphasis = "slate",
}: {
  label: string;
  value: number;
  note: string;
  emphasis?: "slate" | "amber" | "emerald" | "blue" | "violet";
}) {
  const accents = {
    slate: "border-slate-200 bg-slate-50",
    amber: "border-amber-200 bg-amber-50/60",
    emerald: "border-emerald-200 bg-emerald-50/60",
    blue: "border-blue-200 bg-blue-50/60",
    violet: "border-violet-200 bg-violet-50/60",
  };

  return (
    <div className={`rounded-xl border p-4 ${accents[emphasis]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </div>
  );
}

function PipelineArrow() {
  return (
    <div className="hidden items-center justify-center px-1 text-slate-300 lg:flex">→</div>
  );
}

function AttentionColumn({
  title,
  count,
  empty,
  items,
  badge,
  badgeClass,
  border = false,
}: {
  title: string;
  count: number;
  empty: string;
  items: OverviewItem[];
  badge: string;
  badgeClass: string;
  border?: boolean;
}) {
  return (
    <div className={`p-5 md:p-6 ${border ? "border-t border-slate-100 md:border-l md:border-t-0" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs font-bold text-slate-400">{count}</span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-5 text-xs leading-5 text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.briefId}
              href={`/brief/${item.briefId}`}
              className="block rounded-xl border border-slate-100 px-3.5 py-3 transition hover:border-blue-200 hover:bg-blue-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-semibold leading-5 text-slate-800">
                    {item.title}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-slate-400">
                    {item.brandName}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${badgeClass}`}>
                  {badge}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ item }: { item: OverviewItem }) {
  if (isRevision(item)) {
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700">
        Revision
      </span>
    );
  }

  if (isDesigned(item)) {
    return (
      <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700">
        Designed ✓
      </span>
    );
  }

  if (isWaitingDesign(item)) {
    return (
      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-semibold text-blue-700">
        Ready Design
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">
      Draft
    </span>
  );
}

function NumberCell({ value, attention = false }: { value: number; attention?: boolean }) {
  return (
    <td className="px-4 py-4 text-center">
      <span
        className={`inline-flex min-w-8 justify-center rounded-lg px-2 py-1 text-xs font-semibold ${
          attention ? "bg-amber-50 text-amber-700" : "text-slate-600"
        }`}
      >
        {value}
      </span>
    </td>
  );
}

function OverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
