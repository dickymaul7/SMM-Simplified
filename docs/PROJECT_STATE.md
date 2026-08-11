# PROJECT_STATE.md

## Current stable product
SMM Simplified is deployed via GitHub + Vercel and backed by Supabase.

## Stack
- Next.js App Router
- Supabase database + auth + RLS
- Gemini for reasoning/storytelling
- Tavily for live web research
- Vercel deployment
- GitHub source of truth

## Stable journey
### Quick Brief
Short user input:
- Brand/company
- Website optional
- Topic/product/campaign
- Audience
- Objective
- CTA
- Preferred format
- Advanced Context optional

Quick Brief draft persists across navigation.

### Story Angles
AI performs live research and returns 5 case-led Story Angles.

### Full Brief
User can edit:
- Purpose
- Headline
- Body Copy
- Evidence
- Visual Direction
- Transition

User can also reorder and delete slides.

### Human QC
Human QC is the final production gate.

### Scheduling
After Human QC, user can click `Jadwalkan Brief`.

### Content Calendar
Supports:
- monthly calendar
- scheduled-content cards
- drag/drop dates
- Quick Move
- opening Full Brief

### Design production state
Cards support:
- Ready to Design
- Designed
- external design-file link

## Important historical lesson
Previous updates accidentally reintroduced older versions of files and hid existing scheduled data.

Therefore:
- always inspect the current repository version before editing;
- never patch from an older copied file;
- preserve all current features when adding new ones.

## Stable checkpoint
`stable-v1` is the known-good snapshot created before the next major development phase.
