"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Diagnostics = {
  organizationCount?: number;
  declaredChannelCount?: number;
  returnedChannelCount?: number;
  services?: string[];
};

function findTarget(): HTMLElement | null {
  const select = Array.from(document.querySelectorAll("select")).find((node) =>
    Array.from(node.options).some((option) => option.textContent?.includes("Pilih akun Instagram")),
  );
  if (!select) return null;

  const parent = select.parentElement;
  if (!parent) return null;

  const existing = parent.querySelector<HTMLElement>("[data-buffer-diagnostics-root]");
  if (existing) return existing;

  const root = document.createElement("div");
  root.setAttribute("data-buffer-diagnostics-root", "true");
  select.insertAdjacentElement("afterend", root);
  return root;
}

export default function BufferChannelDiagnostics() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState("Checking Buffer connection...");
  const [tone, setTone] = useState<"ok" | "warn" | "error">("warn");

  useEffect(() => {
    let disposed = false;
    let frame = 0;

    const resolve = () => {
      if (disposed) return;
      const node = findTarget();
      if (node) {
        setTarget(node);
        return;
      }
      frame = requestAnimationFrame(resolve);
    };

    resolve();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const response = await fetch("/api/buffer/channels?diagnostics=1", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok || !payload?.ok) {
          setTone("error");
          setStatus(`Buffer API error: ${payload?.error || `HTTP ${response.status}`}`);
          return;
        }

        const d = (payload.diagnostics ?? {}) as Diagnostics;
        const returned = Number(d.returnedChannelCount ?? payload.channels?.length ?? 0);
        const declared = Number(d.declaredChannelCount ?? 0);
        const orgs = Number(d.organizationCount ?? payload.organizations?.length ?? 0);
        const services = Array.isArray(d.services) && d.services.length ? ` · ${d.services.join(", ")}` : "";

        if (returned > 0) {
          setTone("ok");
          setStatus(`Buffer connected · ${orgs} organization · ${returned} channel ditemukan${services}`);
        } else {
          setTone("warn");
          setStatus(`Buffer connected · ${orgs} organization · declared ${declared} channel · API returned 0`);
        }
      } catch (error) {
        if (cancelled) return;
        setTone("error");
        setStatus(`Buffer diagnostic gagal: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) return null;

  const classes = tone === "ok"
    ? "mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] leading-4 text-emerald-700"
    : tone === "error"
      ? "mt-2 rounded-lg bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-700"
      : "mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-700";

  return createPortal(<div className={classes}>{status}</div>, target);
}
