import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { average, clampScore, compactJson, createStructuredJson, loadStorytellingKnowledge, slugify } from "@/lib/ai/core";
import { angleSynthesisSchema, queryPlanSchema } from "@/lib/ai/schemas";
import { normalizeSources, tavilySearch } from "@/lib/ai/tavily";
import { buildIndonesiaNewsQueries, normalizeIndonesiaNews, tavilyNewsSearch } from "@/lib/ai/indonesia-news";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const APP_MARKER = "__storybrief_lite__";
const MAX_ANGLES = 10;
const DEFAULT_ANGLES = 5;

type QuickBrief = {
  brandId?: string;
  brandName: string;
  website?: string;
  topic: string;
  audience: string;
  objective: string;
  cta?: string;
  preferredFormat?: "auto" | "carousel" | "reels" | "single_post";
  extraContext?: string;
  storyAngleCount?: number;
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
    const requested = Number(body.storyAngleCount ?? DEFAULT_ANGLES);
    const storyAngleCount = Number.isFinite(requested)
      ? Math.min(MAX_ANGLES, Math.max(1, Math.round(requested)))
      : DEFAULT_ANGLES;

    const input: QuickBrief = {
      brandId: String(body.brandId ?? "").trim() || undefined,
      brandName: String(body.brandName ?? "").trim(),
      website: String(body.website ?? "").trim(),
      topic: String(body.topic ?? "").trim(),
      audience: String(body.audience ?? "").trim(),
      objective: String(body.objective ?? "").trim(),
      cta: String(body.cta ?? "").trim(),
      preferredFormat: body.preferredFormat ?? "auto",
      extraContext: String(body.extraContext ?? "").trim(),
      storyAngleCount,
    };

    if ((!input.brandId && !input.brandName) || !input.topic || !input.audience || !input.objective) {
      return errorJson("Brand, topik/program, target audience, dan objective wajib diisi.");
    }
    if (!process.env.DEEPSEEK_API_KEY?.trim()) return errorJson("DEEPSEEK_API_KEY belum dikonfigurasi.", 503);
    if (!process.env.TAVILY_API_KEY?.trim()) return errorJson("TAVILY_API_KEY belum dikonfigurasi.", 503);

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid. Silakan sign in ulang.", 401);

    let existingBrand: any = null;
    if (input.brandId) {
      const { data, error } = await supabase.from("brands").select("*").eq("id", input.brandId).maybeSingle();
      if (error) return errorJson(error.message, 500);
      if (!data) return errorJson("Active Brand tidak ditemukan. Pilih ulang brand dari sidebar.", 404);
      existingBrand = data;
      input.brandName = data.name;
      if (!input.website && data.website) input.website = data.website;
    } else {
      const { data, error } = await supabase.from("brands").select("*").ilike("name", input.brandName).limit(1);
      if (error) return errorJson(error.message, 500);
      existingBrand = data?.[0] ?? null;
    }

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
      user: `TANGGAL: ${today}\n\nQUICK CAMPAIGN BRIEF:\n${compactJson(input)}\n\nEXISTING BRAND CONTEXT:\n${compactJson(existingGuideline ? { positioning: existingBrand?.positioning, target_audiences: existingGuideline.target_audiences, audience_pain_points: existingGuideline.audience_pain_points, core_expertise: existingGuideline.core_expertise, brand_pov: existingGuideline.brand_pov } : null)}\n\nBuat tepat 4 query web untuk menemukan kasus perusahaan/organisasi nyata yang relevan dengan topik dan business problem campaign. Query harus mencari nama perusahaan, kejadian konkret, konsekuensi, keputusan, dan mechanism. Jangan tulis copy sosial media.`,
      temperature: 0.2,
    });

    const queries = (queryPlan?.queries ?? []).filter((q): q is string => typeof q === "string").map((q) => q.trim()).filter(Boolean);
    if (queries.length !== 4) return errorJson("Format respons AI tidak lengkap. Silakan generate ulang.", 502);

    const [globalBatches, indonesiaBatches] = await Promise.all([
      Promise.all(queries.map(async (query) => ({ query, results: await tavilySearch(query) }))),
      Promise.all(buildIndonesiaNewsQueries(input).map(async (query) => ({ query, results: await tavilyNewsSearch(query) }))),
    ]);

    const webSources = normalizeSources(globalBatches);
    const indonesiaNews = normalizeIndonesiaNews(indonesiaBatches);
    if (webSources.length < 5 && indonesiaNews.length < 5) {
      return errorJson("Source live research terlalu sedikit. Coba perjelas topik atau objective.", 502);
    }

    const globalCatalog = webSources.map((s) => `${s.ref} | GLOBAL | ${s.publisher} | ${s.title} | ${s.url}\nSNIPPET: ${s.content}`).join("\n\n");
    const indonesiaCatalog = indonesiaNews.map((s) => `${s.ref} | INDONESIA NEWS | ${s.publisher} | ${s.title} | ${s.url}\nSNIPPET: ${s.content}`).join("\n\n");
    const sourceCatalog = [globalCatalog, indonesiaCatalog].filter(Boolean).join("\n\n=== END SOURCE GROUP ===\n\n");

    const synthesis = await createStructuredJson<Synthesis>({
      schema: angleSynthesisSchema as unknown as Record<string, unknown>,
      system: "Kamu adalah gabungan senior B2B researcher, content strategist, dan executive storyteller. Semua output human-facing wajib Bahasa Indonesia. Kamu menolak konten generik. Berita Indonesia adalah sinyal tren dan bahan case/evidence, bukan alasan untuk mengejar viralitas secara buta.",
      user: `EDITORIAL KNOWLEDGE BASE:\n${knowledge}\n\nQUICK INPUT:\n${compactJson(input)}\n\nEXISTING BRAND INTELLIGENCE:\n${compactJson(existingGuideline ? { brand: existingBrand, guideline: existingGuideline } : null)}\n\nGLOBAL/INDUSTRY WEB SOURCES:\n${globalCatalog || "Tidak ada sumber global yang cukup."}\n\nINDONESIAN NEWS — BERITA TERBARU MAKSIMAL 7 HARI:\n${indonesiaCatalog || "Tidak ada berita Indonesia yang relevan ditemukan."}\n\nATURAN NEWS INTELLIGENCE:\n- Prioritaskan berita Indonesia yang aktual dan relevan dengan topic, audience, objective, atau business problem.\n- Gunakan berita Indonesia sebagai signal/trend atau case evidence; jangan menganggap headline otomatis penting hanya karena sedang ramai.\n- Jangan membuat klaim bahwa suatu berita "viral", "paling ramai", atau "sedang trending" kecuali sumber benar-benar mendukungnya.\n- Jika berita Indonesia hanya relevan secara permukaan, abaikan. Relevansi strategis lebih penting daripada recency.\n- Untuk fakta yang berasal dari berita, pertahankan source ref dan jangan mengarang detail yang tidak ada di snippet.\n- Global/official/industry sources tetap boleh menjadi sumber utama; Indonesia news menambah konteks lokal dan recency.\n\nTUGAS:\n1. Bentuk hidden brand profile yang cukup untuk menulis konten berkualitas.\n2. Turunkan campaign logic: desired perception, business problem, key message, funnel stage.\n3. Pilih 3-4 kasus nyata dengan tension + mechanism kuat. Setiap kasus idealnya punya >=2 source refs.\n4. Jika ada berita Indonesia yang punya relevance + storytelling potential tinggi, prioritaskan atau gunakan sebagai konteks lokal untuk case.\n5. Buat HINGGA ${storyAngleCount} content angles yang case-led dan non-generic. Usahakan mencapai jumlah yang diminta hanya jika setiap angle benar-benar berbeda dan kuat. Jika kualitas turun, berhenti lebih awal; jangan membuat filler.\n\nATURAN KUALITAS:\n- Setiap angle wajib mengikuti Case/Evidence → Tension → Mechanism → Insight → Brand POV.\n- Jangan membuat angle hanya dengan mengganti headline dari angle lain.\n- Setiap angle harus memiliki thesis, tension, mechanism, dan audience implication yang berbeda.\n- Judul harus spesifik dan curiosity-driving tanpa clickbait palsu.\n- Jangan membuat angka, quote, motive, legal finding, motive, atau hubungan sebab-akibat yang tidak didukung source.\n- Semua human-facing text dalam Bahasa Indonesia; nama perusahaan, produk, istilah resmi, dan judul sumber boleh tetap asli.\n- Audience adalah ${input.audience}. Beri implikasi yang relevan dengan senioritas/profesi mereka.\n- ${formatLabel(input.preferredFormat)}\n- Extra context user: ${input.extraContext || "Tidak ada."}\n- Brand promotion tidak boleh muncul terlalu cepat; insight harus earned.`,
      temperature: 0.35,
    });

    const synthesisCases = Array.isArray(synthesis?.cases) ? synthesis.cases : [];
    const synthesisIdeas = Array.isArray(synthesis?.ideas) ? synthesis.ideas.slice(0, storyAngleCount) : [];
    if (!synthesis?.brand_profile || !synthesis?.campaign || !synthesisCases.length || !synthesisIdeas.length) {
      return errorJson("Format respons AI tidak lengkap. Silakan generate ulang.", 502);
    }
    if (synthesisIdeas.length > storyAngleCount) return errorJson("AI mengembalikan jumlah story angle melebihi permintaan.", 502);

    const sourceMap = new Map([...webSources, ...indonesiaNews].map((source) => [source.ref, source]));
    const normalizedCases = synthesisCases.map((item) => {
      const itemSources = Array.isArray(item?.sources) ? item.sources : [];
      const mappedSources = itemSources.map((s) => ({ ...s, source: sourceMap.get(s.ref) })).filter((s) => Boolean(s.source));
      const avg = average([clampScore(item.relevance_score), clampScore(item.credibility_score), clampScore(item.tension_score), clampScore(item.executive_value_score), clampScore(item.brand_fit_score)]);
      return { item, mappedSources, avg };
    });
    const eligible = normalizedCases.filter((c) => c.mappedSources.length >= 2 && c.item.confidence !== "low");
    if (eligible.length < 2) return errorJson("AI belum menemukan minimal dua kasus yang cukup terverifikasi. Coba perjelas topik campaign.", 502);
    const best = [...eligible].sort((a, b) => b.avg - a.avg)[0];

    let brandId = existingBrand?.id as string | undefined;
    if (!brandId) {
      const { data: insertedBrand, error } = await supabase.from("brands").insert({ name: input.brandName, slug: `${slugify(input.brandName)}-${Date.now().toString().slice(-6)}`, positioning: synthesis.brand_profile.positioning || null, description: synthesis.brand_profile.value_proposition || null, website: input.website || null }).select("id").single();
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
      content_target: synthesisIdeas.length,
      status: "draft",
    }).select("id").single();
    if (campaignError || !campaign) throw new Error(campaignError?.message || "Gagal membuat campaign.");

    const caseIdByKey = new Map<string, string>();
    for (const c of normalizedCases) {
      const verified = c.mappedSources.length >= 2 && c.item.confidence !== "low";
      const { data: inserted, error } = await supabase.from("research_cases").insert({ campaign_id: campaign.id, company_name: c.item.company_name || null, case_title: c.item.case_title, case_summary: c.item.case_summary, business_problem: c.item.business_problem, tension: c.item.tension, decision_or_move: c.item.decision_or_move, mechanism: c.item.mechanism, outcome: c.item.outcome, executive_implication: c.item.executive_implication, relevance_score: clampScore(c.item.relevance_score), credibility_score: clampScore(c.item.credibility_score), tension_score: clampScore(c.item.tension_score), executive_value_score: clampScore(c.item.executive_value_score), brand_fit_score: clampScore(c.item.brand_fit_score), confidence: c.item.confidence, selected: c === best, research_status: verified ? "verified" : "candidate" }).select("id").single();
      if (error || !inserted) throw new Error(error?.message || "Gagal menyimpan research case.");
      caseIdByKey.set(c.item.key, inserted.id);
      if (c.mappedSources.length) {
        const rows = c.mappedSources.map((mapped, index) => ({ research_case_id: inserted.id, source_type: mapped.source_type, publisher: mapped.source!.publisher, title: mapped.source!.title, url: mapped.source!.url, source_rank: index + 1, fact_notes: mapped.fact_notes }));
        const { error: sourceError } = await supabase.from("research_sources").insert(rows);
        if (sourceError) throw new Error(sourceError.message);
      }
    }

    const bestId = caseIdByKey.get(best.item.key)!;
    const ideaRows = synthesisIdeas.map((idea) => {
      const referencedCase = caseIdByKey.get(idea.case_key) || bestId;
      const preferred = input.preferredFormat && input.preferredFormat !== "auto" ? input.preferredFormat : idea.recommended_format;
      return { campaign_id: campaign.id, pillar_id: null, research_case_id: referencedCase, working_title: idea.working_title, content_angle: idea.content_angle, tension: idea.tension, core_insight: idea.core_insight, storytelling_pattern: "Strategic Case-to-Capability", recommended_format: preferred, campaign_relevance: idea.campaign_relevance, status: "idea" };
    });
    const { error: ideaError } = await supabase.from("content_ideas").insert(ideaRows);
    if (ideaError) throw new Error(ideaError.message);

    return NextResponse.json({ ok: true, campaignId: campaign.id, ideasCreated: ideaRows.length, requestedStoryAngles: storyAngleCount, verifiedCases: eligible.length, indonesiaNewsSources: indonesiaNews.length });
  } catch (error) {
    console.error("StoryBrief angles-v2 error", error);
    return errorJson(error instanceof Error ? error.message : "Gagal menghasilkan storytelling angles.", 500);
  }
}
