import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

import { getAIModel } from "@/lib/ai/core";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_PER_FILE = 180000;
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json", "html", "htm", "xml"]);

type SourceText = { name: string; text: string };

function errorJson(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function extension(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

function stripCodeFences(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJson(text: string) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("AI tidak mengembalikan JSON Brand Intelligence yang valid.");
}

function extractChatCompletionText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeSources(value: unknown, fallbackNames: string[]) {
  if (!Array.isArray(value)) return fallbackNames.map((name) => ({ name, notes: "Dibaca sebagai sumber Brand Intelligence." }));
  const rows = value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item: any) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      notes: typeof item.notes === "string" ? item.notes.trim() : "",
    }))
    .filter((item) => item.name);
  return rows.length ? rows.slice(0, 10) : fallbackNames.map((name) => ({ name, notes: "Dibaca sebagai sumber Brand Intelligence." }));
}

async function extractSourceText(file: File) {
  const ext = extension(file.name);

  if (file.type === "application/pdf" || ext === "pdf") {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(bytes);
    const text = String(parsed.text || "").trim();
    if (!text) {
      throw new Error(`PDF ${file.name} tidak memiliki text layer yang dapat dibaca. Gunakan PDF hasil export yang memiliki teks selectable.`);
    }
    return text.slice(0, MAX_TEXT_PER_FILE);
  }

  if (file.type.startsWith("text/") || file.type === "application/json" || TEXT_EXTENSIONS.has(ext)) {
    const text = await file.text();
    return text.slice(0, MAX_TEXT_PER_FILE);
  }

  throw new Error(
    `Format ${file.name} belum didukung langsung. Gunakan PDF atau file teks/CSV/JSON. Untuk DOCX, PPTX, atau XLSX, export ke PDF terlebih dahulu.`,
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorJson("Session login tidak valid. Silakan sign in ulang.", 401);

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) return errorJson("DEEPSEEK_API_KEY belum dikonfigurasi.", 503);

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const brandName = String(formData.get("brandName") ?? "").trim();

    if (!files.length) return errorJson("Pilih minimal satu file brand.");
    if (files.length > MAX_FILES) return errorJson(`Maksimal ${MAX_FILES} file dalam satu kali ekstraksi.`);

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) return errorJson("Total file terlalu besar. Maksimal 12 MB per ekstraksi agar stabil di Vercel.");

    const sources: SourceText[] = [];
    for (const file of files) {
      const text = await extractSourceText(file);
      sources.push({ name: file.name, text });
    }

    const contract = {
      market_industry: "string",
      market_context: "string",
      market_trends: ["string"],
      customer_segments: ["string"],
      target_audiences: ["string"],
      audience_pain_points: ["string"],
      positioning: "string",
      value_proposition: "string",
      differentiation: "string",
      brand_pov: "string",
      capabilities: ["string"],
      proof_points: ["string"],
      allowed_claims: ["string"],
      prohibited_claims: ["string"],
      communication_dos: ["string"],
      communication_donts: ["string"],
      source_files: [{ name: "string", notes: "string" }],
      confidence_notes: ["string"],
    };

    const sourceBlock = sources
      .map((source) => `\n=== SOURCE FILE: ${source.name} ===\n${source.text}\n=== END SOURCE: ${source.name} ===`)
      .join("\n");

    const prompt = `Kamu adalah senior brand strategist dan B2B market researcher.

BRAND YANG SEDANG DIBANGUN: ${brandName || "Nama brand belum diberikan"}

Baca seluruh teks hasil ekstraksi file di bawah dan ekstrak Brand Intelligence yang relevan untuk pembuatan konten social media.
Gunakan kerangka Understand Markets, Customers, and Capabilities dengan STP (Segmentation, Targeting, Positioning).

ATURAN KETAT:
1. Hanya ambil informasi yang didukung oleh file. Jangan mengarang fakta, client, angka, positioning, capability, atau claim.
2. Bedakan fakta eksplisit dari inferensi. Jika suatu field tidak cukup didukung, isi string kosong / array kosong dan tambahkan penjelasan di confidence_notes.
3. Jika dua file bertentangan, jangan memilih diam-diam. Masukkan konflik itu ke confidence_notes agar user melakukan human review.
4. Customer problem harus berupa business problem / jobs-to-be-done yang masuk akal dari dokumen, bukan pain point generik.
5. Capabilities hanya berisi kemampuan/produk/expertise yang benar-benar disebut atau sangat jelas didukung dokumen.
6. Proof points hanya berisi bukti yang aman disebut: client, case, certification, scale, product, award, atau evidence yang benar-benar ada di sumber.
7. Allowed/prohibited claims harus konservatif. Jangan mengubah inference menjadi klaim fakta.
8. Tulis seluruh output human-facing dalam Bahasa Indonesia, kecuali proper noun/istilah resmi.
9. Cantumkan setiap file pada source_files dan jelaskan singkat kontribusi file tersebut.
10. Jika hasil ekstraksi PDF kehilangan layout tabel atau urutan visual, jangan menebak isi yang hilang. Gunakan hanya teks yang terbaca.

Kembalikan HANYA satu JSON valid tanpa markdown dengan struktur persis seperti ini:
${JSON.stringify(contract, null, 2)}

${sourceBlock}`;

    const model = getAIModel();
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Kamu adalah senior brand strategist. Keluarkan hanya JSON valid sesuai contract. Jangan membuat informasi yang tidak ada di sumber.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.15,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || `DeepSeek request failed (${response.status})`;
      return errorJson(`DeepSeek ${response.status}: ${String(detail)}`, response.status === 429 ? 429 : 502);
    }

    const text = extractChatCompletionText(payload);
    if (!text) return errorJson("DeepSeek tidak mengembalikan hasil ekstraksi.", 502);

    const raw = extractJson(text) as Record<string, unknown>;
    const data = {
      market_industry: typeof raw.market_industry === "string" ? raw.market_industry.trim() : "",
      market_context: typeof raw.market_context === "string" ? raw.market_context.trim() : "",
      market_trends: normalizeArray(raw.market_trends),
      customer_segments: normalizeArray(raw.customer_segments),
      target_audiences: normalizeArray(raw.target_audiences),
      audience_pain_points: normalizeArray(raw.audience_pain_points),
      positioning: typeof raw.positioning === "string" ? raw.positioning.trim() : "",
      value_proposition: typeof raw.value_proposition === "string" ? raw.value_proposition.trim() : "",
      differentiation: typeof raw.differentiation === "string" ? raw.differentiation.trim() : "",
      brand_pov: typeof raw.brand_pov === "string" ? raw.brand_pov.trim() : "",
      capabilities: normalizeArray(raw.capabilities),
      proof_points: normalizeArray(raw.proof_points),
      allowed_claims: normalizeArray(raw.allowed_claims),
      prohibited_claims: normalizeArray(raw.prohibited_claims),
      communication_dos: normalizeArray(raw.communication_dos),
      communication_donts: normalizeArray(raw.communication_donts),
      source_files: normalizeSources(raw.source_files, sources.map((source) => source.name)),
      confidence_notes: normalizeArray(raw.confidence_notes),
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("brand-intelligence extract error", error);
    return errorJson(error instanceof Error ? error.message : "Ekstraksi Brand Intelligence gagal.", 500);
  }
}