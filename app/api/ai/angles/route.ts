import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { average, clampScore, compactJson, createStructuredJson, loadStorytellingKnowledge, slugify } from "@/lib/ai/core";
import { angleSynthesisSchema, queryPlanSchema } from "@/lib/ai/schemas";
import { normalizeSources, tavilySearch } from "@/lib/ai/tavily";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const APP_MARKER = "__storybrief_lite__";

type QuickBrief = {
  brandName: string;
  website?: string;
  topic: string;
  audience: string;
  objective: string;
  cta?: string;
  preferredFormat?: "auto" | "carousel" | "reels" | "single_post";
  extraContext?: string;
};

type QueryPlan = { queries: string[] };

type Synthesis = {
  brand_profile: {
    positioning: string;
    value_proposition: string;
    audience_pain_points: string[];
    tone_of_voice: string;
    key_messages: string[];
    brand_pov: string;
    core_expertise: string[];
    communication_dos: string[];
    communication_donts: string[];
  };
  campaign: {
    desired_perception: string;
    business_problem: string;
    key_message: string;
    funnel_stage: "awareness" | "consideration" | "conversion";
  };
  cases: Array<{
    key: string;
    company_name: string;
    case_title: string;
    case_summary: string;
    business_problem: string;
    tension: string;
    decision_or_move: string;
    mechanism: string;
    outcome: string;
    executive_implication: string;
    relevance_score: number;
    credibility_score: number;
    tension_score: number;
    executive_value_score: number;
    brand_fit_score: number;
    confidence: "low" | "medium" | "high";
    sources: Array<{ ref: string; source_type: string; fact_notes: string }>;
  }>;
  ideas: Array<{
    case_key: string;
    working_title: string;
    content_angle: string;
    tension: string;
    core_insight: string;
    recommended_format: "carousel" | "reels" | "single_post";
    campaign_relevance: string;
  }>;
};

function errorJson(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function formatLabel(format: QuickBrief["preferredFormat"]) {
  if (format === "carousel") return "Utamakan carousel.";
  if (format === "reels") return "Utamakan Reels.";
  if (format === "single_post") return "Utamakan single post.";
  return "Pilih format terbaik per angle berdasarkan kekuatan cerita.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<QuickBrief>;
    const input: QuickBrief = {
      brandName: String(body.brandName ?? "").trim(),
      website: String(body.website ?? "").trim(),
      topic: String(body.topic ?? "").trim(),
      audience: String(body.audience ?? "").trim(),
      objective: String(body.objective ?? "").trim(),
      cta: String(body.cta ?? "").trim(),
      preferredFormat: body.preferredFormat ?? "auto",
      extraContext: String(body.extraContext ?? "").trim(),
    };

    if (!input.brandName || !input.topic || !input.audience || !input.objective) {
      return errorJson("Brand, topik/program, target audience, dan objective wajib diisi.");
    }
    if (!process.env.GEMINI_API_KEY?.trim()) return errorJson("GEMINI_API_KEY belum dikonfigurasi.", 503);
    if (!process.env.TAVILY_API_KEY?.trim()) return errorJson("TAVILY_API_KEY belum dikonfigurasi.", 503);

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid. Silakan sign in ulang.", 401);

    const { data: matchingBrands, error: brandLookupError } = await supabase
      .from("brands")
      .select("*")
      .ilike("name", input.brandName)
      .limit(1);
    if (brandLookupError) return errorJson(brandLookupError.message, 500);

    const existingBrand = matchingBrands?.[0] ?? null;
    let existingGuideline: any = null;
    if (existingBrand) {
      const result = await supabase.from("brand_guidelines").select("*").eq("brand_id", existingBrand.id).maybeSingle();
      if (result.error) return errorJson(result.error.message, 500);
      existingGuideline = result.data;
    }

    const knowledge = await loadStorytellingKnowledge();
    const today = new Date().toISOString().slice(0, 10);
    const queryPlan = await createStructuredJson<QueryPlan>({
      schema: queryPlanSchema as unknown as Record<string, unknown>,
      system: "Kamu adalah search strategist untuk riset case study B2B. Tugasmu hanya membuat query pencarian yang presisi.",
      user: `
TANGGAL: ${today}

QUICK CAMPAIGN BRIEF:
${compactJson(input)}

EXISTING BRAND CONTEXT (jika tersedia):
${compactJson(existingGuideline ? {
  positioning: existingBrand?.positioning,
  target_audiences: existingGuideline.target_audiences,
  audience_pain_points: existingGuideline.audience_pain_points,
  core_expertise: existingGuideline.core_expertise,
  brand_pov: existingGuideline.brand_pov,
} : null)}

Buat tepat 4 query web untuk menemukan kasus perusahaan/organisasi nyata yang relevan dengan topik dan business problem campaign.
1. Query recent incident/failure/enforcement/strategic tension.
2. Query official/regulator/company evidence.
3. Query implementation/turnaround/successful response.
4. Query benchmark case yang lebih lama bila punya mekanisme kuat.

Query harus mencari nama perusahaan, kejadian konkret, konsekuensi, keputusan, dan mechanism. Jangan tulis copy sosial media.
`,
      temperature: 0.2,
    });

    const queries = queryPlan.queries.map((q) => q.trim()).filter(Boolean).slice(0, 4);
    if (queries.length < 4) return errorJson("AI gagal membuat search query yang cukup.", 502);

    const batches = await Promise.all(queries.map(async (query) => ({ query, results: await tavilySearch(query) })));
    const webSources = normalizeSources(batches);
    if (webSources.length < 5) return errorJson("Source live research terlalu sedikit. Coba perjelas topik atau objective.", 502);

    const sourceCatalog = webSources.map((s) => `${s.ref} | ${s.publisher} | ${s.title} | ${s.url}\nSNIPPET: ${s.content}`).join("\n\n");

    const synthesis = await createStructuredJson<Synthesis>({
      schema: angleSynthesisSchema as unknown as Record<string, unknown>,
      system: "Kamu adalah gabungan senior B2B researcher, content strategist, dan executive storyteller. Semua output human-facing wajib Bahasa Indonesia. Kamu menolak konten generik.",
      user: `
EDITORIAL KNOWLEDGE BASE:
${knowledge}

QUICK INPUT — ini sengaja singkat. Bangun konteks editorial yang dibutuhkan secara konservatif:
${compactJson(input)}

EXISTING BRAND INTELLIGENCE — gunakan jika tersedia, jangan bertentangan tanpa alasan:
${compactJson(existingGuideline ? { brand: existingBrand, guideline: existingGuideline } : null)}

LIVE WEB SOURCES — fakta kasus hanya boleh berasal dari katalog ini:
${sourceCatalog}

TUGAS:
1. Bentuk hidden brand profile yang cukup untuk menulis konten berkualitas. Ini adalah editorial inference, bukan klaim fakta perusahaan.
2. Turunkan campaign logic: desired perception, business problem, key message, funnel stage.
3. Pilih 3-4 kasus nyata dengan tension + mechanism kuat. Setiap kasus idealnya punya >=2 source refs.
4. Buat tepat 5 content angles yang case-led dan non-generic.

ATURAN KUALITAS:
- Jangan membuat ide dari topik saja. Wajib Case/Evidence → Tension → Mechanism → Insight → Brand POV.
- Judul harus spesifik dan curiosity-driving tanpa clickbait palsu.
- Utamakan kasus yang membuat audience berpikir “kok bisa?”.
- Jangan membuat angka, quote, motive, legal finding, atau hubungan sebab-akibat yang tidak didukung source.
- Semua human-facing text dalam Bahasa Indonesia; nama perusahaan, produk, istilah resmi, dan judul sumber boleh tetap asli.
- Audience adalah ${input.audience}. Beri implikasi yang relevan dengan senioritas/profesi mereka.
- ${formatLabel(input.preferredFormat)}
- Extra context user: ${input.extraContext || "Tidak ada."}
- Brand promotion tidak boleh muncul terlalu cepat; insight harus earned.
`,
      temperature: 0.35,
    });

    const sourceMap = new Map(webSources.map((source) => [source.ref, source]));
    const normalizedCases = synthesis.cases.map((item) => {
      const mappedSources = item.sources
        .map((s) => ({ ...s, source: sourceMap.get(s.ref) }))
        .filter((s) => Boolean(s.source));
      const avg = average([
        clampScore(item.relevance_score),
        clampScore(item.credibility_score),
        clampScore(item.tension_score),
        clampScore(item.executive_value_score),
        clampScore(item.brand_fit_score),
      ]);
      return { item, mappedSources, avg };
    });

    const eligible = normalizedCases.filter((c) => c.mappedSources.length >= 2 && c.item.confidence !== "low");
    if (eligible.length < 2) return errorJson("AI belum menemukan minimal dua kasus yang cukup terverifikasi. Coba perjelas topik campaign.", 502);
    const best = [...eligible].sort((a, b) => b.avg - a.avg)[0];

    let brandId = existingBrand?.id as string | undefined;
    if (!brandId) {
      const { data: insertedBrand, error } = await supabase.from("brands").insert({
        name: input.brandName,
        slug: `${slugify(input.brandName)}-${Date.now().toString().slice(-6)}`,
        positioning: synthesis.brand_profile.positioning || null,
        description: synthesis.brand_profile.value_proposition || null,
        website: input.website || null,
      }).select("id").single();
      if (error || !insertedBrand) throw new Error(error?.message || "Gagal membuat brand.");
      brandId = insertedBrand.id;
    } else {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (!existingBrand.positioning) update.positioning = synthesis.brand_profile.positioning;
      if (!existingBrand.description) update.description = synthesis.brand_profile.value_proposition;
      if (!existingBrand.website && input.website) update.website = input.website;
      await supabase.from("brands").update(update).eq("id", brandId);
    }

    if (!existingGuideline) {
      const { error } = await supabase.from("brand_guidelines").insert({
        brand_id: brandId,
        customer_segments: [input.audience],
        target_audiences: [input.audience],
        audience_pain_points: synthesis.brand_profile.audience_pain_points,
        value_proposition: synthesis.brand_profile.value_proposition,
        brand_personality: ["strategis", "evidence-led", "praktis"],
        tone_of_voice: synthesis.brand_profile.tone_of_voice,
        key_messages: synthesis.brand_profile.key_messages,
        communication_dos: synthesis.brand_profile.communication_dos,
        communication_donts: synthesis.brand_profile.communication_donts,
        core_expertise: synthesis.brand_profile.core_expertise,
        allowed_claims: ["Klaim harus didukung evidence atau dinyatakan sebagai perspektif/interpretasi."],
        prohibited_claims: ["Superlatif, angka, hasil, dan klaim kapabilitas yang tidak terverifikasi."],
        visual_guideline: {},
        brand_pov: synthesis.brand_profile.brand_pov,
      });
      if (error) throw new Error(error.message);
    }

    const campaignName = `${input.topic} — ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`;
    const { data: campaign, error: campaignError } = await supabase.from("campaigns").insert({
      brand_id: brandId,
      name: campaignName,
      objective: input.objective,
      desired_perception: synthesis.campaign.desired_perception,
      funnel_stage: synthesis.campaign.funnel_stage,
      target_audience_override: [input.audience],
      priority_topics: [APP_MARKER, input.topic],
      business_problem: synthesis.campaign.business_problem,
      product_or_program: input.topic,
      key_message: synthesis.campaign.key_message,
      cta: input.cta || null,
      content_target: 5,
      status: "draft",
    }).select("id").single();
    if (campaignError || !campaign) throw new Error(campaignError?.message || "Gagal membuat campaign.");

    const caseIdByKey = new Map<string, string>();
    for (const c of normalizedCases) {
      const verified = c.mappedSources.length >= 2 && c.item.confidence !== "low";
      const { data: inserted, error } = await supabase.from("research_cases").insert({
        campaign_id: campaign.id,
        company_name: c.item.company_name || null,
        case_title: c.item.case_title,
        case_summary: c.item.case_summary,
        business_problem: c.item.business_problem,
        tension: c.item.tension,
        decision_or_move: c.item.decision_or_move,
        mechanism: c.item.mechanism,
        outcome: c.item.outcome,
        executive_implication: c.item.executive_implication,
        relevance_score: clampScore(c.item.relevance_score),
        credibility_score: clampScore(c.item.credibility_score),
        tension_score: clampScore(c.item.tension_score),
        executive_value_score: clampScore(c.item.executive_value_score),
        brand_fit_score: clampScore(c.item.brand_fit_score),
        confidence: c.item.confidence,
        selected: c === best,
        research_status: verified ? "verified" : "candidate",
      }).select("id").single();
      if (error || !inserted) throw new Error(error?.message || "Gagal menyimpan research case.");
      caseIdByKey.set(c.item.key, inserted.id);

      if (c.mappedSources.length) {
        const rows = c.mappedSources.map((mapped, index) => ({
          research_case_id: inserted.id,
          source_type: mapped.source_type,
          publisher: mapped.source!.publisher,
          title: mapped.source!.title,
          url: mapped.source!.url,
          source_rank: index + 1,
          fact_notes: mapped.fact_notes,
        }));
        const { error: sourceError } = await supabase.from("research_sources").insert(rows);
        if (sourceError) throw new Error(sourceError.message);
      }
    }

    const bestId = caseIdByKey.get(best.item.key)!;
    const ideaRows = synthesis.ideas.map((idea) => {
      const referencedCase = caseIdByKey.get(idea.case_key) || bestId;
      const preferred = input.preferredFormat && input.preferredFormat !== "auto" ? input.preferredFormat : idea.recommended_format;
      return {
        campaign_id: campaign.id,
        pillar_id: null,
        research_case_id: referencedCase,
        working_title: idea.working_title,
        content_angle: idea.content_angle,
        tension: idea.tension,
        core_insight: idea.core_insight,
        storytelling_pattern: "Strategic Case-to-Capability",
        recommended_format: preferred,
        campaign_relevance: idea.campaign_relevance,
        status: "idea",
      };
    });

    const { error: ideaError } = await supabase.from("content_ideas").insert(ideaRows);
    if (ideaError) throw new Error(ideaError.message);

    return NextResponse.json({ ok: true, campaignId: campaign.id, ideasCreated: ideaRows.length, verifiedCases: eligible.length });
  } catch (error) {
    console.error("StoryBrief angles error", error);
    return errorJson(error instanceof Error ? error.message : "Gagal menghasilkan storytelling angles.", 500);
  }
}
