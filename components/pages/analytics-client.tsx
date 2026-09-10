"use client";

import { useEffect, useMemo, useState } from "react";

import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";

type Metric = { type: string; name?: string | null; value: number | string | null; unit?: string | null };
type Channel = { id: string; name?: string | null; displayName?: string | null; service?: string | null; avatar?: string | null; organizationName?: string | null };
type Post = { id: string; text?: string | null; dueAt?: string | null; sentAt?: string | null; createdAt?: string | null; externalLink?: string | null; metrics?: Metric[] | null; metricsUpdatedAt?: string | null };
type AnalyticsPayload = {
  ok: boolean;
  error?: string;
  days: number;
  range: { currentStart: string; currentEnd: string; previousStart: string; previousEnd: string };
  comparisonAvailable?: boolean;
  channels: Channel[];
  selectedChannel: Channel;
  current: { metrics: Metric[]; metricsUpdatedAt?: string | null };
  previous: { metrics: Metric[]; metricsUpdatedAt?: string | null };
  posts: Post[];
  note?: string;
};

const metricLabels: Record<string, string> = {
  postCount: "Posts",
  reactions: "Reactions",
  comments: "Comments",
  engagementRate: "Eng. Rate",
  views: "Views",
  shares: "Shares",
  reposts: "Reposts",
  saves: "Saves",
  follows: "Follows from posts",
  reach: "Reach",
  impressions: "Impressions",
  totalTimeWatched: "Watch Time",
  averageTimeWatched: "Avg. Watch Time",
  clicks: "Clicks",
};

const preferredMetricOrder = [
  "postCount",
  "reactions",
  "comments",
  "engagementRate",
  "views",
  "shares",
  "saves",
  "follows",
  "reach",
  "impressions",
  "totalTimeWatched",
  "averageTimeWatched",
  "clicks",
];

function metricMap(metrics: Metric[] | null | undefined) {
  return new Map((metrics ?? []).map((metric) => [metric.type, metric]));
}

function numericValue(metric?: Metric) {
  const value = Number(metric?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function formatMetric(metric?: Metric) {
  if (!metric || metric.value === null || metric.value === undefined) return "—";
  const value = Number(metric.value);
  if (!Number.isFinite(value)) return String(metric.value);
  const type = metric.type;
  const unit = String(metric.unit || "").toLowerCase();
  if (type === "engagementRate" || unit === "percentage" || unit === "percent") return `${value.toFixed(2)}%`;
  if (type === "averageTimeWatched") return `${value.toFixed(2)} sec`;
  if (type === "totalTimeWatched") return `${value.toFixed(2)} min`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function delta(current?: Metric, previous?: Metric) {
  const a = numericValue(current);
  const b = numericValue(previous);
  if (b === 0) return a === 0 ? null : 100;
  return ((a - b) / Math.abs(b)) * 100;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function truncate(text?: string | null, max = 72) {
  const clean = String(text || "Untitled post").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [channelId, setChannelId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ days: String(days) });
        if (channelId) query.set("channelId", channelId);
        const response = await fetch(`/api/buffer/analytics?${query.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Gagal mengambil analytics Buffer.");
        if (!cancelled) {
          setData(payload);
          if (!channelId && payload.selectedChannel?.id) setChannelId(payload.selectedChannel.id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal mengambil analytics Buffer.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [days, channelId]);

  const current = useMemo(() => metricMap(data?.current.metrics), [data]);
  const previous = useMemo(() => metricMap(data?.previous.metrics), [data]);
  const visibleTypes = useMemo(() => {
    const available = new Set(data?.current.metrics.map((metric) => metric.type) ?? []);
    return preferredMetricOrder.filter((type) => available.has(type));
  }, [data]);

  const comparisonAvailable = Boolean(data?.comparisonAvailable);

  return <AuthGuard>
    <AppHeader />
    <main className="app-workspace px-5 py-8 lg:px-8 lg:py-9">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="ui-page-header gap-4">
          <div>
            <p className="ui-eyebrow">Performance</p>
            <h1 className="ui-page-title">Analytics</h1>
            <p className="ui-page-description">Performance data langsung dari channel yang terhubung ke Buffer.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="ui-input min-w-[190px]" value={channelId} onChange={(event) => setChannelId(event.target.value)} disabled={!data?.channels.length}>
              {(data?.channels ?? []).map((channel) => <option key={channel.id} value={channel.id}>{channel.displayName || channel.name || channel.id} · {channel.service || "channel"}</option>)}
            </select>
            <select className="ui-input" value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
        </header>

        {error && <section className="ui-card border-red-200 bg-red-50 p-5 text-sm text-red-700"><strong>Analytics belum dapat dimuat.</strong><div className="mt-1">{error}</div></section>}

        <section className="ui-card p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Summary</h2>
              <p className="mt-1 text-sm text-slate-500">
                {data
                  ? `${formatDate(data.range.currentStart)} – ${formatDate(data.range.currentEnd)}${comparisonAvailable ? ` · Compared with previous ${data.days} days` : ""}`
                  : "Loading performance period…"}
              </p>
            </div>
            {data?.current.metricsUpdatedAt && <span className="ui-badge ui-badge-neutral">Updated {formatDate(data.current.metricsUpdatedAt)}</span>}
          </div>

          {loading && !data ? <div className="grid min-h-48 place-items-center text-sm text-slate-500">Loading Buffer analytics…</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {visibleTypes.map((type) => {
              const change = comparisonAvailable ? delta(current.get(type), previous.get(type)) : null;
              return <article key={type} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">{metricLabels[type] || current.get(type)?.name || type}</div>
                <div className="mt-2 flex items-end gap-2">
                  <strong className="text-2xl tracking-tight text-slate-900">{formatMetric(current.get(type))}</strong>
                  {change !== null && <span className={`pb-0.5 text-xs font-bold ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>{change >= 0 ? "↗" : "↘"} {change >= 0 ? "+" : ""}{change.toFixed(1)}%</span>}
                </div>
              </article>;
            })}
            {!visibleTypes.length && !loading && <div className="col-span-full py-8 text-center text-sm text-slate-500">Buffer belum mengembalikan metrics untuk channel dan periode ini.</div>}
          </div>}

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            {data?.note || "Metric dapat berbeda per social network. Buffer memperbarui post metrics sekitar sekali per hari."}
          </div>
        </section>

        <section className="ui-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5 lg:px-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Performance per Post</h2>
              <p className="mt-1 text-sm text-slate-500">{data ? `${data.posts.length} sent posts in this period` : "Loading posts…"}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 lg:px-6">Post</th>
                  <th className="px-4 py-3">Reactions</th>
                  <th className="px-4 py-3">Comments</th>
                  <th className="px-4 py-3">Eng. Rate</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Reach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(data?.posts ?? []).map((post) => {
                  const metrics = metricMap(post.metrics);
                  return <tr key={post.id} className="bg-white align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4 lg:px-6">
                      <div className="max-w-xl font-semibold text-slate-900">{post.externalLink ? <a href={post.externalLink} target="_blank" rel="noreferrer" className="hover:text-red-600 hover:underline">{truncate(post.text)}</a> : truncate(post.text)}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDate(post.sentAt || post.dueAt || post.createdAt)}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{formatMetric(metrics.get("reactions"))}</td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{formatMetric(metrics.get("comments"))}</td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{formatMetric(metrics.get("engagementRate"))}</td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{formatMetric(metrics.get("views"))}</td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{formatMetric(metrics.get("reach"))}</td>
                  </tr>;
                })}
                {!data?.posts.length && !loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">Belum ada sent post dengan metrics untuk periode ini.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </AuthGuard>;
}
