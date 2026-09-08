"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = {
  brief_id: string;
  assigned_to: string;
  status: "todo" | "in_progress" | "review" | "completed";
};

type Member = { id: string; display_name: string };

const statusLabel: Record<Task["status"], string> = {
  todo: "To-do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

export default function CalendarAssignmentBadges() {
  useEffect(() => {
    let disposed = false;
    let timer = 0;
    let observer: MutationObserver | null = null;

    async function loadAndDecorate() {
      const supabase = createClient();
      const [{ data: tasks, error: taskError }, { data: members, error: memberError }] = await Promise.all([
        supabase.from("task_assignments").select("brief_id,assigned_to,status"),
        supabase.from("team_members").select("id,display_name").eq("active", true),
      ]);
      if (disposed || taskError || memberError) return;

      const memberMap = new Map((members ?? []).map((member: Member) => [member.id, member.display_name]));
      const byTitle = new Map<string, { name: string; status: Task["status"] }[]>();

      const briefIds = Array.from(new Set((tasks ?? []).map((task: Task) => task.brief_id).filter(Boolean)));
      if (!briefIds.length) return;

      const { data: briefs, error: briefError } = await supabase
        .from("content_briefs")
        .select("id,content_idea_id")
        .in("id", briefIds);
      if (disposed || briefError) return;

      const ideaIds = Array.from(new Set((briefs ?? []).map((brief: any) => brief.content_idea_id).filter(Boolean)));
      const { data: ideas, error: ideaError } = ideaIds.length
        ? await supabase.from("content_ideas").select("id,working_title").in("id", ideaIds)
        : { data: [], error: null };
      if (disposed || ideaError) return;

      const titleByBrief = new Map((briefs ?? []).map((brief: any) => [brief.id, (ideas ?? []).find((idea: any) => idea.id === brief.content_idea_id)?.working_title || "Untitled content"]));

      (tasks ?? []).forEach((task: Task) => {
        const title = titleByBrief.get(task.brief_id);
        const name = memberMap.get(task.assigned_to);
        if (!title || !name) return;
        const list = byTitle.get(title) ?? [];
        list.push({ name, status: task.status });
        byTitle.set(title, list);
      });

      const decorate = () => {
        const articles = document.querySelectorAll<HTMLElement>("main.app-workspace article");
        articles.forEach((article) => {
          const title = Array.from(article.querySelectorAll("p"))[0]?.textContent?.trim();
          if (!title) return;

          article.querySelectorAll("[data-assignment-badge]").forEach((node) => node.remove());
          const assignments = byTitle.get(title) ?? [];
          if (!assignments.length) return;

          const badge = document.createElement("div");
          badge.setAttribute("data-assignment-badge", "true");
          badge.className = "mt-2 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-[9px] leading-3 text-blue-800";
          const names = assignments.map((assignment) => assignment.name).join(", ");
          const statuses = assignments.map((assignment) => `${assignment.name}: ${statusLabel[assignment.status]}`).join(" · ");
          badge.innerHTML = `<div style="font-weight:700">👤 Assigned: ${names}</div><div style="margin-top:2px;color:#64748b">${statuses}</div>`;
          article.appendChild(badge);
        });
      };

      decorate();
      timer = window.setTimeout(decorate, 150);
      timer = window.setTimeout(decorate, 500);

      const workspace = document.querySelector("main.app-workspace");
      if (workspace) {
        observer = new MutationObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(decorate, 80);
        });
        observer.observe(workspace, { childList: true, subtree: true });
      }
    }

    void loadAndDecorate();
    const refresh = () => void loadAndDecorate();
    window.addEventListener("task-assignment-updated", refresh);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("task-assignment-updated", refresh);
    };
  }, []);

  return null;
}
