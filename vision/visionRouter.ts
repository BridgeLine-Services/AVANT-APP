/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Vision AI Router                                   ║
 * ║                                                              ║
 * ║  Routes image + prompt to the best available vision model:  ║
 * ║  Gemini 2.0 Flash → Groq LLaVA → GPT-4o Vision →          ║
 * ║  Text-only fallback → Offline fallback                      ║
 * ║                                                              ║
 * ║  Also carries a rolling context memory buffer               ║
 * ║  so AVANT remembers what it saw recently.                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Config keys (shared with existing config.js) ──────────────
async function getKeys() {
  try {
    const cfg = await import('../src/modules/config');
    return {
      gemini:    cfg.GEMINI_API_KEY   ?? '',
      groq:      cfg.GROQ_API_KEY     ?? '',
      openai:    cfg.OPENAI_API_KEY   ?? '',
      ownerName: cfg.OWNER_NAME       ?? 'Michael',
    };
  } catch {
    return { gemini: '', groq: '', openai: '', ownerName: 'Michael' };
  }
}

function hasKey(k: string): boolean { return !!k && !k.includes('YOUR_'); }

// ── Rolling vision memory (last 6 observations) ───────────────
interface VisionMemoryEntry {
  timestamp:   number;
  prompt:      string;
  summary:     string;
  source:      'camera' | 'screen' | 'unknown';
}

const visionMemory: VisionMemoryEntry[] = [];
const MAX_MEMORY = 6;

export function getVisionMemory(): VisionMemoryEntry[] { return [...visionMemory]; }

function pushMemory(entry: VisionMemoryEntry): void {
  visionMemory.push(entry);
  if (visionMemory.length > MAX_MEMORY) visionMemory.shift();
}

// ── Vision system prompt ───────────────────────────────────────
function buildVisionSystem(ownerName: string, mode: 'snapshot' | 'live' | 'ar' | 'screen'): string {
  const modeNote = {
    snapshot: 'The user just pointed their camera at something and wants to know what it is.',
    live:     'You are watching a continuous real-time camera stream. Be brief — 1-2 sentences per frame.',
    ar:       'You are an AR assistant. Identify objects, return JSON array with label, x%, y%, importance 0-1.',
    screen:   'You are analyzing a phone screen. Explain what app/content is showing and how to help the user.',
  }[mode];

  const recent = visionMemory.slice(-3).map((m, i) =>
    `[${i + 1}] (${new Date(m.timestamp).toLocaleTimeString()}) ${m.summary}`
  ).join('\n');

  return `You are AVANT — ${ownerName}'s personal AI vision assistant.
You are brilliant, warm, and concise. You describe what you see clearly and helpfully.
${modeNote}
${recent ? `\nRecent observations:\n${recent}` : ''}
Keep responses SHORT for voice output — 1-3 sentences max unless user asks for detail.`;
}

// ── Vision input type ─────────────────────────────────────────
export interface VisionInput {
  image:   string;   // base64, no data: prefix
  prompt:  string;
  mode?:   'snapshot' | 'live' | 'ar' | 'screen';
  source?: 'camera' | 'screen' | 'unknown';
}

// ── Engine: Gemini 2.0 Flash (best multimodal, free tier) ─────
async function geminiVision(input: VisionInput): Promise<string | null> {
  const { gemini, ownerName } = await getKeys();
  if (!hasKey(gemini)) return null;

  const mode   = input.mode   ?? 'snapshot';
  const system = buildVisionSystem(ownerName, mode);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `${system}\n\nUser: ${input.prompt}` },
              { inline_data: { mime_type: 'image/jpeg', data: input.image } }
            ]
          }],
          generationConfig: {
            maxOutputTokens: mode === 'live' || mode === 'ar' ? 200 : 400,
            temperature:     0.4,
          }
        }),
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) throw new Error(`Gemini vision ${res.status}`);
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (e: any) {
    console.warn('[Vision] Gemini:', e.message);
    return null;
  }
}

// ── Engine: GPT-4o Vision ─────────────────────────────────────
async function gpt4oVision(input: VisionInput): Promise<string | null> {
  const { openai, ownerName } = await getKeys();
  if (!hasKey(openai)) return null;

  const mode   = input.mode ?? 'snapshot';
  const system = buildVisionSystem(ownerName, mode);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openai}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system',  content: system },
          { role: 'user',    content: [
            { type: 'text',      text: input.prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.image}`, detail: 'low' } }
          ]}
        ],
        max_tokens:  mode === 'live' ? 150 : 350,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`GPT-4o vision ${res.status}`);
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (e: any) {
    console.warn('[Vision] GPT-4o:', e.message);
    return null;
  }
}

// ── Engine: Groq text-only fallback (describes from prompt only)
async function groqTextFallback(input: VisionInput): Promise<string | null> {
  const { groq, ownerName } = await getKeys();
  if (!hasKey(groq)) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groq}` },
      body: JSON.stringify({
        model:    'llama-3.3-70b-versatile',
        messages: [
          { role: 'system',  content: buildVisionSystem(ownerName, 'snapshot') },
          { role: 'user',    content: `I'm looking at something but can't send the image right now. ${input.prompt} Please give a helpful general answer.` }
        ],
        max_tokens:  300,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Groq text ${res.status}`);
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (e: any) {
    console.warn('[Vision] Groq fallback:', e.message);
    return null;
  }
}

// ── Offline vision fallback ───────────────────────────────────
function offlineVisionFallback(input: VisionInput): string {
  const fallbacks = [
    "I can't analyze images offline, but describe what you're seeing and I'll do my best to help.",
    "No vision AI available right now. Tell me what you see and I'll work with that.",
    "My vision systems need an internet connection. Describe the scene to me?",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ── AR mode: parse JSON object labels from AI response ────────
export interface ARLabel {
  label:      string;
  xPct:       number;   // 0-100, percent of screen width
  yPct:       number;   // 0-100, percent of screen height
  importance: number;   // 0-1
  color?:     string;
}

export function parseARLabels(aiResponse: string): ARLabel[] {
  // Try JSON block first
  const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/) ||
                    aiResponse.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const raw = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
      return (Array.isArray(raw) ? raw : []).map((item: any) => ({
        label:      String(item.label  ?? item.name ?? 'Object'),
        xPct:       Number(item.x      ?? item.xPct ?? 50),
        yPct:       Number(item.y      ?? item.yPct ?? 50),
        importance: Number(item.importance ?? item.confidence ?? 0.7),
        color:      item.color ?? '#40AAFF',
      }));
    } catch {}
  }

  // Fallback: extract lines that look like labels
  const lines = aiResponse.split('\n').filter(l => l.trim().startsWith('-') || l.includes(':'));
  return lines.slice(0, 5).map((l, i) => ({
    label:      l.replace(/^[-•*]\s*/, '').split(':')[0].trim().slice(0, 24),
    xPct:       20 + (i * 15) % 70,
    yPct:       20 + (i * 12) % 60,
    importance: 0.8,
    color:      '#40AAFF',
  }));
}

// ── Main vision router entry point ────────────────────────────
export async function visionRouter(input: VisionInput): Promise<string> {
  const mode   = input.mode   ?? 'snapshot';
  const source = input.source ?? 'unknown';

  // Cascade through vision-capable engines
  for (const engine of [geminiVision, gpt4oVision, groqTextFallback]) {
    try {
      const result = await engine(input);
      if (result) {
        // Store in rolling memory
        pushMemory({
          timestamp: Date.now(),
          prompt:    input.prompt.slice(0, 80),
          summary:   result.slice(0, 120),
          source,
        });
        return result;
      }
    } catch (e: any) {
      console.warn('[Vision] Engine error:', e.message);
    }
  }

  return offlineVisionFallback(input);
}

// ── Convenience wrappers ───────────────────────────────────────
export async function analyzeScene(imageBase64: string): Promise<string> {
  return visionRouter({
    image:  imageBase64,
    prompt: 'Describe what you see clearly and helpfully in 2-3 sentences.',
    mode:   'snapshot',
    source: 'camera',
  });
}

export async function analyzeScreen(imageBase64: string): Promise<string> {
  return visionRouter({
    image:  imageBase64,
    prompt: 'What is showing on this phone screen? Summarize clearly and suggest how I can help.',
    mode:   'screen',
    source: 'screen',
  });
}

export async function analyzeLiveFrame(imageBase64: string, context = ''): Promise<string> {
  return visionRouter({
    image:  imageBase64,
    prompt: `Describe what is happening right now in one brief sentence.${context ? ` Context: ${context}` : ''}`,
    mode:   'live',
    source: 'camera',
  });
}

export async function analyzeForAR(imageBase64: string): Promise<ARLabel[]> {
  const response = await visionRouter({
    image: imageBase64,
    prompt: `Identify the main objects visible. Return a JSON array where each item has:
- "label": short name (max 3 words)
- "x": estimated X position as % of image width (0-100)
- "y": estimated Y position as % of image height (0-100)
- "importance": how significant this object is (0.0 to 1.0)
Return ONLY the JSON array, no other text.`,
    mode:   'ar',
    source: 'camera',
  });
  return parseARLabels(response);
}
