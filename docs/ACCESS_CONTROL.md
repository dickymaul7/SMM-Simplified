# ACCESS_CONTROL.md

## Goal
SMM Simplified uses a two-axis access model:

1. **What can this user do?** → Role + granular permissions.
2. **Where can this user do it?** → Explicit brand access.

Phase 1 creates the foundation only. Existing dashboard behavior remains unrestricted until later enforcement phases are explicitly activated.

## Preset roles
- `super_admin` — full access to every module and brand.
- `manager` — content operations, QC, calendar, design handoff, Brand Intelligence, analytics.
- `content_writer` — Brief Studio, AI generation, editing, read-only supporting workspaces.
- `designer` — read brief/calendar + update design status and design link.
- `viewer` — read-only client/viewer access.

Preset roles are defaults, not hard-coded final permissions. `user_permission_overrides` can allow or deny an individual permission for one user.

## Tables
### profiles
1:1 profile metadata for Supabase Auth users.

### roles
Preset role catalog.

### permissions
Granular permission catalog, for example `brief.ai_generate`, `brief.qc`, or `design.update_status`.

### role_permissions
Default permission bundle for each preset role.

### user_roles
One preset role assignment per user in Phase 1.

### user_brand_access
Explicit user ↔ brand mapping. Super Admin is treated as all-brand access by the application resolver.

### user_permission_overrides
Per-user allow/deny exceptions applied after the preset role matrix.

## Phase 1 runtime behavior
`lib/access-control.ts` contains the shared role/permission vocabulary and resolver helpers.

`GET /api/access/me` can inspect the signed-in user's configured access once the foundation SQL has been applied.

`ACCESS_CONTROL_ENFORCEMENT_ENABLED` is intentionally `false` in Phase 1. No existing sidebar, route, API, or Supabase business-table query is blocked yet.

If the new access-control tables have not been applied to Supabase, `/api/access/me` returns a safe `legacy_unrestricted` response instead of breaking the current dashboard.

## Database activation
Run `database/USER_ROLE_FOUNDATION.sql` once in the existing Supabase project's SQL Editor.

The script is additive:
- creates only new access-control tables;
- seeds five preset roles and the permission catalog;
- creates RLS only on the new access-control tables;
- does not alter RLS on `brands`, `campaigns`, `content_briefs`, or other existing business tables;
- backfills profile rows for existing Supabase Auth users;
- if the project has exactly one Auth user and no role assignment, safely assigns that user `super_admin` as a bootstrap.

## Planned enforcement phases
### Phase 2 — Users & Access UI
Admin-facing user list, role selection, brand access, granular overrides, invitation flow.

### Phase 3 — UI + API enforcement
Hide/disable unauthorized controls and verify permissions in server/API actions.

### Phase 4 — Brand-level RLS
Restrict existing business data at the database layer using user ↔ brand access. This phase must be tested separately because it changes the true security boundary.

## Non-regression rule
Do not turn `ACCESS_CONTROL_ENFORCEMENT_ENABLED` on until Phase 2/3 have a verified Super Admin path and the existing Quick Brief → AI → Full Brief → QC → Calendar → Design workflow has passed regression testing.
