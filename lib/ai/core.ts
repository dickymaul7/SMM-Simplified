import fs from "node:fs/promises";
import path from "node:path";

export function getAIModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

export async function loadStorytellingKnowledge() {
  const file = path.join(
    process.cwd(),
    "public",
    "knowledge",
    "storytelling_knowledge_base.md",
  );
  return fs.readFile(file, "utf8");
}

export function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function stripCodeFences(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractFirstJson(text: string) {
  const cleaned = stripCodeFences(text);

  // Fast path.
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {}

  // Recover the first balanced JSON object/array from extra prose.
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")]
    .filter((n) => n >= 0)
    .sort((a, b) => a - b);

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
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === opening) depth++;
    if (ch === closing) {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
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
    if (Array.isArray(schema.required) && schema.required.some((key: string) => !(key in record))) {
      return false;
    }
    return Object.entries(schema.properties ?? {}).every(
      ([key, childSchema]) =>
        !(key in record) || matchesSchema(record[key], childSchema),
    );
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) return false;
    if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return false;
    return !schema.items || value.every((item) => matchesSchema(item, schema.items));
  }

  if (schema.type === "string") {
    if (typeof value !== "string") return false;
    if (typeof schema.minLength === "number" && value.trim().length < schema.minLength) return false;
    return true;
  }

  if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    if (typeof schema.minimum === "number" && value < schema.minimum) return false;
    if (typeof schema.maximum === "number" && value > schema.maximum) return false;
    return true;
  }

  if (schema.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) return false;
    if (typeof schema.minimum === "number" && value < schema.minimum) return false;
    if (typeof schema.maximum === "number" && value > schema.maximum) return false;
  }

  return true;
}

function extractGenerateContentText(payload: any) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const parts = candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .filter((part: any) => typeof part?.text === "string")
    .map((part: any) => part.text)
    .join("")
    .trim();
}

async function callGeminiPlainText({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  // Intentionally use the fully supported generateContent API with the
  // smallest possible request surface. No response schema / response_format
  // is sent to Gemini, avoiding INVALID_ARGUMENT caused by structured schemas.
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Gemini request failed (${response.status})`;
    throw new Error(`Gemini ${response.status}: ${String(message)}`);
  }

  const text = extractGenerateContentText(payload);
  if (!text) {
    const finishReason = payload?.candidates?.[0]?.finishReason;
    throw new Error(
      `Gemini tidak mengembalikan teks${finishReason ? ` (${finishReason})` : ""}.`,
    );
  }

  return text;
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

  const model = getAIModel();

  const contract = JSON.stringify(schema);

  const prompt = `${system}

${user}

=== OUTPUT CONTRACT ===
Kembalikan HANYA satu JSON valid.
JANGAN gunakan markdown.
JANGAN gunakan code fence.
JANGAN menulis komentar sebelum atau sesudah JSON.
Ikuti struktur/schema ini sedekat mungkin dan isi seluruh field required:

${contract}

Gunakan Bahasa Indonesia untuk seluruh field yang bersifat editorial/content,
kecuali nama perusahaan, judul sumber, URL, istilah resmi, atau proper noun yang
lebih tepat dipertahankan dalam bahasa aslinya.`;

  const firstText = await callGeminiPlainText({
    apiKey,
    model,
    prompt,
  });

  try {
    const parsed = parseJson<T>(firstText);
    if (!matchesSchema(parsed, schema as JsonSchema)) throw new Error("Incomplete JSON structure");
    return parsed;
  } catch {
    // One repair pass for malformed JSON or valid JSON with an incomplete structure.
    const repairPrompt = `Perbaiki struktur output berikut menjadi SATU JSON valid.

ATURAN:
- Hanya JSON.
- Tanpa markdown atau code fence.
- Jangan menambah penjelasan.
- Pertahankan isi/fakta semaksimal mungkin.
- Jangan mengubah isi editorial kecuali diperlukan untuk memenuhi struktur.
- Lengkapi semua field required dan sesuaikan dengan schema berikut.

SCHEMA:
${contract}

OUTPUT YANG HARUS DIPERBAIKI:
${firstText}`;

    const repairedText = await callGeminiPlainText({
      apiKey,
      model,
      prompt: repairPrompt,
    });

    try {
      const repaired = parseJson<T>(repairedText);
      if (!matchesSchema(repaired, schema as JsonSchema)) throw new Error("Incomplete JSON structure");
      return repaired;
    } catch {
      throw new Error("Format respons AI tidak lengkap. Silakan generate ulang.");
    }
  }
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
