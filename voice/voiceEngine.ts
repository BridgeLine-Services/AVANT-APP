/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Voice Engine v3 (FIXED)                            ║
 * ║                                                              ║
 * ║  FIXES:                                                      ║
 * ║  • Wake word "Hey Avant"/"Whats up Avant" continuous loop   ║
 * ║  • AVANT always talks back — TTS on every response          ║
 * ║  • No button required — fully hands-free                    ║
 * ║  • Commands stripped of wake prefix before routing          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { aiRouter } from '../core/aiRouter';
import { offlineBrain } from '../offline/offlineBrain';

const isNative =
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor?.isNative;

// ── Wake word patterns ────────────────────────────────────────
// Matches: "hey avant", "whats up avant", "yo avant", "avant"
const WAKE_PATTERNS = [
  /\b(hey|hi|hello|yo|ok|okay|whats up|what'?s up|sup|good\s+\w+)\s+avant\b/i,
  /^avant[\s,!.?]*/i,
  /\bavant\b/i,
];

function isWakeWord(text: string): boolean {
  const t = text.trim().toLowerCase();
  return WAKE_PATTERNS.some(p => p.test(t));
}

function stripWakePrefix(text: string): string {
  return text
    .replace(/^(hey|hi|hello|yo|ok|okay|whats up|what'?s up|sup|good\s+\w+)\s+avant[,\s]*/i, '')
    .replace(/^avant[,\s]*/i, '')
    .trim() || text.trim();
}

// ── TTS — expo-speech primary (works in RN/Expo) ─────────────
export async function speak(text: string, pitch = 1.1, rate = 0.95): Promise<void> {
  const styled = styleVoice(text);
  if (!styled) return;

  // expo-speech (primary — works in React Native)
  try {
    const Speech = require('expo-speech');
    await new Promise<void>((resolve) => {
      Speech.speak(styled, {
        language: 'en-US',
        pitch,
        rate,
        onDone: resolve,
        onError: () => resolve(),
      });
    });
    return;
  } catch (_) {}

  // Capacitor TTS (fallback)
  if (isNative) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.speak({ text: styled, lang: 'en-US', rate, pitch, category: 'ambient' });
      return;
    } catch {}
  }

  // Web Speech API (last resort)
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
    const utter = new SpeechSynthesisUtterance(styled);
    utter.lang = 'en-US'; utter.pitch = pitch; utter.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const female = voices.find(v => /samantha|victoria|karen|female|google us english/i.test(v.name));
    if (female) utter.voice = female;
    utter.onend = () => resolve(); utter.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

// ── STT single capture ────────────────────────────────────────
async function listenOnce(timeoutMs = 8000): Promise<string> {
  if (isNative) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      const perm = await SpeechRecognition.requestPermissions();
      if (!(perm as any).speechRecognition) throw new Error('Permission denied');
      return new Promise((resolve) => {
        const timer = setTimeout(() => { SpeechRecognition.stop().catch(()=>{}); resolve(''); }, timeoutMs);
        SpeechRecognition.addListener('partialResults', (data: any) => {
          const heard = data.matches?.[0] || '';
          if (heard) { clearTimeout(timer); SpeechRecognition.stop().catch(()=>{}); resolve(heard); }
        });
        SpeechRecognition.start({ language: 'en-US', partialResults: true, popup: false })
          .catch(() => { clearTimeout(timer); resolve(''); });
      });
    } catch {}
  }
  return new Promise((resolve) => {
    const SR = (window as any)?.SpeechRecognition || (window as any)?.webkitSpeechRecognition;
    if (!SR) { resolve(''); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
    const timer = setTimeout(() => { try { rec.stop(); } catch {} resolve(''); }, timeoutMs);
    rec.onresult = (e: any) => { clearTimeout(timer); resolve(e.results[0]?.[0]?.transcript || ''); };
    rec.onerror = () => { clearTimeout(timer); resolve(''); };
    rec.start();
  });
}

// ── Short listen chunk for wake word loop ─────────────────────
async function listenChunk(timeoutMs = 3500): Promise<string> {
  if (isNative) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      return new Promise((resolve) => {
        const timer = setTimeout(() => { SpeechRecognition.stop().catch(()=>{}); resolve(''); }, timeoutMs);
        SpeechRecognition.addListener('partialResults', (data: any) => {
          const heard = data.matches?.[0] || '';
          if (heard) { clearTimeout(timer); SpeechRecognition.stop().catch(()=>{}); resolve(heard); }
        });
        SpeechRecognition.start({ language: 'en-US', partialResults: true, popup: false })
          .catch(() => { clearTimeout(timer); resolve(''); });
      });
    } catch {}
  }
  return new Promise((resolve) => {
    const SR = (window as any)?.SpeechRecognition || (window as any)?.webkitSpeechRecognition;
    if (!SR) { resolve(''); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    const timer = setTimeout(() => { try { rec.stop(); } catch {} resolve(''); }, timeoutMs);
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join(' ').trim();
      if (t) { clearTimeout(timer); try { rec.stop(); } catch {} resolve(t); }
    };
    rec.onerror = () => { clearTimeout(timer); resolve(''); };
    rec.start();
  });
}

function delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// ── Voice formatter ───────────────────────────────────────────
function styleVoice(text: string): string {
  return text
    .replace(/\bI am\b/g, "I'm").replace(/\bI cannot\b/gi, "I can't")
    .replace(/\bI will\b/gi, "I'll").replace(/\bdo not\b/gi, "don't")
    .replace(/\bdoes not\b/gi, "doesn't").replace(/\bwould not\b/gi, "wouldn't")
    .replace(/\bcould not\b/gi, "couldn't").replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/#{1,6}\s/g, '').replace(/•/g, ',').trim();
}

function detectTone(text: string): 'urgent' | 'serious' | 'simple' | 'casual' {
  if (/urgent|emergency|asap|right now|immediately|hurry/i.test(text)) return 'urgent';
  if (/serious|important|professional|formal/i.test(text)) return 'serious';
  if (/simply|7th grade|explain|break.?it.?down|eli5|simple/i.test(text)) return 'simple';
  return 'casual';
}

async function handleBuiltIn(text: string): Promise<string | null> {
  const l = text.toLowerCase().trim();
  if (/^(what.?s the time|what time is it|current time)$/i.test(l))
    return `It's ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
  if (/^(what.?s today|what day|today.?s date|what is today)$/i.test(l))
    return `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`;
  if (/who are you|what are you|your name/i.test(l))
    return "I'm AVANT — your personal AI. Always here, always listening.";
  if (/how are you|you okay/i.test(l)) return "Running perfectly. What do you need?";
  const math = l.match(/^(?:what is |calc |calculate )?(\d+(?:\.\d+)?)\s*([+\-xX×*\/÷])\s*(\d+(?:\.\d+)?)$/);
  if (math) {
    const a = parseFloat(math[1]), b = parseFloat(math[3]), op = math[2];
    const r = op==='+' ? a+b : op==='-' ? a-b : /[xX×*]/.test(op) ? a*b : b!==0 ? a/b : null;
    return r !== null ? `${a} ${op} ${b} = ${parseFloat(r.toFixed(6))}` : "Can't divide by zero.";
  }
  if (/^(stop|cancel|never mind|shut up|quiet|silence)$/i.test(l)) {
    VoiceEngine.stopSpeaking(); return null;
  }
  return null;
}

async function routeCommand(rawText: string): Promise<string> {
  const text = stripWakePrefix(rawText);
  if (!text.trim()) return '';
  const builtin = await handleBuiltIn(text);
  if (builtin !== null) return builtin;

  // Navigate intent
  if (/navigate|go to|take me to|directions to/i.test(text)) {
    const dest = text.replace(/navigate|go to|take me to|directions to/gi, '').trim();
    if (dest) {
      // Emit navigation event for HomeScreen to handle
      if (typeof (global as any).__avantNavigate === 'function') {
        (global as any).__avantNavigate(dest);
      }
      return `Navigating to ${dest}.`;
    }
  }

  try {
    const { handleIntelligenceCommand } = await import('../intelligence/contextEngine');
    let result = '';
    const handled = await handleIntelligenceCommand(text, async (t: string) => { result = t; });
    if (handled && result) return result;
  } catch (e) { console.warn('[Router] Intelligence:', (e as Error).message); }

  try {
    const { handleVisionCommand } = await import('../ar/hudEngine');
    let result = '';
    const handled = await handleVisionCommand(text, () => false, async (t: string) => { result = t; });
    if (handled && result) return result;
  } catch (e) { console.warn('[Router] Vision:', (e as Error).message); }

  try {
    const tone = detectTone(text);
    const answer = await aiRouter(text, tone);
    return answer || offlineBrain(text);
  } catch {
    return offlineBrain(text);
  }
}

// ══════════════════════════════════════════════════════════════
// ── CONTINUOUS WAKE WORD ENGINE ───────────────────────────────
// This is the core fix. Runs a perpetual background loop.
// No button needed — just say "Hey Avant" or "Whats up Avant"
// ══════════════════════════════════════════════════════════════
class WakeWordEngine {
  static running = false;
  static paused = false;

  static start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[WakeWord] Continuous engine started — say "Hey Avant" or "Whats up Avant"');
    this.loop();
  }

  static stop(): void { this.running = false; }
  static setPaused(p: boolean): void { this.paused = p; }

  private static async loop(): Promise<void> {
    while (this.running) {
      try {
        if (this.paused) { await delay(400); continue; }
        const heard = await listenChunk(3500);
        if (!heard) { await delay(150); continue; }
        if (isWakeWord(heard)) {
          console.log('[WakeWord] Triggered:', heard);
          this.paused = true;
          await speak('Yes?', 1.1, 0.95);
          await VoiceEngine.runSession();
          this.paused = false;
        }
      } catch (e) {
        await delay(1200);
      }
    }
  }
}

// ── VoiceEngine public API ────────────────────────────────────
export class VoiceEngine {
  static isActive = false;
  static isSpeaking = false;
  static lastCommand = '';
  static onStateChange: ((s: 'idle'|'listening'|'thinking'|'speaking') => void) | null = null;

  private static setState(s: 'idle'|'listening'|'thinking'|'speaking'): void {
    VoiceEngine.onStateChange?.(s);
    try { (window as any).Capacitor?.Plugins?.AvantPlugin?.updateOverlay?.({ state: s }); } catch {}
  }

  static async runSession(): Promise<void> {
    if (VoiceEngine.isActive) return;
    VoiceEngine.isActive = true;
    WakeWordEngine.setPaused(true);
    try {
      VoiceEngine.setState('listening');
      const transcript = await listenOnce(8000);
      if (!transcript.trim()) { VoiceEngine.setState('idle'); return; }
      VoiceEngine.lastCommand = transcript;
      VoiceEngine.setState('thinking');
      const response = await routeCommand(transcript);
      if (response) {
        VoiceEngine.setState('speaking');
        VoiceEngine.isSpeaking = true;
        await speak(response, 1.1, detectTone(transcript) === 'urgent' ? 1.15 : 0.95);
      }
    } catch (e) {
      await speak("Something went wrong, but I'm still here.");
    } finally {
      VoiceEngine.isSpeaking = false; VoiceEngine.isActive = false;
      VoiceEngine.setState('idle'); WakeWordEngine.setPaused(false);
    }
  }

  static async handleCommand(text: string): Promise<void> {
    if (!text.trim()) return;
    VoiceEngine.isActive = true; VoiceEngine.lastCommand = text;
    try {
      VoiceEngine.setState('thinking');
      const response = await routeCommand(text);
      if (response) {
        VoiceEngine.setState('speaking'); VoiceEngine.isSpeaking = true;
        await speak(response, 1.1, detectTone(text) === 'urgent' ? 1.15 : 0.95);
      }
    } catch { await speak("I hit a snag. Try again?"); }
    finally {
      VoiceEngine.isSpeaking = false; VoiceEngine.isActive = false; VoiceEngine.setState('idle');
    }
  }

  static async justSay(text: string): Promise<void> {
    VoiceEngine.isSpeaking = true; VoiceEngine.setState('speaking');
    await speak(text);
    VoiceEngine.isSpeaking = false; VoiceEngine.setState('idle');
  }

  static stopSpeaking(): void {
    try { require('expo-speech').stop(); } catch {}
    try { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); } catch {}
    VoiceEngine.isSpeaking = false; VoiceEngine.setState('idle');
  }
}

export function initWakeWordBridge(): void {
  WakeWordEngine.start();
}

export { WakeWordEngine };
