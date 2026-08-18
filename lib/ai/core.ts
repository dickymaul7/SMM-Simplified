import fs from "node:fs/promises";
import path from "node:path";

export function getAIModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

export async function loadStorytellingKnowledge() {
  const knowledgeDir = path.join(process.cwd(), "public", "knowledge");
  const [storytelling, copywriting] = await Promise.all([
    fs.readFile(path.join(knowledgeDir, "storytelling_knowledge_base.md"), "utf8"),
    fs.readFile(path.join(knowledgeDir, "copywriting_knowledge_base.md"), "utf8"),
  ]);

  return [
    "# STORYTELLING KNOWLEDGE BASE",
    storytelling,
    "\n\n# COPYWRITING & RETENTION KNOWLEDGE BASE",
    copywriting,
  ].join("\n\n");
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
    return parseJson<T>(firstText);
  } catch {
    // One repair pass if the model adds malformed JSON despite the contract.
    const repairPrompt = `Perbaiki output berikut menjadi SATU JSON valid.

ATURAN:
- Hanya JSON.
- Tanpa markdown atau code fence.
- Jangan menambah penjelasan.
- Pertahankan isi/fakta semaksimal mungkin.
- Sesuaikan dengan schema berikut.

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
      return parseJson<T>(repairedText);
    } catch {
      throw new Error(
        "Gemini berhasil merespons tetapi JSON belum valid setelah 1x repair. Silakan generate ulang.",
      );
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
