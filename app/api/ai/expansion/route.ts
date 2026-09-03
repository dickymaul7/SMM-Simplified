import { NextResponse } from "next/server";

import {
  generateExpansion,
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

async function loadMasterContext(supabase: any, briefId: string) {
  const { data: brief, error: briefError } = await supabase
    .from("content_briefs")
    .select("*")
    .eq("id", briefId)
    .single();

  if (briefError || !brief) {
    throw new Error(briefError?.message || "Master brief tidak ditemukan.");
  }

  if (brief.human_qc_status !== "approved" || !brief.human_qc_at) {
    const error = new Error("Master Social Brief harus lolos Human QC sebelum Content Expansion dibuat.");
    (error as any).status = 409;
    throw error;
  }

  const { data: sections, error: sectionError } = await supabase
    .from("brief_sections")
    .select("*")
    .eq("content_brief_id", briefId)
    .order("sequence_no", { ascending: true });
  if (sectionError) throw new Error(sectionError.message);

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
    const replace = Boolean(body?.replace);

    if (!briefId) return errorJson("briefId wajib diisi.");
    if (!isChannel(channelInput)) return errorJson("Channel tidak valid.");

    const channel: ExpansionChannel = channelInput;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid.", 401);

    const { brief, master } = await loadMasterContext(supabase, briefId);

    const existing = await supabase
      .from("content_expansions")
      .select("id,status,human_qc_status")
      .eq("content_brief_id", briefId)
      .eq("channel", channel)
      .maybeSingle();

    if (existing.error) {
      if (existing.error.code === "42P01") {
        return errorJson("Aktifkan database/CONTENT_EXPANSION_V1.sql terlebih dahulu.", 409);
      }
      return errorJson(existing.error.message, 500);
    }

    if (existing.data && !replace) {
      return NextResponse.json({
        ok: true,
        expansionId: existing.data.id,
        existing: true,
      });
    }

    const content = await generateExpansion({ channel, master });
    const alignment = await reviewExpansionAlignment({ channel, master, content });
    const now = new Date().toISOString();

    const { data: saved, error: saveError } = await supabase
      .from("content_expansions")
      .upsert(
        {
          content_brief_id: briefId,
          channel,
          status: "draft",
          content,
          alignment_report: alignment,
          master_qc_at: brief.human_qc_at,
          human_qc_status: "pending",
          human_qc_at: null,
          updated_at: now,
        },
        { onConflict: "content_brief_id,channel" },
      )
      .select("id,status,alignment_report")
      .single();

    if (saveError || !saved) {
      if (saveError?.code === "42P01") {
        return errorJson("Aktifkan database/CONTENT_EXPANSION_V1.sql terlebih dahulu.", 409);
      }
      return errorJson(saveError?.message || "Gagal menyimpan Content Expansion.", 500);
    }

    return NextResponse.json({
      ok: true,
      expansionId: saved.id,
      existing: false,
      replaced: Boolean(existing.data),
      alignment: saved.alignment_report,
    });
  } catch (error) {
    console.error("Content Expansion generation error", error);
    const status = Number((error as any)?.status || 500);
    return errorJson(
      error instanceof Error ? error.message : "Gagal membuat Content Expansion.",
      status,
    );
  }
}
