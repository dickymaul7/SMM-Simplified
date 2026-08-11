# AGENTS.md — SMM Simplified

## Project identity
SMM Simplified is an existing production-style social-media content operating system. Treat it as a stable application, not a greenfield rewrite.

Repository: `smm-simplified`

## Primary rule
PRESERVE CURRENT BEHAVIOR unless the user explicitly asks to change it.

Do not refactor, rewrite, simplify, rename, or replace working business logic merely for cleanliness.

## Current stable workflow
1. Quick Brief
2. AI live research
3. 5 Story Angles
4. Full Storytelling Brief
5. Human slide editing
6. Human QC
7. Schedule Brief
8. Content Calendar
9. Ready to Design / Designed
10. External design-file link

## AI/content quality requirements
- Use case-led storytelling whenever a strong real case is available.
- Prefer a real company/event as the opening hook.
- Avoid generic educational content such as “5 manfaat...” unless explicitly requested.
- Use live research and credible sources.
- Never fabricate cases, numbers, quotes, or outcomes.
- Preferred narrative:
  Case Hook → Context → Tension → Turning Point/Failure → Mechanism → Outcome → Executive Insight → Brand POV → CTA.
- Brand promotion must not appear too early.
- Mechanism and business insight matter more than superficial tips.
- Human-facing AI output should be Bahasa Indonesia by default.
- Existing Gemini + Tavily behavior should not be changed unless explicitly requested.

## Non-regression rules
Before declaring work complete, verify relevant areas:
- Quick Brief inputs survive navigation and return.
- AI still generates 5 Story Angles.
- Research remains evidence-based and source-backed.
- Full Brief opens.
- Slides remain editable, reorderable, and deletable.
- AI Improve still works when available.
- Human QC still works.
- Editing after Human QC invalidates QC when applicable.
- Jadwalkan Brief works.
- Scheduled content appears in Content Calendar.
- Calendar drag/drop persists changes.
- Quick Move persists changes.
- Ready to Design / Designed persists.
- Design file link persists and opens.
- Existing Supabase data is never deleted or recreated.
- Existing RLS/auth is not weakened.
- No secrets are committed.

## UI work policy
For UI redesign:
- Change presentation layer only unless behavior change is explicitly requested.
- Preserve routes, data flow, database behavior, AI logic, and user workflow.
- Prefer additive components/styles over replacing working files from older versions.
- NEVER use an older file version as the base for a new UI change.
- Inspect the current repository file before editing it.

## Git workflow
- `main` = production.
- `stable-v1` = known-good frozen checkpoint.
- New substantial work should use a feature branch, e.g. `ui-revamp`.
- Prefer Vercel Preview before merging to `main`.
- Never modify `stable-v1`.

## Database safety
- Prefer additive migrations.
- Never drop/reset production tables.
- Preserve existing RLS unless access-control work explicitly requires changes.

## Secrets
Never commit `.env`, `.env.local`, Gemini keys, Tavily keys, or Supabase secret/service-role keys.

## Near-term roadmap
1. UI Revamp with zero UX/logic regression.
2. Global brand selector / multi-brand.
3. Overview dashboard.
4. Analytics workspace.
5. Meta Business API integration.
6. Brand-level access control before external multi-client rollout.
