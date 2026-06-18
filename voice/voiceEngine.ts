/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Voice Engine (TypeScript)                          ║
 * ║                                                              ║
 * ║  Handles the full voice pipeline:                           ║
 * ║  Mic → STT → AI Router → TTS → Response                    ║
 * ║                                                              ║
 * ║  Bridges the JS layer to the native Android services via    ║
 * ║  Capacitor + native broadcast receivers.                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { aiRouter }   from '../core/aiRouter';
import { offlineBrain } from '../offline/offlineBrain';

// ── Platform detection ────────────────────────────────────────
const isNative = typeof (window as any).Capacitor !== 'undefined' &&
                 (window as any).Capacitor.isNative;

// ── TTS abstraction (native or Web Speech API) ─────────────────
async function speak(text: string, pitch = 1.1, rate = 0.95): Promise<void> {
  const styled = styleVoice(text);

  if (isNative) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.speak({ text: styled, lang: 'en-US', rate, pitch, category: 'ambient' });
      return;
    } catch (e) { console.warn('Native TTS failed, falling back to Web Speech'); }
  }

  // Web Speech API fallback (works in Expo Go / browser)
  return new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(styled);
    utter.lang  = 'en-US';
    utter.pitch = pitch;
    utter.rate  = rate;
    const voices = window.speechSynthesis.getVoices();
    // Prefer a female voice
    const female = voices.find(v =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.toLowerCase().includes('google us english female')
    );
    if (female) utter.voice = female;
    utter.onend  = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

// ── STT abstraction (native or Web Speech API) ─────────────────
async function listenOnce(timeoutMs = 7000): Promise<string> {
  if (isNative) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      const perm = await SpeechRecognition.requestPermissions();
      if (!perm.speechRecognition) throw new Error('Permission denied');

      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          SpeechRecognition.stop();
          resolve('');
        }, timeoutMs);

        SpeechRecognition.addListener('partialResults', (data: any) => {
          const heard = data.matches?.[0] || '';
          if (heard) {
            clearTimeout(timer);
            SpeechRecognition.stop();
            resolve(heard);
          }
        });

        SpeechRecognition.start({
          language:       'en-US',
          partialResults: true,
          popup:          false,
        }).catch(reject);
      });
    } catch (e) {
      console.warn('Native STT failed, using Web Speech');
    }
  }

  // Web Speech API fallback
  return new Promise<string>((resolve) => {
    const SR = (window as any).SpeechRecognition ||
               (window as any).webkitSpeechRecognition;
    if (!SR) { resolve(''); return; }

    const rec = new SR();
    rec.lang          = 'en-US';
    rec.continuous    = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    const timer = setTimeout(() => { try { rec.stop(); } catch {} resolve(''); }, timeoutMs);

    rec.onresult = (e: any) => {
      clearTimeout(timer);
      resolve(e.results[0]?.[0]?.transcript || '');
    };
    rec.onerror = () => { clearTimeout(timer); resolve(''); };
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
    // Clean markdown that shouldn't be spoken
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/•/g, ',')
    .trim();
}

// ── Tone detector ──────────────────────────────────────────────
function detectTone(text: string): 'urgent' | 'serious' | 'simple' | 'casual' {
  const l = text.toLowerCase();
  if (/urgent|emergency|asap|right now|immediately|hurry/i.test(l)) return 'urgent';
  if (/serious|important|professional|formal/i.test(l))              return 'serious';
  if (/simply|7th grade|explain|break it down|eli5|simple/i.test(l)) return 'simple';
  return 'casual';
}

// ── Main voice pipeline ────────────────────────────────────────
export class VoiceEngine {

  static isActive    = false;
  static isSpeaking  = false;
  static onStateChange: ((state: 'idle'|'listening'|'thinking'|'speaking') => void) | null = null;

  private static setState(state: 'idle'|'listening'|'thinking'|'speaking') {
    VoiceEngine.onStateChange?.(state);
    // Notify overlay service
    if (isNative) {
      try {
        const { Capacitor } = window as any;
        Capacitor?.Plugins?.AvantPlugin?.updateOverlay?.({ state });
      } catch {}
    }
  }

  // Full voice session: listen → think → speak
  static async runSession(): Promise<void> {
    if (VoiceEngine.isActive) return;
    VoiceEngine.isActive = true;

    try {
      VoiceEngine.setState('listening');
      const transcript = await listenOnce(8000);

      if (!transcript.trim()) {
        VoiceEngine.setState('idle');
        VoiceEngine.isActive = false;
        return;
      }

      VoiceEngine.setState('thinking');
      const tone     = detectTone(transcript);
      const response = await aiRouter(transcript, tone);

      VoiceEngine.setState('speaking');
      VoiceEngine.isSpeaking = true;

      // Adjust speed for urgent mode
      const rate = tone === 'urgent' ? 1.1 : 0.95;
      await speak(response, 1.1, rate);

    } catch (e) {
      console.error('VoiceEngine error:', e);
      await speak("Sorry, something went wrong. I'm still here though.");
    } finally {
      VoiceEngine.isSpeaking = false;
      VoiceEngine.isActive   = false;
      VoiceEngine.setState('idle');
    }
  }

  // Handle a pre-transcribed command (from native Kotlin layer)
  static async handleCommand(text: string): Promise<void> {
    if (!text.trim()) return;
    VoiceEngine.isActive = true;
    try {
      VoiceEngine.setState('thinking');
      const tone     = detectTone(text);
      const response = await aiRouter(text, tone);
      VoiceEngine.setState('speaking');
      VoiceEngine.isSpeaking = true;
      await speak(response, 1.1, tone === 'urgent' ? 1.1 : 0.95);
    } catch (e) {
      await speak("I hit a snag processing that. Try again?");
    } finally {
      VoiceEngine.isSpeaking = false;
      VoiceEngine.isActive   = false;
      VoiceEngine.setState('idle');
    }
  }

  // Quick speak without full session
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
      });
    }
    window.speechSynthesis?.cancel();
    VoiceEngine.isSpeaking = false;
    VoiceEngine.setState('idle');
  }
}

// ── Wake word listener (JS layer) ─────────────────────────────
// Runs when the Kotlin kernel broadcasts a wake-word detection,
// OR when the app is in foreground and the user taps the orb.
export function initWakeWordBridge(): void {
  if (!isNative) {
    // Web / Expo Go: poll with Web Speech API
    let wakePoll: ReturnType<typeof setInterval>;
    const pollWakeWord = async () => {
      if (VoiceEngine.isActive || VoiceEngine.isSpeaking) return;
      try {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        rec.lang = 'en-US'; rec.continuous = false; rec.maxAlternatives = 1;
        rec.onresult = async (e: any) => {
          const heard = e.results[0]?.[0]?.transcript?.toLowerCase() || '';
          if (heard.includes('avant')) {
            clearInterval(wakePoll);
            await VoiceEngine.justSay("Hey, I'm listening.");
            await VoiceEngine.runSession();
            wakePoll = setInterval(pollWakeWord, 4000);
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

  // Native: listen for broadcasts from AvantVoiceKernelService
  try {
    const { Capacitor } = window as any;
    Capacitor?.Plugins?.AvantPlugin?.addListener(
      'avantWakeWord', async (data: { transcript: string }) => {
        console.log('Wake word broadcast received:', data.transcript);
        await VoiceEngine.justSay("Hey, I'm listening.");
        await VoiceEngine.runSession();
      }
    );
    Capacitor?.Plugins?.AvantPlugin?.addListener(
      'avantCommand', async (data: { command: string }) => {
        console.log('Command broadcast received:', data.command);
        await VoiceEngine.handleCommand(data.command);
      }
    );
  } catch (e) {
    console.warn('Native bridge not available:', e);
  }
}
