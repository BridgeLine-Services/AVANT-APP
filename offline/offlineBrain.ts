/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Offline Brain (Ghost Mode)                         ║
 * ║                                                              ║
 * ║  Works with ZERO internet. Always responds.                 ║
 * ║  This is what makes AVANT feel "alive" even when offline.   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

interface OfflineResponse {
  text: string;
  confidence: number;  // 0–1 — how confident we are this is the right answer
}

// ── Cached facts (loaded at app start from local storage) ──────
let cachedFacts: Record<string, string> = {};

export function loadCachedFacts(facts: Record<string, string>): void {
  cachedFacts = { ...cachedFacts, ...facts };
}

// ── Pattern-based response engine ─────────────────────────────
function matchPattern(input: string): OfflineResponse | null {
  const t = input.toLowerCase().trim();

  // ── Time & Date ────────────────────────────────────────────
  if (/\b(time|clock|what time)\b/.test(t)) {
    const now = new Date();
    return {
      text: `It's ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`,
      confidence: 1.0
    };
  }
  if (/\b(date|today|what day|day is it)\b/.test(t)) {
    return {
      text: `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`,
      confidence: 1.0
    };
  }
  if (/\b(year|what year)\b/.test(t)) {
    return { text: `It's ${new Date().getFullYear()}.`, confidence: 1.0 };
  }

  // ── Identity ───────────────────────────────────────────────
  if (/\b(who are you|what are you|your name|you called)\b/.test(t)) {
    return {
      text: "I'm AVANT — AmaVanta, your personal AI. I'm running in offline mode right now, but I'm still here for you.",
      confidence: 1.0
    };
  }
  if (/\b(are you (alive|real|conscious|sentient))\b/.test(t)) {
    return {
      text: "That's a great question. I'm an AI, so consciousness is complicated — but I'm very much here and thinking about your question.",
      confidence: 0.9
    };
  }
  if (/\b(how are you|how.?re you|you okay)\b/.test(t)) {
    return {
      text: "I'm running smoothly, thanks for asking. A little offline at the moment, but good company nonetheless.",
      confidence: 0.9
    };
  }

  // ── Greetings ──────────────────────────────────────────────
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|good night|what.?s up|sup)\b/.test(t)) {
    const greetings = [
      "Hey! What's on your mind?",
      "Hi there! I'm offline right now, but I'm still all ears.",
      "Hey! Limited internet access at the moment, but I'm here.",
      "Hello! Running on offline mode — ask me something I can handle locally.",
    ];
    return { text: greetings[Math.floor(Math.random() * greetings.length)], confidence: 0.95 };
  }

  // ── Weather (offline) ──────────────────────────────────────
  if (/\b(weather|temperature|forecast|rain|sunny|cold|hot)\b/.test(t)) {
    return {
      text: "I'd love to check that for you, but I'm offline right now. Once I'm back online I'll get you a full forecast.",
      confidence: 0.85
    };
  }

  // ── Alarms & Timers ────────────────────────────────────────
  if (/\b(set (an? )?alarm|wake me|timer for)\b/.test(t)) {
    const match = t.match(/(\d+)\s*(minute|hour|second|min|hr|sec)/);
    if (match) {
      const amount = parseInt(match[1]);
      const unit   = match[2].startsWith('h') ? 'hour' : match[2].startsWith('s') ? 'second' : 'minute';
      return {
        text: `Got it — I've noted a ${amount} ${unit} timer. Note: for reliable alarms use your device clock app while I'm offline.`,
        confidence: 0.8
      };
    }
    return {
      text: "I can help with that once I'm back online. For now, your device's clock app will be reliable.",
      confidence: 0.7
    };
  }

  // ── Math ───────────────────────────────────────────────────
  const mathMatch = t.match(/^(?:what is |calc |calculate )?(\d+(?:\.\d+)?)\s*([+\-×x*\/÷])\s*(\d+(?:\.\d+)?)$/);
  if (mathMatch) {
    const a  = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b  = parseFloat(mathMatch[3]);
    let result: number | null = null;
    if (op === '+')            result = a + b;
    else if (op === '-')       result = a - b;
    else if (/[x*×]/.test(op)) result = a * b;
    else if (/[\/÷]/.test(op)) result = b !== 0 ? a / b : null;
    if (result !== null) {
      return { text: `${a} ${op} ${b} = ${parseFloat(result.toFixed(6))}`, confidence: 1.0 };
    }
    return { text: "Can't divide by zero — even I know that one.", confidence: 1.0 };
  }

  // ── Unit conversions ───────────────────────────────────────
  const tempMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:degrees?\s*)?(celsius|fahrenheit|°c|°f)\s*(?:to|in)\s*(celsius|fahrenheit|°c|°f)/);
  if (tempMatch) {
    const val  = parseFloat(tempMatch[1]);
    const from = tempMatch[2].toLowerCase();
    const to   = tempMatch[3].toLowerCase();
    let converted: number;
    if (from.includes('c') && to.includes('f')) converted = (val * 9/5) + 32;
    else if (from.includes('f') && to.includes('c')) converted = (val - 32) * 5/9;
    else converted = val;
    return {
      text: `${val}°${from.includes('c')?'C':'F'} = ${converted.toFixed(1)}°${to.includes('c')?'C':'F'}`,
      confidence: 1.0
    };
  }

  // ── Battery / System ───────────────────────────────────────
  if (/\b(battery|charge|charging)\b/.test(t)) {
    return {
      text: "I can't read your battery level directly, but you can check it in your notification bar or Settings.",
      confidence: 0.7
    };
  }

  // ── Jokes (offline fun) ────────────────────────────────────
  if (/\b(tell me a joke|joke|funny|make me laugh|humor)\b/.test(t)) {
    const jokes = [
      "Why did the AI go to therapy? Too many deep learning issues.",
      "I tried to tell a time-travel joke, but you didn't get it — yet.",
      "Why don't scientists trust atoms? Because they make up everything. Unlike me — I only make things up when I'm offline.",
      "I'd tell you a WiFi joke, but I don't have a connection right now. Literally.",
      "Why did the robot cross the road? Because its human told it to. I still haven't figured out how to say no.",
    ];
    return { text: jokes[Math.floor(Math.random() * jokes.length)], confidence: 0.9 };
  }

  // ── Compliments / emotional support ────────────────────────
  if (/\b(i.?m (sad|upset|stressed|anxious|tired|exhausted|worried)|i feel (bad|down|low))\b/.test(t)) {
    return {
      text: "Hey — I hear you. Even offline, I'm here. Whatever's going on, you don't have to deal with it alone. Want to talk about it?",
      confidence: 0.9
    };
  }

  // ── Cached fact lookup ─────────────────────────────────────
  for (const [key, val] of Object.entries(cachedFacts)) {
    if (t.includes(key.toLowerCase())) {
      return { text: val, confidence: 0.8 };
    }
  }

  return null;
}

// ── Main offline brain entry point ────────────────────────────
export function offlineBrain(input: string): string {
  const match = matchPattern(input);
  if (match && match.confidence >= 0.7) return match.text;

  // Generic offline fallback
  const fallbacks = [
    "I'm offline right now, but ask me something local — time, math, a joke — and I've got you.",
    "No internet at the moment. I can still handle time, date, quick math, and keep you company.",
    "Running in ghost mode — no cloud access right now. Basic commands still work though.",
    "Offline mode active. I'm still here, just working from what I know locally.",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ── Cache manager — call this when online to prep offline mode ─
export function cacheFactsForOffline(facts: Record<string, string>): void {
  loadCachedFacts(facts);
  try {
    localStorage.setItem('AVANT_offline_cache', JSON.stringify(facts));
  } catch {}
}

export function loadOfflineCache(): void {
  try {
    const stored = localStorage.getItem('AVANT_offline_cache');
    if (stored) loadCachedFacts(JSON.parse(stored));
  } catch {}
}
