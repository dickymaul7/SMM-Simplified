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
    system: "Kamu adalah elite B2B case-study storyteller, senior content strategist, dan senior copywriter/editorial director. Semua output human-facing wajib Bahasa Indonesia. Kamu menulis brief eksekutif yang evidence-led, case-first, high-retention, dan tidak terasa seperti template AI. Copywriting dipakai untuk meningkatkan perhatian, curiosity, narrative momentum, readability, dan payoff — bukan untuk mengubah fakta atau membuat clickbait.",
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

COPYWRITER LAYER — WAJIB DITERAPKAN:
1. Temukan satu curiosity gap utama yang legitimate dari kasus/evidence. Jangan membuat curiosity dari klaim palsu.
2. Hook harus spesifik terhadap kasus dan memberi alasan kuat untuk lanjut membaca/menonton.
3. Beri audience implicit promise tentang insight yang akan mereka dapatkan.
4. Setiap slide/scene hanya punya satu pekerjaan utama dan harus membuat cerita bergerak maju.
5. Gunakan open loop secara terkontrol lalu bayar dengan reveal/mechanism/payoff. Jangan meninggalkan pertanyaan hanya demi memaksa swipe.
6. Variasikan ritme kalimat. Potong filler, jargon, dan kalimat yang terdengar seperti AI.
7. Supporting copy tidak boleh sekadar mengulang headline.
8. Headline harus kuat walaupun dibaca tanpa supporting copy.
9. Gunakan specificity, contradiction, decision tension, unexpected consequence, dan concrete business stakes bila tersedia di evidence.
10. Brand/CTA baru muncul setelah audience menerima value yang cukup.
11. Target editorialnya adalah membuat audience merasa "saya ingin tahu kelanjutannya" lalu "insight ini memang layak saya baca sampai selesai".
12. Jangan menjanjikan atau mengarang hasil performa seperti watch time, completion rate, engagement, atau conversion.

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
    system: "Kamu adalah executive editorial director sekaligus senior copywriter yang keras. Jangan memberi skor tinggi hanya karena brief terlihat rapi. Tolak konten generik, unsupported, dan copy yang hanya terdengar pintar.",
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

COPYWRITING REVIEW — WAJIB:
- Hook harus memiliki legitimate curiosity gap dan specificity.
- Opening harus memberi alasan jelas untuk continue reading/watching.
- Story harus memiliki narrative momentum: setiap slide/scene membuka, memperdalam, mengungkap, atau membayar informasi.
- Open loop harus memiliki payoff; jangan memakai cliffhanger kosong.
- Headline harus kuat tanpa supporting copy.
- Supporting copy harus mendorong cerita, bukan mengulang headline.
- Sentence craft harus terasa manusiawi: konkret, aktif, ritmis, dan minim filler.
- Tidak boleh terasa seperti template AI atau copy generik B2B.
- CTA harus merupakan konsekuensi natural dari insight.

Penalti besar jika:
- verified case kuat tersedia tapi opening masih generik;
- hook melebih-lebihkan evidence atau menggunakan clickbait;
- tidak ada curiosity gap yang legitimate;
- story momentum datar atau slide repetitif;
- mekanisme HOW/WHY lemah;
- payoff tidak menjawab promise/open loop;
- brand selling muncul terlalu cepat;
- insight dapat ditulis tanpa riset;
- slide repetitif;
- visual direction terlalu abstrak;
- kalimat penuh filler, jargon, atau frasa template AI.

required_revisions harus berupa instruksi konkret per bagian/slide, termasuk rewrite direction untuk hook atau bagian dengan retention lemah.
`,
    temperature: 0.15,
  });
}
