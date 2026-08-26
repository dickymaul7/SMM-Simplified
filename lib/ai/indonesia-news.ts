import { tavilySearch, type TavilyResult } from "@/lib/ai/tavily";

export const INDONESIAN_NEWS_DOMAINS = [
  "antaranews.com",
  "kompas.com",
  "tempo.co",
  "detik.com",
  "cnnindonesia.com",
  "cnbcindonesia.com",
  "bisnis.com",
  "kontan.co.id",
];

const NEWS_DAYS = 7;

function normalizeQueryPart(value: string, fallback: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 220) : fallback;
}

function expandContext(value: string) {
  const normalized = value.toLowerCase();
  const terms = new Set<string>();
  if (/human capital|human resource|\bhr\b|sdm|talent|workforce|karyawan|tenaga kerja/.test(normalized)) {
    ["human capital", "human resources", "SDM", "talent", "workforce", "tenaga kerja", "ketenagakerjaan"].forEach((term) => terms.add(term));
  }
  if (/ai|artificial intelligence|kecerdasan buatan/.test(normalized)) {
    ["AI", "artificial intelligence", "kecerdasan buatan", "otomasi"].forEach((term) => terms.add(term));
  }
  if (/esg|sustainability|lingkungan|governance/.test(normalized)) {
    ["ESG", "sustainability", "keberlanjutan", "governance"].forEach((term) => terms.add(term));
  }
  if (/quality|mutu|iso 9001/.test(normalized)) {
    ["quality management", "mutu", "ISO 9001", "operational excellence"].forEach((term) => terms.add(term));
  }
  return Array.from(terms).join(" ");
}

export function buildIndonesiaNewsQueries(input: {
  topic: string;
  audience: string;
  objective: string;
  extraContext?: string;
}) {
  const topic = normalizeQueryPart(input.topic, "bisnis Indonesia");
  const audience = normalizeQueryPart(input.audience, "profesional dan pemimpin bisnis");
  const objective = normalizeQueryPart(input.objective, "tren bisnis dan organisasi");
  const context = normalizeQueryPart(input.extraContext ?? "", "");
  const semanticTerms = expandContext(`${topic} ${context} ${audience}`);
  const contextBlock = [context, semanticTerms].filter(Boolean).join(" ");
  return [
    `${topic} ${contextBlock} Indonesia berita terbaru tren bisnis organisasi`,
    `${topic} ${contextBlock} ${audience} Indonesia perusahaan tenaga kerja kebijakan industri berita terbaru`,
    `${topic} ${contextBlock} ${objective} Indonesia perusahaan dampak strategi berita`,
    `${contextBlock || topic} Indonesia kasus perusahaan nyata keputusan perubahan dampak 7 hari terakhir`,
  ].map((query) => query.replace(/\s+/g, " ").trim().slice(0, 420));
}

export async function tavilyNewsSearch(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error("TAVILY_API_KEY belum dikonfigurasi.");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "advanced", chunks_per_source: 2, max_results: 8, topic: "news", days: NEWS_DAYS, include_answer: false, include_raw_content: false, include_images: false, include_domains: INDONESIAN_NEWS_DOMAINS }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail?.error || payload?.detail || payload?.error || `Tavily news search failed (${response.status})`;
    throw new Error(String(detail));
  }
  return Array.isArray(payload?.results) ? payload.results : [];
}

export function normalizeIndonesiaNews(batches: Array<{ query: string; results: TavilyResult[] }>) {
  const unique = new Map<string, { title: string; url: string; publisher: string; content: string; score: number; query: string }>();
  for (const batch of batches) {
    for (const result of batch.results) {
      const url = String(result.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) continue;
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        if (!INDONESIAN_NEWS_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) continue;
        if (unique.has(url)) continue;
        unique.set(url, {
          title: String(result.title ?? hostname).replace(/\s+/g, " ").trim(),
          url,
          publisher: hostname,
          content: String(result.content ?? "").replace(/\s+/g, " ").trim().slice(0, 2800),
          score: Number.isFinite(Number(result.score)) ? Number(result.score) : 0,
          query: batch.query,
        });
      } catch {
        // Ignore malformed URLs returned by the search provider.
      }
    }
  }
  return Array.from(unique.values()).sort((a, b) => b.score - a.score).slice(0, 24).map((source, index) => ({ ref: `IDN${index + 1}`, ...source }));
}
