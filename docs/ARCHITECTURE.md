# ARCHITECTURE.md

## High-level flow
User
↓
Next.js UI
↓
Supabase Auth
↓
Quick Brief
↓
AI Research / Generation
├─ Tavily: live web search
└─ Gemini: analysis + storytelling
↓
Supabase persistence
↓
Full Brief editor
↓
Human QC
↓
Scheduling
↓
Content Calendar
↓
Design production state

## Core domains
### Brief creation
Short user input and AI generation.

### Research
Tavily retrieves live public sources. Research must support claims.

### Storytelling
Gemini turns brief + research into case-led Story Angles and Story Sequence.

### Editorial editing
Full Brief is a human-editable production artifact. Human changes must not be silently overwritten.

### Quality control
AI quality score is advisory. Human QC is the final gate.

### Scheduling
Publication date is stored and surfaced in Content Calendar.

### Design workflow
Ready to Design → Designed, with external design-file URL.

## Future architecture
### Multi-brand
Introduce global active-brand context/filter.
Overview, Brief Studio, Calendar, Analytics should respect active brand.

### Analytics
Keep Meta API integration separate from storytelling.
Suggested flow:
Meta Business API → sync layer → normalized social metrics tables → analytics queries → UI.

### External client access
Before client self-service, implement user↔brand access mapping and brand-level RLS.
