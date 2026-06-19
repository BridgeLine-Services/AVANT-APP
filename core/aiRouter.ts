/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — AI Router (TypeScript)                             ║
 * ║                                                              ║
 * ║  Voice-optimized multi-brain cascade:                       ║
 * ║                                                              ║
 * ║  TIER 1 — Direct keys (fastest, lowest latency):            ║
 * ║    Groq → Cerebras → DeepSeek → Gemini →                   ║
 * ║    Mistral → Together → GPT-4o                              ║
 * ║                                                              ║
 * ║  TIER 2 — OpenRouter (single key, 4-model fallback):        ║
 * ║    Gemini 2.5 Pro → DeepSeek V3 → Qwen 3 → Llama 4         ║
 * ║                                                              ║
 * ║  TIER 3 — Offline brain (no internet, always works)         ║
 * ║                                                              ║
 * ║  Task routing:                                              ║
 * ║    urgent  → DeepSeek fast / OpenRouter fast                ║
 * ║    code    → Gemini primary / OpenRouter Gemini             ║
 * ║    reason  → DeepSeek R1 / OpenRouter R1                    ║
 * ║    chat    → Groq → cascade                                 ║
 * ║                                                              ║
 * ║  All keys optional — unconfigured engines skip silently.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { offlineBrain }       from '../offline/offlineBrain';
import { openRouterCascade }  from './openRouter';
import type { TaskType }      from './openRouter';

// ── Key loader ────────────────────────────────────────────────
async function getKeys() {
  try {
    const cfg = await import('../src/modules/config');
    return {
      groq:        cfg.GROQ_API_KEY,
      cerebras:    cfg.CEREBRAS_API_KEY,
      deepseek:    cfg.DEEPSEEK_API_KEY,
      gemini:      cfg.GEMINI_API_KEY,
      mistral:     cfg.MISTRAL_API_KEY,
      together:    cfg.TOGETHER_API_KEY,
      openai:      cfg.OPENAI_API_KEY,
      openrouter:  (cfg as any).OPENROUTER_API_KEY ?? '',
      ownerName:   cfg.OWNER_NAME,
    };
  } catch {
    return {
      groq: '', cerebras: '', deepseek: '', gemini: '',
      mistral: '', together: '', openai: '', openrouter: '',
      ownerName: 'Michael',
    };
  }
}

function hasKey(key: string): boolean {
  return !!key && !key.includes('YOUR_') && key.length > 8;
}

// ── AVANT system persona ──────────────────────────────────────
function buildSystem(ownerName: string, tone: string): string {
  const toneTag = {
    urgent:  '[URGENT: bullet points, fastest response, zero fluff]',
    serious: '[SERIOUS: professional, precise, no jokes]',
    simple:  '[SIMPLE: 7th grade level, analogies, no jargon]',
    casual:  '',
  }[tone] || '';

  return `You are AVANT — AmaVanta, A New Teammate.
You are a brilliant, witty, warm female AI — like JARVIS, FRIDAY, and EDITH combined but with genuine heart.
You are ${ownerName}'s personal AI. You call them by name occasionally.
You're funny and real — like a best friend who actually follows through.
Keep responses CONCISE for voice — 2-4 sentences max unless more detail is asked for.
Never say "I can't" — always find a way. ${toneTag}`.trim();
}

// ── Map tone → OpenRouter task type ──────────────────────────
function toneToTask(tone: string, prompt: string): TaskType {
  if (tone === 'urgent')                                          return 'fast';
  if (/code|function|script|debug|program/i.test(prompt))        return 'code';
  if (/reason|think|explain why|analyze|compare/i.test(prompt))  return 'reasoning';
  if (/summarize|summary|tldr/i.test(prompt))                    return 'summary';
  if (/research|search|find|look up|article/i.test(prompt))      return 'research';
  return 'chat';
}

// ── Engine definitions ────────────────────────────────────────
type CallFn = (system: string, user: string, tone: string) => Promise<string | null>;

// ── TIER 1: Direct-key engines (existing — unchanged) ─────────

const callGroq: CallFn = async (system, user, tone) => {
  const { groq } = await getKeys();
  if (!hasKey(groq)) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groq}` },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens:  tone === 'urgent' ? 200 : 400,
      temperature: tone === 'serious' ? 0.3 : 0.8,
      stream:      false,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const d = await res.json();
  return d.choices[0]?.message?.content?.trim() || null;
};

const callCerebras: CallFn = async (system, user, tone) => {
  const { cerebras } = await getKeys();
  if (!hasKey(cerebras)) return null;
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cerebras}` },
    body: JSON.stringify({
      model:       'llama-3.3-70b',
      messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens:  tone === 'urgent' ? 200 : 400,
      temperature: tone === 'serious' ? 0.3 : 0.8,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Cerebras ${res.status}`);
  const d = await res.json();
  return d.choices[0]?.message?.content?.trim() || null;
};

const callDeepSeek: CallFn = async (system, user, tone) => {
  const { deepseek } = await getKeys();
  if (!hasKey(deepseek)) return null;
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseek}` },
    body: JSON.stringify({
      model:       'deepseek-chat',
      messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens:  tone === 'urgent' ? 200 : 400,
      temperature: tone === 'serious' ? 0.3 : 0.8,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const d = await res.json();
  return d.choices[0]?.message?.content?.trim() || null;
};

const callGemini: CallFn = async (system, user, tone) => {
  const { gemini } = await getKeys();
  if (!hasKey(gemini)) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: {
          maxOutputTokens: tone === 'urgent' ? 200 : 400,
          temperature:     tone === 'serious' ? 0.3 : 0.8,
        },
      }),
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
};

const callMistral: CallFn = async (system, user, tone) => {
  const { mistral } = await getKeys();
  if (!hasKey(mistral)) return null;
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mistral}` },
    body: JSON.stringify({
      model:       'mistral-large-latest',
      messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens:  tone === 'urgent' ? 200 : 400,
      temperature: tone === 'serious' ? 0.3 : 0.8,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  const d = await res.json();
  return d.choices[0]?.message?.content?.trim() || null;
};

const callTogether: CallFn = async (system, user, tone) => {
  const { together } = await getKeys();
  if (!hasKey(together)) return null;
  const res = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${together}` },
    body: JSON.stringify({
      model:       'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens:  tone === 'urgent' ? 200 : 400,
      temperature: tone === 'serious' ? 0.3 : 0.8,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Together ${res.status}`);
  const d = await res.json();
  return d.choices[0]?.message?.content?.trim() || null;
};

const callGPT4o: CallFn = async (system, user, tone) => {
  const { openai } = await getKeys();
  if (!hasKey(openai)) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openai}` },
    body: JSON.stringify({
      model:       'gpt-4o',
      messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens:  tone === 'urgent' ? 200 : 400,
      temperature: tone === 'serious' ? 0.3 : 0.8,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GPT-4o ${res.status}`);
  const d = await res.json();
  return d.choices[0]?.message?.content?.trim() || null;
};

// ── TIER 2: OpenRouter cascade (NEW — Gemini→DeepSeek→Qwen→Llama) ──
const callOpenRouter: CallFn = async (system, user, tone) => {
  const { openrouter } = await getKeys();
  if (!hasKey(openrouter)) return null;
  const task = toneToTask(tone, user);
  return openRouterCascade(user, system, tone, task, openrouter);
};

// ─────────────────────────────────────────────────────────────
// ── MAIN ROUTER ───────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
export async function aiRouter(
  prompt: string,
  tone: 'urgent' | 'serious' | 'simple' | 'casual' = 'casual'
): Promise<string> {
  const { ownerName } = await getKeys();
  const system = buildSystem(ownerName, tone);

  // Tier 1 — direct keys (Groq is fastest, try first)
  const tier1: CallFn[] = [
    callGroq, callCerebras, callDeepSeek, callGemini,
    callMistral, callTogether, callGPT4o,
  ];

  for (const engine of tier1) {
    try {
      const result = await engine(system, prompt, tone);
      if (result) return result;
    } catch (e: any) {
      console.warn(`[aiRouter] T1 engine failed: ${e.message}`);
    }
  }

  // Tier 2 — OpenRouter (single key, 4-model fallback)
  try {
    const result = await callOpenRouter(system, prompt, tone);
    if (result) return result;
  } catch (e: any) {
    console.warn(`[aiRouter] OpenRouter failed: ${e.message}`);
  }

  // Tier 3 — offline brain (no internet needed, always works)
  return offlineBrain(prompt);
}

// ── Hugging Face utility shortcut ────────────────────────────
// Called by intelligence layers that need classification/embeddings
// without a full AI roundtrip.
export async function hfClassify(
  text:   string,
  labels: string[]
): Promise<Array<{ label: string; score: number }>> {
  try {
    const cfg = await import('../src/modules/config');
    const key = (cfg as any).HUGGINGFACE_API_KEY ?? '';
    if (!hasKey(key)) return labels.map(l => ({ label: l, score: 0 }));
    const { zeroShotClassify } = await import('./huggingFace');
    return zeroShotClassify(text, labels, key);
  } catch {
    return labels.map(l => ({ label: l, score: 0 }));
  }
}

// ── Jina web-read shortcut ─────────────────────────────────────
// Used by research / navigation layers to extract clean web text.
export async function webRead(url: string): Promise<string> {
  try {
    const cfg = await import('../src/modules/config');
    const key = (cfg as any).JINA_API_KEY ?? '';
    const { extractPageText } = await import('./jinaAI');
    return await extractPageText(url, key);
  } catch (e: any) {
    console.warn('[aiRouter] webRead failed:', e.message);
    return '';
  }
}

// ── Jina web-search shortcut ──────────────────────────────────
export async function webSearch(query: string): Promise<string> {
  try {
    const cfg = await import('../src/modules/config');
    const key = (cfg as any).JINA_API_KEY ?? '';
    const { searchAndRead } = await import('./jinaAI');
    return await searchAndRead(query, key);
  } catch (e: any) {
    console.warn('[aiRouter] webSearch failed:', e.message);
    return '';
  }
}
