# NON_REGRESSION_RULES.md

A change is NOT complete if any relevant item regresses.

## Brief Studio
- [ ] Quick Brief loads
- [ ] Draft persistence still works
- [ ] User can clear the form intentionally
- [ ] Existing fields remain
- [ ] AI generation still works
- [ ] 5 Story Angles are returned

## Research / AI quality
- [ ] Real-case evidence preserved
- [ ] Source-backed research preserved
- [ ] Case-first storytelling preserved
- [ ] Human-facing copy stays Bahasa Indonesia
- [ ] No generic prompt rewrite
- [ ] Gemini/Tavily untouched unless explicitly requested

## Full Brief
- [ ] Full Brief opens
- [ ] Story sequence loads
- [ ] Headline editable
- [ ] Body copy editable
- [ ] Evidence editable
- [ ] Visual direction editable
- [ ] Transition editable
- [ ] Slide reorder works
- [ ] Slide delete works
- [ ] Existing brief data remains intact

## QC
- [ ] Human QC can be approved
- [ ] QC persists
- [ ] Content edits invalidate QC where expected

## Scheduling
- [ ] Jadwalkan Brief works
- [ ] scheduled_for persists
- [ ] Existing scheduled items still appear

## Calendar
- [ ] All existing scheduled content displays
- [ ] Drag/drop schedule works
- [ ] Quick Move works
- [ ] Refresh preserves moved dates
- [ ] Full Brief link works

## Design workflow
- [ ] Ready to Design persists
- [ ] Designed persists
- [ ] Design link persists
- [ ] Design link opens
- [ ] Existing scheduled cards do not disappear

## Infrastructure
- [ ] Build succeeds
- [ ] Vercel Preview succeeds
- [ ] No secrets leak
- [ ] Supabase tables are not dropped/reset
- [ ] Existing RLS is preserved
