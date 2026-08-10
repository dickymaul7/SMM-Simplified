# SMM Dashboard V2 — Simplified StoryBrief Architecture

## User-facing workflow

### Step 1 — Quick Brief
Required:
- Brand
- Topic / Product / Program
- Target Audience
- Objective

Optional:
- Website
- CTA
- Preferred Format
- Advanced Context

### Step 2 — Story Angles
Automated hidden workflow:
- Build editorial Brand Context from existing brand intelligence or conservative AI inference
- Gemini creates research queries
- Tavily performs live web research
- Gemini selects evidence-backed cases
- 5 case-led angles are generated

User only chooses the angle.

### Step 3 — Final Brief
Automated:
- Case-first story sequence
- Evidence labels and source notes
- Quality review across 12 dimensions
- Auto-revision if score <90

User can:
- Improve Brief with AI
- Add optional human revision note
- Copy Full Brief
- Export PDF

## Why quality can improve despite fewer inputs

The old version asked the user to manually populate many strategy fields. V2 moves those fields into an internal AI context layer. Quality is protected by stronger evidence and editorial gates rather than form length.

Quality engine:
**Short human input → Hidden Brand Context → Live Research → Verified Case → Case-First Story → Mechanism → Executive Insight → Brand POV → Quality Critic → Auto Revision**
