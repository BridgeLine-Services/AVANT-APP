/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Hugging Face Inference Engine                      ║
 * ║                                                              ║
 * ║  Utility AI jobs that save Gemini / OpenRouter credits:     ║
 * ║    • Embeddings  — memory search, semantic similarity       ║
 * ║    • Intent classification — route commands without AI call ║
 * ║    • Sentiment analysis — understand tone of user messages  ║
 * ║    • Zero-shot classification — tag, categorize, prioritize ║
 * ║    • Summarization — condense long text                     ║
 * ║    • Q&A extraction — pull answers from documents           ║
 * ║    • Text extraction from URLs (via HF Inference)           ║
 * ║                                                              ║
 * ║  Free tier: https://huggingface.co (no credit card needed)  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Model choices ─────────────────────────────────────────────
const HF_MODELS = {
  // Embeddings — semantic memory search
  embeddings:      'sentence-transformers/all-MiniLM-L6-v2',
  // Classification — intent & category detection
  classification:  'facebook/bart-large-mnli',
  // Sentiment — positive / negative / neutral
  sentiment:       'cardiffnlp/twitter-roberta-base-sentiment-latest',
  // Summarization — condense documents
  summarization:   'facebook/bart-large-cnn',
  // Q&A extraction — pull answer from context
  qa:              'deepset/roberta-base-squad2',
} as const;

type HFModel = typeof HF_MODELS[keyof typeof HF_MODELS];

const HF_BASE = 'https://api-inference.huggingface.co/models';

// ── Core fetch ────────────────────────────────────────────────
async function hfPost(
  model:   HFModel,
  payload: object,
  apiKey:  string,
  retries  = 2
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${HF_BASE}/${model}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 503) {
      // Model loading — wait and retry
      const wait = (attempt + 1) * 3000;
      console.log(`[HF] Model ${model} loading, retrying in ${wait}ms…`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HF ${model} → ${res.status}: ${body.slice(0, 100)}`);
    }
    return await res.json();
  }
  throw new Error(`HF ${model} failed after ${retries} retries`);
}

// ══════════════════════════════════════════════════════════════
// ── 1. EMBEDDINGS — semantic memory search ────────────────────
// ══════════════════════════════════════════════════════════════

export interface EmbeddingResult {
  text:      string;
  embedding: number[];
}

/**
 * Convert text(s) to embedding vectors for semantic search.
 */
export async function getEmbeddings(
  texts:  string | string[],
  apiKey: string
): Promise<number[][]> {
  const inputs = Array.isArray(texts) ? texts : [texts];
  const data   = await hfPost(HF_MODELS.embeddings, { inputs }, apiKey);

  // HF returns either [[...]] or [number, ...] depending on input shape
  if (Array.isArray(data) && typeof data[0] === 'number') return [data];
  if (Array.isArray(data) && Array.isArray(data[0]))       return data;
  throw new Error('Unexpected embedding shape');
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

/**
 * Semantic search — find the most similar items to a query.
 */
export async function semanticSearch(
  query:   string,
  corpus:  Array<{ id: string; text: string; embedding?: number[] }>,
  topK     = 5,
  apiKey:  string
): Promise<Array<{ id: string; text: string; score: number }>> {
  // Embed query
  const [queryVec] = await getEmbeddings(query, apiKey);

  // Embed any corpus items that don't have embeddings yet
  const needsEmbed = corpus.filter(c => !c.embedding);
  if (needsEmbed.length) {
    const vecs = await getEmbeddings(needsEmbed.map(c => c.text), apiKey);
    needsEmbed.forEach((c, i) => { c.embedding = vecs[i]; });
  }

  return corpus
    .map(c => ({ id: c.id, text: c.text, score: cosineSim(queryVec, c.embedding!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ══════════════════════════════════════════════════════════════
// ── 2. INTENT CLASSIFICATION ──────────────────────────────────
// ══════════════════════════════════════════════════════════════

export type AVANTIntent =
  | 'spatial_mapping'
  | 'object_search'
  | 'prediction_request'
  | 'timeline_query'
  | 'vision_analysis'
  | 'navigation'
  | 'weather'
  | 'news'
  | 'alarm_timer'
  | 'general_chat'
  | 'code_help'
  | 'research'
  | 'math';

const INTENT_LABELS: Record<AVANTIntent, string[]> = {
  spatial_mapping:     ['start mapping', 'scan the room', 'map my space', 'spatial scan'],
  object_search:       ['where is', 'find my', 'locate', "can't find", 'lost my'],
  prediction_request:  ['predictions', 'what should I', 'brief me', 'heads up', 'proactive'],
  timeline_query:      ['what happened', 'timeline', 'history', 'last week', 'when did'],
  vision_analysis:     ['what am I looking at', 'describe this', 'analyze', 'what is this'],
  navigation:          ['directions', 'how do I get to', 'navigate', 'route', 'traffic'],
  weather:             ['weather', 'temperature', 'rain', 'forecast', 'humidity'],
  news:                ['news', 'headlines', 'what happened today', 'latest'],
  alarm_timer:         ['set alarm', 'remind me', 'timer', 'wake me up', 'alert'],
  general_chat:        ['tell me', 'explain', 'what is', 'how does', 'why'],
  code_help:           ['code', 'program', 'function', 'debug', 'error', 'script'],
  research:            ['research', 'find information', 'look up', 'search for', 'article'],
  math:                ['calculate', 'what is', 'percent', 'divide', 'multiply'],
};

/**
 * Classify user intent using zero-shot classification.
 * Returns top intent + confidence score.
 * Falls back to 'general_chat' on error.
 */
export async function classifyIntent(
  text:   string,
  apiKey: string
): Promise<{ intent: AVANTIntent; confidence: number }> {
  try {
    const candidateLabels = Object.keys(INTENT_LABELS) as AVANTIntent[];
    const data = await hfPost(HF_MODELS.classification, {
      inputs:           text,
      parameters: {
        candidate_labels: candidateLabels,
        multi_label:      false,
      },
    }, apiKey);

    const labels: AVANTIntent[] = data.labels ?? [];
    const scores: number[]      = data.scores  ?? [];
    const topIdx = 0;   // HF returns sorted descending
    return {
      intent:     labels[topIdx] ?? 'general_chat',
      confidence: scores[topIdx] ?? 0,
    };
  } catch (e: any) {
    console.warn('[HF] Intent classification failed:', e.message);
    return { intent: 'general_chat', confidence: 0 };
  }
}

// ══════════════════════════════════════════════════════════════
// ── 3. SENTIMENT ANALYSIS ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
  sentiment:  Sentiment;
  confidence: number;
  scores:     Record<Sentiment, number>;
}

/**
 * Analyze tone of a message — useful for adjusting AVANT's response style.
 */
export async function analyzeSentiment(
  text:   string,
  apiKey: string
): Promise<SentimentResult> {
  try {
    const data: Array<{ label: string; score: number }[]> = await hfPost(
      HF_MODELS.sentiment,
      { inputs: text },
      apiKey
    );

    const results = Array.isArray(data[0]) ? data[0] : (data as any);
    const mapped: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };

    for (const r of results) {
      const lbl = r.label.toLowerCase();
      // Map model-specific labels to our three categories
      if (lbl.includes('pos') || lbl === 'label_2') mapped.positive = r.score;
      if (lbl.includes('neu') || lbl === 'label_1') mapped.neutral  = r.score;
      if (lbl.includes('neg') || lbl === 'label_0') mapped.negative = r.score;
    }

    const top = (Object.entries(mapped) as [Sentiment, number][])
      .sort((a, b) => b[1] - a[1])[0];

    return { sentiment: top[0], confidence: top[1], scores: mapped };
  } catch (e: any) {
    console.warn('[HF] Sentiment failed:', e.message);
    return { sentiment: 'neutral', confidence: 0, scores: { positive: 0, neutral: 1, negative: 0 } };
  }
}

// ══════════════════════════════════════════════════════════════
// ── 4. SUMMARIZATION ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

/**
 * Summarize long text — useful for documents, articles, notes.
 * minLength / maxLength in tokens (~0.75 words each).
 */
export async function summarizeText(
  text:      string,
  apiKey:    string,
  maxLength  = 180,
  minLength  = 40
): Promise<string> {
  // Truncate input to avoid model limits (~1024 tokens)
  const input = text.slice(0, 3000);
  try {
    const data = await hfPost(HF_MODELS.summarization, {
      inputs:     input,
      parameters: { max_length: maxLength, min_length: minLength, do_sample: false },
    }, apiKey);

    const result = Array.isArray(data) ? data[0] : data;
    return result?.summary_text ?? result?.generated_text ?? '';
  } catch (e: any) {
    console.warn('[HF] Summarization failed:', e.message);
    return '';
  }
}

// ══════════════════════════════════════════════════════════════
// ── 5. EXTRACTIVE Q&A ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export interface QAResult {
  answer:     string;
  score:      number;
  start:      number;
  end:        number;
}

/**
 * Extract a specific answer from a document/context.
 * Great for PDFs, web pages, documents — without a full AI call.
 */
export async function extractAnswer(
  question: string,
  context:  string,
  apiKey:   string
): Promise<QAResult> {
  try {
    const data = await hfPost(HF_MODELS.qa, {
      inputs: { question, context: context.slice(0, 4000) },
    }, apiKey);

    return {
      answer: data.answer   ?? '',
      score:  data.score    ?? 0,
      start:  data.start    ?? 0,
      end:    data.end      ?? 0,
    };
  } catch (e: any) {
    console.warn('[HF] QA extraction failed:', e.message);
    return { answer: '', score: 0, start: 0, end: 0 };
  }
}

// ══════════════════════════════════════════════════════════════
// ── 6. ZERO-SHOT CLASSIFICATION (generic) ─────────────────────
// ══════════════════════════════════════════════════════════════

/**
 * Generic zero-shot classifier — pass any labels.
 * Useful for: priority (high/medium/low), category, topic, etc.
 */
export async function zeroShotClassify(
  text:            string,
  candidateLabels: string[],
  apiKey:          string,
  multiLabel       = false
): Promise<Array<{ label: string; score: number }>> {
  try {
    const data = await hfPost(HF_MODELS.classification, {
      inputs:     text,
      parameters: { candidate_labels: candidateLabels, multi_label: multiLabel },
    }, apiKey);

    const labels: string[]  = data.labels ?? [];
    const scores: number[]  = data.scores  ?? [];
    return labels.map((l, i) => ({ label: l, score: scores[i] ?? 0 }));
  } catch (e: any) {
    console.warn('[HF] Zero-shot classification failed:', e.message);
    return candidateLabels.map(l => ({ label: l, score: 0 }));
  }
}

// ══════════════════════════════════════════════════════════════
// ── 7. MEMORY SEARCH (semantic memory index) ──────────────────
// ══════════════════════════════════════════════════════════════

export interface MemoryItem {
  id:        string;
  text:      string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

/**
 * In-memory semantic index for AVANT's life graph.
 * Embeds nodes on first access, caches vectors locally.
 */
export class SemanticMemoryIndex {
  private items:  MemoryItem[] = [];
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  add(item: MemoryItem): void {
    const existing = this.items.findIndex(i => i.id === item.id);
    if (existing >= 0) this.items[existing] = item;
    else this.items.push(item);
  }

  addMany(items: MemoryItem[]): void {
    items.forEach(i => this.add(i));
  }

  remove(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  get size(): number { return this.items.length; }

  async search(
    query:  string,
    topK    = 5,
    minScore = 0.3
  ): Promise<Array<MemoryItem & { score: number }>> {
    if (!this.items.length) return [];
    if (!this.apiKey || this.apiKey.includes('YOUR_')) {
      // Fallback: substring match when no HF key
      const q = query.toLowerCase();
      return this.items
        .filter(i => i.text.toLowerCase().includes(q))
        .slice(0, topK)
        .map(i => ({ ...i, score: 0.5 }));
    }

    try {
      const results = await semanticSearch(query, this.items, topK, this.apiKey);
      return results
        .filter(r => r.score >= minScore)
        .map(r => ({ ...this.items.find(i => i.id === r.id)!, score: r.score }))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async buildIndex(): Promise<void> {
    const needsEmbed = this.items.filter(i => !i.embedding);
    if (!needsEmbed.length || !this.apiKey || this.apiKey.includes('YOUR_')) return;

    const BATCH = 32;
    for (let i = 0; i < needsEmbed.length; i += BATCH) {
      const batch = needsEmbed.slice(i, i + BATCH);
      try {
        const vecs = await getEmbeddings(batch.map(b => b.text), this.apiKey);
        batch.forEach((b, j) => { b.embedding = vecs[j]; });
      } catch (e: any) {
        console.warn(`[HF] Embedding batch ${i} failed: ${e.message}`);
      }
    }
  }
}

// ── Singleton index (shared across the app) ───────────────────
let _globalIndex: SemanticMemoryIndex | null = null;

export function getMemoryIndex(apiKey?: string): SemanticMemoryIndex {
  if (!_globalIndex) {
    _globalIndex = new SemanticMemoryIndex(apiKey ?? '');
  }
  return _globalIndex;
}

// ── Test / health check ───────────────────────────────────────
export async function testHuggingFace(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.includes('YOUR_')) return false;
  try {
    await getEmbeddings('test', apiKey);
    return true;
  } catch {
    return false;
  }
}
