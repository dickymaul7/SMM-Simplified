import fs from "node:fs/promises";
import path from "node:path";

export function getAIModel() {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
}

export async function loadStorytellingKnowledge() {
  const file = path.join(process.cwd(), "public", "knowledge", "storytelling_knowledge_base.md");
  return fs.readFile(file, "utf8");
}

export function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function stripCodeFences(text: string) {
  return text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function extractFirstJson(text: string) {
  const cleaned = stripCodeFences(text);
  try { JSON.parse(cleaned); return cleaned; } catch {}
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((n) => n >= 0).sort((a, b) => a - b);
  if (!starts.length) return cleaned;
  const start = starts[0];
  const opening = cleaned[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === opening) depth++;
    if (ch === closing) { depth--; if (depth === 0) return cleaned.slice(start, i + 1); }
  }
  return cleaned;
}

function parseJson<T>(text: string): T {
  return JSON.parse(extractFirstJson(text)) as T;
}

type JsonSchema = {
  enum?: unknown[];
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  minimum?: number;
  maximum?: number;
};

function matchesSchema(value: unknown, schema: JsonSchema): boolean {
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    if (Array.isArray(schema.required) && schema.required.some((key) => !(key in record))) return false;
    return Object.entries(schema.properties ?? {}).every(([key, childSchema]) => !(key in record) || matchesSchema(record[key], childSchema));
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return false;
    if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return false;
    return !schema.items || value.every((item) => matchesSchema(item, schema.items!));
  }
  if (schema.type === "string") return typeof value === "string" && (typeof schema.minLength !== "number" || value.trim().length >= schema.minLength);
  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value) && (typeof schema.minimum !== "number" || value >= schema.minimum) && (typeof schema.maximum !== "number" || value <= schema.maximum);
  if (schema.type === "integer") return typeof value === "number" && Number.isInteger(value) && (typeof schema.minimum !== "number" || value >= schema.minimum) && (typeof schema.maximum !== "number" || value <= schema.maximum);
  return true;
}

function extractChatCompletionText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

async function callDeepSeekPlainText({ apiKey, model, system, prompt }: { apiKey: string; model: string; system: string; prompt: string }) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature: 0.35,
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `DeepSeek request failed (${response.status})`;
    throw new Error(`DeepSeek ${response.status}: ${String(message)}`);
  }
  const text = extractChatCompletionText(payload);
  if (!text) throw new Error("DeepSeek tidak mengembalikan teks.");
  return text;
}

export async function createStructuredJson<T>({ schema, system, user, temperature: _temperature = 0.35 }: { schema: Record<string, unknown>; system: string; user: string; temperature?: number }) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY belum dikonfigurasi.");
  const model = getAIModel();
  const contract = JSON.stringify(schema);
  const prompt = `${user}\n\n=== OUTPUT CONTRACT ===\nKembalikan HANYA satu JSON valid.\nJANGAN gunakan markdown.\nJANGAN gunakan code fence.\nJANGAN menulis komentar sebelum atau sesudah JSON.\nIkuti struktur/schema ini sedekat mungkin dan isi seluruh field required:\n\n${contract}\n\nGunakan Bahasa Indonesia untuk seluruh field yang bersifat editorial/content, kecuali nama perusahaan, judul sumber, URL, istilah resmi, atau proper noun yang lebih tepat dipertahankan dalam bahasa aslinya.`;

  const firstText = await callDeepSeekPlainText({ apiKey, model, system, prompt });
  try {
    const parsed = parseJson<T>(firstText);
    if (!matchesSchema(parsed, schema as JsonSchema)) throw new Error("Incomplete JSON structure");
    return parsed;
  } catch {
    const repairPrompt = `Perbaiki struktur output berikut menjadi SATU JSON valid.\n\nATURAN:\n- Hanya JSON.\n- Tanpa markdown atau code fence.\n- Jangan menambah penjelasan.\n- Pertahankan isi/fakta semaksimal mungkin.\n- Jangan mengubah isi editorial kecuali diperlukan untuk memenuhi struktur.\n- Lengkapi semua field required dan sesuaikan dengan schema berikut.\n\nSCHEMA:\n${contract}\n\nOUTPUT YANG HARUS DIPERBAIKI:\n${firstText}`;
    const repairedText = await callDeepSeekPlainText({ apiKey, model, system: "Kamu adalah JSON repair assistant. Ikuti schema dengan ketat dan keluarkan hanya JSON valid.", prompt: repairPrompt });
    try {
      const repaired = parseJson<T>(repairedText);
      if (!matchesSchema(repaired, schema as JsonSchema)) throw new Error("Incomplete JSON structure");
      return repaired;
    } catch {
      throw new Error("Format respons AI tidak lengkap. Silakan generate ulang.");
    }
  }
}

export function clampScore(value: number) { if (!Number.isFinite(value)) return 0; return Math.min(10, Math.max(0, value)); }
export function average(values: number[]) { if (!values.length) return 0; return values.reduce((sum, value) => sum + value, 0) / values.length; }
export function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70); }
