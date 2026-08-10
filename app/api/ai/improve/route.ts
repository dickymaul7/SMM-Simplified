import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clampScore, loadStorytellingKnowledge } from "@/lib/ai/core";
import { generateBrief, reviewBrief, reviewTotal, type BriefOutput, type QualityReview } from "@/lib/ai/brief-engine";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function reviewRow(briefId: string, review: QualityReview, total: number) {
  return {
    content_brief_id: briefId,
    case_strength: clampScore(review.case_strength),
    tension: clampScore(review.tension),
    insight_depth: clampScore(review.insight_depth),
    mechanism_clarity: clampScore(review.mechanism_clarity),
    audience_relevance: clampScore(review.audience_relevance),
    brand_fit: clampScore(review.brand_fit),
    brand_pov: clampScore(review.brand_pov),
    story_flow: clampScore(review.story_flow),
    non_generic_score: clampScore(review.non_generic_score),
    conversion_naturalness: clampScore(review.conversion_naturalness),
    total_score: total,
    reviewer_notes: `AI Improvement Review — ${review.reviewer_notes}\nHook Strength: ${review.hook_strength.toFixed(1)}/10 | Evidence Safety: ${review.evidence_safety.toFixed(1)}/10${review.required_revisions.length ? `\nRemaining revisions: ${review.required_revisions.join(" | ")}` : ""}`,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const briefId = String(body?.briefId ?? "").trim();
    const userNotes = String(body?.notes ?? "").trim();
    if (!briefId) return errorJson("briefId wajib diisi.");

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid.", 401);

    const { data: brief, error: briefError } = await supabase.from("content_briefs").select("*").eq("id", briefId).single();
    if (briefError || !brief) return errorJson(briefError?.message || "Brief tidak ditemukan.", 404);
    const { data: idea } = await supabase.from("content_ideas").select("*").eq("id", brief.content_idea_id).single();
    if (!idea) return errorJson("Content idea tidak ditemukan.", 404);
    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", idea.campaign_id).single();
    if (!campaign) return errorJson("Campaign tidak ditemukan.", 404);

    const [{ data: brand }, { data: guideline }, { data: researchCase }, { data: sections }, { data: latestReviews }] = await Promise.all([
      supabase.from("brands").select("*").eq("id", campaign.brand_id).single(),
      supabase.from("brand_guidelines").select("*").eq("brand_id", campaign.brand_id).maybeSingle(),
      supabase.from("research_cases").select("*").eq("id", idea.research_case_id).single(),
      supabase.from("brief_sections").select("*").eq("content_brief_id", briefId).order("sequence_no", { ascending: true }),
      supabase.from("quality_reviews").select("*").eq("content_brief_id", briefId).order("created_at", { ascending: false }).limit(1),
    ]);
    if (!brand || !researchCase) return errorJson("Brand atau research case tidak ditemukan.", 404);

    const { data: sources, error: sourceError } = await supabase.from("research_sources").select("*").eq("research_case_id", researchCase.id).order("source_rank", { ascending: true });
    if (sourceError) return errorJson(sourceError.message, 500);
    if (!sources?.length) return errorJson("Source research tidak ditemukan.", 409);

    const currentBrief: BriefOutput = {
      content_objective: brief.content_objective || "",
      target_audience: brief.target_audience || "",
      funnel_stage: brief.funnel_stage || "awareness",
      editorial_thesis: brief.editorial_thesis || "",
      case_evidence: brief.case_evidence || "",
      why_this_case: brief.why_this_case || "",
      tension: brief.tension || "",
      core_insight: brief.core_insight || "",
      brand_pov: brief.brand_pov || "",
      capability_bridge: brief.capability_bridge || "",
      story_arc: brief.story_arc || "",
      cta: brief.cta || "",
      fact_check_notes: brief.fact_check_notes || "",
      sections: (sections || []).map((s) => ({
        sequence_no: s.sequence_no,
        section_type: s.section_type,
        purpose: s.purpose || "",
        headline: s.headline || "",
        supporting_copy: s.supporting_copy || "",
        evidence_needed: s.evidence_needed || "",
        visual_direction: s.visual_direction || "",
        transition_to_next: s.transition_to_next || "",
      })),
    };

    const latestReview = latestReviews?.[0];
    const oldScore = Number(brief.final_score || latestReview?.total_score || 0);
    const reviewerNotes = latestReview?.reviewer_notes ? [String(latestReview.reviewer_notes)] : [];
    const sourceList = sources.map((s, index) => `S${index + 1} | ${s.publisher || "Web source"} | ${s.title || "Untitled"} | ${s.url}\nFACT NOTES: ${s.fact_notes || "—"}`).join("\n\n");
    const knowledge = await loadStorytellingKnowledge();
    const context = { brand, guideline, campaign, idea, researchCase, sources };
    const format = (idea.recommended_format || "carousel") as "carousel" | "reels" | "single_post";

    const improved = await generateBrief({
      knowledge,
      context,
      sourceList,
      format,
      revisionNotes: reviewerNotes,
      currentBrief,
      userNotes,
    });
    const review = await reviewBrief({ knowledge, context, brief: improved });
    const newScore = reviewTotal(review);

    if (newScore + 0.01 < oldScore) {
      return NextResponse.json({ ok: true, applied: false, oldScore, newScore, message: "Versi lama dipertahankan karena skor revisi lebih rendah." });
    }

    const { error: updateError } = await supabase.from("content_briefs").update({
      content_objective: improved.content_objective,
      target_audience: improved.target_audience,
      funnel_stage: improved.funnel_stage,
      editorial_thesis: improved.editorial_thesis,
      case_evidence: improved.case_evidence,
      why_this_case: improved.why_this_case,
      tension: improved.tension,
      core_insight: improved.core_insight,
      brand_pov: improved.brand_pov,
      capability_bridge: improved.capability_bridge,
      story_arc: improved.story_arc,
      cta: improved.cta,
      fact_check_notes: improved.fact_check_notes,
      final_score: newScore,
      status: newScore >= 85 ? "review" : "draft",
      updated_at: new Date().toISOString(),
    }).eq("id", briefId);
    if (updateError) throw new Error(updateError.message);

    const { error: deleteError } = await supabase.from("brief_sections").delete().eq("content_brief_id", briefId);
    if (deleteError) throw new Error(deleteError.message);
    const sectionRows = improved.sections.map((s) => ({
      content_brief_id: briefId,
      sequence_no: s.sequence_no,
      section_type: s.section_type,
      purpose: s.purpose,
      headline: s.headline,
      supporting_copy: s.supporting_copy,
      evidence_needed: s.evidence_needed,
      visual_direction: s.visual_direction,
      transition_to_next: s.transition_to_next,
    }));
    const { error: insertError } = await supabase.from("brief_sections").insert(sectionRows);
    if (insertError) throw new Error(insertError.message);

    const { error: reviewError } = await supabase.from("quality_reviews").insert(reviewRow(briefId, review, newScore));
    if (reviewError) throw new Error(reviewError.message);

    return NextResponse.json({ ok: true, applied: true, oldScore, newScore, message: "Brief berhasil diperbaiki dan di-score ulang." });
  } catch (error) {
    console.error("StoryBrief improve error", error);
    return errorJson(error instanceof Error ? error.message : "Gagal memperbaiki brief.", 500);
  }
}
