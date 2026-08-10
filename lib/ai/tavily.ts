export type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

export type SourceRecord = {
  ref: string;
  title: string;
  url: string;
  publisher: string;
  content: string;
  score: number;
};

function publisherFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web source";
  }
}

export async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error("TAVILY_API_KEY belum dikonfigurasi.");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      chunks_per_source: 2,
      max_results: 6,
      topic: "general",
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail?.error || payload?.detail || payload?.error || `Tavily search failed (${response.status})`;
    throw new Error(String(detail));
  }
  return Array.isArray(payload?.results) ? payload.results : [];
}

export function normalizeSources(batches: Array<{ query: string; results: TavilyResult[] }>) {
  const unique = new Map<string, Omit<SourceRecord, "ref">>();
  for (const batch of batches) {
    for (const result of batch.results) {
      const url = String(result.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) continue;
      if (unique.has(url)) continue;
      unique.set(url, {
        title: String(result.title ?? publisherFromUrl(url)).trim(),
        url,
        publisher: publisherFromUrl(url),
        content: String(result.content ?? "").replace(/\s+/g, " ").trim().slice(0, 2600),
        score: Number.isFinite(Number(result.score)) ? Number(result.score) : 0,
      });
    }
  }
  return Array.from(unique.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
    .map((source, index) => ({ ref: `S${index + 1}`, ...source }));
}
