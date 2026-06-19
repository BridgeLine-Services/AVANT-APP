/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — OpenRouter Engine                                  ║
 * ║                                                              ║
 * ║  Single key, 4-model fallback cascade:                      ║
 * ║  Gemini 2.5 Pro → DeepSeek R1 → Qwen 3 → Llama 4           ║
 * ║                                                              ║
 * ║  Task routing:                                              ║
 * ║    General chat / coding / reasoning  → Gemini              ║
 * ║    Fast responses                     → DeepSeek V3         ║
 * ║    Backup                             → Qwen 3              ║
 * ║    Final fallback                     → Llama 4             ║
 * ║                                                              ║
 * ║  Free tier: https://openrouter.ai (sign up, free credits)   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Model registry ────────────────────────────────────────────
export const OR_MODELS = {
  // Primary — best reasoning, long context
  gemini_primary:   'google/gemini-2.5-pro',
  // Fast — low latency, great for quick answers
  deepseek_fast:    'deepseek/deepseek-v3',
  // Long reasoning — chain-of-thought problems
  deepseek_reason:  'deepseek/deepseek-r1',
  // Backup AI
  qwen3:            'qwen/qwen3-235b-a22b',
  qwen3_fast:       'qwen/qwen3-32b',
  // Final fallback
  llama4:           'meta-llama/llama-4-maverick',
} as const;

export type ORModel = typeof OR_MODELS[keyof typeof OR_MODELS];

// ── Task → model routing ──────────────────────────────────────
export type TaskType =
  | 'chat'         // general conversation
  | 'code'         // coding / technical
  | 'reasoning'    // complex multi-step logic
  | 'fast'         // speed-critical (urgent tone)
  | 'analysis'     // document / text analysis
  | 'summary'      // summarization
  | 'research';    // web research / synthesis

export function pickModel(task: TaskType, tone?: string): ORModel {
  if (tone === 'urgent' || task === 'fast')     return OR_MODELS.deepseek_fast;
  if (task === 'reasoning')                      return OR_MODELS.deepseek_reason;
  if (task === 'code' || task === 'analysis')    return OR_MODELS.gemini_primary;
  return OR_MODELS.gemini_primary;               // default: Gemini primary
}

// ── Fallback cascade order ────────────────────────────────────
const FALLBACK_ORDER: ORModel[] = [
  OR_MODELS.gemini_primary,
  OR_MODELS.deepseek_fast,
  OR_MODELS.qwen3,
  OR_MODELS.llama4,
];

// ── Core fetch ────────────────────────────────────────────────
async function callORModel(
  model:   ORModel,
  system:  string,
  user:    string,
  tone:    string,
  apiKey:  string
): Promise<string | null> {
  const maxTokens = tone === 'urgent' ? 200 : tone === 'reasoning' ? 1500 : 600;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://avant.bridgeline.app',
      'X-Title':       'AVANT AI',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
      max_tokens:   maxTokens,
      temperature:  tone === 'serious' ? 0.3 : 0.8,
      stream:       false,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${model} → ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || null;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Route to specific model — no fallback.
 */
export async function callOpenRouter(
  prompt:   string,
  system:   string,
  model:    ORModel,
  tone      = 'casual',
  apiKey:   string
): Promise<string | null> {
  try {
    return await callORModel(model, system, prompt, tone, apiKey);
  } catch (e: any) {
    console.warn(`[OpenRouter] ${model} failed: ${e.message}`);
    return null;
  }
}

/**
 * Smart cascade — tries primary model, falls back through the list.
 * This is the main entry point used by aiRouter.ts
 */
export async function openRouterCascade(
  prompt:  string,
  system:  string,
  tone     = 'casual',
  task:    TaskType = 'chat',
  apiKey:  string
): Promise<string | null> {
  // Start with the task-appropriate model
  const preferred = pickModel(task, tone);
  const order     = [preferred, ...FALLBACK_ORDER.filter(m => m !== preferred)];

  for (const model of order) {
    try {
      console.log(`[OpenRouter] Trying ${model}…`);
      const result = await callORModel(model, system, prompt, tone, apiKey);
      if (result) {
        console.log(`[OpenRouter] ✓ ${model}`);
        return result;
      }
    } catch (e: any) {
      console.warn(`[OpenRouter] ✗ ${model}: ${e.message}`);
    }
  }
  return null;
}

/**
 * Get list of available models (useful for debugging / settings UI).
 */
export async function listOpenRouterModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((m: any) => m.id).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if the OpenRouter key is valid.
 */
export async function testOpenRouterKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.includes('YOUR_')) return false;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
