"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

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

function firstText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join(", ")
      .trim();
  }
  return typeof value === "string" ? value.trim() : "";
}

export default function StudioClient() {
  const router = useRouter();
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

    const supabase = createClient();
    supabase
      .from("campaigns")
      .select("id,name,objective,product_or_program,created_at")
      .contains("priority_topics", [APP_MARKER])
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setHistory((data ?? []) as CampaignRow[]));
  }, []);

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
  }, [brandName, website, topic, audience, objective, cta, preferredFormat, extraContext, draftLoaded]);

  function clearDraft() {
    setBrandName("");
    setWebsite("");
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

  async function resolveBrandIntelligence() {
    const supabase = createClient();
    const { data: matchingBrands, error: brandError } = await supabase
      .from("brands")
      .select("id,name,website,positioning,description")
      .ilike("name", brandName.trim())
      .limit(1);

    if (brandError) throw new Error(brandError.message);
    const brand = matchingBrands?.[0];
    if (!brand) return { resolvedAudience: audience.trim(), resolvedObjective: objective.trim() };

    const { data: guideline, error: guidelineError } = await supabase
      .from("brand_guidelines")
      .select("*")
      .eq("brand_id", brand.id)
      .maybeSingle();

    if (guidelineError) throw new Error(guidelineError.message);

    const resolvedAudience = audience.trim() ||
      firstText(guideline?.target_audiences) ||
      firstText(guideline?.customer_segments);

    // Objective is intentionally optional in Quick Brief. If the saved Brand Intelligence
    // has no explicit campaign objective field, use its value proposition/key messages/PV
    // as editorial context instead of forcing the user to type a duplicate input.
    const guidelineContext = [
      guideline?.value_proposition,
      guideline?.brand_pov,
      firstText(guideline?.key_messages),
      firstText(guideline?.audience_pain_points),
    ].filter((value) => typeof value === "string" && value.trim()).join(" | ");

    return {
      resolvedAudience,
      resolvedObjective: objective.trim() || "Membangun awareness dan consideration yang relevan dengan positioning serta kebutuhan audience brand.",
      guidelineContext,
      brandId: brand.id,
      brandName: brand.name,
      website: website.trim() || brand.website || "",
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!brandName.trim() || !topic.trim()) {
        throw new Error("Brand dan topik/program wajib diisi.");
      }

      const intelligence = await resolveBrandIntelligence();
      if (!intelligence.resolvedAudience) {
        throw new Error("Brand Intelligence belum memiliki target audience. Isi target audience pada Brand Intelligence terlebih dahulu.");
      }

      const mergedExtraContext = [
        intelligence.guidelineContext ? `BRAND INTELLIGENCE CONTEXT: ${intelligence.guidelineContext}` : "",
        extraContext.trim(),
      ].filter(Boolean).join("\n\n");

      const response = await fetch("/api/ai/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: intelligence.brandName || brandName.trim(),
          website: intelligence.website || website.trim(),
          topic: topic.trim(),
          audience: intelligence.resolvedAudience,
          objective: intelligence.resolvedObjective,
          cta: cta.trim(),
          preferredFormat,
          extraContext: mergedExtraContext,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Generate gagal.");

      router.push(`/campaign/${payload.campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate gagal.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

  return (
    <AuthGuard>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <section>
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">3-step workflow</div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">Dari 5 input ke storytelling brief yang siap dieksekusi.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Tidak ada Brand Intelligence form panjang. AI membangun konteks internal, mencari kasus nyata via live research, lalu memberi 5 angle case-led.</p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Draft tersimpan otomatis</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700/80">Pindah ke Content Calendar atau membuka brief lain tidak akan menghapus input ini.</p>
                </div>
                <button type="button" onClick={clearDraft} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Kosongkan Form</button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">1. Brand / perusahaan</label>
                <div className="grid gap-3 md:grid-cols-2">
                  <input required className={inputClass} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Contoh: Proxsis Academy" />
                  <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (opsional)" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">2. Apa yang ingin dibahas / dipromosikan?</label>
                <input required className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: Webinar ISO 37001 / AI for HR / Leadership" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">3. Siapa audience utamanya? <span className="font-normal text-slate-400">(opsional — otomatis dari Brand Intelligence)</span></label>
                <textarea className={`${inputClass} min-h-24 resize-y`} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Kosongkan untuk menggunakan Target Audience dari Brand Intelligence" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">4. Apa hasil yang ingin dicapai? <span className="font-normal text-slate-400">(opsional)</span></label>
                <textarea className={`${inputClass} min-h-24 resize-y`} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Kosongkan untuk menggunakan objective editorial default berbasis Brand Intelligence" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">5. CTA</label>
                <input className={inputClass} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Opsional — contoh: Ikuti webinar / konsultasikan kebutuhan training" />
              </div>

              <div>
                <span className="mb-2 block text-sm font-semibold">Format</span>
                <div className="flex flex-wrap gap-2">
                  {[['auto','AI pilih'],['carousel','Carousel'],['reels','Reels'],['single_post','Single Post']].map(([value,label]) => (
                    <button key={value} type="button" onClick={() => setPreferredFormat(value as typeof preferredFormat)} className={`rounded-full px-4 py-2 text-sm font-medium ${preferredFormat === value ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{label}</button>
                  ))}
                </div>
              </div>

              <details className="rounded-2xl bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Advanced context (opsional)</summary>
                <textarea className={`${inputClass} mt-4 min-h-28 resize-y`} value={extraContext} onChange={(e) => setExtraContext(e.target.value)} placeholder="Hal yang wajib masuk / wajib dihindari, tone khusus, batasan claim, konteks klien, dll." />
              </details>

              {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
                {loading ? "Membaca Brand Intelligence + riset kasus..." : "Cari Kasus & Buat 5 Story Angles →"}
              </button>

              <p className="text-center text-xs leading-5 text-slate-400">Jika Audience dikosongkan, dashboard otomatis mengambil Target Audience dari Brand Intelligence brand yang dipilih.</p>
            </form>
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl bg-slate-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Yang berubah dari v1</p>
              <h2 className="mt-3 text-2xl font-bold">User hanya melihat keputusan yang penting.</h2>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
                <p><strong className="text-white">1. Quick Brief</strong><br />5 input utama, bukan puluhan field Brand Intelligence.</p>
                <p><strong className="text-white">2. Story Angles</strong><br />AI mencari kasus nyata dan langsung memberi 5 angle untuk dipilih.</p>
                <p><strong className="text-white">3. Final Brief</strong><br />Case-first story sequence, quality score, improve with AI, copy, dan export PDF.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Recent StoryBrief campaigns</h2><span className="text-xs text-slate-400">{history.length}</span></div>
              <div className="mt-4 space-y-3">
                {history.length === 0 && <p className="text-sm text-slate-500">Belum ada campaign dari versi Lite.</p>}
                {history.map((item) => (
                  <button key={item.id} onClick={() => router.push(`/campaign/${item.id}`)} className="w-full rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/40">
                    <p className="font-medium text-slate-900">{item.product_or_program || item.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.objective}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </AuthGuard>
  );
}
