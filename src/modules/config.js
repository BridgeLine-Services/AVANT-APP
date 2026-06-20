/**
 * AVANT — Config (FIXED)
 * 
 * FIXES:
 * • GOOGLE_MAPS_KEY exported (was missing)
 * • OWNER_NAME default set to a placeholder
 * • Voice settings tuned for natural female voice
 */

// ── Owner ─────────────────────────────────────────────────────
export const OWNER_NAME = 'Boss'; // Change this to your name

// ── Voice settings ────────────────────────────────────────────
export const VOICE_PITCH = 1.1;   // Slightly higher — female range
export const VOICE_RATE  = 0.92;  // Slightly slower — clearer speech

// ── API Keys — fill these in your .env file ───────────────────
// All zero-signup APIs work with NO key.
// Add optional keys for enhanced features:

// Google Maps (optional — for embedded map)
// Get free at: console.cloud.google.com → Maps Embed API
export const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

// AI Keys (optional — cascade falls back gracefully without them)
export const GROQ_API_KEY       = process.env.EXPO_PUBLIC_GROQ_API_KEY       || '';
export const GEMINI_API_KEY     = process.env.EXPO_PUBLIC_GEMINI_API_KEY     || '';
export const DEEPSEEK_API_KEY   = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY   || '';
export const CEREBRAS_API_KEY   = process.env.EXPO_PUBLIC_CEREBRAS_API_KEY   || '';
export const OPENAI_API_KEY     = process.env.EXPO_PUBLIC_OPENAI_API_KEY     || '';

// SerpAPI (optional — for advanced map directions)
export const SERPAPI_KEY = process.env.EXPO_PUBLIC_SERPAPI_KEY || '';

// ── API Base URLs (zero-signup — no key needed) ───────────────
export const WIKI_BASE        = 'https://en.wikipedia.org/api/rest_v1';
export const OPEN_METEO_BASE  = 'https://api.open-meteo.com/v1';
export const ISS_BASE         = 'http://api.open-notify.org';
export const NOMINATIM_BASE   = 'https://nominatim.openstreetmap.org';
export const ARXIV_BASE       = 'https://export.arxiv.org/api';
export const USGS_BASE        = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0';
export const TVMAZE_BASE      = 'https://api.tvmaze.com';
export const POKEAPI_BASE     = 'https://pokeapi.co/api/v2';
export const JIKAN_BASE       = 'https://api.jikan.moe/v4';
export const CROSSREF_BASE    = 'https://api.crossref.org';
export const OPENALEX_BASE    = 'https://api.openalex.org';
export const EUROPE_PMC_BASE  = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
export const COINGECKO_BASE   = 'https://api.coingecko.com/api/v3';
export const HACKERNEWS_BASE  = 'https://hacker-news.firebaseio.com/v0';
export const QUOTABLE_BASE    = 'https://api.quotable.io';
export const OPENLIBRARY_BASE = 'https://openlibrary.org';
export const GUTENBERG_BASE   = 'https://gutendex.com/books';
export const WIKIDATA_BASE    = 'https://query.wikidata.org/sparql';
export const SEARXNG_BASE     = 'https://searx.be/search'; // Public SearXNG instance
