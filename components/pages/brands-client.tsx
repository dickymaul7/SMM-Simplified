"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type BrandRow = {
  id: string;
  name: string;
  positioning: string | null;
  description: string | null;
  website: string | null;
};

type GuidelineRow = {
  brand_id: string;
  customer_segments?: string[] | null;
  target_audiences?: string[] | null;
  audience_pain_points?: string[] | null;
  value_proposition?: string | null;
  brand_personality?: string[] | null;
  tone_of_voice?: string | null;
  key_messages?: string[] | null;
  communication_dos?: string[] | null;
  communication_donts?: string[] | null;
  core_expertise?: string[] | null;
  allowed_claims?: string[] | null;
  prohibited_claims?: string[] | null;
  visual_guideline?: Record<string, unknown> | null;
  brand_pov?: string | null;
};

type SourceFile = { name: string; notes?: string };

type ExtractedIntelligence = {
  market_industry?: string;
  market_context?: string;
  market_trends?: string[];
  customer_segments?: string[];
  target_audiences?: string[];
  audience_pain_points?: string[];
  positioning?: string;
  value_proposition?: string;
  differentiation?: string;
  brand_pov?: string;
  capabilities?: string[];
  proof_points?: string[];
  allowed_claims?: string[];
  prohibited_claims?: string[];
  communication_dos?: string[];
  communication_donts?: string[];
  source_files?: SourceFile[];
  confidence_notes?: string[];
};

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toText(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join("\n") : "";
}

function intelligenceFromVisual(visual: Record<string, unknown> | null | undefined) {
  const raw = visual?.brand_intelligence;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {} as Record<string, unknown>;
  return raw as Record<string, unknown>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function BrandsClient() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [guideline, setGuideline] = useState<GuidelineRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confidenceNotes, setConfidenceNotes] = useState<string[]>([]);

  const [newBrandName, setNewBrandName] = useState("");
  const [showAddBrand, setShowAddBrand] = useState(false);

  const [website, setWebsite] = useState("");
  const [marketIndustry, setMarketIndustry] = useState("");
  const [marketContext, setMarketContext] = useState("");
  const [marketTrends, setMarketTrends] = useState("");
  const [customerSegments, setCustomerSegments] = useState("");
  const [targetAudiences, setTargetAudiences] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [positioning, setPositioning] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [differentiation, setDifferentiation] = useState("");
  const [brandPov, setBrandPov] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [proofPoints, setProofPoints] = useState("");
  const [allowedClaims, setAllowedClaims] = useState("");
  const [prohibitedClaims, setProhibitedClaims] = useState("");
  const [communicationDos, setCommunicationDos] = useState("");
  const [communicationDonts, setCommunicationDonts] = useState("");
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedId) ?? null,
    [brands, selectedId],
  );

  const completion = useMemo(() => {
    const required = [
      marketIndustry,
      marketContext,
      customerSegments,
      targetAudiences,
      painPoints,
      positioning,
      valueProposition,
      differentiation,
      capabilities,
    ];
    const filled = required.filter((value) => value.trim().length > 0).length;
    return Math.round((filled / required.length) * 100);
  }, [
    marketIndustry,
    marketContext,
    customerSegments,
    targetAudiences,
    painPoints,
    positioning,
    valueProposition,
    differentiation,
    capabilities,
  ]);

  async function loadBrands(preferredId?: string) {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("brands")
      .select("id,name,positioning,description,website")
      .order("name", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as BrandRow[];
    setBrands(rows);
    const nextId = preferredId || selectedId || rows[0]?.id || "";
    setSelectedId(nextId);
    setLoading(false);
  }

  useEffect(() => {
    void loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const supabase = createClient();
    let active = true;

    async function loadGuideline() {
      setLoading(true);
      setError("");
      const { data, error: guidelineError } = await supabase
        .from("brand_guidelines")
        .select("*")
        .eq("brand_id", selectedId)
        .maybeSingle();

      if (!active) return;
      if (guidelineError) {
        setError(guidelineError.message);
        setLoading(false);
        return;
      }

      const row = (data ?? null) as GuidelineRow | null;
      const brand = brands.find((item) => item.id === selectedId) ?? null;
      const intel = intelligenceFromVisual(row?.visual_guideline);

      setGuideline(row);
      setWebsite(brand?.website ?? "");
      setMarketIndustry(String(intel.market_industry ?? ""));
      setMarketContext(String(intel.market_context ?? ""));
      setMarketTrends(toText(intel.market_trends));
      setCustomerSegments(toText(row?.customer_segments));
      setTargetAudiences(toText(row?.target_audiences));
      setPainPoints(toText(row?.audience_pain_points));
      setPositioning(brand?.positioning ?? String(intel.positioning ?? ""));
      setValueProposition(row?.value_proposition ?? "");
      setDifferentiation(String(intel.differentiation ?? ""));
      setBrandPov(row?.brand_pov ?? "");
      setCapabilities(toText(row?.core_expertise));
      setProofPoints(toText(intel.proof_points));
      setAllowedClaims(toText(row?.allowed_claims));
      setProhibitedClaims(toText(row?.prohibited_claims));
      setCommunicationDos(toText(row?.communication_dos));
      setCommunicationDonts(toText(row?.communication_donts));
      setSourceFiles(Array.isArray(intel.source_files) ? (intel.source_files as SourceFile[]) : []);
      setConfidenceNotes([]);
      setFiles([]);
      setLoading(false);
    }

    void loadGuideline();
    return () => {
      active = false;
    };
  }, [selectedId, brands]);

  async function addBrand() {
    const name = newBrandName.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("brands")
      .insert({
        name,
        slug: `${slugify(name)}-${Date.now().toString().slice(-6)}`,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError(insertError?.message || "Gagal menambahkan brand.");
      setSaving(false);
      return;
    }

    await supabase.from("brand_guidelines").insert({
      brand_id: data.id,
      customer_segments: [],
      target_audiences: [],
      audience_pain_points: [],
      core_expertise: [],
      allowed_claims: [],
      prohibited_claims: [],
      communication_dos: [],
      communication_donts: [],
      visual_guideline: { brand_intelligence: {} },
    });

    setNewBrandName("");
    setShowAddBrand(false);
    await loadBrands(data.id);
    setSaving(false);
  }

  async function extractFiles() {
    if (!files.length) {
      setError("Pilih minimal satu file brand terlebih dahulu.");
      return;
    }

    setExtracting(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      if (selectedBrand) formData.append("brandName", selectedBrand.name);

      const response = await fetch("/api/ai/brand-intelligence/extract", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Ekstraksi Brand Intelligence gagal.");

      const extracted = (payload.data ?? {}) as ExtractedIntelligence;
      if (extracted.market_industry) setMarketIndustry(extracted.market_industry);
      if (extracted.market_context) setMarketContext(extracted.market_context);
      if (extracted.market_trends?.length) setMarketTrends(extracted.market_trends.join("\n"));
      if (extracted.customer_segments?.length) setCustomerSegments(extracted.customer_segments.join("\n"));
      if (extracted.target_audiences?.length) setTargetAudiences(extracted.target_audiences.join("\n"));
      if (extracted.audience_pain_points?.length) setPainPoints(extracted.audience_pain_points.join("\n"));
      if (extracted.positioning) setPositioning(extracted.positioning);
      if (extracted.value_proposition) setValueProposition(extracted.value_proposition);
      if (extracted.differentiation) setDifferentiation(extracted.differentiation);
      if (extracted.brand_pov) setBrandPov(extracted.brand_pov);
      if (extracted.capabilities?.length) setCapabilities(extracted.capabilities.join("\n"));
      if (extracted.proof_points?.length) setProofPoints(extracted.proof_points.join("\n"));
      if (extracted.allowed_claims?.length) setAllowedClaims(extracted.allowed_claims.join("\n"));
      if (extracted.prohibited_claims?.length) setProhibitedClaims(extracted.prohibited_claims.join("\n"));
      if (extracted.communication_dos?.length) setCommunicationDos(extracted.communication_dos.join("\n"));
      if (extracted.communication_donts?.length) setCommunicationDonts(extracted.communication_donts.join("\n"));
      setSourceFiles(extracted.source_files ?? files.map((file) => ({ name: file.name })));
      setConfidenceNotes(extracted.confidence_notes ?? []);
      setMessage("AI selesai membaca file. Review hasilnya lalu klik Save Brand Intelligence.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ekstraksi Brand Intelligence gagal.");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (!selectedBrand) return;
    setSaving(true);
    setError("");
    setMessage("");

    const supabase = createClient();
    const currentVisual = guideline?.visual_guideline ?? {};
    const visualGuideline = {
      ...currentVisual,
      brand_intelligence: {
        ...intelligenceFromVisual(currentVisual),
        market_industry: marketIndustry.trim(),
        market_context: marketContext.trim(),
        market_trends: lines(marketTrends),
        positioning: positioning.trim(),
        differentiation: differentiation.trim(),
        proof_points: lines(proofPoints),
        source_files: sourceFiles,
        updated_at: new Date().toISOString(),
      },
    };

    const { error: brandError } = await supabase
      .from("brands")
      .update({
        website: website.trim() || null,
        positioning: positioning.trim() || null,
        description: valueProposition.trim() || selectedBrand.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedBrand.id);

    if (brandError) {
      setError(brandError.message);
      setSaving(false);
      return;
    }

    const payload = {
      brand_id: selectedBrand.id,
      customer_segments: lines(customerSegments),
      target_audiences: lines(targetAudiences),
      audience_pain_points: lines(painPoints),
      value_proposition: valueProposition.trim() || null,
      brand_pov: brandPov.trim() || null,
      core_expertise: lines(capabilities),
      allowed_claims: lines(allowedClaims),
      prohibited_claims: lines(prohibitedClaims),
      communication_dos: lines(communicationDos),
      communication_donts: lines(communicationDonts),
      visual_guideline: visualGuideline,
      updated_at: new Date().toISOString(),
    };

    const { error: guidelineError } = await supabase
      .from("brand_guidelines")
      .upsert(payload, { onConflict: "brand_id" });

    if (guidelineError) {
      setError(guidelineError.message);
      setSaving(false);
      return;
    }

    setGuideline((current) => ({ ...(current ?? { brand_id: selectedBrand.id }), ...payload }));
    setBrands((current) =>
      current.map((brand) =>
        brand.id === selectedBrand.id
          ? {
              ...brand,
              website: website.trim() || null,
              positioning: positioning.trim() || null,
              description: valueProposition.trim() || brand.description,
            }
          : brand,
      ),
    );
    setMessage("Brand Intelligence tersimpan dan akan dipakai otomatis oleh AI saat membuat brief.");
    setSaving(false);
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50";
  const textareaClass = `${inputClass} min-h-28 resize-y`;

  return (
    <AuthGuard>
      <AppHeader />
      <main className="app-workspace px-5 py-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Brand workspace</p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">Brand Intelligence</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
                Simpan pemahaman Market, Customer, Positioning, dan Capabilities sekali per brand. AI akan memakai konteks ini saat riset kasus, membuat Story Angles, dan mengecek alignment brief.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="min-w-60 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800"
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddBrand((value) => !value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Add Brand
              </button>
            </div>
          </header>

          {showAddBrand && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-blue-700">Nama brand baru</label>
                <input value={newBrandName} onChange={(event) => setNewBrandName(event.target.value)} className={inputClass} placeholder="Contoh: FS Institute" />
              </div>
              <button type="button" disabled={saving || !newBrandName.trim()} onClick={addBrand} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                Tambahkan Brand
              </button>
            </div>
          )}

          {loading && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Memuat Brand Intelligence...</div>}

          {!loading && !selectedBrand && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h2 className="text-lg font-semibold text-slate-900">Belum ada brand</h2>
              <p className="mt-2 text-sm text-slate-500">Tambahkan brand pertama untuk mulai membangun Brand Intelligence.</p>
            </div>
          )}

          {!loading && selectedBrand && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <section className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Fast onboarding</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">Upload file brand</h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                        Upload company profile, brand guideline, strategy deck yang sudah diexport ke PDF, atau file teks. AI akan mengekstrak STP + capabilities lalu mengisi form di bawah untuk direview manusia.
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Human review required</span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md,.csv,.json,.html,.xml,application/pdf,text/plain,text/csv,application/json"
                      onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {files.map((file) => (
                        <span key={`${file.name}-${file.size}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{file.name}</span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">PDF memberi hasil terbaik karena Gemini dapat memahami layout, tabel, dan visual. Untuk DOCX/PPTX/XLSX, export ke PDF terlebih dahulu untuk hasil yang paling stabil.</p>
                    <button
                      type="button"
                      onClick={extractFiles}
                      disabled={extracting || !files.length}
                      className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {extracting ? "AI sedang membaca file..." : "Extract Brand Intelligence with AI"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">01 · Understand Market</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">Market</h2>
                    </div>
                    <Field label="Industry / market yang dilayani">
                      <input className={inputClass} value={marketIndustry} onChange={(e) => setMarketIndustry(e.target.value)} placeholder="Contoh: Professional Training, GRC, Compliance" />
                    </Field>
                    <Field label="Website brand">
                      <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
                    </Field>
                    <Field label="Market context" wide>
                      <textarea className={textareaClass} value={marketContext} onChange={(e) => setMarketContext(e.target.value)} placeholder="Apa yang sedang berubah di market? Apa isu bisnis yang relevan?" />
                    </Field>
                    <Field label="Tren / isu market" hint="Satu poin per baris" wide>
                      <textarea className={textareaClass} value={marketTrends} onChange={(e) => setMarketTrends(e.target.value)} placeholder="Regulatory pressure meningkat\nAI adoption\nFraud prevention..." />
                    </Field>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">02 · STP</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">Customers & Positioning</h2>
                    </div>
                    <Field label="Segmentation" hint="Satu segmen per baris">
                      <textarea className={textareaClass} value={customerSegments} onChange={(e) => setCustomerSegments(e.target.value)} placeholder="Enterprise\nBUMN\nRegulated industries" />
                    </Field>
                    <Field label="Targeting / priority audience" hint="Satu audience per baris">
                      <textarea className={textareaClass} value={targetAudiences} onChange={(e) => setTargetAudiences(e.target.value)} placeholder="Head of Compliance\nRisk Manager\nDirector" />
                    </Field>
                    <Field label="Customer problems / jobs-to-be-done" hint="Satu masalah per baris" wide>
                      <textarea className={textareaClass} value={painPoints} onChange={(e) => setPainPoints(e.target.value)} placeholder="Butuh sistem yang bisa diimplementasikan\nSulit menerjemahkan standar ke proses bisnis..." />
                    </Field>
                    <Field label="Positioning">
                      <textarea className={textareaClass} value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="Brand ingin dikenal sebagai apa?" />
                    </Field>
                    <Field label="Value proposition">
                      <textarea className={textareaClass} value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} placeholder="Value yang dijanjikan kepada audience." />
                    </Field>
                    <Field label="Differentiation" wide>
                      <textarea className={textareaClass} value={differentiation} onChange={(e) => setDifferentiation(e.target.value)} placeholder="Apa pembeda utama dibanding alternatif/kompetitor?" />
                    </Field>
                    <Field label="Brand POV" wide>
                      <textarea className={textareaClass} value={brandPov} onChange={(e) => setBrandPov(e.target.value)} placeholder="Sudut pandang khas brand terhadap masalah audience." />
                    </Field>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">03 · Capabilities</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">Capabilities, Proof & Guardrails</h2>
                    </div>
                    <Field label="Core capabilities / expertise" hint="Satu capability per baris">
                      <textarea className={textareaClass} value={capabilities} onChange={(e) => setCapabilities(e.target.value)} placeholder="ISO Training\nGovernance\nRisk Management" />
                    </Field>
                    <Field label="Proof points" hint="Client, case, certification, product, evidence">
                      <textarea className={textareaClass} value={proofPoints} onChange={(e) => setProofPoints(e.target.value)} placeholder="Daftar bukti yang aman digunakan oleh AI." />
                    </Field>
                    <Field label="Allowed claims">
                      <textarea className={textareaClass} value={allowedClaims} onChange={(e) => setAllowedClaims(e.target.value)} placeholder="Klaim yang boleh dibuat." />
                    </Field>
                    <Field label="Prohibited claims">
                      <textarea className={textareaClass} value={prohibitedClaims} onChange={(e) => setProhibitedClaims(e.target.value)} placeholder="Klaim yang tidak boleh dibuat." />
                    </Field>
                    <Field label="Communication do's">
                      <textarea className={textareaClass} value={communicationDos} onChange={(e) => setCommunicationDos(e.target.value)} placeholder="Apa yang perlu selalu dilakukan dalam komunikasi brand?" />
                    </Field>
                    <Field label="Communication don'ts">
                      <textarea className={textareaClass} value={communicationDonts} onChange={(e) => setCommunicationDonts(e.target.value)} placeholder="Apa yang harus dihindari?" />
                    </Field>
                  </div>
                </div>

                {(error || message) && (
                  <div className={`rounded-2xl px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {error || message}
                  </div>
                )}

                <div className="sticky bottom-4 z-10 flex justify-end">
                  <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 disabled:opacity-50">
                    {saving ? "Menyimpan..." : "Save Brand Intelligence"}
                  </button>
                </div>
              </section>

              <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Completeness</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{completion}%</p>
                    </div>
                    <div className="h-14 w-14 rounded-full border-4 border-blue-100 p-1">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{completion}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${completion}%` }} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">Semakin lengkap konteks ini, semakin presisi AI memilih kasus, angle, audience relevance, dan capability bridge.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">How AI uses this</p>
                  <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
                    <p><strong className="text-white">Research</strong><br />Mencari kasus yang relevan dengan market dan problem audience.</p>
                    <p><strong className="text-white">Story Angles</strong><br />Memilih tension dan insight yang mendukung positioning brand.</p>
                    <p><strong className="text-white">Full Brief</strong><br />Menjaga capability bridge dan CTA tetap natural.</p>
                    <p><strong className="text-white">Alignment QC</strong><br />Mengecek apakah brief konsisten dengan audience, positioning, capabilities, dan guardrails.</p>
                  </div>
                </div>

                {sourceFiles.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Source files</p>
                    <div className="mt-3 space-y-3">
                      {sourceFiles.map((source, index) => (
                        <div key={`${source.name}-${index}`} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">{source.name}</p>
                          {source.notes && <p className="mt-1 text-xs leading-5 text-slate-500">{source.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {confidenceNotes.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Needs human review</p>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-800">
                      {confidenceNotes.map((note) => <li key={note}>• {note}</li>)}
                    </ul>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}

function Field({ label, hint, wide = false, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "lg:col-span-2" : ""}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-semibold text-slate-800">{label}</label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
