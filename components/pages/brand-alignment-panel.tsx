"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

type AlignmentResult = {
  overall_score: number;
  verdict: string;
  audience_fit: number;
  positioning_alignment: number;
  capability_relevance: number;
  market_relevance: number;
  claim_compliance: number;
  strengths: string[];
  misalignments: string[];
  recommendations: string[];
};

export default function BrandAlignmentPanel() {
  const { id } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AlignmentResult | null>(null);

  async function runCheck() {
    setOpen(true);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/brand-alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Brand Alignment QC gagal.");
      setResult(payload.data as AlignmentResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brand Alignment QC gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={result ? () => setOpen(true) : runCheck}
        className="fixed bottom-5 right-5 z-40 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-700"
      >
        {result ? `Brand Alignment ${Math.round(result.overall_score)}/100` : "Check Brand Alignment"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/30 p-3 backdrop-blur-[2px] sm:p-5">
          <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">AI Quality Control</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Brand Alignment QC</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Membandingkan brief dengan Market, Customer, Positioning, Capabilities, dan brand guardrails.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Tutup</button>
            </header>

            <div className="p-5 md:p-6">
              {loading && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-700">AI sedang membaca Full Brief dan membandingkannya dengan Brand Intelligence...</div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</div>
              )}

              {result && !loading && (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-slate-950 p-5 text-white">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">Overall alignment</p>
                        <p className="mt-1 text-4xl font-bold">{Math.round(result.overall_score)}<span className="text-lg font-semibold text-slate-400">/100</span></p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">{result.verdict}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Audience Fit" value={result.audience_fit} />
                    <Metric label="Positioning" value={result.positioning_alignment} />
                    <Metric label="Capabilities" value={result.capability_relevance} />
                    <Metric label="Market" value={result.market_relevance} />
                    <div className="col-span-2"><Metric label="Claim Compliance" value={result.claim_compliance} /></div>
                  </div>

                  <Section title="Yang sudah align" items={result.strengths} tone="good" />
                  <Section title="Potential misalignment" items={result.misalignments} tone="warn" empty="Tidak ditemukan misalignment material." />
                  <Section title="Recommended action" items={result.recommendations} tone="neutral" />

                  <button
                    type="button"
                    onClick={runCheck}
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Run Check Again
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className="text-sm font-bold text-slate-950">{Math.round(normalized)}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

function Section({ title, items, tone, empty }: { title: string; items: string[]; tone: "good" | "warn" | "neutral"; empty?: string }) {
  const classes = tone === "good"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <h3 className="text-sm font-bold">{title}</h3>
      {items?.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {items.map((item, index) => <li key={`${title}-${index}`}>• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm opacity-75">{empty || "Belum ada catatan."}</p>
      )}
    </div>
  );
}
