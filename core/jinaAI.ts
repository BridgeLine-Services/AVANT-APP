/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Jina AI Engine                                     ║
 * ║                                                              ║
 * ║  Web intelligence layer:                                    ║
 * ║    • r.jina.ai  — extract clean text from any webpage       ║
 * ║    • s.jina.ai  — grounded web search (search + scrape)     ║
 * ║    • Jina Embeddings API — high-quality text vectors        ║
 * ║                                                              ║
 * ║  Free tier: https://jina.ai — 1M free tokens/month          ║
 * ║  Get key:  https://jina.ai/?sui=apikey                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Constants ─────────────────────────────────────────────────
const READER_BASE   = 'https://r.jina.ai/';
const SEARCH_BASE   = 'https://s.jina.ai/';
const EMBED_BASE    = 'https://api.jina.ai/v1/embeddings';
const RERANK_BASE   = 'https://api.jina.ai/v1/rerank';

// ── Types ─────────────────────────────────────────────────────
export interface JinaReaderResult {
  url:         string;
  title:       string;
  content:     string;    // clean extracted text
  description: string;
  links:       Record<string, string>;
  wordCount:   number;
}

export interface JinaSearchResult {
  query:       string;
  results:     Array<{
    title:       string;
    url:         string;
    content:     string;
    description: string;
    score?:      number;
  }>;
}

export interface JinaEmbedding {
  embedding: number[];
  index:     number;
}

// ── Helper ────────────────────────────────────────────────────
function buildHeaders(apiKey: string, extra: Record<string, string> = {}): HeadersInit {
  const h: HeadersInit = {
    'Accept':          'application/json',
    'X-Return-Format': 'text',
    ...extra,
  };
  if (apiKey && !apiKey.includes('YOUR_')) {
    (h as any)['Authorization'] = `Bearer ${apiKey}`;
  }
  return h;
}

// ══════════════════════════════════════════════════════════════
// ── 1. WEB READER — extract clean text from any URL ───────────
// ══════════════════════════════════════════════════════════════

/**
 * Extract readable content from any webpage.
 * Works WITHOUT an API key (rate-limited to ~20 req/min).
 * With a key: 1M free tokens/month.
 *
 * Use cases: article reading, research, document extraction,
 *            website summaries, competitive research.
 */
export async function readWebPage(
  url:     string,
  apiKey   = '',
  options: {
    noImages?:  boolean;
    noLinks?:   boolean;
    targetSelector?: string;
  } = {}
): Promise<JinaReaderResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (apiKey && !apiKey.includes('YOUR_')) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (options.noImages)  headers['X-Remove-Selector']     = 'img, picture, figure';
  if (options.noLinks)   headers['X-Retain-Images']       = 'none';
  if (options.targetSelector) headers['X-Target-Selector'] = options.targetSelector;

  const res = await fetch(`${READER_BASE}${encodeURIComponent(url)}`, {
    headers,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Jina Reader: ${res.status} for ${url}`);

  const data = await res.json();
  return {
    url:         data.data?.url         ?? url,
    title:       data.data?.title       ?? '',
    content:     data.data?.content     ?? data.data?.text ?? '',
    description: data.data?.description ?? '',
    links:       data.data?.links       ?? {},
    wordCount:   data.data?.content?.split(/\s+/).length ?? 0,
  };
}

/**
 * Quick plain-text extraction — returns just the content string.
 */
export async function extractPageText(url: string, apiKey = ''): Promise<string> {
  const result = await readWebPage(url, apiKey);
  return result.content;
}

// ══════════════════════════════════════════════════════════════
// ── 2. WEB SEARCH — grounded search + scrape ──────────────────
// ══════════════════════════════════════════════════════════════

/**
 * Search the web AND get the actual content (not just links).
 * Each result includes the full extracted text of the page.
 *
 * Unlike DuckDuckGo/SerpApi, Jina Search returns CONTENT, not just snippets.
 * Perfect for research tasks where AVANT needs to actually read the results.
 */
export async function jinaSearch(
  query:   string,
  apiKey   = '',
  options: {
    numResults?: number;
    siteFilter?: string;   // restrict to a domain
    locale?:     string;   // e.g. 'en-US'
  } = {}
): Promise<JinaSearchResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (apiKey && !apiKey.includes('YOUR_')) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (options.numResults) headers['X-With-Generated-Alt'] = String(options.numResults);
  if (options.siteFilter) headers['X-Site']               = options.siteFilter;
  if (options.locale)     headers['Accept-Language']       = options.locale;

  const encodedQuery = encodeURIComponent(query);
  const res = await fetch(`${SEARCH_BASE}${encodedQuery}`, {
    headers,
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`Jina Search: ${res.status} for "${query}"`);

  const data = await res.json();
  const results = (data.data ?? []).map((r: any) => ({
    title:       r.title       ?? '',
    url:         r.url         ?? '',
    content:     r.content     ?? r.text ?? '',
    description: r.description ?? '',
    score:       r.score,
  }));

  return { query, results };
}

/**
 * Quick search — returns just the top result's content.
 */
export async function searchAndRead(
  query:  string,
  apiKey  = ''
): Promise<string> {
  const results = await jinaSearch(query, apiKey, { numResults: 3 });
  if (!results.results.length) return '';

  return results.results
    .slice(0, 2)
    .map(r => `## ${r.title}\n${r.content.slice(0, 800)}`)
    .join('\n\n---\n\n');
}

// ══════════════════════════════════════════════════════════════
// ── 3. JINA EMBEDDINGS API ────────────────────────────────────
// ══════════════════════════════════════════════════════════════

/**
 * Higher quality embeddings than HuggingFace's free tier.
 * Model: jina-embeddings-v3 (multilingual, 8192 token context)
 */
export async function jinaEmbed(
  texts:   string | string[],
  apiKey:  string,
  model    = 'jina-embeddings-v3'
): Promise<number[][]> {
  if (!apiKey || apiKey.includes('YOUR_')) {
    throw new Error('Jina Embeddings requires an API key');
  }

  const inputs = Array.isArray(texts) ? texts : [texts];
  const res = await fetch(EMBED_BASE, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: inputs }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Jina Embeddings: ${res.status}`);
  const data = await res.json();
  return (data.data ?? []).map((d: JinaEmbedding) => d.embedding);
}

// ══════════════════════════════════════════════════════════════
// ── 4. RERANKER ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export interface RerankResult {
  index:          number;
  relevanceScore: number;
  document:       string;
}

/**
 * Re-rank a list of documents by relevance to a query.
 * Useful for improving search results before passing to AI.
 */
export async function rerankDocuments(
  query:     string,
  documents: string[],
  apiKey:    string,
  topN       = 3,
  model      = 'jina-reranker-v2-base-multilingual'
): Promise<RerankResult[]> {
  if (!apiKey || apiKey.includes('YOUR_')) return documents.slice(0, topN).map((d, i) => ({ index: i, relevanceScore: 0, document: d }));

  try {
    const res = await fetch(RERANK_BASE, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, documents, model, top_n: topN }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Jina Rerank: ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      index:          r.index,
      relevanceScore: r.relevance_score,
      document:       documents[r.index] ?? '',
    }));
  } catch (e: any) {
    console.warn('[Jina] Rerank failed:', e.message);
    return documents.slice(0, topN).map((d, i) => ({ index: i, relevanceScore: 0, document: d }));
  }
}

// ══════════════════════════════════════════════════════════════
// ── 5. RESEARCH AGENT helper ──────────────────────────────────
// ══════════════════════════════════════════════════════════════

export interface ResearchResult {
  query:    string;
  summary:  string;
  sources:  Array<{ title: string; url: string; excerpt: string }>;
}

/**
 * Full research cycle: search → read top results → return structured data.
 * Call this before an AI summarization call to give AVANT real web data.
 */
export async function researchTopic(
  query:     string,
  apiKey     = '',
  maxSources = 3
): Promise<ResearchResult> {
  const search = await jinaSearch(query, apiKey, { numResults: maxSources });
  const sources = search.results.slice(0, maxSources).map(r => ({
    title:   r.title,
    url:     r.url,
    excerpt: r.content.slice(0, 500),
  }));

  const combined = sources
    .map(s => `Source: ${s.title}\n${s.excerpt}`)
    .join('\n\n');

  return {
    query,
    summary: combined,
    sources,
  };
}

/**
 * Read a URL and answer a question about its contents — no AI call needed.
 * Uses Jina Reader to extract text, then returns the relevant section.
 */
export async function answerFromUrl(
  url:      string,
  question: string,
  apiKey    = ''
): Promise<string> {
  const page = await readWebPage(url, apiKey);
  if (!page.content) return '';

  // Simple keyword extraction — pull the most relevant paragraph
  const q      = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const paras  = page.content.split(/\n+/).filter(p => p.trim().length > 40);
  const scored = paras.map(p => {
    const pl    = p.toLowerCase();
    const score = q.reduce((s, w) => s + (pl.includes(w) ? 1 : 0), 0);
    return { p, score };
  });

  const best = scored.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.p);
  return best.join('\n') || paras[0] || '';
}

// ── Health check ──────────────────────────────────────────────
export async function testJinaReader(): Promise<boolean> {
  try {
    const result = await readWebPage('https://example.com', '', { noImages: true });
    return result.content.length > 10;
  } catch {
    return false;
  }
}
