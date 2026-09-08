"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { createClient } from "@/lib/supabase/client";

type Brief = {
  id: string;
  title: string;
  scheduledFor: string;
  humanQcStatus: string | null;
  designStatus: string | null;
  designFileUrl: string | null;
  coreInsight: string | null;
  brandPov: string | null;
  cta: string | null;
};

type BufferChannel = {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  type: string;
  timezone: string;
  isQueuePaused: boolean;
};

function findPublisherTarget(): HTMLElement | null {
  const button = Array.from(document.querySelectorAll("button")).find(
    (node) => node.textContent?.trim() === "Pindahkan Tanggal",
  );
  if (!button) return null;

  const container = button.parentElement;
  if (!container) return null;

  const existing = container.querySelector<HTMLElement>("[data-buffer-instagram-root]");
  if (existing) return existing;

  const root = document.createElement("div");
  root.setAttribute("data-buffer-instagram-root", "true");
  container.appendChild(root);
  return root;
}

function directMediaUrl(value: string | null) {
  if (!value) return "";
  return /\.(?:jpg|jpeg|png|webp|gif|mp4|mov)(?:\?|#|$)/i.test(value) ? value : "";
}

function inferMediaType(value: string) {
  return /\.(?:mp4|mov)(?:\?|#|$)/i.test(value) ? "video" : "image";
}

function defaultCaption(brief: Brief | null) {
  if (!brief) return "";
  return [brief.title, brief.coreInsight, brief.brandPov, brief.cta]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export default function BufferInstagramPanel() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [activeBriefId, setActiveBriefId] = useState("");
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [publishTime, setPublishTime] = useState("09:00");
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let observer: MutationObserver | null = null;

    const resolveTarget = () => {
      if (disposed) return;
      const target = findPublisherTarget();
      if (target) {
        setPortalTarget(target);
        observer?.disconnect();
        return;
      }
      frame = window.requestAnimationFrame(resolveTarget);
    };

    observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    resolveTarget();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  async function loadBriefs() {
    const supabase = createClient();
    const { data: rows, error: briefError } = await supabase
      .from("content_briefs")
      .select("id,content_idea_id,scheduled_for,human_qc_status,design_status,design_file_url,core_insight,brand_pov,cta")
      .not("scheduled_for", "is", null)
      .order("scheduled_for", { ascending: true });

    if (briefError) {
      setError(briefError.message);
      return;
    }

    const ideaIds = (rows ?? []).map((row: any) => row.content_idea_id).filter(Boolean);
    const { data: ideas, error: ideaError } = ideaIds.length
      ? await supabase.from("content_ideas").select("id,working_title").in("id", ideaIds)
      : { data: [], error: null };

    if (ideaError) {
      setError(ideaError.message);
      return;
    }

    const titleMap = new Map((ideas ?? []).map((idea: any) => [idea.id, idea.working_title || "Untitled content"]));
    setBriefs((rows ?? []).map((row: any) => ({
      id: row.id,
      title: titleMap.get(row.content_idea_id) || "Untitled content",
      scheduledFor: row.scheduled_for,
      humanQcStatus: row.human_qc_status,
      designStatus: row.design_status,
      designFileUrl: row.design_file_url,
      coreInsight: row.core_insight,
      brandPov: row.brand_pov,
      cta: row.cta,
    })) as Brief[]);
  }

  async function loadChannels() {
    setLoadingChannels(true);
    setError("");
    try {
      const response = await fetch("/api/buffer/channels", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Gagal memuat channel Buffer.");
      const rows = (payload.channels ?? []) as BufferChannel[];
      setChannels(rows);
      if (rows.length === 1) setChannelId(rows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat channel Buffer.");
    } finally {
      setLoadingChannels(false);
    }
  }

  useEffect(() => {
    void loadBriefs();
    void loadChannels();
  }, []);

  useEffect(() => {
    const handleCalendarCardClick = (event: MouseEvent) => {
      const article = (event.target as HTMLElement | null)?.closest("article");
      if (!article) return;
      const cardText = article.textContent || "";
      if (!cardText.includes("Instagram")) return;

      const title = Array.from(article.querySelectorAll("p"))[0]?.textContent?.trim();
      if (!title) return;
      const matched = briefs.find((brief) => brief.title.trim() === title);
      if (!matched) return;

      setActiveBriefId(matched.id);
      setCaption(defaultCaption(matched));
      const detectedMedia = directMediaUrl(matched.designFileUrl);
      setMediaUrl(detectedMedia);
      setMediaType(inferMediaType(detectedMedia));
      setMessage("");
      setError("");
    };

    document.addEventListener("click", handleCalendarCardClick);
    return () => document.removeEventListener("click", handleCalendarCardClick);
  }, [briefs]);

  const activeBrief = useMemo(
    () => briefs.find((brief) => brief.id === activeBriefId) ?? null,
    [briefs, activeBriefId],
  );

  async function scheduleToBuffer() {
    if (!activeBrief) {
      setError("Klik kartu Instagram di Calendar terlebih dahulu.");
      return;
    }
    if (activeBrief.humanQcStatus !== "approved") {
      setError("Human QC Instagram harus approved sebelum dikirim ke Buffer.");
      return;
    }
    if (activeBrief.designStatus !== "designed") {
      setError("Design Status harus Designed sebelum dikirim ke Buffer.");
      return;
    }
    if (!channelId) {
      setError("Pilih channel Instagram Buffer terlebih dahulu.");
      return;
    }
    if (!mediaUrl.trim()) {
      setError("Masukkan direct public image/video URL. Link editor Canva/Figma tidak dapat dipublish langsung oleh Buffer.");
      return;
    }

    setScheduling(true);
    setMessage("");
    setError("");

    try {
      const dueAt = new Date(`${activeBrief.scheduledFor}T${publishTime}:00+07:00`).toISOString();
      const response = await fetch("/api/buffer/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          text: caption,
          dueAt,
          mediaUrl: mediaUrl.trim(),
          mediaType,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Scheduling Buffer gagal.");

      setMessage(`Scheduled on Buffer ✓ · ${activeBrief.scheduledFor} ${publishTime} WIB`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scheduling Buffer gagal.");
    } finally {
      setScheduling(false);
    }
  }

  if (!portalTarget) return null;

  const panel = (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Buffer Publisher</p>
          <p className="mt-1 text-sm font-bold text-slate-900">Instagram Scheduling</p>
        </div>
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700">Buffer</span>
      </div>

      {!activeBrief ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Klik kartu <strong>Instagram</strong> di Calendar. Panel ini sengaja tidak aktif untuk LinkedIn atau SEO.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Selected Instagram Content</p>
            <p className="mt-1 text-xs font-semibold text-slate-900">{activeBrief.title}</p>
            <p className="mt-1 text-[10px] text-slate-500">{activeBrief.scheduledFor} · QC {activeBrief.humanQcStatus === "approved" ? "Approved" : "Pending"} · {activeBrief.designStatus === "designed" ? "Designed" : "Not Designed"}</p>
          </div>

          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Instagram Channel</label>
          <select value={channelId} onChange={(event) => setChannelId(event.target.value)} disabled={loadingChannels} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-red-700">
            <option value="">{loadingChannels ? "Loading Buffer..." : "Pilih channel"}</option>
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.displayName || channel.name}</option>)}
          </select>

          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Caption</label>
          <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={6} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs leading-5 outline-none focus:border-red-700" />

          <div className="grid grid-cols-[1fr_92px] gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Publish Time (WIB)</label>
              <input type="time" value={publishTime} onChange={(event) => setPublishTime(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-red-700" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Media</label>
              <select value={mediaType} onChange={(event) => setMediaType(event.target.value as "image" | "video")} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-xs outline-none focus:border-red-700"><option value="image">Image</option><option value="video">Video</option></select>
            </div>
          </div>

          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Direct Public Media URL</label>
          <input type="url" value={mediaUrl} onChange={(event) => { const value = event.target.value; setMediaUrl(value); setMediaType(inferMediaType(value)); }} placeholder="https://.../final-post.jpg" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-red-700" />
          <p className="text-[10px] leading-4 text-slate-500">Harus URL file publik langsung. Buffer membutuhkan image/video untuk Instagram; link editor Canva/Figma tidak cukup.</p>

          {message && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</div>}
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <button onClick={scheduleToBuffer} disabled={scheduling || loadingChannels} className="w-full rounded-lg bg-red-600 px-4 py-3 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
            {scheduling ? "Scheduling to Buffer..." : "Schedule to Buffer → Instagram"}
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(panel, portalTarget);
}
