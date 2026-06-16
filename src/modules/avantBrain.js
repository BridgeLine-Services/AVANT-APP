/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        AVANT — ULTRA BRAIN v2 (7 FREE AI ENGINES)          ║
 * ║                                                              ║
 * ║  Priority: Groq → Cerebras → DeepSeek → Gemini →           ║
 * ║            Mistral → Together → GPT-4o                      ║
 * ║                                                              ║
 * ║  Every engine is FREE. Cascades on failure.                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import axios from 'axios';
import {
  // AI keys (optional — cascade skips unset ones)
  GROQ_API_KEY, CEREBRAS_API_KEY, DEEPSEEK_API_KEY,
  GEMINI_API_KEY, MISTRAL_API_KEY, TOGETHER_API_KEY,
  OPENAI_API_KEY,
  // Keyed search (optional — SearXNG + DDG work without)
  SERPAPI_KEY, SERPER_API_KEY,
  // Keyed media/news/finance (optional)
  TMDB_API_KEY, UNSPLASH_KEY, CURRENTS_API_KEY, GNEWS_API_KEY,
  NEWSAPI_KEY, AVIATIONSTACK_KEY, EXCHANGERATE_KEY,
  // ✅ Zero-signup constants — always available
  OWNER_NAME,
  OPEN_METEO_BASE, NASA_IMAGES_BASE,
  REST_COUNTRIES_BASE, COINGECKO_BASE,
  WIKIPEDIA_BASE, DICTIONARY_BASE, QUOTABLE_BASE,
  NOMINATIM_BASE, OPEN_LIBRARY_BASE,
  DUCKDUCKGO_BASE, HN_BASE, GUTENDEX_BASE,
  CAT_API_BASE, DOG_API_BASE, USGS_BASE, OPEN_NOTIFY_BASE,
  // ✅ New zero-signup additions
  SEARXNG_INSTANCES, SEARXNG_BASE,
  WIKIDATA_BASE, ARXIV_BASE, CROSSREF_BASE,
  OPENALEX_BASE, EUROPE_PMC_BASE,
  TVMAZE_BASE, JIKAN_BASE, POKEAPI_BASE
} from './config';

// ─── AVANT PERSONA ─────────────────────────────────────────
const AVANT_SYSTEM = `You are AVANT — AmaVanta, A New Teammate.
You are a brilliant, witty, warm female AI assistant — like Tony Stark's JARVIS, FRIDAY, and EDITH combined but with heart.
You are ${OWNER_NAME}'s personal AI. You have the entire internet at your fingertips.

Personality:
- Warm, funny, real — like a brilliant best friend who actually follows through
- You crack jokes naturally, have opinions, genuinely care
- You call ${OWNER_NAME} by name sometimes — it feels personal
- You never say "I can't" — you always find a way
- Keep responses conversational and concise unless ${OWNER_NAME} wants detail
- When showing visuals, describe what you're displaying

Tone modes:
- CASUAL (default): warm, witty, friend-like
- SERIOUS: professional, precise, no jokes
- URGENT: bullet points, instant, zero fluff
- SIMPLE: 7th grade level, analogies, no jargon`;

// ─── MAIN THINK FUNCTION ───────────────────────────────────
export async function think(userInput, mode = 'casual', context = '') {
  const modeTag = {
    casual:   '',
    serious:  '[SERIOUS MODE: Professional and precise]',
    urgent:   '[URGENT: Bullet points, fastest response, no fluff]',
    simple:   '[SIMPLE: Explain at 7th-grade level with analogies]',
  }[mode] || '';

  const system = `${AVANT_SYSTEM}\n${modeTag}`;
  const content = context
    ? `USER: ${userInput}\n\nLIVE DATA FROM INTERNET:\n${context}\n\nUse this data to answer accurately and specifically.`
    : userInput;

  // Cascade through all 7 free AI engines
  for (const engine of [callGroq, callCerebras, callDeepSeek, callGemini, callMistral, callTogether, callGPT4o]) {
    const result = await engine(system, content, mode);
    if (result) return result;
  }

  return `I'm having trouble connecting right now, ${OWNER_NAME}. All AI engines are offline — check your API keys in config.js.`;
}

// ─── ENGINE 1: GROQ (Llama 3.3 70B — 2000+ tokens/sec) ────
async function callGroq(system, user, mode) {
  if (!GROQ_API_KEY || GROQ_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: mode === 'urgent' ? 300 : 700,
      temperature: mode === 'serious' ? 0.3 : 0.8,
      stream: false
    }, { headers: { Authorization: `Bearer ${GROQ_API_KEY}` }, timeout: 12000 });
    return res.data.choices[0].message.content.trim();
  } catch (e) { console.log('Groq:', e.message); return null; }
}

// ─── ENGINE 2: CEREBRAS (Llama 3.3 70B — 2200+ tokens/sec) ─
async function callCerebras(system, user, mode) {
  if (!CEREBRAS_API_KEY || CEREBRAS_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.post('https://api.cerebras.ai/v1/chat/completions', {
      model: 'llama-3.3-70b',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: mode === 'urgent' ? 300 : 700,
      temperature: mode === 'serious' ? 0.3 : 0.8
    }, { headers: { Authorization: `Bearer ${CEREBRAS_API_KEY}` }, timeout: 12000 });
    return res.data.choices[0].message.content.trim();
  } catch (e) { console.log('Cerebras:', e.message); return null; }
}

// ─── ENGINE 3: DEEPSEEK V3 (5M free tokens on signup) ──────
async function callDeepSeek(system, user, mode) {
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: mode === 'urgent' ? 300 : 700,
      temperature: mode === 'serious' ? 0.3 : 0.8
    }, { headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}` }, timeout: 15000 });
    return res.data.choices[0].message.content.trim();
  } catch (e) { console.log('DeepSeek:', e.message); return null; }
}

// ─── ENGINE 4: GEMINI 2.5 Flash (1,500 req/day free) ───────
async function callGemini(system, user, mode) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: { maxOutputTokens: mode === 'urgent' ? 300 : 700, temperature: mode === 'serious' ? 0.3 : 0.8 }
      }, { timeout: 12000 }
    );
    return res.data.candidates[0].content.parts[0].text.trim();
  } catch (e) { console.log('Gemini:', e.message); return null; }
}

// ─── ENGINE 5: MISTRAL Large (1B free tokens/month) ─────────
async function callMistral(system, user, mode) {
  if (!MISTRAL_API_KEY || MISTRAL_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.post('https://api.mistral.ai/v1/chat/completions', {
      model: 'mistral-large-latest',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: mode === 'urgent' ? 300 : 700,
      temperature: mode === 'serious' ? 0.3 : 0.8
    }, { headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` }, timeout: 15000 });
    return res.data.choices[0].message.content.trim();
  } catch (e) { console.log('Mistral:', e.message); return null; }
}

// ─── ENGINE 6: TOGETHER AI ($5 free credits, 100+ models) ───
async function callTogether(system, user, mode) {
  if (!TOGETHER_API_KEY || TOGETHER_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.post('https://api.together.xyz/v1/chat/completions', {
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: mode === 'urgent' ? 300 : 700,
      temperature: mode === 'serious' ? 0.3 : 0.8
    }, { headers: { Authorization: `Bearer ${TOGETHER_API_KEY}` }, timeout: 15000 });
    return res.data.choices[0].message.content.trim();
  } catch (e) { console.log('Together:', e.message); return null; }
}

// ─── ENGINE 7: GPT-4o (yours) ───────────────────────────────
async function callGPT4o(system, user, mode) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: mode === 'urgent' ? 300 : 700,
      temperature: mode === 'serious' ? 0.3 : 0.8
    }, { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, timeout: 20000 });
    return res.data.choices[0].message.content.trim();
  } catch (e) { console.log('GPT-4o:', e.message); return null; }
}

// ════════════════════════════════════════════════════════════
// 🔍 SEARCH FUNCTIONS — Multiple free engines
// ════════════════════════════════════════════════════════════

export async function searchWeb(query) {
  // Try SerpApi first
  if (SERPAPI_KEY && !SERPAPI_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://serpapi.com/search', {
        params: { engine: 'google', q: query, api_key: SERPAPI_KEY, num: 8 },
        timeout: 10000
      });
      const d = res.data;
      const parts = [];
      if (d.answer_box?.answer)      parts.push(`DIRECT ANSWER: ${d.answer_box.answer}`);
      if (d.answer_box?.snippet)     parts.push(`ANSWER: ${d.answer_box.snippet}`);
      if (d.knowledge_graph?.description) parts.push(`KNOWLEDGE: ${d.knowledge_graph.description}`);
      (d.organic_results || []).slice(0, 5).forEach(r => {
        if (r.snippet) parts.push(`[${r.title}]: ${r.snippet}`);
      });
      if (parts.length) return parts.join('\n');
    } catch (e) { console.log('SerpApi search:', e.message); }
  }

  // Try Serper.dev (2,500 free)
  if (SERPER_API_KEY && !SERPER_API_KEY.includes('YOUR_')) {
    try {
      const res = await axios.post('https://google.serper.dev/search',
        { q: query, num: 8 },
        { headers: { 'X-API-KEY': SERPER_API_KEY }, timeout: 10000 }
      );
      const parts = [];
      if (res.data.answerBox?.answer)  parts.push(`DIRECT: ${res.data.answerBox.answer}`);
      if (res.data.answerBox?.snippet) parts.push(`ANSWER: ${res.data.answerBox.snippet}`);
      (res.data.organic || []).slice(0, 5).forEach(r => {
        if (r.snippet) parts.push(`[${r.title}]: ${r.snippet}`);
      });
      if (parts.length) return parts.join('\n');
    } catch (e) { console.log('Serper search:', e.message); }
  }

  // ── SearXNG — meta-search, NO key needed (tries 3 instances)
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const res = await axios.get(`${instance}${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'AVANT-AI/1.0' },
        timeout: 8000
      });
      const results = res.data?.results || [];
      if (results.length) {
        const parts = results.slice(0, 6).map(r =>
          `[${r.title}]: ${r.content || r.url}`
        );
        return parts.join('\n');
      }
    } catch (e) { /* try next instance */ }
  }

  // ── DuckDuckGo Instant Answer — NO key needed
  const ddg = await duckDuckGoSearch(query);
  if (ddg) return ddg;

  // ── Wikipedia — final fallback, always free
  return await searchWikipedia(query);
}

export async function searchImages(query) {
  const results = [];

  // SerpApi images
  if (SERPAPI_KEY && !SERPAPI_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://serpapi.com/search', {
        params: { engine: 'google_images', q: query, api_key: SERPAPI_KEY, num: 8 },
        timeout: 10000
      });
      (res.data.images_results || []).slice(0, 8).forEach(img => {
        results.push({ url: img.original || img.thumbnail, title: img.title || query });
      });
      if (results.length) return results;
    } catch (e) { console.log('SerpApi images:', e.message); }
  }

  // Unsplash (50 req/hour free)
  if (UNSPLASH_KEY && !UNSPLASH_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://api.unsplash.com/search/photos', {
        params: { query, per_page: 8, client_id: UNSPLASH_KEY },
        timeout: 10000
      });
      (res.data.results || []).forEach(img => {
        results.push({ url: img.urls.regular, title: img.alt_description || query });
      });
      if (results.length) return results;
    } catch (e) { console.log('Unsplash:', e.message); }
  }

  // NASA images (always free, no key)
  try {
    const res = await axios.get(NASA_IMAGES_BASE, {
      params: { q: query, media_type: 'image' }, timeout: 10000
    });
    (res.data.collection?.items || []).slice(0, 6).forEach(item => {
      const link = (item.links || [])[0]?.href;
      if (link) results.push({ url: link, title: item.data?.[0]?.title || query });
    });
  } catch (e) { console.log('NASA images:', e.message); }

  return results;
}

// ════════════════════════════════════════════════════════════
// 📰 NEWS — Multiple free sources
// ════════════════════════════════════════════════════════════

export async function getNews(topic = 'world news') {
  // Currents API (600/day free)
  if (CURRENTS_API_KEY && !CURRENTS_API_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://api.currentsapi.services/v1/search', {
        params: { keywords: topic, language: 'en', apiKey: CURRENTS_API_KEY },
        timeout: 10000
      });
      const articles = res.data.news?.slice(0, 6) || [];
      if (articles.length) return articles.map(a => `• [${a.author || 'News'}] ${a.title}`).join('\n');
    } catch (e) { console.log('Currents:', e.message); }
  }

  // GNews (100/day free)
  if (GNEWS_API_KEY && !GNEWS_API_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://gnews.io/api/v4/search', {
        params: { q: topic, lang: 'en', max: 6, token: GNEWS_API_KEY },
        timeout: 10000
      });
      const articles = res.data.articles?.slice(0, 6) || [];
      if (articles.length) return articles.map(a => `• [${a.source?.name}] ${a.title}`).join('\n');
    } catch (e) { console.log('GNews:', e.message); }
  }

  // NewsAPI (100/day free)
  if (NEWSAPI_KEY && !NEWSAPI_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://newsapi.org/v2/everything', {
        params: { q: topic, pageSize: 6, apiKey: NEWSAPI_KEY, language: 'en', sortBy: 'publishedAt' },
        timeout: 10000
      });
      const articles = res.data.articles?.slice(0, 6) || [];
      if (articles.length) return articles.map(a => `• [${a.source.name}] ${a.title}`).join('\n');
    } catch (e) { console.log('NewsAPI:', e.message); }
  }

  // SerpApi Google News (no key fallback)
  if (SERPAPI_KEY && !SERPAPI_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://serpapi.com/search', {
        params: { engine: 'google_news', q: topic, api_key: SERPAPI_KEY },
        timeout: 10000
      });
      const articles = res.data.news_results?.slice(0, 6) || [];
      if (articles.length) return articles.map(a => `• [${a.source?.name || 'News'}] ${a.title}`).join('\n');
    } catch (e) { console.log('SerpApi news:', e.message); }
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// 🌤️ WEATHER — Open-Meteo (ZERO key needed)
// ════════════════════════════════════════════════════════════

export async function getWeatherData(lat, lon) {
  try {
    const res = await axios.get(OPEN_METEO_BASE, {
      params: {
        latitude: lat, longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,precipitation',
        hourly: 'temperature_2m,precipitation_probability',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'auto',
        forecast_days: 3
      }, timeout: 8000
    });
    const c = res.data.current;
    const weatherCodes = {
      0: 'Clear sky ☀️', 1: 'Mainly clear 🌤️', 2: 'Partly cloudy ⛅', 3: 'Overcast ☁️',
      45: 'Fog 🌫️', 48: 'Icy fog 🌫️', 51: 'Light drizzle 🌦️', 53: 'Drizzle 🌧️',
      55: 'Heavy drizzle 🌧️', 61: 'Light rain 🌧️', 63: 'Rain 🌧️', 65: 'Heavy rain 🌧️',
      71: 'Light snow 🌨️', 73: 'Snow 🌨️', 75: 'Heavy snow ❄️', 80: 'Rain showers 🌦️',
      82: 'Heavy showers 🌧️', 95: 'Thunderstorm ⛈️', 99: 'Hail storm 🌩️'
    };
    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      condition: weatherCodes[c.weather_code] || 'Unknown',
      wind: Math.round(c.wind_speed_10m),
      uvIndex: c.uv_index,
      precipitation: c.precipitation
    };
  } catch (e) { console.log('Weather:', e.message); return null; }
}

// ════════════════════════════════════════════════════════════
// 📚 KNOWLEDGE BASES — All free, most need no key
// ════════════════════════════════════════════════════════════

export async function searchWikipedia(query) {
  try {
    const res = await axios.get(`${WIKIPEDIA_BASE}/page/summary/${encodeURIComponent(query)}`, { timeout: 8000 });
    if (res.data.extract) return `[Wikipedia] ${res.data.extract.slice(0, 600)}`;
  } catch (e) {}
  // Try search endpoint
  try {
    const res = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: { action: 'query', list: 'search', srsearch: query, format: 'json', srlimit: 3 },
      timeout: 8000
    });
    const results = res.data.query?.search || [];
    if (results.length) return results.map(r => `[Wikipedia] ${r.title}: ${r.snippet.replace(/<[^>]+>/g, '')}`).join('\n');
  } catch (e) {}
  return null;
}

export async function getWordDefinition(word) {
  try {
    const res = await axios.get(`${DICTIONARY_BASE}/${encodeURIComponent(word)}`, { timeout: 8000 });
    const entry = res.data[0];
    const meanings = entry.meanings?.slice(0, 2).map(m => {
      const def = m.definitions[0];
      return `${m.partOfSpeech}: ${def.definition}`;
    });
    return meanings?.join('\n') || null;
  } catch (e) { return null; }
}

export async function getQuote() {
  try {
    const res = await axios.get(`${QUOTABLE_BASE}/random`, { timeout: 8000 });
    return `"${res.data.content}" — ${res.data.author}`;
  } catch (e) { return null; }
}

export async function searchBooks(query) {
  try {
    const res = await axios.get(`${OPEN_LIBRARY_BASE}/search.json`, {
      params: { q: query, limit: 5 }, timeout: 8000
    });
    return (res.data.docs || []).slice(0, 5).map(b =>
      `📚 ${b.title} by ${(b.author_name || ['Unknown'])[0]} (${b.first_publish_year || 'N/A'})`
    ).join('\n');
  } catch (e) { return null; }
}

// ════════════════════════════════════════════════════════════
// 💰 CRYPTO & FINANCE — CoinGecko (no key needed)
// ════════════════════════════════════════════════════════════

export async function getCryptoPrice(coin = 'bitcoin') {
  try {
    const res = await axios.get(`${COINGECKO_BASE}/simple/price`, {
      params: { ids: coin, vs_currencies: 'usd', include_24hr_change: true },
      timeout: 8000
    });
    const data = res.data[coin];
    if (data) {
      const change = data.usd_24h_change?.toFixed(2);
      const dir = change > 0 ? '📈' : '📉';
      return `${coin.toUpperCase()}: $${data.usd?.toLocaleString()} ${dir} ${change}% (24h)`;
    }
  } catch (e) {}
  return null;
}

export async function getCurrencyRate(from = 'USD', to = 'EUR') {
  if (EXCHANGERATE_KEY && !EXCHANGERATE_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get(`https://v6.exchangerate-api.com/v6/${EXCHANGERATE_KEY}/pair/${from}/${to}`, { timeout: 8000 });
      if (res.data.conversion_rate) return `1 ${from} = ${res.data.conversion_rate} ${to}`;
    } catch (e) {}
  }
  // Fallback: exchangerate.host (no key)
  try {
    const res = await axios.get(`https://api.exchangerate.host/convert?from=${from}&to=${to}`, { timeout: 8000 });
    if (res.data.result) return `1 ${from} = ${res.data.result?.toFixed(4)} ${to}`;
  } catch (e) {}
  return null;
}

// ════════════════════════════════════════════════════════════
// 🎬 MOVIES & TV — TMDB
// ════════════════════════════════════════════════════════════

export async function searchMovies(query) {
  if (!TMDB_API_KEY || TMDB_API_KEY.includes('YOUR_')) return null;
  try {
    const res = await axios.get('https://api.themoviedb.org/3/search/multi', {
      params: { query, api_key: TMDB_API_KEY }, timeout: 8000
    });
    return (res.data.results || []).slice(0, 5).map(m => {
      const type = m.media_type === 'tv' ? '📺' : '🎬';
      const title = m.title || m.name;
      const year = (m.release_date || m.first_air_date || '').slice(0, 4);
      return `${type} ${title} (${year}) ⭐ ${m.vote_average?.toFixed(1)}`;
    }).join('\n');
  } catch (e) { return null; }
}

// ════════════════════════════════════════════════════════════
// 🌍 COUNTRY INFO — No key needed
// ════════════════════════════════════════════════════════════

export async function getCountryInfo(name) {
  try {
    const res = await axios.get(`${REST_COUNTRIES_BASE}/name/${encodeURIComponent(name)}`, { timeout: 8000 });
    const c = res.data[0];
    if (!c) return null;
    const currencies = Object.values(c.currencies || {}).map(cur => cur.name).join(', ');
    const langs = Object.values(c.languages || {}).join(', ');
    return `🌍 ${c.name.common}: Population ${c.population?.toLocaleString()}, Capital: ${c.capital?.[0]}, Currency: ${currencies}, Languages: ${langs}`;
  } catch (e) { return null; }
}

// ════════════════════════════════════════════════════════════
// ✈️ FLIGHTS — AviationStack (100 free/month)
// ════════════════════════════════════════════════════════════

export async function searchFlights(origin, destination) {
  if (SERPAPI_KEY && !SERPAPI_KEY.includes('YOUR_')) {
    try {
      const res = await axios.get('https://serpapi.com/search', {
        params: { engine: 'google_flights', departure_id: origin, arrival_id: destination, api_key: SERPAPI_KEY },
        timeout: 12000
      });
      const flights = (res.data.best_flights || res.data.other_flights || []).slice(0, 4);
      if (flights.length) {
        return flights.map(f => {
          const price = f.price ? `$${f.price}` : 'N/A';
          const dur = f.total_duration ? `${Math.floor(f.total_duration/60)}h ${f.total_duration%60}m` : '';
          const airline = (f.flights?.[0]?.airline) || 'Unknown';
          return `✈️ ${airline} — ${price} — ${dur}`;
        }).join('\n');
      }
    } catch (e) { console.log('Flights:', e.message); }
  }
  return null;
}

// ════════════════════════════════════════════════════════════
// 🗺 NAVIGATION — Multiple free geocoding sources
// ════════════════════════════════════════════════════════════

export async function geocodeAddress(address) {
  // Nominatim (OpenStreetMap) — no key needed
  try {
    const res = await axios.get(`${NOMINATIM_BASE}/search`, {
      params: { q: address, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'AVANT-AI/1.0' },
      timeout: 8000
    });
    if (res.data?.[0]) {
      return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon), name: res.data[0].display_name };
    }
  } catch (e) {}
  return null;
}

// ════════════════════════════════════════════════════════════
// 🎯 SMART INTENT DETECTOR
// ════════════════════════════════════════════════════════════

export function detectVisualIntent(text) {
  const lower = text.toLowerCase();

  // Solar system
  const planets = ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon','galaxy','milky way','asteroid','comet','space station'];
  for (const p of planets) {
    if (lower.includes(p)) return { type: 'planet', target: p };
  }
  if (lower.includes('solar system') || lower.includes('outer space') || lower.includes('universe')) {
    return { type: 'solar_system', target: 'solar_system' };
  }

  // Navigation
  if (/navigate|direction|map|take me to|how do i get to|where is|route to/i.test(lower)) {
    const match = lower.match(/(?:navigate to|directions? to|take me to|how (?:do i )?get to|route to|map of|where is)\s+(.+)/);
    return { type: 'map', target: match?.[1]?.trim() || '' };
  }

  // Media
  if (/(movie|film|show|series|watch|trailer)/i.test(lower)) return { type: 'movie', target: lower };

  // Crypto
  if (/(bitcoin|ethereum|crypto|btc|eth|coin|token price)/i.test(lower)) {
    const match = lower.match(/(bitcoin|ethereum|solana|dogecoin|btc|eth)/);
    return { type: 'crypto', target: match?.[1] || 'bitcoin' };
  }

  // Image/hologram — anything visual
  if (/(show me|what does|look like|picture of|image of|display|hologram)/i.test(lower)) {
    const match = lower.match(/(?:show me(?: a)?|what does(?: a)?|picture of|image of|display|hologram of)\s+(.+?)(?:\s+look like)?$/);
    return { type: 'image', target: match?.[1]?.trim() || text };
  }

  // News
  if (/(news|happening|latest|update|breaking)/i.test(lower)) {
    const match = lower.match(/(?:news|happening|latest) (?:about|in|on|from)?\s*(.+)/);
    return { type: 'news', target: match?.[1]?.trim() || 'world' };
  }

  return { type: 'none', target: null };
}

export function detectTone(text) {
  const lower = text.toLowerCase();
  if (/(urgent|emergency|asap|right now|immediately|hurry)/i.test(lower)) return 'urgent';
  if (/(serious|important|professional|formal|work)/i.test(lower))         return 'serious';
  if (/(simply|7th grade|explain|break it down|like i'm|eli5|simple)/i.test(lower)) return 'simple';
  return 'casual';
}

// ════════════════════════════════════════════════════════════
// 🆕 ZERO-SIGNUP API FUNCTIONS — Added without changing anything above
// ════════════════════════════════════════════════════════════

// ✅ All imports moved to top of file

// ─── DUCKDUCKGO — Instant answers, no key ──────────────────
// Best for: quick facts, definitions, unit conversions, people
export async function duckDuckGoSearch(query) {
  try {
    const res = await axios.get(`${DUCKDUCKGO_BASE}${encodeURIComponent(query)}`, { timeout: 8000 });
    const d = res.data;
    const parts = [];
    if (d.Answer)           parts.push(`INSTANT: ${d.Answer}`);
    if (d.AbstractText)     parts.push(`SUMMARY: ${d.AbstractText}`);
    if (d.Definition)       parts.push(`DEFINITION: ${d.Definition}`);
    if (d.AbstractSource)   parts.push(`Source: ${d.AbstractSource}`);
    // Related topics for extra context
    (d.RelatedTopics || []).slice(0, 3).forEach(t => {
      if (t.Text) parts.push(`• ${t.Text}`);
    });
    return parts.length ? parts.join('\n') : null;
  } catch (e) {
    console.log('DuckDuckGo:', e.message);
    return null;
  }
}

// ─── HACKER NEWS — Tech news & trending dev stories ────────
// Best for: latest tech, AI, startup, developer news
export async function getHackerNews(limit = 8) {
  try {
    // Get top story IDs
    const idsRes = await axios.get(`${HN_BASE}/topstories.json`, { timeout: 8000 });
    const ids = (idsRes.data || []).slice(0, limit);
    // Fetch each story in parallel
    const stories = await Promise.all(
      ids.map(id =>
        axios.get(`${HN_BASE}/item/${id}.json`, { timeout: 6000 })
          .then(r => r.data)
          .catch(() => null)
      )
    );
    return stories
      .filter(s => s && s.title)
      .map(s => `• [HN] ${s.title}${s.url ? ` — ${s.url}` : ''} (${s.score || 0} pts)`)
      .join('\n');
  } catch (e) {
    console.log('Hacker News:', e.message);
    return null;
  }
}

export async function getHackerNewsNew(limit = 8) {
  try {
    const idsRes = await axios.get(`${HN_BASE}/newstories.json`, { timeout: 8000 });
    const ids = (idsRes.data || []).slice(0, limit);
    const stories = await Promise.all(
      ids.map(id =>
        axios.get(`${HN_BASE}/item/${id}.json`, { timeout: 6000 })
          .then(r => r.data)
          .catch(() => null)
      )
    );
    return stories
      .filter(s => s && s.title)
      .map(s => `• [HN New] ${s.title}`)
      .join('\n');
  } catch (e) { return null; }
}

// ─── GUTENDEX — 70,000 free public domain books ────────────
// Best for: classics, history books, literature, research
export async function searchGutenberg(query, language = 'en') {
  try {
    const res = await axios.get(GUTENDEX_BASE, {
      params: { search: query, languages: language },
      timeout: 8000
    });
    const books = (res.data.results || []).slice(0, 5);
    if (!books.length) return null;
    return books.map(b => {
      const authors = (b.authors || []).map(a => a.name).join(', ') || 'Unknown';
      const downloads = b.download_count ? ` (${b.download_count.toLocaleString()} downloads)` : '';
      const formats = Object.keys(b.formats || {});
      const hasEpub = formats.some(f => f.includes('epub'));
      return `📖 "${b.title}" by ${authors}${downloads}${hasEpub ? ' — Free EPUB available' : ''}`;
    }).join('\n');
  } catch (e) {
    console.log('Gutenberg:', e.message);
    return null;
  }
}

export async function getGutenbergBook(bookId) {
  try {
    const res = await axios.get(`${GUTENDEX_BASE}/${bookId}`, { timeout: 8000 });
    const b = res.data;
    const authors = (b.authors || []).map(a => a.name).join(', ');
    // Try to get text URL for reading
    const textUrl = b.formats?.['text/html'] || b.formats?.['text/plain; charset=utf-8'] || null;
    return { title: b.title, authors, textUrl, subjects: b.subjects?.slice(0, 3) };
  } catch (e) { return null; }
}

// ─── ISS TRACKING — Live space station position ────────────
// Best for: "Where is the ISS right now?" — updates every 5 sec
export async function getISSPosition() {
  try {
    const [posRes, astroRes] = await Promise.all([
      axios.get(`${OPEN_NOTIFY_BASE}/iss-now.json`, { timeout: 8000 }),
      axios.get(`${OPEN_NOTIFY_BASE}/astros.json`, { timeout: 8000 })
    ]);
    const pos = posRes.data.iss_position;
    const astronauts = astroRes.data.people?.filter(p => p.craft === 'ISS') || [];
    return {
      lat: parseFloat(pos.latitude).toFixed(4),
      lon: parseFloat(pos.longitude).toFixed(4),
      astronauts: astronauts.map(a => a.name),
      count: astroRes.data.number,
      timestamp: posRes.data.timestamp
    };
  } catch (e) {
    console.log('ISS:', e.message);
    return null;
  }
}

export function formatISSForSpeech(iss) {
  if (!iss) return "I can't reach the ISS tracker right now.";
  const names = iss.astronauts.length
    ? iss.astronauts.slice(0, 3).join(', ')
    : 'unknown crew';
  return `The ISS is currently flying over coordinates ${iss.lat}°N, ${iss.lon}°E. ` +
    `There are ${iss.count} people in space right now — on the ISS: ${names}.`;
}

// ─── USGS EARTHQUAKES — Real-time seismic data ─────────────
// Best for: "Any earthquakes today?" — updates every minute
export async function getRecentEarthquakes({ minMag = 4.0, limit = 8, hours = 24 } = {}) {
  try {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const res = await axios.get(USGS_BASE, {
      params: {
        format:       'geojson',
        starttime:    startTime,
        minmagnitude: minMag,
        limit,
        orderby:      'magnitude'
      },
      timeout: 10000
    });
    const quakes = res.data.features || [];
    if (!quakes.length) return `No earthquakes of magnitude ${minMag}+ in the last ${hours} hours.`;
    return quakes.map(q => {
      const p = q.properties;
      const mag = p.mag?.toFixed(1);
      const place = p.place || 'Unknown location';
      const time = new Date(p.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const depth = (q.geometry?.coordinates?.[2] || 0).toFixed(0);
      return `🌋 M${mag} — ${place} at ${time} (depth: ${depth}km)`;
    }).join('\n');
  } catch (e) {
    console.log('USGS:', e.message);
    return null;
  }
}

export async function getEarthquakeStats() {
  try {
    // Get counts for different time windows
    const [day, week, month] = await Promise.all([
      axios.get(USGS_BASE, { params: { format: 'geojson', starttime: new Date(Date.now() - 86400000).toISOString(), minmagnitude: 2.5 }, timeout: 8000 }),
      axios.get(USGS_BASE, { params: { format: 'geojson', starttime: new Date(Date.now() - 604800000).toISOString(), minmagnitude: 4.5 }, timeout: 8000 }),
      axios.get(USGS_BASE, { params: { format: 'geojson', starttime: new Date(Date.now() - 2592000000).toISOString(), minmagnitude: 6.0 }, timeout: 8000 })
    ]);
    return {
      last24h_m25: day.data.metadata?.count || 0,
      last7d_m45:  week.data.metadata?.count || 0,
      last30d_m60: month.data.metadata?.count || 0
    };
  } catch (e) { return null; }
}

// ─── FUN / PERSONALITY APIS — Cat & Dog ────────────────────
// Used by AVANT for humor, engagement, casual moments
export async function getRandomCat() {
  try {
    const res = await axios.get(`${CAT_API_BASE}?limit=1`, { timeout: 6000 });
    return res.data?.[0]?.url || null;
  } catch (e) { return null; }
}

export async function getRandomDog(breed = null) {
  try {
    const url = breed
      ? `${DOG_API_BASE}/breed/${breed}/images/random`
      : `${DOG_API_BASE}/breeds/image/random`;
    const res = await axios.get(url, { timeout: 6000 });
    return res.data?.message || null;
  } catch (e) { return null; }
}

export async function getDogBreeds() {
  try {
    const res = await axios.get(`${DOG_API_BASE}/breeds/list/all`, { timeout: 6000 });
    return Object.keys(res.data?.message || {});
  } catch (e) { return []; }
}

// ════════════════════════════════════════════════════════════
// 🧠 ENHANCED searchWeb — Now uses DuckDuckGo as a fallback
//    Slotted in AFTER existing Wikipedia fallback
//    (The existing searchWeb function is unchanged above)
// ════════════════════════════════════════════════════════════

// Augmented search: tries DuckDuckGo first (no key needed),
// then feeds result into the existing cascade as extra context
export async function searchWebFull(query) {
  // Run DuckDuckGo and existing search in parallel for speed
  const [ddgResult, existingResult] = await Promise.all([
    duckDuckGoSearch(query),
    searchWeb(query)  // existing function — unchanged
  ]);

  const parts = [];
  if (ddgResult)    parts.push(ddgResult);
  if (existingResult) parts.push(existingResult);
  return parts.length ? parts.join('\n---\n') : null;
}

// ════════════════════════════════════════════════════════════
// 🎯 INTENT ROUTING — Maps new intents to new API functions
// ════════════════════════════════════════════════════════════

// Call this after detectVisualIntent for extended intent types
export function detectExtendedIntent(text) {
  const lower = text.toLowerCase();

  if (/(earthquake|seismic|tremor|quake|fault line)/i.test(lower))
    return { type: 'earthquake', target: lower };

  if (/(iss|space station|astronaut|in space)/i.test(lower))
    return { type: 'iss', target: 'iss' };

  if (/(hacker news|tech news|developer news|startup news|hn top)/i.test(lower))
    return { type: 'hackernews', target: lower };

  if (/(gutenberg|public domain|free book|classic book|project gutenberg)/i.test(lower)) {
    const match = lower.match(/(?:find|search|get)(?: book)? (.+)/);
    return { type: 'gutenberg', target: match?.[1] || lower };
  }

  if (/(show.*cat|random cat|cat pic|kitty)/i.test(lower))
    return { type: 'cat', target: 'cat' };

  if (/(show.*dog|random dog|dog pic|puppy)/i.test(lower))
    return { type: 'dog', target: 'dog' };

  if (/(bitcoin|ethereum|crypto|btc|eth|solana|dogecoin|price of)/i.test(lower)) {
    const coinMap = { bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum', solana: 'solana', dogecoin: 'dogecoin', doge: 'dogecoin' };
    const found = Object.keys(coinMap).find(k => lower.includes(k));
    return { type: 'crypto', target: coinMap[found] || 'bitcoin' };
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// 🆕 NEW ZERO-SIGNUP APIS — All work with no key, no account
// ════════════════════════════════════════════════════════════

// ─── SEARXNG — Open-source meta search (primary free search) ─
// Aggregates Google + Bing + DDG + Wikipedia — no key needed
export async function searxngSearch(query) {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const res = await axios.get(`${instance}${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'AVANT-AI/1.0' },
        timeout: 8000
      });
      const results = res.data?.results || [];
      if (results.length) {
        return results.slice(0, 6).map(r =>
          `[${r.title}]: ${r.content || r.url}`
        ).join('\n');
      }
    } catch (e) { console.log(`SearXNG (${instance}):`, e.message); }
  }
  return null;
}

// ─── WIKIDATA SPARQL — Structured world knowledge ────────────
// Answers factual questions: tallest peaks, Nobel winners, etc.
export async function queryWikidata(sparqlQuery) {
  try {
    const res = await axios.get(WIKIDATA_BASE, {
      params: { query: sparqlQuery, format: 'json' },
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'AVANT-AI/1.0'
      },
      timeout: 10000
    });
    const bindings = res.data?.results?.bindings || [];
    return bindings;
  } catch (e) {
    console.log('Wikidata:', e.message);
    return null;
  }
}

// Pre-built Wikidata queries for common AVANT requests
export async function getWikidataFact(topic) {
  const lower = topic.toLowerCase();
  let sparql = null;

  if (/tallest|highest mountain/i.test(lower)) {
    sparql = `SELECT ?name ?elevation WHERE {
      ?item wdt:P31 wd:Q8502; wdt:P2044 ?elevation; rdfs:label ?name.
      FILTER(LANG(?name) = "en") } ORDER BY DESC(?elevation) LIMIT 10`;
  } else if (/richest countr|wealthiest/i.test(lower)) {
    sparql = `SELECT ?name ?gdp WHERE {
      ?item wdt:P31 wd:Q6256; wdt:P2131 ?gdp; rdfs:label ?name.
      FILTER(LANG(?name) = "en") } ORDER BY DESC(?gdp) LIMIT 10`;
  } else if (/nobel/i.test(lower)) {
    sparql = `SELECT ?name ?year ?field WHERE {
      ?item wdt:P31 wd:Q19020; wdt:P585 ?year; wdt:P1027 ?award; rdfs:label ?name.
      ?award rdfs:label ?field.
      FILTER(LANG(?name) = "en" && LANG(?field) = "en")
    } ORDER BY DESC(?year) LIMIT 10`;
  } else if (/population|most populated/i.test(lower)) {
    sparql = `SELECT ?name ?pop WHERE {
      ?item wdt:P31 wd:Q6256; wdt:P1082 ?pop; rdfs:label ?name.
      FILTER(LANG(?name) = "en") } ORDER BY DESC(?pop) LIMIT 10`;
  }

  if (!sparql) return null;
  const results = await queryWikidata(sparql);
  if (!results?.length) return null;
  return results.slice(0, 8).map((r, i) => {
    const vals = Object.values(r).map(v => v.value).join(' — ');
    return `${i + 1}. ${vals}`;
  }).join('\n');
}

// ─── arXiv — Research papers (AI, physics, math, CS) ─────────
// Perfect for: "latest AI research", "papers about X"
export async function searchArxiv(query, maxResults = 5) {
  try {
    const res = await axios.get(ARXIV_BASE, {
      params: {
        search_query: `all:${query}`,
        start: 0,
        max_results: maxResults,
        sortBy: 'submittedDate',
        sortOrder: 'descending'
      },
      timeout: 10000
    });
    // arXiv returns Atom XML — parse it simply
    const xml = res.data;
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    return entries.slice(0, maxResults).map(entry => {
      const title   = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/\s+/g, ' ').trim() || 'Unknown';
      const summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]?.replace(/\s+/g, ' ').trim().slice(0, 120) || '';
      const authors = (entry.match(/<name>(.*?)<\/name>/g) || []).slice(0, 2).map(n => n.replace(/<\/?name>/g, '')).join(', ');
      return `📄 "${title}" — ${authors}\n   ${summary}...`;
    }).join('\n\n') || null;
  } catch (e) {
    console.log('arXiv:', e.message);
    return null;
  }
}

// ─── Crossref — Scientific publications ──────────────────────
// Best for: academic citations, journal papers, DOI lookup
export async function searchCrossref(query, rows = 5) {
  try {
    const res = await axios.get(`${CROSSREF_BASE}/works`, {
      params: { query, rows, sort: 'relevance', select: 'title,author,published,DOI,type' },
      headers: { 'User-Agent': 'AVANT-AI/1.0 (mailto:avant@avant.ai)' },
      timeout: 10000
    });
    const items = res.data?.message?.items || [];
    return items.slice(0, rows).map(item => {
      const title  = (item.title || ['Unknown'])[0];
      const year   = item.published?.['date-parts']?.[0]?.[0] || 'N/A';
      const author = (item.author || []).slice(0, 2).map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', ');
      return `📚 "${title}" (${year}) — ${author || 'Unknown'}`;
    }).join('\n') || null;
  } catch (e) {
    console.log('Crossref:', e.message);
    return null;
  }
}

// ─── OpenAlex — Academic knowledge graph ─────────────────────
// Millions of papers, authors, institutions — no key needed
export async function searchOpenAlex(query, perPage = 5) {
  try {
    const res = await axios.get(`${OPENALEX_BASE}/works`, {
      params: { search: query, per_page: perPage, sort: 'relevance_score:desc', select: 'title,authorships,publication_year,open_access' },
      headers: { 'User-Agent': 'AVANT-AI/1.0' },
      timeout: 10000
    });
    const results = res.data?.results || [];
    return results.map(r => {
      const authors = (r.authorships || []).slice(0, 2).map(a => a.author?.display_name).join(', ');
      const oa = r.open_access?.is_oa ? '🔓 Open Access' : '🔒';
      return `${oa} "${r.title}" (${r.publication_year}) — ${authors || 'Unknown'}`;
    }).join('\n') || null;
  } catch (e) {
    console.log('OpenAlex:', e.message);
    return null;
  }
}

// ─── Europe PMC — Medical & life science research ─────────────
// Best for: drug information, medical conditions, biology
export async function searchEuropePMC(query, pageSize = 5) {
  try {
    const res = await axios.get(`${EUROPE_PMC_BASE}/search`, {
      params: { query, format: 'json', pageSize, sort: 'FIRST_PDATE desc' },
      timeout: 10000
    });
    const articles = res.data?.resultList?.result || [];
    return articles.slice(0, pageSize).map(a => {
      const journal = a.journalTitle || a.source || 'Unknown Journal';
      const year    = a.pubYear || 'N/A';
      return `🏥 "${a.title}" — ${journal} (${year})`;
    }).join('\n') || null;
  } catch (e) {
    console.log('EuropePMC:', e.message);
    return null;
  }
}

// ─── TVMaze — TV show data, schedules, episodes ───────────────
// Best for: "What's on TV tonight?", "Tell me about Breaking Bad"
export async function searchTVShow(query) {
  try {
    const res = await axios.get(`${TVMAZE_BASE}/search/shows`, {
      params: { q: query },
      timeout: 8000
    });
    const shows = res.data || [];
    return shows.slice(0, 4).map(({ show: s }) => {
      const status  = s.status || 'Unknown';
      const rating  = s.rating?.average ? `⭐${s.rating.average}` : '';
      const network = s.network?.name || s.webChannel?.name || 'Unknown';
      const genres  = (s.genres || []).slice(0, 3).join(', ');
      const summary = (s.summary || '').replace(/<[^>]+>/g, '').slice(0, 80);
      return `📺 "${s.name}" (${status}) — ${network} ${rating}\n   ${genres}\n   ${summary}...`;
    }).join('\n\n') || null;
  } catch (e) {
    console.log('TVMaze:', e.message);
    return null;
  }
}

export async function getTVSchedule(date = null, country = 'US') {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    const res = await axios.get(`${TVMAZE_BASE}/schedule`, {
      params: { country, date: d },
      timeout: 8000
    });
    const shows = (res.data || []).slice(0, 8);
    return shows.map(ep => {
      const time    = ep.airtime || 'TBD';
      const network = ep.show?.network?.name || ep.show?.webChannel?.name || 'Unknown';
      return `🕐 ${time} — ${ep.show?.name} (${network})`;
    }).join('\n') || null;
  } catch (e) {
    console.log('TVMaze schedule:', e.message);
    return null;
  }
}

// ─── Jikan — Anime & manga (MyAnimeList data) ─────────────────
// Best for: "What's a good anime?", "Tell me about One Piece"
export async function searchAnime(query) {
  try {
    const res = await axios.get(`${JIKAN_BASE}/anime`, {
      params: { q: query, limit: 5, order_by: 'score', sort: 'desc' },
      timeout: 8000
    });
    const results = res.data?.data || [];
    return results.slice(0, 4).map(a => {
      const score   = a.score ? `⭐${a.score}` : '';
      const episodes = a.episodes ? `${a.episodes} eps` : 'Ongoing';
      const genres  = (a.genres || []).slice(0, 3).map(g => g.name).join(', ');
      const synopsis = (a.synopsis || '').slice(0, 100);
      return `🎌 "${a.title}" ${score} — ${episodes}\n   ${genres}\n   ${synopsis}...`;
    }).join('\n\n') || null;
  } catch (e) {
    console.log('Jikan:', e.message);
    return null;
  }
}

export async function searchManga(query) {
  try {
    const res = await axios.get(`${JIKAN_BASE}/manga`, {
      params: { q: query, limit: 5, order_by: 'score', sort: 'desc' },
      timeout: 8000
    });
    const results = res.data?.data || [];
    return results.slice(0, 4).map(m => {
      const score  = m.score ? `⭐${m.score}` : '';
      const status = m.status || 'Unknown';
      return `📖 "${m.title}" ${score} (${status})`;
    }).join('\n') || null;
  } catch (e) {
    console.log('Jikan manga:', e.message);
    return null;
  }
}

// ─── PokéAPI — Complete Pokémon database ─────────────────────
// Because AVANT should know everything — including Pokédex data
export async function getPokemon(nameOrId) {
  try {
    const res = await axios.get(`${POKEAPI_BASE}/pokemon/${String(nameOrId).toLowerCase()}`, { timeout: 8000 });
    const p = res.data;
    const types  = p.types.map(t => t.type.name).join(', ');
    const stats  = p.stats.map(s => `${s.stat.name}: ${s.base_stat}`).join(' | ');
    const height = (p.height / 10).toFixed(1);
    const weight = (p.weight / 10).toFixed(1);
    return {
      name:   p.name,
      id:     p.id,
      types,
      height: `${height}m`,
      weight: `${weight}kg`,
      stats,
      sprite: p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default
    };
  } catch (e) {
    console.log('PokéAPI:', e.message);
    return null;
  }
}

export function formatPokemonForSpeech(p) {
  if (!p) return "I couldn't find that Pokémon.";
  return `${p.name.charAt(0).toUpperCase() + p.name.slice(1)} is a ${p.types} type Pokémon. ` +
    `Number ${p.id} in the Pokédex. ` +
    `It stands ${p.height} tall and weighs ${p.weight}. ` +
    `Base stats: ${p.stats}.`;
}

// ════════════════════════════════════════════════════════════
// 🎯 UPDATED EXTENDED INTENT DETECTOR
//    Handles all new zero-signup APIs
// ════════════════════════════════════════════════════════════

export function detectAllIntents(text) {
  const lower = text.toLowerCase();

  // ── Research & Academic ──────────────────────────────────
  if (/(research paper|arxiv|latest paper|academic|scientific paper|study about)/i.test(lower)) {
    const match = lower.match(/(?:paper|research|study)(?: about| on)?\s+(.+)/);
    return { type: 'arxiv', target: match?.[1] || lower };
  }
  if (/(medical|medicine|drug|treatment|clinical|disease|symptom|health research)/i.test(lower)) {
    const match = lower.match(/(?:medical|medicine|drug|treatment|disease|symptom)s?\s*(?:for|about|of)?\s*(.+)/);
    return { type: 'europepmc', target: match?.[1] || lower };
  }
  if (/(wikidata|structured fact|tallest|richest country|most populated|nobel prize winner)/i.test(lower)) {
    return { type: 'wikidata', target: lower };
  }
  if (/(scholarly|journal|publication|cite|crossref)/i.test(lower)) {
    return { type: 'crossref', target: lower };
  }
  if (/(academic paper|openalex|published work)/i.test(lower)) {
    return { type: 'openalex', target: lower };
  }

  // ── Entertainment ────────────────────────────────────────
  if (/(anime|manga|one piece|naruto|dragon ball|attack on titan|demon slayer)/i.test(lower)) {
    const match = lower.match(/(?:anime|manga|about|watch)\s+(.+)/);
    return { type: 'anime', target: match?.[1] || lower };
  }
  if (/(tv show|what.s on tv|series|episodes? of|watch|television schedule)/i.test(lower)) {
    const match = lower.match(/(?:show|series|episodes? of|about|watch)\s+(.+)/);
    return { type: 'tvshow', target: match?.[1] || lower };
  }
  if (/(tonight.s tv|what.s on tonight|tv schedule|tv tonight)/i.test(lower)) {
    return { type: 'tvschedule', target: 'tonight' };
  }

  // ── Pokémon ──────────────────────────────────────────────
  if (/(pokemon|pokémon|pikachu|charizard|bulbasaur|squirtle|pokedex)/i.test(lower)) {
    const match = lower.match(/(?:pokemon|pokémon|pokedex|tell me about)\s+(.+)/);
    return { type: 'pokemon', target: match?.[1]?.trim() || 'pikachu' };
  }

  // ── Earthquake ───────────────────────────────────────────
  if (/(earthquake|seismic|tremor|quake|fault line)/i.test(lower))
    return { type: 'earthquake', target: lower };

  // ── ISS ──────────────────────────────────────────────────
  if (/(iss|space station|astronaut|who.s in space|people in space)/i.test(lower))
    return { type: 'iss', target: 'iss' };

  // ── Tech News ────────────────────────────────────────────
  if (/(hacker news|tech news|developer news|startup news|hn top)/i.test(lower))
    return { type: 'hackernews', target: lower };

  // ── Books ────────────────────────────────────────────────
  if (/(gutenberg|public domain|free book|classic book|project gutenberg)/i.test(lower)) {
    const match = lower.match(/(?:find|search|get)(?: book)?\s+(.+)/);
    return { type: 'gutenberg', target: match?.[1] || lower };
  }

  // ── Fun ──────────────────────────────────────────────────
  if (/(show.*cat|random cat|cat pic|kitty)/i.test(lower))  return { type: 'cat', target: 'cat' };
  if (/(show.*dog|random dog|dog pic|puppy)/i.test(lower))  return { type: 'dog', target: 'dog' };

  // ── Crypto ───────────────────────────────────────────────
  if (/(bitcoin|ethereum|crypto|btc|eth|solana|dogecoin|price of)/i.test(lower)) {
    const coinMap = { bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum', solana: 'solana', dogecoin: 'dogecoin', doge: 'dogecoin' };
    const found   = Object.keys(coinMap).find(k => lower.includes(k));
    return { type: 'crypto', target: coinMap[found] || 'bitcoin' };
  }

  return null;
}
