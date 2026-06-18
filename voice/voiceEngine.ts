/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Voice Engine (TypeScript)                          ║
 * ║                                                              ║
 * ║  Full voice pipeline:                                       ║
 * ║  Wake word → STT → Command Router → AI → TTS               ║
 * ║                                                              ║
 * ║  Command routing cascade (in order):                        ║
 * ║  1. Intelligence layer (life graph, timeline, predictions)  ║
 * ║  2. Vision layer (camera scan, screen, AR, live)            ║
 * ║  3. Spatial layer (mapping, room queries, memory)           ║
 * ║  4. Built-in commands (alarms, music, call, settings)       ║
 * ║  5. AI router (Groq → Gemini → GPT-4o → offline)           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { aiRouter }     from '../core/aiRouter';
import { offlineBrain } from '../offline/offlineBrain';

// ── Platform detection ────────────────────────────────────────
const isNative = typeof (window as any).Capacitor !== 'undefined' &&
                 (window as any).Capacitor?.isNative;

// ── TTS — native Capacitor or Web Speech fallback ─────────────
export async function speak(text: string, pitch = 1.1, rate = 0.95): Promise<void> {
  const styled = styleVoice(text);
  if (!styled) return;

  if (isNative) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.speak({ text: styled, lang: 'en-US', rate, pitch, category: 'ambient' });
      return;
    } catch { /* fall through to web */ }
  }

  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
    const utter        = new SpeechSynthesisUtterance(styled);
    utter.lang         = 'en-US';
    utter.pitch        = pitch;
    utter.rate         = rate;
    const voices       = window.speechSynthesis.getVoices();
    const female       = voices.find(v =>
      /samantha|victoria|karen|female|google us english/i.test(v.name)
    );
    if (female) utter.voice = female;
    utter.onend        = () => resolve();
    utter.onerror      = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

// ── STT — native Capacitor or Web Speech fallback ─────────────
async function listenOnce(timeoutMs = 8000): Promise<string> {
  if (isNative) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      const perm = await SpeechRecognition.requestPermissions();
      if (!(perm as any).speechRecognition) throw new Error('Permission denied');

      return new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
          SpeechRecognition.stop().catch(() => {});
          resolve('');
        }, timeoutMs);

        SpeechRecognition.addListener('partialResults', (data: any) => {
          const heard = data.matches?.[0] || '';
          if (heard) {
            clearTimeout(timer);
            SpeechRecognition.stop().catch(() => {});
            resolve(heard);
          }
        });

        SpeechRecognition.start({ language: 'en-US', partialResults: true, popup: false })
          .catch(() => { clearTimeout(timer); resolve(''); });
      });
    } catch { /* fall through */ }
  }

  return new Promise<string>((resolve) => {
    const SR = (window as any)?.SpeechRecognition || (window as any)?.webkitSpeechRecognition;
    if (!SR) { resolve(''); return; }
    const rec           = new SR();
    rec.lang            = 'en-US';
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    const timer = setTimeout(() => { try { rec.stop(); } catch {} resolve(''); }, timeoutMs);
    rec.onresult  = (e: any) => { clearTimeout(timer); resolve(e.results[0]?.[0]?.transcript || ''); };
    rec.onerror   = () => { clearTimeout(timer); resolve(''); };
    rec.start();
  });
}

// ── Voice personality formatter ────────────────────────────────
function styleVoice(text: string): string {
  return text
    .replace(/\bI am\b/g, "I'm")
    .replace(/\bI cannot\b/gi, "I can't")
    .replace(/\bI will\b/gi, "I'll")
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bdoes not\b/gi, "doesn't")
    .replace(/\bwould not\b/gi, "wouldn't")
    .replace(/\bcould not\b/gi, "couldn't")
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/•/g, ',')
    .trim();
}

// ── Tone detector ──────────────────────────────────────────────
function detectTone(text: string): 'urgent' | 'serious' | 'simple' | 'casual' {
  if (/urgent|emergency|asap|right now|immediately|hurry/i.test(text))   return 'urgent';
  if (/serious|important|professional|formal/i.test(text))                return 'serious';
  if (/simply|7th grade|explain|break.?it.?down|eli5|simple/i.test(text)) return 'simple';
  return 'casual';
}

// ── Built-in direct command handler ───────────────────────────
// Fast local responses — no AI call needed
async function handleBuiltIn(text: string): Promise<string | null> {
  const l = text.toLowerCase().trim();

  // Time / date
  if (/^(what.?s the time|what time is it|current time)$/i.test(l))
    return `It's ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
  if (/^(what.?s today|what day|today.?s date|what is today)$/i.test(l))
    return `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`;

  // Self-identification
  if (/who are you|what are you|your name/i.test(l))
    return "I'm AVANT — your personal AI. I'm always here.";
  if (/how are you|you okay/i.test(l))
    return "I'm running great, thanks for asking. What do you need?";

  // Simple math
  const math = l.match(/^(?:what is |calc |calculate )?(\d+(?:\.\d+)?)\s*([+\-×x*\/÷])\s*(\d+(?:\.\d+)?)$/);
  if (math) {
    const a = parseFloat(math[1]), b = parseFloat(math[3]), op = math[2];
    const r = op === '+' ? a + b : op === '-' ? a - b : /[x*×]/.test(op) ? a * b : b !== 0 ? a / b : null;
    return r !== null ? `${a} ${op} ${b} = ${parseFloat(r.toFixed(6))}` : "Can't divide by zero.";
  }

  // Stop / cancel
  if (/^(stop|cancel|never mind|shut up|quiet|silence)$/i.test(l)) {
    VoiceEngine.stopSpeaking();
    return null;   // no spoken response
  }

  return null;   // not handled — pass to next layer
}

// ══════════════════════════════════════════════════════════════
// ── MASTER COMMAND ROUTER ─────────────────────────────────────
// Every voice command flows through here in priority order.
// ══════════════════════════════════════════════════════════════
async function routeCommand(text: string): Promise<string> {
  if (!text.trim()) return '';

  // ── 0. Built-in instant responses ─────────────────────────
  const builtin = await handleBuiltIn(text);
  if (builtin !== null) return builtin;   // null means "stop, no response"

  // ── 1. Intelligence layer — life graph, timeline, patterns,
  //        predictions, spatial queries, notes ─────────────────
  try {
    const { handleIntelligenceCommand } = await import('../intelligence/contextEngine');
    let intelligenceResult = '';
    const speakCapture = async (t: string) => { intelligenceResult = t; };
    const handled = await handleIntelligenceCommand(text, speakCapture);
    if (handled && intelligenceResult) return intelligenceResult;
  } catch (e) {
    console.warn('[VoiceRouter] Intelligence layer error:', (e as Error).message);
  }

  // ── 2. Vision layer — camera, screen, AR, live mode ────────
  try {
    const { handleVisionCommand } = await import('../ar/hudEngine');
    let visionResult = '';
    const speakCapture = async (t: string) => { visionResult = t; };
    const dummyStop   = () => false;
    const handled = await handleVisionCommand(text, dummyStop, speakCapture);
    if (handled && visionResult) return visionResult;
  } catch (e) {
    console.warn('[VoiceRouter] Vision layer error:', (e as Error).message);
  }

  // ── 3. AI router (Groq → Gemini → GPT-4o → offline) ───────
  try {
    const tone   = detectTone(text);
    const answer = await aiRouter(text, tone);
    return answer || offlineBrain(text);
  } catch (e) {
    console.warn('[VoiceRouter] AI router error:', (e as Error).message);
    return offlineBrain(text);
  }
}

// ══════════════════════════════════════════════════════════════
// ── VoiceEngine class ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
export class VoiceEngine {

  static isActive   = false;
  static isSpeaking = false;
  static lastCommand = '';
  static onStateChange: ((state: 'idle' | 'listening' | 'thinking' | 'speaking') => void) | null = null;

  private static setState(state: 'idle' | 'listening' | 'thinking' | 'speaking'): void {
    VoiceEngine.onStateChange?.(state);
    if (isNative) {
      try {
        (window as any).Capacitor?.Plugins?.AvantPlugin?.updateOverlay?.({ state });
      } catch {}
    }
  }

  // ── Full voice session: listen → route → speak ────────────
  static async runSession(): Promise<void> {
    if (VoiceEngine.isActive) return;
    VoiceEngine.isActive = true;
    try {
      VoiceEngine.setState('listening');
      const transcript = await listenOnce(8000);

      if (!transcript.trim()) {
        VoiceEngine.setState('idle');
        return;
      }

      VoiceEngine.lastCommand = transcript;
      VoiceEngine.setState('thinking');

      const response = await routeCommand(transcript);

      if (response) {
        VoiceEngine.setState('speaking');
        VoiceEngine.isSpeaking = true;
        const tone = detectTone(transcript);
        await speak(response, 1.1, tone === 'urgent' ? 1.15 : 0.95);
      }

    } catch (e) {
      console.error('[VoiceEngine] Session error:', e);
      await speak("Something went wrong, but I'm still here.");
    } finally {
      VoiceEngine.isSpeaking = false;
      VoiceEngine.isActive   = false;
      VoiceEngine.setState('idle');
    }
  }

  // ── Handle a pre-transcribed command (from Kotlin layer) ───
  static async handleCommand(text: string): Promise<void> {
    if (!text.trim()) return;
    VoiceEngine.isActive   = true;
    VoiceEngine.lastCommand = text;
    try {
      VoiceEngine.setState('thinking');
      const response = await routeCommand(text);
      if (response) {
        VoiceEngine.setState('speaking');
        VoiceEngine.isSpeaking = true;
        const tone = detectTone(text);
        await speak(response, 1.1, tone === 'urgent' ? 1.15 : 0.95);
      }
    } catch (e) {
      await speak("I hit a snag processing that. Try again?");
    } finally {
      VoiceEngine.isSpeaking = false;
      VoiceEngine.isActive   = false;
      VoiceEngine.setState('idle');
    }
  }

  // ── Speak without full session ────────────────────────────
  static async justSay(text: string): Promise<void> {
    VoiceEngine.isSpeaking = true;
    VoiceEngine.setState('speaking');
    await speak(text);
    VoiceEngine.isSpeaking = false;
    VoiceEngine.setState('idle');
  }

  static stopSpeaking(): void {
    if (isNative) {
      import('@capacitor-community/text-to-speech').then(({ TextToSpeech }) => {
        TextToSpeech.stop().catch(() => {});
      }).catch(() => {});
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    VoiceEngine.isSpeaking = false;
    VoiceEngine.setState('idle');
  }
}

// ── Wake word listener (JS layer) ─────────────────────────────
export function initWakeWordBridge(): void {
  if (!isNative) {
    // Expo Go / web: poll with short Web Speech bursts
    let wakePoll: ReturnType<typeof setInterval> | null = null;

    const pollWakeWord = async () => {
      if (VoiceEngine.isActive || VoiceEngine.isSpeaking) return;
      try {
        const SR = (window as any)?.SpeechRecognition || (window as any)?.webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        rec.lang = 'en-US'; rec.continuous = false; rec.maxAlternatives = 1;
        rec.onresult = async (e: any) => {
          const heard = (e.results[0]?.[0]?.transcript || '').toLowerCase();
          if (heard.includes('avant')) {
            if (wakePoll) clearInterval(wakePoll);
            await VoiceEngine.justSay("Hey, I'm listening.");
            await VoiceEngine.runSession();
            wakePoll = setInterval(pollWakeWord, 4500);
          }
        };
        rec.onerror = () => {};
        rec.start();
        setTimeout(() => { try { rec.stop(); } catch {} }, 3000);
      } catch {}
    };

    wakePoll = setInterval(pollWakeWord, 4500);
    return;
  }

  // Native: listen for Capacitor plugin broadcasts
  try {
    const cap = (window as any).Capacitor;
    cap?.Plugins?.AvantPlugin?.addListener(
      'avantWakeWord', async (_data: any) => {
        await VoiceEngine.justSay("Hey, I'm listening.");
        await VoiceEngine.runSession();
      }
    );
    cap?.Plugins?.AvantPlugin?.addListener(
      'avantCommand', async (data: { command: string }) => {
        await VoiceEngine.handleCommand(data.command);
      }
    );
  } catch (e) {
    console.warn('[VoiceEngine] Native bridge unavailable:', e);
  }
}
