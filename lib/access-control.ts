export const ACCESS_CONTROL_ENFORCEMENT_ENABLED = false;

export const ROLE_KEYS = [
  "super_admin",
  "manager",
  "content_writer",
  "designer",
  "viewer",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSION_KEYS = [
  "overview.view",
  "brief.view",
  "brief.create",
  "brief.ai_generate",
  "brief.edit",
  "brief.improve",
  "brief.qc",
  "calendar.view",
  "calendar.schedule",
  "calendar.reschedule",
  "design.view",
  "design.update_status",
  "design.update_link",
  "brand.view",
  "brand.edit",
  "brand.upload",
  "brand.create",
  "brand.delete",
  "analytics.view",
  "analytics.export",
  "users.view",
  "users.invite",
  "users.manage",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionOverride = {
  key: PermissionKey;
  allowed: boolean;
};

export type UserAccessSnapshot = {
  foundationReady: boolean;
  enforcementEnabled: boolean;
  userId: string;
  role: {
    key: RoleKey;
    name: string;
  } | null;
  permissions: PermissionKey[];
  brandIds: string[];
  allBrands: boolean;
};

const allPermissions = [...PERMISSION_KEYS];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  super_admin: allPermissions,
  manager: [
    "overview.view",
    "brief.view",
    "brief.create",
    "brief.ai_generate",
    "brief.edit",
    "brief.improve",
    "brief.qc",
    "calendar.view",
    "calendar.schedule",
    "calendar.reschedule",
    "design.view",
    "design.update_status",
    "design.update_link",
    "brand.view",
    "brand.edit",
    "brand.upload",
    "brand.create",
    "analytics.view",
    "analytics.export",
  ],
  content_writer: [
    "overview.view",
    "brief.view",
    "brief.create",
    "brief.ai_generate",
    "brief.edit",
    "brief.improve",
    "calendar.view",
    "design.view",
    "brand.view",
  ],
  designer: [
    "overview.view",
    "brief.view",
    "calendar.view",
    "design.view",
    "design.update_status",
    "design.update_link",
    "brand.view",
  ],
  viewer: [
    "overview.view",
    "brief.view",
    "calendar.view",
    "design.view",
    "brand.view",
    "analytics.view",
  ],
};

export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && (ROLE_KEYS as readonly string[]).includes(value);
}

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function applyPermissionOverrides(
  basePermissions: readonly PermissionKey[],
  overrides: readonly PermissionOverride[],
) {
  const resolved = new Set<PermissionKey>(basePermissions);

  for (const override of overrides) {
    if (override.allowed) resolved.add(override.key);
    else resolved.delete(override.key);
  }

  return PERMISSION_KEYS.filter((key) => resolved.has(key));
}

export function hasPermission(
  snapshot: Pick<UserAccessSnapshot, "permissions" | "role">,
  permission: PermissionKey,
) {
  if (snapshot.role?.key === "super_admin") return true;
  return snapshot.permissions.includes(permission);
}

export function canAccessBrand(
  snapshot: Pick<UserAccessSnapshot, "allBrands" | "brandIds" | "role">,
  brandId: string,
) {
  if (snapshot.role?.key === "super_admin" || snapshot.allBrands) return true;
  return snapshot.brandIds.includes(brandId);
}

// Phase 1 keeps the existing app unrestricted until enforcement phases are explicitly activated.
// This fallback prevents a missing/not-yet-applied access schema from locking the current owner out.
export function legacyUnrestrictedAccess(userId: string): UserAccessSnapshot {
  return {
    foundationReady: false,
    enforcementEnabled: false,
    userId,
    role: null,
    permissions: [...PERMISSION_KEYS],
    brandIds: [],
    allBrands: true,
  };
}
