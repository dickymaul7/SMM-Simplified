const score = { type: "number", minimum: 0, maximum: 10 } as const;

export const queryPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["queries"],
  properties: {
    queries: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "string", minLength: 1 },
    },
  },
} as const;

export const angleSynthesisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["brand_profile", "campaign", "cases", "ideas"],
  properties: {
    brand_profile: {
      type: "object",
      additionalProperties: false,
      required: [
        "positioning",
        "value_proposition",
        "audience_pain_points",
        "tone_of_voice",
        "key_messages",
        "brand_pov",
        "core_expertise",
        "communication_dos",
        "communication_donts"
      ],
      properties: {
        positioning: { type: "string" },
        value_proposition: { type: "string" },
        audience_pain_points: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
        tone_of_voice: { type: "string" },
        key_messages: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
        brand_pov: { type: "string" },
        core_expertise: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
        communication_dos: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
        communication_donts: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
      },
    },
    campaign: {
      type: "object",
      additionalProperties: false,
      required: ["desired_perception", "business_problem", "key_message", "funnel_stage"],
      properties: {
        desired_perception: { type: "string" },
        business_problem: { type: "string" },
        key_message: { type: "string" },
        funnel_stage: { type: "string", enum: ["awareness", "consideration", "conversion"] },
      },
    },
    cases: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key", "company_name", "case_title", "case_summary", "business_problem", "tension",
          "decision_or_move", "mechanism", "outcome", "executive_implication", "relevance_score",
          "credibility_score", "tension_score", "executive_value_score", "brand_fit_score", "confidence", "sources"
        ],
        properties: {
          key: { type: "string" },
          company_name: { type: "string" },
          case_title: { type: "string" },
          case_summary: { type: "string" },
          business_problem: { type: "string" },
          tension: { type: "string" },
          decision_or_move: { type: "string" },
          mechanism: { type: "string" },
          outcome: { type: "string" },
          executive_implication: { type: "string" },
          relevance_score: score,
          credibility_score: score,
          tension_score: score,
          executive_value_score: score,
          brand_fit_score: score,
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          sources: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["ref", "source_type", "fact_notes"],
              properties: {
                ref: { type: "string" },
                source_type: { type: "string", enum: ["official", "government", "media", "research", "academic", "other"] },
                fact_notes: { type: "string" },
              },
            },
          },
        },
      },
    },
    ideas: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["case_key", "working_title", "content_angle", "tension", "core_insight", "recommended_format", "campaign_relevance"],
        properties: {
          case_key: { type: "string" },
          working_title: { type: "string" },
          content_angle: { type: "string" },
          tension: { type: "string" },
          core_insight: { type: "string" },
          recommended_format: { type: "string", enum: ["carousel", "reels", "single_post"] },
          campaign_relevance: { type: "string" },
        },
      },
    },
  },
} as const;

export const briefSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "content_objective", "target_audience", "funnel_stage", "editorial_thesis", "case_evidence", "why_this_case",
    "tension", "core_insight", "brand_pov", "capability_bridge", "story_arc", "cta", "fact_check_notes", "sections"
  ],
  properties: {
    content_objective: { type: "string" },
    target_audience: { type: "string" },
    funnel_stage: { type: "string", enum: ["awareness", "consideration", "conversion"] },
    editorial_thesis: { type: "string" },
    case_evidence: { type: "string" },
    why_this_case: { type: "string" },
    tension: { type: "string" },
    core_insight: { type: "string" },
    brand_pov: { type: "string" },
    capability_bridge: { type: "string" },
    story_arc: { type: "string" },
    cta: { type: "string" },
    fact_check_notes: { type: "string" },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sequence_no", "section_type", "purpose", "headline", "supporting_copy", "evidence_needed", "visual_direction", "transition_to_next"],
        properties: {
          sequence_no: { type: "integer", minimum: 1, maximum: 20 },
          section_type: { type: "string", enum: ["slide", "scene"] },
          purpose: { type: "string" },
          headline: { type: "string" },
          supporting_copy: { type: "string" },
          evidence_needed: { type: "string" },
          visual_direction: { type: "string" },
          transition_to_next: { type: "string" },
        },
      },
    },
  },
} as const;

export const qualitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "case_strength", "hook_strength", "tension", "insight_depth", "mechanism_clarity", "audience_relevance",
    "brand_fit", "brand_pov", "story_flow", "non_generic_score", "conversion_naturalness", "evidence_safety",
    "reviewer_notes", "required_revisions"
  ],
  properties: {
    case_strength: score,
    hook_strength: score,
    tension: score,
    insight_depth: score,
    mechanism_clarity: score,
    audience_relevance: score,
    brand_fit: score,
    brand_pov: score,
    story_flow: score,
    non_generic_score: score,
    conversion_naturalness: score,
    evidence_safety: score,
    reviewer_notes: { type: "string" },
    required_revisions: { type: "array", maxItems: 8, items: { type: "string" } },
  },
} as const;
