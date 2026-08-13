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
