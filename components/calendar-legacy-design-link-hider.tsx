"use client";

import { useEffect } from "react";

function hideLegacyDesignLinkControls() {
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((node) => node.textContent?.trim() === "Link File Design");
  if (!label) return false;

  const input = label.nextElementSibling as HTMLElement | null;
  const saveButton = input?.nextElementSibling as HTMLElement | null;
  const openLink = saveButton?.nextElementSibling as HTMLElement | null;

  label.style.display = "none";
  if (input) input.style.display = "none";
  if (saveButton?.tagName === "BUTTON") saveButton.style.display = "none";
  if (openLink?.tagName === "A") openLink.style.display = "none";

  return true;
}

export default function CalendarLegacyDesignLinkHider() {
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let observer: MutationObserver | null = null;

    const apply = () => {
      if (disposed) return;
      if (hideLegacyDesignLinkControls()) return;
      frame = window.requestAnimationFrame(apply);
    };

    observer = new MutationObserver(() => {
      if (!disposed) hideLegacyDesignLinkControls();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    apply();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return null;
}
