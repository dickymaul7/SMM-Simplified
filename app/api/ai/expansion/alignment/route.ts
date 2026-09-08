import { NextResponse } from "next/server";

import {
  reviewExpansionAlignment,
  type ExpansionChannel,
} from "@/lib/ai/expansion-engine";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isChannel(value: string): value is ExpansionChannel {
  return value === "linkedin" || value === "seo_article";
}

async function loadMaster(supabase: any, briefId: string) {
  const { data: brief, error: briefError } = await supabase
    .from("content_briefs")
    .select("*")
    .eq("id", briefId)
    .single();
  if (briefError || !brief) throw new Error(briefError?.message || "Master brief tidak ditemukan.");

  if (brief.human_qc_status !== "approved" || !brief.human_qc_at) {
    const error = new Error("Master Social Brief harus lolos Human QC ulang sebelum alignment diperiksa.");
    (error as any).status = 409;
    throw error;
  }

  const { data: sections, error: sectionsError } = await supabase
    .from("brief_sections")
    .select("*")
    .eq("content_brief_id", briefId)
    .order("sequence_no", { ascending: true });
  if (sectionsError) throw new Error(sectionsError.message);

  const { data: idea, error: ideaError } = await supabase
    .from("content_ideas")
    .select("*")
    .eq("id", brief.content_idea_id)
    .single();
  if (ideaError || !idea) throw new Error(ideaError?.message || "Content idea tidak ditemukan.");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", idea.campaign_id)
    .single();
  if (campaignError || !campaign) throw new Error(campaignError?.message || "Campaign tidak ditemukan.");

  const [{ data: brand }, { data: guideline }] = await Promise.all([
    supabase.from("brands").select("*").eq("id", campaign.brand_id).single(),
    supabase.from("brand_guidelines").select("*").eq("brand_id", campaign.brand_id).maybeSingle(),
  ]);

  let researchCase = null;
  let sources: any[] = [];
  if (idea.research_case_id) {
    const [{ data: caseData }, { data: sourceRows }] = await Promise.all([
      supabase.from("research_cases").select("*").eq("id", idea.research_case_id).maybeSingle(),
      supabase
        .from("research_sources")
        .select("publisher,title,url,fact_notes,source_rank")
        .eq("research_case_id", idea.research_case_id)
        .order("source_rank", { ascending: true }),
    ]);
    researchCase = caseData ?? null;
    sources = sourceRows ?? [];
  }

  return {
    brief,
    master: {
      brand,
      guideline,
      campaign,
      idea,
      master_brief: brief,
      story_sequence: sections ?? [],
      research_case: researchCase,
      verified_sources: sources,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const briefId = String(body?.briefId ?? "").trim();
    const channelInput = String(body?.channel ?? "").trim();

    if (!briefId) return errorJson("briefId wajib diisi.");
    if (!isChannel(channelInput)) return errorJson("Channel tidak valid.");

    const channel: ExpansionChannel = channelInput;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid.", 401);

    const [{ brief, master }, expansionResult] = await Promise.all([
      loadMaster(supabase, briefId),
      supabase
        .from("content_expansions")
        .select("id,content")
        .eq("content_brief_id", briefId)
        .eq("channel", channel)
        .single(),
    ]);

    if (expansionResult.error || !expansionResult.data) {
      if (expansionResult.error?.code === "42P01") {
        return errorJson("Aktifkan database/CONTENT_EXPANSION_V1.sql terlebih dahulu.", 409);
      }
      return errorJson(expansionResult.error?.message || "Derivative brief tidak ditemukan.", 404);
    }

    const alignment = await reviewExpansionAlignment({
      channel,
      master,
      content: expansionResult.data.content,
    });

    const { error: updateError } = await supabase
      .from("content_expansions")
      .update({
        alignment_report: alignment,
        master_qc_at: brief.human_qc_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expansionResult.data.id);

    if (updateError) return errorJson(updateError.message, 500);

    return NextResponse.json({ ok: true, alignment, masterQcAt: brief.human_qc_at });
  } catch (error) {
    console.error("Content Expansion alignment error", error);
    const status = Number((error as any)?.status || 500);
    return errorJson(
      error instanceof Error ? error.message : "Gagal memeriksa alignment.",
      status,
    );
  }
}
