"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Channel = "linkedin" | "seo_article";

function todayString() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function channelLabel(channel: Channel) {
  return channel === "linkedin" ? "LinkedIn" : "SEO Article";
}

export default function ContentExpansionSchedulePanel() {
  const { id, channel: channelParam } = useParams<{ id: string; channel: string }>();
  const router = useRouter();
  const channel = channelParam === "linkedin" || channelParam === "seo_article" ? channelParam : null;

  const [masterApproved, setMasterApproved] = useState(false);
  const [finalApproved, setFinalApproved] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!channel) return;
    const supabase = createClient();
    const [briefResult, expansionResult] = await Promise.all([
      supabase
        .from("content_briefs")
        .select("human_qc_status,human_qc_at,scheduled_for")
        .eq("id", id)
        .single(),
      supabase
        .from("content_expansions")
        .select("status,human_qc_status,human_qc_at,scheduled_for")
        .eq("content_brief_id", id)
        .eq("channel", channel)
        .single(),
    ]);

    if (briefResult.error || !briefResult.data) {
      setError(briefResult.error?.message || "Master brief tidak ditemukan.");
      setLoading(false);
      return;
    }

    if (expansionResult.error || !expansionResult.data) {
      setError(expansionResult.error?.message || "Derivative brief tidak ditemukan.");
      setLoading(false);
      return;
    }

    const masterIsApproved = briefResult.data.human_qc_status === "approved" && Boolean(briefResult.data.human_qc_at);
    const derivativeIsFinal =
      expansionResult.data.status === "final" &&
      expansionResult.data.human_qc_status === "approved" &&
      Boolean(expansionResult.data.human_qc_at);

    setMasterApproved(masterIsApproved);
    setFinalApproved(derivativeIsFinal);
    setScheduledFor(
      expansionResult.data.scheduled_for || briefResult.data.scheduled_for || todayString(),
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [id, channel]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSchedule() {
    if (!channel || !scheduledFor) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("content_expansions")
        .update({ scheduled_for: scheduledFor, updated_at: new Date().toISOString() })
        .eq("content_brief_id", id)
        .eq("channel", channel);

      if (updateError) throw updateError;

      setMessage(`${channelLabel(channel)} dijadwalkan untuk ${scheduledFor}. Calendar akan menampilkan channel ini sebagai item terpisah.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan jadwal derivative.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-5 pb-8 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Memuat status kalender derivative...
        </div>
      </section>
    );
  }

  return (
    <section className="app-workspace mx-auto max-w-6xl px-5 pb-10 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Calendar Scheduling</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${finalApproved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {finalApproved ? "Final + Human QC ✓" : "Belum Final"}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Jadwalkan {channel ? channelLabel(channel) : "Derivative"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              LinkedIn dan SEO memiliki jadwal sendiri. Tanggal di sini tidak mengubah jadwal Master Social Brief.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh Status
          </button>
        </div>

        {(message || error) && (
          <div className="mt-4 space-y-2">
            {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          </div>
        )}

        {!masterApproved && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            Master Social Brief belum Human-QC approved. Selesaikan Master QC terlebih dahulu.
          </div>
        )}

        {masterApproved && !finalApproved && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            Derivative harus <strong>Approve as Final Brief</strong> terlebih dahulu. Panel ini otomatis memperbarui status setiap beberapa detik.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-800">Tanggal publikasi {channel ? channelLabel(channel) : ""}</label>
            <input
              type="date"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              disabled={!finalApproved || saving}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={() => void saveSchedule()}
            disabled={!finalApproved || saving || !scheduledFor}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Menyimpan..." : "Simpan ke Calendar"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/calendar")}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Buka Calendar →
          </button>
        </div>
      </div>
    </section>
  );
}
