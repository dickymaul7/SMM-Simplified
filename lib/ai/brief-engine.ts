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

function extractBrandIntelligence(context: unknown) {
  const raw = (context as { guideline?: { visual_guideline?: unknown } } | null)?.guideline?.visual_guideline;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const intelligence = (raw as Record<string, unknown>).brand_intelligence;
  if (!intelligence || typeof intelligence !== "object" || Array.isArray(intelligence)) return null;
  return intelligence as Record<string, unknown>;
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
    ? `
MANDATORY EDITOR REVISIONS:
- ${revisionNotes.join("\n- ")}`
    : "";
  const currentBlock = currentBrief ? `
CURRENT BRIEF TO IMPROVE:
${compactJson(currentBrief)}` : "";
  const userBlock = userNotes?.trim()
    ? `

=== MANDATORY HUMAN EDITOR DIRECTIVE ===
USER REQUEST:
${userNotes.trim()}

THIS IS A REAL EDITING REQUEST, NOT A SUGGESTION.
1. Treat the user request as the highest-priority editorial instruction after factual accuracy and evidence safety.
2. Rewrite the actual brief; do not merely describe what should change.
3. If the request concerns tone, language, voice, wording, readability, pacing, or style, rewrite EVERY human-facing headline and supporting_copy across ALL slides/scenes, plus editorial_thesis, story_arc, cta, purpose, and other relevant human-facing fields.
4. Do NOT copy the old wording and make token-level edits. Re-author the affected copy from scratch while preserving verified facts, case identity, strategic insight, and evidence references.
5. If the user asks for "lebih santai", use natural conversational Indonesian: shorter sentences, familiar words, active voice, varied rhythm, and a spoken feel while remaining professional. Avoid corporate jargon unless it is necessary and explain it naturally.
6. If the user asks for "lebih tajam", strengthen the tension, contrast, specificity, and point of view rather than merely changing adjectives.
7. If the user asks for "lebih engaging", improve the hook, curiosity gap, transitions, and concrete examples rather than adding hype.
8. If the user asks for a structural change, rebuild the affected slide/scene sequence instead of only changing labels.
9. Keep the case evidence, numbers, names, and factual claims intact unless the user explicitly asks to change them and the sources support the change.
10. Never respond with an explanation of the requested change. The JSON output itself must contain the revised brief.
11. Before returning JSON, silently compare the revised brief against the old brief and make sure the requested change is visible across the relevant sections. If the old wording still dominates, rewrite again before answering.
=== END MANDATORY HUMAN EDITOR DIRECTIVE ===`
    : "";

  const brandIntelligence = extractBrandIntelligence(context);
  const brandIntelligenceBlock = brandIntelligence
    ? `

=== BRAND INTELLIGENCE — SOURCE OF TRUTH ===
This Brand Intelligence was uploaded/extracted for the selected brand and saved to the brand profile. It is mandatory context, not optional background.
${compactJson(brandIntelligence)}

BRAND INTELLIGENCE RULES:
1. Treat this block as the authoritative source for brand positioning, audience, market context, differentiation, capabilities, proof points, communication style, and claims guardrails.
2. The generated brief MUST be recognizably specific to this brand. A generic competitor could not publish the same brief unchanged.
3. Target audience must come from Brand Intelligence unless the current campaign explicitly overrides it; when overridden, explain the campaign-specific audience in the brief while preserving the brand's strategic context.
4. Brand POV, capability bridge, CTA, and recommendations must connect to capabilities/differentiation/proof points actually present in Brand Intelligence.
5. Do not invent products, services, expertise, customer segments, proof points, achievements, numbers, clients, or claims that are not supported by Brand Intelligence or verification sources.
6. Use market trends from Brand Intelligence as strategic context, but use live verification sources for current news/case facts.
7. Respect communication_dos, communication_donts, allowed_claims, and prohibited_claims throughout EVERY slide/scene, not only the CTA.
8. Do not copy the Brand Intelligence wording mechanically. Translate it into a natural editorial POV and audience-relevant story.
=== END BRAND INTELLIGENCE — SOURCE OF TRUTH ===
`
    : `

=== BRAND INTELLIGENCE STATUS ===
No saved Brand Intelligence block was found for this brand. Do not invent brand-specific capabilities or claims. Keep the brief evidence-led and conservative.
=== END BRAND INTELLIGENCE STATUS ===
`;

  return createStructuredJson<BriefOutput>({
    schema: briefSchema as unknown as Record<string, unknown>,
    system: "Kamu adalah elite B2B case-study storyteller, senior copywriter, dan editorial director. Semua output human-facing wajib Bahasa Indonesia. Kamu menulis brief eksekutif yang evidence-led, case-first, natural, dan tidak terasa seperti template AI. Brand Intelligence yang tersimpan untuk brand terpilih adalah source of truth untuk brand fit dan harus terlihat nyata dalam output. Instruksi eksplisit dari user adalah prioritas utama selama tidak bertentangan dengan factual accuracy, evidence safety, atau struktur output.",
    user: `
EDITORIAL KNOWLEDGE BASE:
${knowledge}

CONTEXT:
${compactJson(context)}
${brandIntelligenceBlock}

VERIFICATION SOURCES:
${sourceList}

TASK:
${currentBrief ? "REWRITE THE EXISTING BRIEF according to the human editor directive. This is a substantive rewrite, not a proofreading pass." : "Buat full storytelling brief."}
${formatInstruction}

CASE-FIRST RULE — WAJIB ketika verified case kuat tersedia:
1. Slide/scene 1 membuka dari KASUS NYATA, bukan teori, definisi, mitos umum, atau promosi.
2. Gunakan nama perusahaan/organisasi + stakes/outcome/kontradiksi paling menarik yang benar-benar didukung source.
3. Hook harus memicu “kok bisa?” tanpa melebih-lebihkan evidence.
4. Slide/scene 2 tetap memperdalam konteks kasus.
5. Urutan default: Case Hook → Context → Tension → Failure/Turning Point → Mechanism → Outcome → Executive Insight → Brand POV → Capability Bridge/CTA.
6. Mechanism adalah jantung konten: jelaskan HOW/WHY secara konkret.
7. ISO/framework/produk/brand baru masuk setelah audience memahami konflik dan insight.

BRAND-FIT QUALITY GATE — WAJIB:
- Sebelum menulis setiap slide/scene, gunakan Brand Intelligence sebagai filter: "Apakah ini relevan dengan audience, positioning, capability, differentiation, dan POV brand?"
- Jangan memaksa produk masuk jika tidak relevan dengan kasus.
- Jangan membuat insight yang bisa diberikan brand mana pun tanpa kaitan nyata ke brand intelligence.
- Jika capability bridge tidak didukung oleh Brand Intelligence, jangan mengarang bridge; gunakan Brand POV yang lebih aman.
- Jika campaign topic bertentangan dengan Brand Intelligence, prioritaskan factual accuracy lalu beri angle yang masih credible terhadap brand daripada memaksakan positioning.

QUALITY RULES:
- Semua fakta hanya boleh berada di dalam evidence yang tersedia.
- Gunakan label [S1], [S2] pada case_evidence/evidence_needed/fact_check_notes jika relevan.
- Jangan mengarang quote, angka, motif, legal finding, atau causal claim.
- Bedakan fakta, interpretasi, dan Brand POV.
- Jangan sekadar merangkum berita; temukan mekanisme bisnis dan executive implication.
- Supporting copy harus cukup detail untuk content writer/designer mengeksekusi.
- Visual direction harus konkret, bukan “gunakan visual menarik”.
- Brand POV harus spesifik terhadap konteks brand/campaign dan Brand Intelligence, bukan kalimat yang bisa dipakai semua brand.
- CTA harus natural dan sesuai funnel stage serta capability yang benar-benar tersedia.
- Hindari kata-kata AI generik seperti “di era yang semakin dinamis”, “penting untuk dipahami”, dan listicle dangkal.
${revisionBlock}${currentBlock}${userBlock}
`,
    temperature: currentBrief ? 0.42 : 0.35,
  });
}

export async function reviewBrief({ knowledge, context, brief, userNotes }: { knowledge: string; context: unknown; brief: BriefOutput; userNotes?: string }) {
  const userDirective = userNotes?.trim()
    ? `

HUMAN EDITOR REQUEST TO VERIFY:
${userNotes.trim()}

You must judge whether this request is visibly reflected throughout the affected brief sections. A style/tone/language request is NOT satisfied by changing one slide only. If it asks for a global writing change, check the whole set of slides/scenes and master fields.
`
    : "";
  const brandIntelligence = extractBrandIntelligence(context);
  const brandIntelligenceReviewBlock = brandIntelligence
    ? `

BRAND INTELLIGENCE SOURCE OF TRUTH:
${compactJson(brandIntelligence)}

For Brand Fit and Brand POV scoring, compare the brief against this source of truth. Penalize unsupported capability claims, wrong audience, generic positioning, missing differentiation, ignored communication guardrails, or CTA that does not connect to the documented brand.
`
    : "";

  return createStructuredJson<QualityReview>({
    schema: qualitySchema as unknown as Record<string, unknown>,
    system: "Kamu adalah executive editorial director yang keras. Jangan memberi skor tinggi hanya karena brief terlihat rapi. Tolak konten generik dan unsupported. Untuk revisi yang diminta manusia, periksa kepatuhan terhadap request secara menyeluruh. Brand Intelligence adalah sumber kebenaran untuk menilai brand fit.",
    user: `
EDITORIAL STANDARD:
${knowledge}

CONTEXT + SOURCES:
${compactJson(context)}
${brandIntelligenceReviewBlock}

BRIEF:
${compactJson(brief)}
${userDirective}

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
- visual direction terlalu abstrak;
- brief dapat dipakai brand lain tanpa perubahan berarti;
- audience, positioning, capability, differentiation, atau POV tidak sesuai Brand Intelligence;
- CTA/capability bridge mengandung klaim yang tidak didukung Brand Intelligence;
- permintaan user hanya diterapkan pada satu bagian padahal permintaannya global.

required_revisions harus berupa instruksi konkret per bagian/slide. Jika human request belum benar-benar terpenuhi, tuliskan revisi yang spesifik untuk memperbaikinya. Jika Brand Fit < 8, wajib beri revisi yang menunjuk bagian konkret yang harus dibuat lebih brand-specific.
`,
    temperature: 0.1,
  });
}
