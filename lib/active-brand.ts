export const ACTIVE_BRAND_STORAGE_KEY = "smm-simplified:active-brand:v1";
export const ACTIVE_BRAND_ALL = "__all__";
export const ACTIVE_BRAND_CHANGE_EVENT = "smm-simplified:active-brand-change";

export type ActiveBrandSelection = {
  id: string;
  name: string;
};

export const ALL_BRANDS_SELECTION: ActiveBrandSelection = {
  id: ACTIVE_BRAND_ALL,
  name: "All Brands",
};

export function readActiveBrandSelection(): ActiveBrandSelection | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_BRAND_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ActiveBrandSelection>;
    if (typeof parsed.id !== "string" || typeof parsed.name !== "string") return null;
    if (!parsed.id.trim() || !parsed.name.trim()) return null;

    return {
      id: parsed.id,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export function writeActiveBrandSelection(selection: ActiveBrandSelection) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, JSON.stringify(selection));
  window.dispatchEvent(
    new CustomEvent<ActiveBrandSelection>(ACTIVE_BRAND_CHANGE_EVENT, {
      detail: selection,
    }),
  );
}
