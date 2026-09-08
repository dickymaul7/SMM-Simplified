# Content Expansion v1

## Goal
Turn a Human-QC-approved Master Social Brief into channel-native derivative content without losing evidence, Brand POV, or editorial alignment.

## Source of truth
The existing Social Brief remains the Master Content. LinkedIn and SEO derivatives never mutate the Master Brief.

## Workflow
Master Social Brief
→ Human QC Approved
→ Content Expansion
→ LinkedIn Draft / SEO Draft
→ Human Edit
→ Alignment Check
→ Derivative Human QC
→ Final

## Channels in v1
### LinkedIn
Editable fields:
- Hook
- Main Angle
- Body Copy
- Key Takeaway
- CTA
- Suggested Visual
- Hashtags
- Additional Research Required

### SEO Article
Editable fields:
- Primary Keyword
- Secondary Keywords
- Search Intent
- SEO Title
- Meta Description
- Slug
- Article Angle
- H1
- H2/H3 Outline
- Internal Link Suggestions
- CTA
- Full SEO Article Draft
- Additional Research Required

## Evidence rule
AI may adapt structure, length, hook, tone, and explanation for the destination channel. It may not invent new facts, figures, quotes, outcomes, legal findings, or causal claims. Missing evidence is written into `research_gaps` / Additional Research Required.

## Alignment gate
Alignment is reviewed across:
- Core Message
- Audience
- Brand POV
- Facts & Claims
- Channel Fit

Overall alignment must be at least 85/100 before derivative Human QC can be finalized.

Any manual derivative edit clears the previous alignment report and derivative Human QC. The user must save, run Alignment Check again, then approve Final.

## Source lineage / out-of-sync
`content_expansions.master_qc_at` records which Master Human-QC version the derivative was last generated or alignment-checked against.

If the Master Brief changes and Human QC is invalidated/re-approved, the derivative displays `Master Content Changed`. The user can either regenerate from the Master or edit manually and run Alignment Check against the latest approved Master.

## Database
Additive migration:
`database/CONTENT_EXPANSION_V1.sql`

New table only:
`content_expansions`

No existing business table or existing RLS policy is modified by this migration.
