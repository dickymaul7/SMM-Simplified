"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type ExpansionChannel = "linkedin" | "seo_article";

type ExpansionRow = {
  id: string;
  channel: ExpansionChannel;
  status: "draft" | "needs_review" | "final";
  human_qc_status: "pending" | "approved";
  human_qc_at: string | null;
  master_qc_at: string | null;
  alignment_report: {
    overall?: number;
  } | null;
  updated_at: string;
};

function sameMoment(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function statusLabel(row: ExpansionRow | undefined) {
  if (!row) return "Belum dibuat";
  if (row.status === "final" && row.human_qc_status === "approved") return "Final ✓";
  if (row.status === "needs_review") return "Needs Review";
  return "Draft";
}

export default function ContentExpansionPanel() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [brief, setBrief] = useState<any>(null);
  const [expansions, setExpansions] = useState<ExpansionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<ExpansionChannel | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const briefResult = await supabase
      .from("content_briefs")
      .select("id,human_qc_status,human_qc_at,status")
      .eq("id", id)
      .single();

    if (briefResult.error || !briefResult.data) {
      setError(briefResult.error?.message || "Master brief tidak ditemukan.");
      setLoading(false);
      return;
    }

    setBrief(briefResult.data);

    const expansionResult = await supabase
      .from("content_expansions")
      .select("id,channel,status,human_qc_status,human_qc_at,master_qc_at,alignment_report,updated_at")
      .eq("content_brief_id", id);

    if (expansionResult.error) {
      if (expansionResult.error.code === "42P01") {
        setError("Content Expansion belum diaktifkan di database. Jalankan database/CONTENT_EXPANSION_V1.sql terlebih dahulu.");
      } else {
        setError(expansionResult.error.message);
      }
      setExpansions([]);
      setLoading(false);
      return;
    }

    setExpansions((expansionResult.data ?? []) as ExpansionRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const byChannel = useMemo(() => {
    return new Map(expansions.map((row) => [row.channel, row]));
  }, [expansions]);

  const qcApproved = brief?.human_qc_status === "approved" && Boolean(brief?.human_qc_at);

  async function generate(channel: ExpansionChannel, replace = false) {
    const current = byChannel.get(channel);
    if (replace && current) {
      const confirmed = window.confirm(
        `Regenerate ${channel === "linkedin" ? "LinkedIn" : "SEO Article"}? Draft saat ini akan diganti dan status Final/Human QC derivative akan di-reset.`,
      );
      if (!confirmed) return;
    }

    setGenerating(channel);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/ai/expansion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: id, channel, replace }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Gagal membuat Content Expansion.");
      }

      setMessage(
        replace
          ? "Derivative berhasil disinkronkan ulang dengan Master Brief terbaru."
          : "Draft derivative berhasil dibuat.",
      );
      await load();
      router.push(`/brief/${id}/expansion/${channel}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat Content Expansion.");
    } finally {
      setGenerating(null);
    }
  }

  if (loading) return null;

  const channels: Array<{
    key: ExpansionChannel;
    eyebrow: string;
    title: string;
    description: string;
    button: string;
  }> = [
    {
      key: "linkedin",
      eyebrow: "Professional Social",
      title: "LinkedIn Content",
      description:
        "Adaptasi Master Brief menjadi hook, executive angle, body copy, takeaway, CTA, visual direction, dan hashtag yang native untuk LinkedIn.",
      button: "Create LinkedIn Draft",
    },
    {
      key: "seo_article",
      eyebrow: "Search Content",
      title: "SEO Article",
      description:
        "Turunkan Master Brief menjadi SEO content brief + article draft: keyword, intent, metadata, outline, internal-link opportunity, CTA, dan artikel editable.",
      button: "Create SEO Draft",
    },
  ];

  return (
    <main className="no-print app-workspace mx-auto max-w-[calc(72rem+16rem)] px-5 pb-3 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
                Content Expansion
              </p>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  qcApproved
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {qcApproved ? "Master QC Approved ✓" : "Locked until Human QC"}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 md:text-2xl">
              Expand this Content
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Master Social Brief tetap menjadi source of truth. Buat derivative channel yang bisa diedit manusia, dicek alignment-nya, lalu diberi Human QC sendiri sebelum menjadi Final.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            <strong className="text-slate-800">Workflow</strong><br />
            Master QC → Draft → Edit → Alignment Check → Final
          </div>
        </div>

        {(error || message) && (
          <div className="mt-4 space-y-2">
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
          </div>
        )}

        {!qcApproved && !error && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            Selesaikan dan approve <strong>Human QC Master Social Brief</strong> terlebih dahulu. Setelah approved, tombol LinkedIn dan SEO akan aktif otomatis.
          </div>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {channels.map((item) => {
            const row = byChannel.get(item.key);
            const outOfSync = Boolean(
              row && (!qcApproved || !sameMoment(row.master_qc_at, brief?.human_qc_at)),
            );
            const alignment = Number(row?.alignment_report?.overall ?? 0);
            const busy = generating === item.key;

            return (
              <article key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.eyebrow}</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">{item.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                      {statusLabel(row)}
                    </span>
                    {row && alignment > 0 && (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${alignment >= 85 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        Alignment {alignment}/100
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>

                {outOfSync && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
                    <strong>Master Content Changed.</strong> Derivative perlu direview terhadap Master Brief terbaru sebelum bisa dianggap final.
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {!row ? (
                    <button
                      type="button"
                      onClick={() => void generate(item.key)}
                      disabled={!qcApproved || Boolean(generating) || Boolean(error)}
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy ? "Generating..." : item.button}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => router.push(`/brief/${id}/expansion/${item.key}`)}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Open {item.key === "linkedin" ? "LinkedIn" : "SEO"} Brief
                      </button>
                      {outOfSync && qcApproved && (
                        <button
                          type="button"
                          onClick={() => void generate(item.key, true)}
                          disabled={Boolean(generating)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          {busy ? "Regenerating..." : "Regenerate from Master"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
