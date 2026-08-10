import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadStorytellingKnowledge, clampScore } from "@/lib/ai/core";
import { generateBrief, reviewBrief, reviewTotal, type QualityReview } from "@/lib/ai/brief-engine";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function reviewRow(briefId: string, review: QualityReview, total: number, prefix: string) {
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
    reviewer_notes: `${prefix}${review.reviewer_notes}\nHook Strength: ${review.hook_strength.toFixed(1)}/10 | Evidence Safety: ${review.evidence_safety.toFixed(1)}/10${review.required_revisions.length ? `\nRequired revisions: ${review.required_revisions.join(" | ")}` : ""}`,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ideaId = String(body?.ideaId ?? "").trim();
    if (!ideaId) return errorJson("ideaId wajib diisi.");

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid.", 401);

    const existing = await supabase.from("content_briefs").select("id").eq("content_idea_id", ideaId).maybeSingle();
    if (existing.error) return errorJson(existing.error.message, 500);
    if (existing.data) return NextResponse.json({ ok: true, briefId: existing.data.id, existing: true });

    const { data: idea, error: ideaError } = await supabase.from("content_ideas").select("*").eq("id", ideaId).single();
    if (ideaError || !idea) return errorJson(ideaError?.message || "Content idea tidak ditemukan.", 404);

    const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("*").eq("id", idea.campaign_id).single();
    if (campaignError || !campaign) return errorJson(campaignError?.message || "Campaign tidak ditemukan.", 404);

    const [{ data: brand }, { data: guideline }, { data: researchCase }] = await Promise.all([
      supabase.from("brands").select("*").eq("id", campaign.brand_id).single(),
      supabase.from("brand_guidelines").select("*").eq("brand_id", campaign.brand_id).maybeSingle(),
      supabase.from("research_cases").select("*").eq("id", idea.research_case_id).single(),
    ]);
    if (!brand || !researchCase) return errorJson("Brand atau research case tidak ditemukan.", 404);

    const { data: sources, error: sourceError } = await supabase
      .from("research_sources").select("*").eq("research_case_id", researchCase.id).order("source_rank", { ascending: true });
    if (sourceError) return errorJson(sourceError.message, 500);
    if (!sources?.length) return errorJson("Research case belum memiliki source terverifikasi.", 409);

    const sourceList = sources.map((s, index) => `S${index + 1} | ${s.publisher || "Web source"} | ${s.title || "Untitled"} | ${s.url}\nFACT NOTES: ${s.fact_notes || "—"}`).join("\n\n");
    const knowledge = await loadStorytellingKnowledge();
    const context = { brand, guideline, campaign, idea, researchCase, sources };
    const format = (idea.recommended_format || "carousel") as "carousel" | "reels" | "single_post";

    let finalBrief = await generateBrief({ knowledge, context, sourceList, format });
    let firstReview = await reviewBrief({ knowledge, context, brief: finalBrief });
    let firstScore = reviewTotal(firstReview);
    let finalReview = firstReview;
    let finalScore = firstScore;
    let revised = false;

    // Stronger quality gate than v1: auto-revise once whenever the draft is below 90.
    if (firstScore < 90 && firstReview.required_revisions.length) {
      revised = true;
      finalBrief = await generateBrief({
        knowledge,
        context,
        sourceList,
        format,
        revisionNotes: firstReview.required_revisions,
        currentBrief: finalBrief,
      });
      finalReview = await reviewBrief({ knowledge, context, brief: finalBrief });
      finalScore = reviewTotal(finalReview);
    }

    const { data: insertedBrief, error: briefError } = await supabase.from("content_briefs").insert({
      content_idea_id: ideaId,
      content_objective: finalBrief.content_objective,
      target_audience: finalBrief.target_audience,
      funnel_stage: finalBrief.funnel_stage,
      editorial_thesis: finalBrief.editorial_thesis,
      case_evidence: finalBrief.case_evidence,
      why_this_case: finalBrief.why_this_case,
      tension: finalBrief.tension,
      core_insight: finalBrief.core_insight,
      brand_pov: finalBrief.brand_pov,
      capability_bridge: finalBrief.capability_bridge,
      story_arc: finalBrief.story_arc,
      cta: finalBrief.cta,
      fact_check_notes: finalBrief.fact_check_notes,
      final_score: finalScore,
      status: finalScore >= 85 ? "review" : "draft",
    }).select("id").single();
    if (briefError || !insertedBrief) throw new Error(briefError?.message || "Gagal menyimpan brief.");

    const sectionRows = finalBrief.sections.map((section) => ({
      content_brief_id: insertedBrief.id,
      sequence_no: section.sequence_no,
      section_type: section.section_type,
      purpose: section.purpose,
      headline: section.headline,
      supporting_copy: section.supporting_copy,
      evidence_needed: section.evidence_needed,
      visual_direction: section.visual_direction,
      transition_to_next: section.transition_to_next,
    }));
    const { error: sectionsError } = await supabase.from("brief_sections").insert(sectionRows);
    if (sectionsError) throw new Error(sectionsError.message);

    const rows = [reviewRow(insertedBrief.id, firstReview, firstScore, "AI Editorial Review #1 — ")];
    if (revised) rows.push(reviewRow(insertedBrief.id, finalReview, finalScore, "AI Editorial Review #2 after auto-revision — "));
    const { error: reviewError } = await supabase.from("quality_reviews").insert(rows);
    if (reviewError) throw new Error(reviewError.message);

    await supabase.from("content_ideas").update({ status: "briefed", updated_at: new Date().toISOString() }).eq("id", ideaId);

    return NextResponse.json({ ok: true, briefId: insertedBrief.id, score: finalScore, revised, passed: finalScore >= 85 });
  } catch (error) {
    console.error("StoryBrief brief error", error);
    return errorJson(error instanceof Error ? error.message : "Gagal membuat storytelling brief.", 500);
  }
}
