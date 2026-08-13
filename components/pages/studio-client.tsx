"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { ACTIVE_BRAND_ALL } from "@/lib/active-brand";
import { createClient } from "@/lib/supabase/client";
import { useActiveBrandSelection } from "@/lib/use-active-brand";

const APP_MARKER = "__storybrief_lite__";
const QUICK_BRIEF_DRAFT_KEY = "smm-simplified:quick-brief-draft:v1";

type QuickBriefDraft = {
  brandName: string;
  website: string;
  topic: string;
  audience: string;
  objective: string;
  cta: string;
  preferredFormat: "auto" | "carousel" | "reels" | "single_post";
  extraContext: string;
};

type CampaignRow = {
  id: string;
  name: string;
  objective: string;
  product_or_program: string | null;
  created_at: string;
};

type BrandContextRow = {
  id: string;
  name: string;
  website: string | null;
};

export default function StudioClient() {
  const router = useRouter();
  const { selection: activeBrand, hydrated: activeBrandHydrated } = useActiveBrandSelection();
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [cta, setCta] = useState("");
  const [preferredFormat, setPreferredFormat] = useState<
    "auto" | "carousel" | "reels" | "single_post"
  >("auto");
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [brandContextLoading, setBrandContextLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CampaignRow[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(QUICK_BRIEF_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<QuickBriefDraft>;

        setBrandName(draft.brandName ?? "");
        setWebsite(draft.website ?? "");
        setTopic(draft.topic ?? "");
        setAudience(draft.audience ?? "");
        setObjective(draft.objective ?? "");
        setCta(draft.cta ?? "");
        setPreferredFormat(
          draft.preferredFormat === "carousel" ||
            draft.preferredFormat === "reels" ||
            draft.preferredFormat === "single_post"
            ? draft.preferredFormat
            : "auto",
        );
        setExtraContext(draft.extraContext ?? "");
      }
    } catch {
      // Ignore corrupted local draft and keep the form usable.
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!activeBrandHydrated) return;
    let active = true;

    async function syncBrandContext() {
      setBrandContextLoading(true);
      setError("");
      const supabase = createClient();

      let historyQuery = supabase
        .from("campaigns")
        .select("id,name,objective,product_or_program,created_at")
        .contains("priority_topics", [APP_MARKER])
        .order("created_at", { ascending: false })
        .limit(8);

      if (activeBrand.id === ACTIVE_BRAND_ALL) {
        const { data } = await historyQuery;
        if (!active) return;
        setHistory((data ?? []) as CampaignRow[]);
        setBrandName("");
        setWebsite("");
        setBrandContextLoading(false);
        return;
      }

      const [{ data: brand, error: brandError }, historyResult] = await Promise.all([
        supabase
          .from("brands")
          .select("id,name,website")
          .eq("id", activeBrand.id)
          .maybeSingle(),
        historyQuery.eq("brand_id", activeBrand.id),
      ]);

      if (!active) return;

      if (brandError || !brand) {
        setBrandName(activeBrand.name);
        setWebsite("");
        setHistory((historyResult.data ?? []) as CampaignRow[]);
        setError(brandError?.message || "Active Brand tidak ditemukan. Pilih ulang brand dari sidebar.");
        setBrandContextLoading(false);
        return;
      }

      const context = brand as BrandContextRow;
      setBrandName(context.name);
      setWebsite(context.website ?? "");
      setHistory((historyResult.data ?? []) as CampaignRow[]);
      setBrandContextLoading(false);
    }

    void syncBrandContext();
    return () => {
      active = false;
    };
  }, [activeBrand.id, activeBrand.name, activeBrandHydrated]);

  useEffect(() => {
    if (!draftLoaded) return;

    const draft: QuickBriefDraft = {
      brandName,
      website,
      topic,
      audience,
      objective,
      cta,
      preferredFormat,
      extraContext,
    };

    try {
      window.localStorage.setItem(QUICK_BRIEF_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Autosave is optional; generation should remain usable.
    }
  }, [
    brandName,
    website,
    topic,
    audience,
    objective,
    cta,
    preferredFormat,
    extraContext,
    draftLoaded,
  ]);

  function clearDraft() {
    if (activeBrand.id === ACTIVE_BRAND_ALL) {
      setBrandName("");
      setWebsite("");
    }
    setTopic("");
    setAudience("");
    setObjective("");
    setCta("");
    setPreferredFormat("auto");
    setExtraContext("");
    setError("");

    try {
      window.localStorage.removeItem(QUICK_BRIEF_DRAFT_KEY);
    } catch {
      // Ignore browser storage errors.
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!activeBrandHydrated || activeBrand.id === ACTIVE_BRAND_ALL) {
      setError("Pilih satu Active Brand dari sidebar sebelum membuat Story Angles.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: activeBrand.id,
          brandName,
          website,
          topic,
          audience,
          objective,
          cta,
          preferredFormat,
          extraContext,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Generate gagal.");
      }

      // Important: draft is intentionally NOT cleared here.
      // User can return to "Buat Brief" without filling everything again.
      router.push(`/campaign/${payload.campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate gagal.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

  const hasActiveBrand = activeBrandHydrated && activeBrand.id !== ACTIVE_BRAND_ALL;

  return (
    <AuthGuard>
      <AppHeader />

      <main className="app-workspace px-5 py-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 border-b border-slate-200 pb-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                  Editorial workspace
                </p>
                <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">
                  Brief Studio
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                  Susun konteks utama, lalu gunakan live research untuk
                  menghasilkan lima story angle berbasis kasus.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${hasActiveBrand ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${hasActiveBrand ? "bg-blue-500" : "bg-amber-500"}`} />
                  {hasActiveBrand ? `Active Brand: ${activeBrand.name}` : "Pilih Active Brand"}
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Draft tersimpan otomatis
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section>
              <form
                onSubmit={submit}
                className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">
                      Quick Brief
                    </h2>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">
                      Brand mengikuti Global Brand Selector. Input campaign tetap tersimpan saat Anda berpindah workspace.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={clearDraft}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Kosongkan Form
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    1. Active Brand
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      required
                      readOnly
                      className={`${inputClass} cursor-default bg-slate-50 text-slate-600`}
                      value={brandContextLoading ? "Memuat brand..." : brandName}
                      placeholder="Pilih Active Brand di sidebar"
                    />
                    <input
                      readOnly
                      className={`${inputClass} cursor-default bg-slate-50 text-slate-600`}
                      value={website}
                      placeholder={hasActiveBrand ? "Website belum tersimpan" : "Website mengikuti Active Brand"}
                    />
                  </div>
                  {!hasActiveBrand && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                      Brief Studio membutuhkan satu brand aktif. Pilih brand dari dropdown paling atas di sidebar.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    2. Apa yang ingin dibahas / dipromosikan?
                  </label>
                  <input
                    required
                    className={inputClass}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Contoh: Webinar ISO 37001 / AI for HR / Leadership"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    3. Siapa audience utamanya?
                  </label>
                  <textarea
                    required
                    className={`${inputClass} min-h-24 resize-y`}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Contoh: HR Manager, Head of Compliance, Director, business owner..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    4. Apa hasil yang ingin dicapai?
                  </label>
                  <textarea
                    required
                    className={`${inputClass} min-h-24 resize-y`}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="Contoh: membangun awareness bahwa anti-suap perlu dioperasionalkan sebagai sistem, bukan hanya kebijakan."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    5. CTA
                  </label>
                  <input
                    className={inputClass}
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    placeholder="Opsional — contoh: Ikuti webinar / konsultasikan kebutuhan training"
                  />
                </div>

                <div>
                  <span className="mb-2 block text-sm font-semibold">
                    Format
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["auto", "AI pilih"],
                      ["carousel", "Carousel"],
                      ["reels", "Reels"],
                      ["single_post", "Single Post"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setPreferredFormat(value as typeof preferredFormat)
                        }
                        className={`rounded-full px-4 py-2 text-sm font-medium ${
                          preferredFormat === value
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Advanced context (opsional)
                  </summary>
                  <textarea
                    className={`${inputClass} mt-4 min-h-28 resize-y`}
                    value={extraContext}
                    onChange={(e) => setExtraContext(e.target.value)}
                    placeholder="Hal yang wajib masuk / wajib dihindari, tone khusus, batasan claim, konteks klien, dll."
                  />
                </details>

                {error && (
                  <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  disabled={loading || brandContextLoading || !hasActiveBrand}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading
                    ? "AI sedang riset kasus & menyusun angle..."
                    : "Cari Kasus & Buat 5 Story Angles →"}
                </button>

                <p className="text-center text-xs leading-5 text-slate-400">
                  Live research + evidence selection + Brand Intelligence brand aktif
                  berjalan otomatis di belakang layar.
                </p>
              </form>
            </section>

            <aside>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="px-5 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Workflow
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-slate-950">
                      Campaign terbaru
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {hasActiveBrand ? activeBrand.name : "Semua brand"}
                    </p>
                  </div>
                  <span className="mr-5 mt-5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {history.length}
                  </span>
                </div>

                <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                  {history.length === 0 && (
                    <p className="px-5 py-8 text-center text-sm text-slate-500">
                      Belum ada campaign untuk context ini.
                    </p>
                  )}

                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => router.push(`/campaign/${item.id}`)}
                      className="group w-full px-5 py-4 text-left transition hover:bg-blue-50/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                          {item.product_or_program || item.name}
                        </p>
                        <span className="text-slate-300 group-hover:text-blue-500">
                          →
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {item.objective}
                      </p>
                      <p className="mt-2 text-[11px] font-medium text-slate-400">
                        {new Intl.DateTimeFormat("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(item.created_at))}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
