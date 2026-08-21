"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "smm-simplified:story-angle-count:v1";

export default function StoryAngleCountControl() {
  const pathname = usePathname();
  const [count, setCount] = useState(5);
  const countRef = useRef(5);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 1 && saved <= 10) {
        setCount(saved);
        countRef.current = saved;
      }
    } catch {}
  }, []);

  useEffect(() => {
    countRef.current = count;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(count));
    } catch {}
  }, [count]);

  useEffect(() => {
    if (!pathname?.startsWith("/studio")) return;

    const originalFetch = window.fetch.bind(window);
    const interceptedFetch: typeof window.fetch = async (input, init) => {
      const originalUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (!originalUrl.includes("/api/ai/angles")) return originalFetch(input, init);

      const targetUrl = originalUrl.replace("/api/ai/angles", "/api/ai/angles-v2");
      const nextInit: RequestInit = { ...init };
      if (typeof nextInit.body === "string") {
        try {
          const body = JSON.parse(nextInit.body) as Record<string, unknown>;
          body.storyAngleCount = countRef.current;
          nextInit.body = JSON.stringify(body);
        } catch {}
      }

      if (typeof input === "string") {
        return originalFetch(targetUrl, nextInit);
      }

      if (input instanceof Request) {
        return originalFetch(new Request(targetUrl, input), nextInit);
      }

      return originalFetch(targetUrl, nextInit);
    };

    window.fetch = interceptedFetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname]);

  if (!pathname?.startsWith("/studio")) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[290px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Story Angles</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Jumlah yang ingin dibuat</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{count}/10</span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCount(value)}
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
        Default 5. Maksimal 10. Jika angle tambahan tidak cukup kuat, AI boleh berhenti lebih awal daripada membuat filler.
      </p>
    </div>
  );
}
