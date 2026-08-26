"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const STORY_ANGLE_COUNT_STORAGE_KEY = "smm-simplified:story-angle-count:v1";
export const STORY_ANGLE_COUNT_EVENT = "smm-simplified:story-angle-count-change";

export default function StoryAngleCountControl() {
  const pathname = usePathname();
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (pathname !== "/") return;

    try {
      const saved = Number(window.localStorage.getItem(STORY_ANGLE_COUNT_STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 1 && saved <= 10) {
        setCount(saved);
      }
    } catch {
      // Keep the default when browser storage is unavailable.
    }
  }, [pathname]);

  if (pathname !== "/") return null;

  function selectCount(value: number) {
    setCount(value);

    try {
      window.localStorage.setItem(STORY_ANGLE_COUNT_STORAGE_KEY, String(value));
    } catch {
      // The in-memory state still works when storage is unavailable.
    }

    window.dispatchEvent(
      new CustomEvent(STORY_ANGLE_COUNT_EVENT, {
        detail: { count: value },
      }),
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[310px] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
            Generate Story Angles
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            Berapa brief yang ingin dibuat?
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
          {count}/10
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => selectCount(value)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
              count === value
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-4 text-slate-500">
        Default 5. Maksimal 10. AI tidak dipaksa membuat filler jika angle tambahan tidak cukup kuat.
      </p>
    </div>
  );
}
