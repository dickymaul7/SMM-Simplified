import { average, clampScore, compactJson, createStructuredJson } from "@/lib/ai/core";
import { briefSchema, qualitySchema } from "@/lib/ai/schemas";

export type BriefOutput = {
  content_objective: string;
  target_audience: string;
  funnel_stage: "awareness" | "consideration" | "conversion";
  editorial_thesis: string;
  case_evidence: string;
  why_this_case: string;
  tension: string;
  core_insight: string;
  brand_pov: string;
  capability_bridge: string;
  story_arc: string;
  cta: string;
  fact_check_notes: string;
  sections: Array<{
    sequence_no: number;
    section_type: "slide" | "scene";
    purpose: string;
    headline: string;
    supporting_copy: string;
    evidence_needed: string;
    visual_direction: string;
    transition_to_next: string;
  }>;
};

export type QualityReview = {
  case_strength: number;
  hook_strength: number;
  tension: number;
  insight_depth: number;
  mechanism_clarity: number;
  audience_relevance: number;
  brand_fit: number;
  brand_pov: number;
  story_flow: number;
  non_generic_score: number;
  conversion_naturalness: number;
  evidence_safety: number;
  reviewer_notes: string;
  required_revisions: string[];
};

export const qualityKeys: Array<keyof Omit<QualityReview, "reviewer_notes" | "required_revisions">> = [
  "case_strength", "hook_strength", "tension", "insight_depth", "mechanism_clarity", "audience_relevance",
  "brand_fit", "brand_pov", "story_flow", "non_generic_score", "conversion_naturalness", "evidence_safety",
];

export function reviewTotal(review: QualityReview) {
  return average(qualityKeys.map((key) => clampScore(Number(review[key])))) * 10;
}

export async function generateBrief({
  knowledge,
  context,
  sourceList,
  format,
  revisionNotes,
  currentBrief,
  userNotes,
}: {
  knowledge: string;
  context: unknown;
  sourceList: string;
  format: "carousel" | "reels" | "single_post";
  revisionNotes?: string[];
  currentBrief?: BriefOutput;
  userNotes?: string;
}) {
  const formatInstruction = format === "reels"
    ? "Buat 7-10 scene untuk Reels 45-90 detik. section_type=scene."
    : format === "single_post"
      ? "Buat 1-3 section untuk single post. section_type=slide untuk kompatibilitas."
      : "Buat 8-9 slide carousel. section_type=slide.";

  const revisionBlock = revisionNotes?.length
    ? `\nMANDATORY EDITOR REVISIONS:\n- ${revisionNotes.join("\n- ")}`
    : "";
  const currentBlock = currentBrief ? `\nCURRENT BRIEF TO IMPROVE:\n${compactJson(currentBrief)}` : "";
  const userBlock = userNotes?.trim() ? `\nCATATAN MANUSIA YANG WAJIB DIPERTIMBANGKAN:\n${userNotes.trim()}` : "";

  return createStructuredJson<BriefOutput>({
    schema: briefSchema as unknown as Record<string, unknown>,
    system: "Kamu adalah elite B2B case-study storyteller dan senior content strategist. Semua output human-facing wajib Bahasa Indonesia. Kamu menulis brief eksekutif yang evidence-led, case-first, dan tidak terasa seperti template AI.",
    user: `
EDITORIAL KNOWLEDGE BASE:
${knowledge}

CONTEXT:
${compactJson(context)}

VERIFICATION SOURCES:
${sourceList}

TASK:
${currentBrief ? "Perbaiki brief yang ada secara targeted." : "Buat full storytelling brief."}
${formatInstruction}

CASE-FIRST RULE — WAJIB ketika verified case kuat tersedia:
1. Slide/scene 1 membuka dari KASUS NYATA, bukan teori, definisi, mitos umum, atau promosi.
2. Gunakan nama perusahaan/organisasi + stakes/outcome/kontradiksi paling menarik yang benar-benar didukung source.
3. Hook harus memicu “kok bisa?” tanpa melebih-lebihkan evidence.
4. Slide/scene 2 tetap memperdalam konteks kasus.
5. Urutan default: Case Hook → Context → Tension → Failure/Turning Point → Mechanism → Outcome → Executive Insight → Brand POV → Capability Bridge/CTA.
6. Mechanism adalah jantung konten: jelaskan HOW/WHY secara konkret.
7. ISO/framework/produk/brand baru masuk setelah audience memahami konflik dan insight.

QUALITY RULES:
- Semua fakta hanya boleh berada di dalam evidence yang tersedia.
- Gunakan label [S1], [S2] pada case_evidence/evidence_needed/fact_check_notes jika relevan.
- Jangan mengarang quote, angka, motif, legal finding, atau causal claim.
- Bedakan fakta, interpretasi, dan Brand POV.
- Jangan sekadar merangkum berita; temukan mekanisme bisnis dan executive implication.
- Supporting copy harus cukup detail untuk content writer/designer mengeksekusi.
- Visual direction harus konkret, bukan “gunakan visual menarik”.
- Brand POV harus spesifik terhadap konteks brand/campaign, bukan kalimat yang bisa dipakai semua brand.
- CTA harus natural dan sesuai funnel stage.
- Hindari kata-kata AI generik seperti “di era yang semakin dinamis”, “penting untuk dipahami”, dan listicle dangkal.
${revisionBlock}${currentBlock}${userBlock}
`,
    temperature: currentBrief ? 0.28 : 0.35,
  });
}

export async function reviewBrief({ knowledge, context, brief }: { knowledge: string; context: unknown; brief: BriefOutput }) {
  return createStructuredJson<QualityReview>({
    schema: qualitySchema as unknown as Record<string, unknown>,
    system: "Kamu adalah executive editorial director yang keras. Jangan memberi skor tinggi hanya karena brief terlihat rapi. Tolak konten generik dan unsupported.",
    user: `
EDITORIAL STANDARD:
${knowledge}

CONTEXT + SOURCES:
${compactJson(context)}

BRIEF:
${compactJson(brief)}

Beri skor 0-10 secara ketat untuk:
- Case Strength
- Hook Strength
- Tension
- Insight Depth
- Mechanism Clarity
- Audience Relevance
- Brand Fit
- Brand POV
- Story Flow
- Non-Generic Score
- Conversion Naturalness
- Evidence Safety

Skor 9+ berarti publish-worthy setelah human fact check, bukan sekadar “bagus”.
Penalti besar jika:
- verified case kuat tersedia tapi opening masih generik;
- hook melebih-lebihkan evidence;
- mekanisme HOW/WHY lemah;
- brand selling muncul terlalu cepat;
- insight dapat ditulis tanpa riset;
- slide repetitif;
- visual direction terlalu abstrak.

required_revisions harus berupa instruksi konkret per bagian/slide.
`,
    temperature: 0.15,
  });
}
