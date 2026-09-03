CORE DASHBOARD

SMM StoryBrief Lite reuses the existing SMM Dashboard Supabase schema v1.
Do not rerun or reset the existing core schema/RLS.

USER ROLE FOUNDATION — PHASE 1

A new additive SQL file is available:
  database/USER_ROLE_FOUNDATION.sql

Run it once in the existing Supabase project's SQL Editor when activating the User Role Foundation.

Safety rules:
- It creates only new access-control tables.
- It does not drop/reset existing data.
- It does not change RLS on brands, campaigns, content_briefs, or other existing business tables.
- Access enforcement remains OFF, so the current dashboard workflow stays unchanged.

USERS & ACCESS UI — PHASE 2

After Phase 1 has been applied, run this additive SQL file once:
  database/USERS_ACCESS_UI.sql

It adds secure SECURITY DEFINER RPCs used by the Settings → Users & Access page.

Phase 2 safety rules:
- It does not open broad write policies on access-control tables.
- Admin read/write is guarded by users.view / users.manage permissions.
- It protects the final Super Admin from accidental demotion.
- It does not change RLS on existing business tables.
- It does not activate workspace-wide permission enforcement yet.

CONTENT EXPANSION V1

Run this additive SQL file once before testing LinkedIn / SEO derivatives:
  database/CONTENT_EXPANSION_V1.sql

It creates only the new content_expansions table used for channel derivatives.

Content Expansion safety rules:
- Existing content_briefs, brief_sections, campaigns, brands, research, Calendar, and Design data are untouched.
- Master Social Brief remains the source of truth.
- A derivative can only be AI-generated from a Human-QC-approved Master Brief.
- LinkedIn and SEO derivatives have their own editable draft, Alignment Check, and Human QC status.
- Existing business-table RLS is not changed.
- The new table uses temporary authenticated-workspace policies consistent with current workspace-wide enforcement being OFF; brand-level isolation remains a later access-control phase.
