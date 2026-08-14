# Super Admin All Brands

## Purpose
Make the global `All Brands` workspace scope available only to Super Admin while preserving the existing Calendar and Overview aggregation behavior.

## Behavior
- Super Admin sees `All Brands` plus every brand in the Active Brand selector.
- When `All Brands` is active, existing Overview and Calendar behavior aggregates all brands.
- Calendar cards continue to show the brand name on each scheduled content card.
- Non-Super-Admin users do not see `All Brands`.
- Non-Super-Admin brand options are filtered to `user_brand_access` returned by `/api/access/me`.
- If a stored Active Brand is no longer accessible, the selector automatically moves to the first assigned brand.
- A user with no assigned brand sees `No brand access` and guidance to contact Super Admin.

## Compatibility
- No database migration is required.
- Existing Calendar loading, drag/drop, Quick Move, design status, and design link behavior are unchanged.
- Existing Overview metrics and Brand Breakdown logic are unchanged.
- Existing access-control enforcement remains OFF; this is role-aware UI scoping, not Phase 3/4 security enforcement.
- Legacy fallback remains unrestricted when the access-control foundation is not available, preventing owner lockout.
