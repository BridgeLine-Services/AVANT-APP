/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Spatial Engine                                     ║
 * ║                                                              ║
 * ║  Orchestrates the full spatial AI loop:                     ║
 * ║  Vision frame → AI parse → Graph update → Change detect     ║
 * ║  → AR labels → Voice narration → Persist                    ║
 * ║                                                              ║
 * ║  Also handles spatial voice queries:                        ║
 * ║  "Where did I leave my keys?"                               ║
 * ║  "What changed in this room?"                               ║
 * ║  "What has AVANT seen today?"                               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import {
  ingestScene, detectChanges, findObjectLocation,
  summarizeRoom, getRecentActivity, getGraphStats,
  serializeGraphForAI, loadGraph, saveGraph,
  upsertRoom, getGraph, SceneSnapshot, SceneChange,
  SpatialNode,
} from './memoryGraph';

import { visionRouter, ARLabel }    from '../vision/visionRouter';
import { captureVision, resizeBase64, startLiveVision, stopLiveVision }
  from '../vision/cameraEngine';
import { captureScreen }            from '../vision/screenEngine';

// ── Spatial engine state ──────────────────────────────────────
export type SpatialMode = 'off' | 'idle' | 'mapping' | 'query' | 'live_map';

interface SpatialState {
  mode:           SpatialMode;
  currentRoom:    string;
  frameCount:     number;
  lastChanges:    SceneChange[];
  statusText:     string;
  isProcessing:   boolean;
}

let state: SpatialState = {
  mode:         'off',
  currentRoom:  'Unknown',
  frameCount:   0,
  lastChanges:  [],
  statusText:   '',
  isProcessing: false,
};

type StateListener = (s: SpatialState) => void;
const listeners = new Set<StateListener>();

export function subscribeSpatial(fn: StateListener): () => void {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

function emit(patch: Partial<SpatialState>): void {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn({ ...state }));
}

// ── Init — load persisted graph on app start ──────────────────
let _initialized = false;
export async function initSpatialEngine(): Promise<void> {
  if (_initialized) return;
  await loadGraph();
  _initialized = true;
  emit({ mode: 'idle', statusText: 'Spatial memory loaded' });
  const stats = getGraphStats();
  console.log(
    `[Spatial] Loaded: ${stats.nodeCount} objects, ` +
    `${stats.roomCount} rooms, ${stats.edgeCount} edges`
  );
}

// ── Core: process one camera frame through the full pipeline ──
let _previousLabels: string[] = [];

export async function processSpatialFrame(imageBase64: string): Promise<{
  labels:   ARLabel[];
  changes:  SceneChange[];
  room:     string;
  summary:  string;
}> {
  if (state.isProcessing) return { labels: [], changes: [], room: state.currentRoom, summary: '' };
  emit({ isProcessing: true });

  try {
    // ── 1. Ask AI to identify objects with spatial positions + room guess
    const aiResponse = await visionRouter({
      image:  imageBase64,
      prompt: `You are building a spatial map of this environment.

Identify every distinct object visible. For each object return:
- label: short name (max 3 words, lowercase)
- x: horizontal position as % of image width (0=far left, 100=far right)
- y: vertical position as % of image height (0=top, 100=bottom)
- importance: confidence 0.0-1.0

Also guess the room type (bedroom, kitchen, office, living room, bathroom, hallway, outside, unknown).

Return ONLY valid JSON in this exact format:
{
  "room": "living room",
  "objects": [
    {"label": "couch", "x": 45, "y": 60, "importance": 0.92},
    {"label": "coffee table", "x": 50, "y": 75, "importance": 0.85}
  ]
}`,
      mode:   'ar',
      source: 'camera',
    });

    // ── 2. Parse AI response
    let parsed: { room?: string; objects?: any[] } = { room: 'unknown', objects: [] };
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback: extract any recognizable object names
      const words = aiResponse.match(/\b(chair|table|desk|bed|laptop|phone|door|window|couch|tv|book|lamp|cup|bottle|plant|car|person|dog|cat|bag|shelf|monitor|keyboard|mouse|clock|picture)\b/gi);
      parsed.objects = (words || []).map((w, i) => ({ label: w.toLowerCase(), x: 20 + i * 10, y: 50, importance: 0.7 }));
    }

    const objects = (parsed.objects ?? []).filter((o: any) => o.label && o.importance >= 0.4);
    const roomName = parsed.room ?? 'Unknown Room';

    // ── 3. Ingest into memory graph
    const snapshot: SceneSnapshot = {
      objects:    objects.map((o: any) => ({
        label:      String(o.label),
        xPct:       Number(o.x   ?? 50),
        yPct:       Number(o.y   ?? 50),
        importance: Number(o.importance ?? 0.7),
      })),
      roomGuess:  roomName,
      timestamp:  Date.now(),
    };
    const { newObjects, movedObjects, room } = ingestScene(snapshot);

    // ── 4. Detect changes since last frame
    const currentLabels = objects.map((o: any) => String(o.label));
    const changes = detectChanges(_previousLabels, currentLabels);
    _previousLabels = currentLabels;

    // ── 5. Build AR labels for HUD overlay
    const arLabels: ARLabel[] = objects.map((o: any) => ({
      label:      String(o.label),
      xPct:       Number(o.x   ?? 50),
      yPct:       Number(o.y   ?? 50),
      importance: Number(o.importance ?? 0.7),
      color:      getObjectColor(String(o.label), Number(o.importance ?? 0.7)),
    }));

    // ── 6. Build brief summary for voice output
    const newNames    = newObjects.map(n => n.label);
    const movedNames  = movedObjects.map(n => n.label);
    let summary = '';
    if (newNames.length)   summary += `New: ${newNames.join(', ')}. `;
    if (movedNames.length) summary += `Moved: ${movedNames.join(', ')}. `;
    if (!summary)          summary  = `${room.name} — ${objects.length} objects tracked.`;

    emit({
      currentRoom:  room.name,
      frameCount:   state.frameCount + 1,
      lastChanges:  changes,
      statusText:   `${room.name} · ${getGraph().nodes.length} objects mapped`,
      isProcessing: false,
    });

    return { labels: arLabels, changes, room: room.name, summary };

  } catch (e: any) {
    console.error('[Spatial] Frame error:', e.message);
    emit({ isProcessing: false });
    return { labels: [], changes: [], room: state.currentRoom, summary: '' };
  }
}

// ── Colour code objects by type/importance ────────────────────
function getObjectColor(label: string, importance: number): string {
  const l = label.toLowerCase();
  if (/person|human|face|people/.test(l)) return '#FF6644';   // orange — people
  if (/door|exit|window|stair/.test(l))   return '#44FF88';   // green — navigation
  if (/phone|laptop|computer|screen|tv/.test(l)) return '#FFB344'; // amber — tech
  if (/bed|couch|chair|table|desk/.test(l)) return '#40AAFF'; // blue — furniture
  if (importance > 0.85)                  return '#FFFFFF';   // white — high conf
  return '#40AAFF99';                                          // dim blue — default
}

// ── Spatial mapping session ───────────────────────────────────
let _mappingStop = false;

export async function startSpatialMapping(
  stopSignal: () => boolean,
  onFrame: (result: Awaited<ReturnType<typeof processSpatialFrame>>) => void,
  onSpeak: (text: string) => void,
): Promise<void> {
  _mappingStop = false;
  emit({ mode: 'live_map', statusText: 'Spatial mapping active' });

  let spokenRoomNames = new Set<string>();
  let framesSinceSpeak = 0;

  await startLiveVision(async (rawFrame) => {
    if (stopSignal() || _mappingStop) { stopLiveVision(); return; }

    const frame  = await resizeBase64(rawFrame, 640);
    const result = await processSpatialFrame(frame);

    onFrame(result);
    framesSinceSpeak++;

    // Announce new room the first time
    if (result.room && !spokenRoomNames.has(result.room)) {
      spokenRoomNames.add(result.room);
      onSpeak(`Now mapping the ${result.room}.`);
    }

    // Announce important changes
    for (const change of result.changes) {
      if (change.type === 'new_object' && framesSinceSpeak > 2) {
        onSpeak(`I see a ${change.label} here.`);
        framesSinceSpeak = 0;
      }
    }
  }, { stopSignal: () => stopSignal() || _mappingStop });

  await saveGraph();
  emit({ mode: 'idle', statusText: 'Mapping saved', isProcessing: false });
}

export function stopSpatialMapping(): void {
  _mappingStop = true;
  stopLiveVision();
}

// ── Single-shot spatial scan ───────────────────────────────────
export async function runSpatialScan(): Promise<string> {
  emit({ mode: 'mapping', statusText: 'Scanning…', isProcessing: true });
  const raw = await captureVision();
  if (!raw) {
    emit({ mode: 'idle', isProcessing: false });
    return "Can't access camera. Check permissions.";
  }
  const frame  = await resizeBase64(raw, 768);
  const result = await processSpatialFrame(frame);
  await saveGraph();
  emit({ mode: 'idle', isProcessing: false, statusText: result.room });
  return result.summary;
}

// ── AI reasoning over memory graph ───────────────────────────
export async function queryMemory(question: string): Promise<string> {
  emit({ mode: 'query', statusText: 'Thinking…' });

  // Handle simple local queries without calling AI
  const l = question.toLowerCase();
  if (/where.*(is|did|are|left|put|seen)/.test(l)) {
    const match = question.match(/where.*(?:is|did.*leave|are|put|seen)\s+(?:my\s+)?(.+?)(?:\?|$)/i);
    if (match?.[1]) {
      const answer = findObjectLocation(match[1].trim());
      emit({ mode: 'idle' });
      return answer;
    }
  }
  if (/what.*(room|this place|here|around me)/.test(l)) {
    emit({ mode: 'idle' });
    return summarizeRoom();
  }
  if (/what.*changed|anything.*different|what.*moved/.test(l)) {
    const changes = state.lastChanges;
    emit({ mode: 'idle' });
    if (!changes.length) return "Nothing has changed since my last scan.";
    return changes.map(c =>
      c.type === 'new_object'    ? `New: ${c.label}` :
      c.type === 'removed_object' ? `Gone: ${c.label}` :
      c.type === 'moved_object'   ? `Moved: ${c.label}` : c.type
    ).join(', ');
  }
  if (/how many|statistics|memory stats/.test(l)) {
    const s = getGraphStats();
    emit({ mode: 'idle' });
    return `I have ${s.nodeCount} objects mapped across ${s.roomCount} rooms. Most seen: ${s.mostSeenObject}. Oldest memory: ${s.oldestMemory}.`;
  }
  if (/what.*seen|recent.*activity|been.*tracking/.test(l)) {
    emit({ mode: 'idle' });
    return `Recent activity: ${getRecentActivity(6)}`;
  }

  // Full AI reasoning over graph
  try {
    const { aiRouter } = await import('../core/aiRouter');
    const context = serializeGraphForAI(25);
    const answer  = await aiRouter(
      `You are AVANT's spatial memory AI. Use ONLY the following memory to answer the question.\n\n${context}\n\nQuestion: ${question}`,
      'casual'
    );
    emit({ mode: 'idle' });
    return answer;
  } catch (e: any) {
    emit({ mode: 'idle' });
    return "I had trouble searching my spatial memory. Try again?";
  }
}

// ── Voice command router (spatial commands only) ──────────────
export async function handleSpatialCommand(
  command: string,
  stopSignal: () => boolean,
  speak:      (text: string) => Promise<void>
): Promise<boolean> {
  const l = command.toLowerCase();

  if (/start.*(mapping|spatial|scan room|map.*room)|map.*space/i.test(l)) {
    await speak("Starting spatial mapping. I'll build a memory of this space.");
    startSpatialMapping(stopSignal, () => {}, speak); // non-blocking
    return true;
  }
  if (/stop.*(mapping|spatial)|end.*map/i.test(l)) {
    stopSpatialMapping();
    const stats = getGraphStats();
    await speak(`Mapping stopped. I've mapped ${stats.nodeCount} objects across ${stats.roomCount} rooms.`);
    return true;
  }
  if (/quick scan|scan (this|the) room|spatial scan/i.test(l)) {
    const result = await runSpatialScan();
    await speak(result);
    return true;
  }
  if (/where.*i (leave|put|left|last|see)|where is (my|the)/i.test(l)) {
    const answer = await queryMemory(command);
    await speak(answer);
    return true;
  }
  if (/what.*(changed|different|moved|new)|anything.*changed/i.test(l)) {
    const answer = await queryMemory(command);
    await speak(answer);
    return true;
  }
  if (/what.*room|where.*am i|describe.*space|room summary/i.test(l)) {
    const summary = summarizeRoom();
    await speak(summary);
    return true;
  }
  if (/spatial memory|memory stats|how many.*mapped|what.*tracked/i.test(l)) {
    const answer = await queryMemory(command);
    await speak(answer);
    return true;
  }
  if (/what.*seen today|recent activity|what.*been tracking/i.test(l)) {
    await speak(`Here's what I've been tracking: ${getRecentActivity(5)}`);
    return true;
  }

  return false;
}

// ── Export current state read ─────────────────────────────────
export function getSpatialState(): Readonly<SpatialState> { return state; }
