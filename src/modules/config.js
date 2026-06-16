/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           AVANT — COMPLETE API CONFIGURATION                ║
 * ║                                                              ║
 * ║  ✅ = Works RIGHT NOW, zero signup, zero key                ║
 * ║  🔑 = Works if you add a key (all free tiers)               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════════════════════════════════
// ⚡ AI BRAINS — Optional keys (cascade — uses whichever is set)
// ════════════════════════════════════════════════════════════════
// 🔑 GROQ — Sign up: https://console.groq.com (free, fastest)
export const GROQ_API_KEY       = 'YOUR_GROQ_API_KEY';

// 🔑 GEMINI — Sign up: https://aistudio.google.com/apikey
export const GEMINI_API_KEY     = 'YOUR_GEMINI_API_KEY';

// 🔑 DEEPSEEK — Sign up: https://platform.deepseek.com
export const DEEPSEEK_API_KEY   = 'YOUR_DEEPSEEK_API_KEY';

// 🔑 CEREBRAS — Sign up: https://cloud.cerebras.ai
export const CEREBRAS_API_KEY   = 'YOUR_CEREBRAS_API_KEY';

// 🔑 TOGETHER — Sign up: https://api.together.ai
export const TOGETHER_API_KEY   = 'YOUR_TOGETHER_API_KEY';

// 🔑 MISTRAL — Sign up: https://console.mistral.ai
export const MISTRAL_API_KEY    = 'YOUR_MISTRAL_API_KEY';

// 🔑 OPENAI GPT-4o — Sign up: https://platform.openai.com
export const OPENAI_API_KEY     = 'YOUR_OPENAI_API_KEY';

// ════════════════════════════════════════════════════════════════
// 🔍 SEARCH — Optional keys (SearXNG + DuckDuckGo work without)
// ════════════════════════════════════════════════════════════════
// 🔑 SERPAPI — Sign up: https://serpapi.com (100/month free)
export const SERPAPI_KEY        = 'YOUR_SERPAPI_KEY';

// 🔑 SERPER.DEV — Sign up: https://serper.dev (2,500 free lifetime)
export const SERPER_API_KEY     = 'YOUR_SERPER_API_KEY';

// 🔑 GOOGLE MAPS DEMO — https://mapsplatform.google.com/maps-demo-key/
export const GOOGLE_MAPS_KEY    = 'YOUR_GOOGLE_MAPS_DEMO_KEY';

// ════════════════════════════════════════════════════════════════
// 📰 NEWS — Optional keys (Hacker News works without any key)
// ════════════════════════════════════════════════════════════════
// 🔑 CURRENTS — Sign up: https://currentsapi.services/en/register
export const CURRENTS_API_KEY   = 'YOUR_CURRENTS_API_KEY';

// 🔑 GNEWS — Sign up: https://gnews.io/register
export const GNEWS_API_KEY      = 'YOUR_GNEWS_API_KEY';

// 🔑 NEWSAPI — Sign up: https://newsapi.org/register
export const NEWSAPI_KEY        = 'YOUR_NEWSAPI_KEY';

// ════════════════════════════════════════════════════════════════
// 🎬 MEDIA — Optional keys (TVMaze works without any key)
// ════════════════════════════════════════════════════════════════
// 🔑 TMDB — Sign up: https://www.themoviedb.org/signup
export const TMDB_API_KEY       = 'YOUR_TMDB_API_KEY';

// 🔑 UNSPLASH — Sign up: https://unsplash.com/developers
export const UNSPLASH_KEY       = 'YOUR_UNSPLASH_KEY';

// ════════════════════════════════════════════════════════════════
// 💰 FINANCE — Optional keys (CoinGecko works without any key)
// ════════════════════════════════════════════════════════════════
// 🔑 EXCHANGERATE — Sign up: https://app.exchangerate-api.com/sign-up
export const EXCHANGERATE_KEY   = 'YOUR_EXCHANGERATE_KEY';

// 🔑 OPENWEATHER — Sign up: https://openweathermap.org/api
export const OPENWEATHER_KEY    = 'YOUR_OPENWEATHER_KEY';

// 🔑 AVIATIONSTACK — Sign up: https://aviationstack.com/signup/free
export const AVIATIONSTACK_KEY  = 'YOUR_AVIATIONSTACK_KEY';

// ════════════════════════════════════════════════════════════════
// ✅ ZERO-SIGNUP · ZERO-KEY APIs — Work immediately, right now
// ════════════════════════════════════════════════════════════════

// ── WEATHER ────────────────────────────────────────────────────
// ✅ Open-Meteo — 10,000 calls/day, no key, no signup
export const OPEN_METEO_BASE      = 'https://api.open-meteo.com/v1/forecast';

// ── SPACE ──────────────────────────────────────────────────────
// ✅ NASA Images — Space photo search, no key required
export const NASA_API_KEY         = 'DEMO_KEY';
export const NASA_IMAGES_BASE     = 'https://images-api.nasa.gov/search';

// ✅ Open Notify — Live ISS position + astronauts in space
export const OPEN_NOTIFY_BASE     = 'http://api.open-notify.org';

// ── MAPS & LOCATION ────────────────────────────────────────────
// ✅ Nominatim (OpenStreetMap) — Free geocoding, no key
export const NOMINATIM_BASE       = 'https://nominatim.openstreetmap.org';

// ✅ OpenStreetMap Tiles — Free map tiles, replaces Google Maps billing
export const OSM_TILE_BASE        = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// ✅ IPAPI — IP to city/country/lat-lon, no key
export const IPAPI_BASE           = 'https://ipapi.co/json/';

// ── COUNTRIES & WORLD ──────────────────────────────────────────
// ✅ REST Countries — Country data, flags, currencies, languages
export const REST_COUNTRIES_BASE  = 'https://restcountries.com/v3.1';

// ── KNOWLEDGE ──────────────────────────────────────────────────
// ✅ Wikipedia REST API — Full encyclopedia, no key
export const WIKIPEDIA_BASE       = 'https://en.wikipedia.org/api/rest_v1';

// ✅ Wikidata SPARQL — Structured facts: tallest mountains, Nobel winners, etc.
export const WIKIDATA_BASE        = 'https://query.wikidata.org/sparql';

// ✅ DictionaryAPI.dev — Definitions, pronunciation, no key
export const DICTIONARY_BASE      = 'https://api.dictionaryapi.dev/api/v2/entries/en';

// ✅ Open Library — 20M+ books, authors, covers, no key
export const OPEN_LIBRARY_BASE    = 'https://openlibrary.org';

// ✅ Quotable — Inspirational quotes, no key
export const QUOTABLE_BASE        = 'https://api.quotable.io';

// ── SEARCH ─────────────────────────────────────────────────────
// ✅ DuckDuckGo Instant Answer — Quick facts, definitions, no key
export const DUCKDUCKGO_BASE      = 'https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=';

// ✅ SearXNG — Open-source meta search engine, NO key, NO signup
//    Aggregates Google, Bing, DuckDuckGo, Wikipedia results
//    Multiple public instances — falls back if one is down
export const SEARXNG_INSTANCES    = [
  'https://searx.be/search?format=json&q=',
  'https://search.disroot.org/search?format=json&q=',
  'https://searx.tiekoetter.com/search?format=json&q=',
];
export const SEARXNG_BASE         = 'https://searx.be/search?format=json&q=';

// ── ACADEMIC & RESEARCH ────────────────────────────────────────
// ✅ arXiv — Research papers: AI, physics, math, CS — no key
export const ARXIV_BASE           = 'https://export.arxiv.org/api/query';

// ✅ Crossref — Scientific publications index — no key
export const CROSSREF_BASE        = 'https://api.crossref.org';

// ✅ OpenAlex — Academic knowledge graph, millions of papers — no key
export const OPENALEX_BASE        = 'https://api.openalex.org';

// ✅ Europe PMC — Medical & life science research — no key
export const EUROPE_PMC_BASE      = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

// ── FINANCE ────────────────────────────────────────────────────
// ✅ CoinGecko — Crypto prices, market cap, 24hr change — no key
export const COINGECKO_BASE       = 'https://api.coingecko.com/api/v3';

// ── BOOKS & LITERATURE ─────────────────────────────────────────
// ✅ Gutendex — 70,000 Project Gutenberg books — no key
export const GUTENDEX_BASE        = 'https://gutendex.com/books';

// ── NEWS & TECH ────────────────────────────────────────────────
// ✅ Hacker News — Top tech & developer stories — no key
export const HN_BASE              = 'https://hacker-news.firebaseio.com/v0';

// ── EARTH SCIENCE ──────────────────────────────────────────────
// ✅ USGS Earthquakes — Real-time global seismic data — no key
export const USGS_BASE            = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

// ── ENTERTAINMENT ──────────────────────────────────────────────
// ✅ TVMaze — TV show data, schedules, cast, episodes — no key
export const TVMAZE_BASE          = 'https://api.tvmaze.com';

// ✅ Jikan — Anime & manga database (MyAnimeList) — no key
export const JIKAN_BASE           = 'https://api.jikan.moe/v4';

// ✅ PokéAPI — Complete Pokémon database — no key
export const POKEAPI_BASE         = 'https://pokeapi.co/api/v2';

// ── FUN & PERSONALITY ──────────────────────────────────────────
// ✅ The Cat API — Random cat images — works without key
export const CAT_API_BASE         = 'https://api.thecatapi.com/v1/images/search';

// ✅ Dog CEO API — Dog breeds + random images — no key
export const DOG_API_BASE         = 'https://dog.ceo/api';

// ════════════════════════════════════════════════════════════════
// ⚙️ APP SETTINGS
// ════════════════════════════════════════════════════════════════

export const OWNER_NAME   = 'Michael';
export const WAKE_WORD    = 'avant';
export const HOME_ADDRESS = 'Your Home Address Here';
export const TIMEZONE     = 'America/Los_Angeles';

// Voice — natural feminine tone
export const VOICE_PITCH  = 1.1;
export const VOICE_RATE   = 0.95;
export const VOICE_LANG   = 'en-US';

// LLM cascade — skips any engine whose key is not set
export const LLM_PRIORITY = ['groq', 'cerebras', 'deepseek', 'gemini', 'mistral', 'together', 'openai'];
