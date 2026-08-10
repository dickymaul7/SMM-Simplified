import fs from "node:fs/promises";
import path from "node:path";

export function getAIModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

export async function loadStorytellingKnowledge() {
  const file = path.join(process.cwd(), "public", "knowledge", "storytelling_knowledge_base.md");
  return fs.readFile(file, "utf8");
}

export function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function safeJsonParse<T>(text: string): T {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

function extractInteractionText(payload: any) {
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const modelSteps = steps.filter((step: any) => step?.type === "model_output" && Array.isArray(step?.content));
  const last = modelSteps[modelSteps.length - 1];
  if (!last) return "";
  return last.content
    .filter((item: any) => item?.type === "text" && typeof item?.text === "string")
    .map((item: any) => item.text)
    .join("");
}

export async function createStructuredJson<T>({
  schema,
  system,
  user,
  temperature: _temperature = 0.35,
}: {
  schema: Record<string, unknown>;
  system: string;
  user: string;
  temperature?: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY belum dikonfigurasi.");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: getAIModel(),
      input: `SYSTEM ROLE\n${system}\n\nUSER TASK\n${user}`,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema,
      },
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || `Gemini request failed (${response.status})`;
    throw new Error(String(detail));
  }

  const text = extractInteractionText(payload);
  if (!text) throw new Error("Gemini tidak mengembalikan structured output.");
  return safeJsonParse<T>(text);
}

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, value));
}

export function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}
