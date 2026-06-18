/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — AR HUD Engine                                      ║
 * ║                                                              ║
 * ║  Iron Man-style floating overlay system:                    ║
 * ║  • Renders AR labels over camera feed                       ║
 * ║  • Manages label lifecycle (fade in/out, expire)            ║
 * ║  • Tracks world memory (what AVANT has seen)                ║
 * ║  • Drives the HUD state machine                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { ARLabel, analyzeForAR, analyzeScene, visionRouter } from '../vision/visionRouter';
import { captureVision, startLiveVision, stopLiveVision, resizeBase64 }
  from '../vision/cameraEngine';
import { captureScreen } from '../vision/screenEngine';

// ── HUD state ─────────────────────────────────────────────────
export type HUDMode = 'off' | 'idle' | 'camera' | 'screen' | 'ar' | 'live';

export interface HUDState {
  mode:         HUDMode;
  labels:       ActiveLabel[];
  statusText:   string;
  scanActive:   boolean;
  lastAnalysis: string;
  frameCount:   number;
}

export interface ActiveLabel extends ARLabel {
  id:          string;
  opacity:     number;   // 0-1 for fade animation
  expiresAt:   number;   // ms timestamp
  isNew:       boolean;  // triggers entrance animation
}

// ── World memory (what AVANT has "seen") ──────────────────────
interface WorldMemoryEntry {
  timestamp:   number;
  labels:      string[];
  description: string;
  source:      'camera' | 'screen';
}

const worldMemory: WorldMemoryEntry[] = [];
const MAX_WORLD_MEMORY = 20;

export function getWorldMemory(): WorldMemoryEntry[] { return [...worldMemory]; }

function rememberScene(labels: string[], description: string, source: 'camera' | 'screen'): void {
  worldMemory.push({ timestamp: Date.now(), labels, description, source });
  if (worldMemory.length > MAX_WORLD_MEMORY) worldMemory.shift();
}

// ── HUD state + subscriber ────────────────────────────────────
let _hudState: HUDState = {
  mode:         'off',
  labels:       [],
  statusText:   '',
  scanActive:   false,
  lastAnalysis: '',
  frameCount:   0,
};

type HUDListener = (state: HUDState) => void;
const _listeners: Set<HUDListener> = new Set();

export function subscribeHUD(fn: HUDListener): () => void {
  _listeners.add(fn);
  fn({ ..._hudState });                          // immediate initial state
  return () => _listeners.delete(fn);
}

function emitHUD(patch: Partial<HUDState>): void {
  _hudState = { ..._hudState, ...patch };
  _listeners.forEach(fn => fn({ ..._hudState }));
}

// ── Label management ──────────────────────────────────────────
function labelId(): string { return `lbl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function setLabels(incoming: ARLabel[]): void {
  const now   = Date.now();
  const ttl   = 5000;   // labels live 5 seconds
  const next: ActiveLabel[] = incoming
    .filter(l => l.importance >= 0.5)   // drop low-confidence labels
    .slice(0, 8)                         // max 8 labels on screen
    .map(l => ({
      ...l,
      id:        labelId(),
      opacity:   0,
      expiresAt: now + ttl,
      isNew:     true,
    }));

  // Fade in
  requestAnimationFrame?.(() => {
    const faded = next.map(l => ({ ...l, opacity: 1, isNew: false }));
    emitHUD({ labels: faded });
  });

  emitHUD({ labels: next });

  // Auto-expire
  setTimeout(() => {
    emitHUD({ labels: [] });
  }, ttl + 500);
}

// ── One-shot snapshot analysis ─────────────────────────────────
export async function runSnapshot(mode: 'camera' | 'screen' = 'camera'): Promise<string> {
  emitHUD({ mode: mode === 'camera' ? 'camera' : 'screen', scanActive: true, statusText: 'Scanning…' });

  const raw = mode === 'camera' ? await captureVision() : await captureScreen();
  if (!raw) {
    emitHUD({ scanActive: false, statusText: 'Camera unavailable' });
    return "I couldn't access the camera. Check permissions.";
  }

  const frame     = await resizeBase64(raw);
  const analysis  = await analyzeScene(frame);

  emitHUD({
    scanActive:   false,
    lastAnalysis: analysis,
    frameCount:   _hudState.frameCount + 1,
    statusText:   'Analysis complete',
    mode:         'idle',
  });

  rememberScene([], analysis, mode);
  return analysis;
}

// ── AR mode: continuous label overlay ─────────────────────────
export async function startARMode(stopSignal: () => boolean): Promise<void> {
  emitHUD({ mode: 'ar', statusText: 'AR Mode Active', scanActive: true });
  let frameCount = 0;

  await startLiveVision(async (frame) => {
    if (stopSignal()) { stopLiveVision(); return; }

    try {
      const small  = await resizeBase64(frame, 512); // smaller = faster AR
      const labels = await analyzeForAR(small);
      setLabels(labels);

      const labelNames = labels.map(l => l.label);
      rememberScene(labelNames, labelNames.join(', '), 'camera');

      frameCount++;
      emitHUD({
        frameCount:  _hudState.frameCount + 1,
        statusText:  `AR Active — ${labels.length} objects`,
        scanActive:  true,
      });
    } catch (e: any) {
      console.error('[HUD] AR frame error:', e.message);
    }
  }, { stopSignal, maxFrames: 200 });

  emitHUD({ mode: 'idle', scanActive: false, statusText: '', labels: [] });
}

// ── Live narration mode ────────────────────────────────────────
export interface LiveNarrationOptions {
  stopSignal:    () => boolean;
  onNarration:   (text: string) => void;   // called with each AI sentence
  intervalMs?:   number;
}

export async function startLiveNarration(opts: LiveNarrationOptions): Promise<void> {
  emitHUD({ mode: 'live', statusText: 'Live Narration Active', scanActive: true });
  const intervalMs = opts.intervalMs ?? 2500;
  let context = '';

  await startLiveVision(async (frame) => {
    if (opts.stopSignal()) { stopLiveVision(); return; }

    try {
      const small   = await resizeBase64(frame, 640);
      const result  = await visionRouter({
        image:  small,
        prompt: `Describe what is happening in one brief sentence.${context ? ` Previously: ${context}` : ''}`,
        mode:   'live',
        source: 'camera',
      });

      if (result) {
        context = result.slice(0, 100);
        opts.onNarration(result);
        emitHUD({ lastAnalysis: result, statusText: 'Narrating…', frameCount: _hudState.frameCount + 1 });
        rememberScene([], result, 'camera');
      }
    } catch (e: any) {
      console.error('[HUD] Live narration frame error:', e.message);
    }
  }, { stopSignal: opts.stopSignal });

  emitHUD({ mode: 'idle', scanActive: false, statusText: '' });
}

// ── Stop all HUD activity ─────────────────────────────────────
export function stopHUD(): void {
  stopLiveVision();
  emitHUD({ mode: 'off', labels: [], scanActive: false, statusText: '' });
}

// ── Voice command → HUD action router ─────────────────────────
export async function handleVisionCommand(
  command: string,
  stopSignal: () => boolean,
  speak: (text: string) => Promise<void>
): Promise<boolean> {
  const l = command.toLowerCase();

  if (/what.*(see|looking at|this|here)|describe|analyze.*(camera|this)/i.test(l)) {
    const result = await runSnapshot('camera');
    await speak(result);
    return true;
  }

  if (/analyze.*screen|what.*(screen|showing|app)|explain.*screen/i.test(l)) {
    const { analyzeScreen } = await import('../vision/visionRouter');
    const raw = await captureScreen();
    if (!raw) { await speak("I can't access the screen right now."); return true; }
    const result = await analyzeScreen(raw);
    await speak(result);
    return true;
  }

  if (/ar mode|start ar|iron man|label.*everything|show labels/i.test(l)) {
    await speak("AR mode activated. I'll label what I see.");
    startARMode(stopSignal); // non-blocking
    return true;
  }

  if (/live mode|narrate|describe.*continuously|keep.*watching/i.test(l)) {
    await speak("Going live. I'll narrate what I see.");
    startLiveNarration({
      stopSignal,
      onNarration: async (text) => { await speak(text); },
    });
    return true;
  }

  if (/stop.*vision|stop.*ar|stop.*live|turn off.*camera|stop.*looking/i.test(l)) {
    stopHUD();
    await speak("Vision mode off.");
    return true;
  }

  if (/what.*saw|remember.*see|what.*seen|memory/i.test(l) && worldMemory.length > 0) {
    const recent = worldMemory.slice(-3).map(m => m.description).join('. ');
    await speak(`Recently I saw: ${recent}`);
    return true;
  }

  // ── Delegate spatial commands ─────────────────────────────
  const { handleSpatialCommand } = await import('../spatial/spatialEngine');
  const spatialHandled = await handleSpatialCommand(command, stopSignal, speak);
  if (spatialHandled) return true;

  return false; // not a vision or spatial command — let regular AI handle it
}
