# ACCESS_CONTROL.md

## Goal
SMM Simplified uses a two-axis access model:

1. **What can this user do?** → Role + granular permissions.
2. **Where can this user do it?** → Explicit brand access.

Phase 1 creates the foundation. Phase 2 adds the admin-facing Users & Access workspace. Existing dashboard behavior remains unrestricted until Phase 3 enforcement is explicitly activated.

## Preset roles
- `super_admin` — full access to every module and brand.
- `manager` — content operations, QC, calendar, design handoff, Brand Intelligence, analytics.
- `content_writer` — Brief Studio, AI generation, editing, read-only supporting workspaces.
- `designer` — read brief/calendar + update design status and design link.
- `viewer` — read-only client/viewer access.

Preset roles are defaults, not hard-coded final permissions. `user_permission_overrides` can allow or deny an individual permission for one user. Super Admin is intentionally always full-access and cannot be permission-denied, to reduce lockout risk.

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
One preset role assignment per user.

### user_brand_access
Explicit user ↔ brand mapping. Super Admin is treated as all-brand access by the application resolver.

### user_permission_overrides
Per-user allow/deny exceptions applied after the preset role matrix.

## Phase 1 runtime behavior
`lib/access-control.ts` contains the shared role/permission vocabulary and resolver helpers.

`GET /api/access/me` inspects the signed-in user's configured access once the foundation SQL has been applied.

`ACCESS_CONTROL_ENFORCEMENT_ENABLED` remains `false`. No existing sidebar, route, API, or Supabase business-table query is blocked yet.

If the foundation tables have not been applied, `/api/access/me` returns a safe `legacy_unrestricted` response instead of breaking the current dashboard.

## Phase 2 — Users & Access UI
Settings now renders a Users & Access workspace with:
- user list sourced from synced Supabase Auth profiles;
- preset role assignment;
- explicit Brand Access selection;
- granular permission customization per user;
- role-default permissions plus minimal per-user overrides;
- protection against demoting the final Super Admin;
- read-only mode when the actor has `users.view` but not `users.manage`.

The page uses `GET/PUT /api/access/admin`, which calls secure database RPCs from `database/USERS_ACCESS_UI.sql`.

The Phase 2 RPCs are `SECURITY DEFINER` and internally verify `users.view` / `users.manage`. This avoids opening broad RLS write policies on access-control tables.

### Adding / inviting users in Phase 2
Supabase Auth remains the source of truth. No service-role secret is committed to this application.

The UI therefore guides an administrator to create/invite the account from Supabase Authentication → Users, then click Refresh Users. The existing Auth → profile trigger syncs the user into the dashboard, after which Role, Brand Access, and granular permissions can be assigned.

A fully automated email invitation endpoint can be added later only with an explicitly secured server-side admin-auth strategy; it must never expose or commit a Supabase service-role secret.

## Database activation
Run these files in order in the existing Supabase project's SQL Editor:

1. `database/USER_ROLE_FOUNDATION.sql` — Phase 1 foundation.
2. `database/USERS_ACCESS_UI.sql` — Phase 2 secure admin RPCs.

Both scripts are additive and do not alter RLS on `brands`, `campaigns`, `content_briefs`, or other existing business tables.

## Planned enforcement phases
### Phase 3 — UI + API enforcement
Hide/disable unauthorized controls and verify permissions in server/API actions. Global brand selector must eventually show only brands in `user_brand_access`, except Super Admin.

### Phase 4 — Brand-level RLS
Restrict existing business data at the database layer using user ↔ brand access. This phase must be tested separately because it changes the true security boundary.

## Non-regression rule
Do not turn `ACCESS_CONTROL_ENFORCEMENT_ENABLED` on until Phase 3 has a verified Super Admin path and the existing Quick Brief → AI → Full Brief → QC → Calendar → Design workflow has passed regression testing.
