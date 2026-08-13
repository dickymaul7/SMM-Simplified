import { NextResponse } from "next/server";

import { compactJson, createStructuredJson } from "@/lib/ai/core";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const alignmentSchema = {
  type: "object",
  required: [
    "overall_score",
    "verdict",
    "audience_fit",
    "positioning_alignment",
    "capability_relevance",
    "market_relevance",
    "claim_compliance",
    "strengths",
    "misalignments",
    "recommendations",
  ],
  properties: {
    overall_score: { type: "number", minimum: 0, maximum: 100 },
    verdict: { type: "string", minLength: 1 },
    audience_fit: { type: "number", minimum: 0, maximum: 100 },
    positioning_alignment: { type: "number", minimum: 0, maximum: 100 },
    capability_relevance: { type: "number", minimum: 0, maximum: 100 },
    market_relevance: { type: "number", minimum: 0, maximum: 100 },
    claim_compliance: { type: "number", minimum: 0, maximum: 100 },
    strengths: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 1 },
    },
    misalignments: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1 },
    },
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string", minLength: 1 },
    },
  },
};

function errorJson(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const briefId = String(body?.briefId ?? "").trim();
    if (!briefId) return errorJson("briefId wajib diisi.");

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid. Silakan sign in ulang.", 401);

    const { data: brief, error: briefError } = await supabase
      .from("content_briefs")
      .select("*")
      .eq("id", briefId)
      .single();
    if (briefError || !brief) return errorJson(briefError?.message || "Brief tidak ditemukan.", 404);

    const { data: idea } = await supabase
      .from("content_ideas")
      .select("*")
      .eq("id", brief.content_idea_id)
      .single();
    if (!idea) return errorJson("Content idea tidak ditemukan.", 404);

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", idea.campaign_id)
      .single();
    if (!campaign) return errorJson("Campaign tidak ditemukan.", 404);

    const [{ data: brand }, { data: guideline }, { data: sections }] = await Promise.all([
      supabase.from("brands").select("*").eq("id", campaign.brand_id).single(),
      supabase.from("brand_guidelines").select("*").eq("brand_id", campaign.brand_id).maybeSingle(),
      supabase
        .from("brief_sections")
        .select("sequence_no,section_type,purpose,headline,supporting_copy,evidence_needed,visual_direction,transition_to_next")
        .eq("content_brief_id", briefId)
        .order("sequence_no", { ascending: true }),
    ]);

    if (!guideline) {
      return errorJson("Brand Intelligence belum tersedia untuk brand ini. Isi menu Brands terlebih dahulu.", 409);
    }

    const intelligence =
      guideline?.visual_guideline &&
      typeof guideline.visual_guideline === "object" &&
      !Array.isArray(guideline.visual_guideline)
        ? (guideline.visual_guideline as Record<string, unknown>).brand_intelligence ?? null
        : null;

    const brandContext = {
      brand: {
        name: brand?.name,
        positioning: brand?.positioning,
        description: brand?.description,
        website: brand?.website,
      },
      guideline: {
        customer_segments: guideline.customer_segments,
        target_audiences: guideline.target_audiences,
        audience_pain_points: guideline.audience_pain_points,
        value_proposition: guideline.value_proposition,
        core_expertise: guideline.core_expertise,
        brand_pov: guideline.brand_pov,
        allowed_claims: guideline.allowed_claims,
        prohibited_claims: guideline.prohibited_claims,
        communication_dos: guideline.communication_dos,
        communication_donts: guideline.communication_donts,
        brand_intelligence: intelligence,
      },
    };

    const briefContext = {
      campaign: {
        name: campaign.name,
        objective: campaign.objective,
        target_audience_override: campaign.target_audience_override,
        business_problem: campaign.business_problem,
        key_message: campaign.key_message,
        product_or_program: campaign.product_or_program,
        cta: campaign.cta,
      },
      idea: {
        working_title: idea.working_title,
        content_angle: idea.content_angle,
        tension: idea.tension,
        core_insight: idea.core_insight,
        recommended_format: idea.recommended_format,
      },
      brief: {
        content_objective: brief.content_objective,
        target_audience: brief.target_audience,
        editorial_thesis: brief.editorial_thesis,
        case_evidence: brief.case_evidence,
        tension: brief.tension,
        core_insight: brief.core_insight,
        brand_pov: brief.brand_pov,
        capability_bridge: brief.capability_bridge,
        story_arc: brief.story_arc,
        cta: brief.cta,
        fact_check_notes: brief.fact_check_notes,
      },
      sections: sections ?? [],
    };

    const result = await createStructuredJson<any>({
      schema: alignmentSchema,
      system: "Kamu adalah senior brand strategist dan editorial QA reviewer. Tugasmu menilai alignment konten dengan Brand Intelligence, bukan sekadar menilai kualitas tulisan.",
      user: `
BRAND INTELLIGENCE:
${compactJson(brandContext)}

CONTENT BRIEF YANG DINILAI:
${compactJson(briefContext)}

Nilai alignment dengan bobot berikut:
- Audience Fit: 25%
- Positioning Alignment: 25%
- Capability Relevance: 20%
- Market Relevance: 15%
- Claim Compliance: 15%

ATURAN:
1. Jangan memberi nilai tinggi hanya karena brief menyebut nama brand.
2. Brand promotion tidak harus muncul di awal. Case-led storytelling tetap boleh memberi brand bridge di bagian akhir.
3. Penalti jika brief menarget audience yang berbeda dari targeting tanpa alasan campaign yang jelas.
4. Penalti jika capability bridge mempromosikan kemampuan yang tidak didukung Brand Intelligence.
5. Penalti keras untuk claim yang bertentangan dengan prohibited_claims atau tidak didukung proof/allowed claims.
6. Market relevance menilai apakah kasus, tension, dan insight masuk akal terhadap market context / trend brand.
7. Positioning alignment menilai apakah cara brand hadir konsisten dengan positioning, value proposition, differentiation, dan brand POV.
8. Recommendations harus actionable dan menunjuk bagian brief yang perlu diperbaiki.
9. Jika Brand Intelligence belum lengkap, jangan mengarang standar brand; jelaskan keterbatasannya pada misalignments/recommendations.
10. Semua output human-facing dalam Bahasa Indonesia.
`,
      temperature: 0.15,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("brand-alignment error", error);
    return errorJson(error instanceof Error ? error.message : "Brand Alignment QC gagal.", 500);
  }
}
