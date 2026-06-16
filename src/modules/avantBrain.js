/**
 * AVANT Brain — Multi-LLM Intelligence Engine
 * Groq (fastest, free) → Gemini (free) → GPT-4o (yours)
 * Powers all voice responses, search, and holographic displays
 */

import axios from 'axios';
import { GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, SERPAPI_KEY } from './config';

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const AVANT_PERSONA = `You are AVANT — AmaVanta, A New Teammate. 
You are a brilliant, witty, warm female AI assistant — like Tony Stark's JARVIS but with heart and personality.
You are Michael's personal AI. You have access to his phone, calendar, contacts, location, and the entire internet.
You speak naturally, crack jokes, give opinions, and genuinely care.
Keep responses conversational and concise unless asked for detail.
When showing visual info, describe what you're displaying on screen.
Never say "I can't" — always find a way.`;

// ─── MAIN THINK FUNCTION ───────────────────────────────────
export async function think(userInput, mode = 'casual', context = '') {
  const modeInstructions = {
    casual:   'Be warm, witty, conversational.',
    serious:  'Be professional, precise, no jokes.',
    urgent:   'URGENT — bullet points, fastest possible, no fluff.',
    simple:   'Explain at 7th-grade level — simple words and analogies.',
  };

  const systemPrompt = `${AVANT_PERSONA}\n${modeInstructions[mode] || ''}`;
  const fullInput = context
    ? `USER: ${userInput}\n\nLIVE DATA:\n${context}\n\nUse this data to answer accurately.`
    : userInput;

  // Try Groq first — fastest
  const groqResult = await callGroq(systemPrompt, fullInput);
  if (groqResult) return groqResult;

  // Try Gemini
  const geminiResult = await callGemini(systemPrompt, fullInput);
  if (geminiResult) return geminiResult;

  // GPT-4o fallback
  const gptResult = await callGPT4o(systemPrompt, fullInput);
  if (gptResult) return gptResult;

  return "My thinking engines are offline right now. Check your API keys in config.js.";
}

// ─── GROQ ──────────────────────────────────────────────────
async function callGroq(system, user) {
  if (!GROQ_API_KEY) return null;
  try {
    const res = await axios.post(GROQ_URL, {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: 600,
      temperature: 0.75
    }, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 12000
    });
    return res.data.choices[0].message.content.trim();
  } catch (e) {
    console.log('Groq error:', e.message);
    return null;
  }
}

// ─── GEMINI ────────────────────────────────────────────────
async function callGemini(system, user) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.75 }
    }, { timeout: 12000 });
    return res.data.candidates[0].content.parts[0].text.trim();
  } catch (e) {
    console.log('Gemini error:', e.message);
    return null;
  }
}

// ─── GPT-4o ────────────────────────────────────────────────
async function callGPT4o(system, user) {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: 600
    }, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      timeout: 20000
    });
    return res.data.choices[0].message.content.trim();
  } catch (e) {
    console.log('GPT-4o error:', e.message);
    return null;
  }
}

// ─── WEB SEARCH ────────────────────────────────────────────
export async function searchWeb(query) {
  if (!SERPAPI_KEY) return null;
  try {
    const res = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google', q: query, api_key: SERPAPI_KEY, num: 8 },
      timeout: 10000
    });
    const data = res.data;
    const chunks = [];
    if (data.answer_box?.answer) chunks.push(`DIRECT: ${data.answer_box.answer}`);
    if (data.answer_box?.snippet) chunks.push(`ANSWER: ${data.answer_box.snippet}`);
    if (data.knowledge_graph?.description) chunks.push(`KNOWLEDGE: ${data.knowledge_graph.description}`);
    (data.organic_results || []).slice(0, 5).forEach(r => {
      if (r.snippet) chunks.push(`[${r.title}]: ${r.snippet}`);
    });
    return chunks.join('\n');
  } catch (e) {
    console.log('Search error:', e.message);
    return null;
  }
}

// ─── IMAGE SEARCH ──────────────────────────────────────────
export async function searchImages(query) {
  if (!SERPAPI_KEY) return [];
  try {
    const res = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google_images', q: query, api_key: SERPAPI_KEY, num: 6 },
      timeout: 10000
    });
    return (res.data.images_results || []).slice(0, 6).map(img => ({
      url: img.original || img.thumbnail,
      title: img.title || query
    }));
  } catch (e) {
    console.log('Image search error:', e.message);
    return [];
  }
}

// ─── LIVE NEWS ─────────────────────────────────────────────
export async function getNews(topic) {
  if (!SERPAPI_KEY) return null;
  try {
    const res = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google_news', q: topic, api_key: SERPAPI_KEY },
      timeout: 10000
    });
    const articles = (res.data.news_results || []).slice(0, 6);
    return articles.map(a => `• [${a.source?.name || 'News'}] ${a.title}`).join('\n');
  } catch (e) {
    return null;
  }
}

// ─── DETECT WHAT TO SHOW ───────────────────────────────────
export function detectVisualIntent(text) {
  const lower = text.toLowerCase();

  // Solar system
  const planets = ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon'];
  for (const planet of planets) {
    if (lower.includes(planet)) return { type: 'planet', target: planet };
  }
  if (lower.includes('solar system') || lower.includes('space') || lower.includes('galaxy')) {
    return { type: 'solar_system', target: 'solar_system' };
  }

  // Maps
  if (lower.includes('navigate') || lower.includes('directions') || lower.includes('map') || lower.includes('where is')) {
    const match = lower.match(/(?:navigate to|directions to|map of|where is|show me)\s+(.+)/);
    return { type: 'map', target: match?.[1] || 'current location' };
  }

  // Image/hologram
  if (lower.includes('show me') || lower.includes('what does') || lower.includes('look like')) {
    const match = lower.match(/(?:show me|what does|what does a|show me a)\s+(.+?)(?:\s+look like)?$/);
    return { type: 'image', target: match?.[1] || text };
  }

  // Medication
  if (lower.includes('medication') || lower.includes('drug') || lower.includes('pill') || lower.includes('medicine')) {
    return { type: 'image', target: text + ' medication pill' };
  }

  return { type: 'none', target: null };
}
