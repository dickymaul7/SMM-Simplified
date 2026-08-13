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
- Access enforcement remains OFF in Phase 1, so the current dashboard workflow stays unchanged.
