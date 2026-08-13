"use client";

import { useEffect, useState } from "react";
import {
  ACTIVE_BRAND_CHANGE_EVENT,
  ALL_BRANDS_SELECTION,
  readActiveBrandSelection,
  type ActiveBrandSelection,
} from "@/lib/active-brand";

export function useActiveBrandSelection() {
  const [selection, setSelection] = useState<ActiveBrandSelection>(ALL_BRANDS_SELECTION);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readActiveBrandSelection();
    if (stored) setSelection(stored);
    setHydrated(true);

    function onChange(event: Event) {
      const detail = (event as CustomEvent<ActiveBrandSelection>).detail;
      if (!detail || typeof detail.id !== "string" || typeof detail.name !== "string") return;
      setSelection(detail);
    }

    window.addEventListener(ACTIVE_BRAND_CHANGE_EVENT, onChange as EventListener);
    return () => window.removeEventListener(ACTIVE_BRAND_CHANGE_EVENT, onChange as EventListener);
  }, []);

  return { selection, hydrated };
}
