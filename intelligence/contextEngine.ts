/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Context Engine                                     ║
 * ║                                                              ║
 * ║  Assembles the full "right now" context snapshot:           ║
 * ║    Time · Day · Room · Location · Active patterns ·         ║
 * ║    Recent activity · Pending predictions                    ║
 * ║                                                              ║
 * ║  This is what AVANT consults before every proactive         ║
 * ║  suggestion — the "situation awareness" layer.              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { getCurrentLocation, getLifeGraph, getPrivacySettings } from './lifeGraph';
import { getEntriesSince, getRecentHighImportance }               from './timelineEngine';
import { getCurrentTimePatterns, getActiveRoutines, getAllPatterns } from './patternEngine';
import { generatePredictions, getProactiveBriefing }              from './predictionEngine';

export interface ContextSnapshot {
  // Time
  timestamp:     number;
  timeLabel:     string;           // "Monday morning", "Tuesday afternoon"
  hour:          number;
  dayName:       string;
  isWeekday:     boolean;
  // Space
  currentRoom:   string;
  currentLocation: string;
  // Activity
  recentLabels:  string[];         // objects seen in last 30 min
  activeRoutines: string[];
  timePatterns:  string[];
  // Predictions
  topPredictions: string[];
  proactiveBriefing: string;
  // Graph summary
  nodeCount:     number;
  roomCount:     number;
}

let _lastRoom     = 'Unknown';
let _lastLocation = 'Unknown';

export function updateContextRoom(room: string, location?: string): void {
  _lastRoom     = room;
  if (location) _lastLocation = location;
}

export function buildContextSnapshot(): ContextSnapshot {
  const now  = Date.now();
  const date = new Date(now);
  const h    = date.getHours();
  const dow  = date.getDay();

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeOfDay = h < 5 ? 'late night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
  const timeLabel = `${DAY_NAMES[dow]} ${timeOfDay}`;

  const recentEntries = getEntriesSince(now - 30 * 60000);
  const recentLabels  = [...new Set(recentEntries.map(e => e.label.replace(/^Saw /i, '')))].slice(0, 6);
  const activeR       = getActiveRoutines().map(r => r.description);
  const timeP         = getCurrentTimePatterns().map(p => p.label);
  const preds         = generatePredictions().slice(0, 3).map(p => p.text);
  const briefing      = getProactiveBriefing();
  const graph         = getLifeGraph();

  return {
    timestamp:           now,
    timeLabel,
    hour:                h,
    dayName:             DAY_NAMES[dow],
    isWeekday:           dow >= 1 && dow <= 5,
    currentRoom:         _lastRoom,
    currentLocation:     _lastLocation,
    recentLabels,
    activeRoutines:      activeR,
    timePatterns:        timeP,
    topPredictions:      preds,
    proactiveBriefing:   briefing,
    nodeCount:           graph.nodes.length,
    roomCount:           graph.rooms?.length ?? 0,
  };
}

export function serializeContextForAI(): string {
  const ctx = buildContextSnapshot();
  const lines: string[] = [
    `Context: ${ctx.timeLabel}, ${ctx.currentRoom}, ${ctx.currentLocation}`,
    `Tracking: ${ctx.nodeCount} objects, ${ctx.roomCount} rooms`,
  ];
  if (ctx.recentLabels.length)  lines.push(`Recently seen: ${ctx.recentLabels.join(', ')}`);
  if (ctx.activeRoutines.length) lines.push(`Active routines: ${ctx.activeRoutines.join('; ')}`);
  if (ctx.topPredictions.length) lines.push(`Predictions: ${ctx.topPredictions.join(' | ')}`);
  return lines.join('\n');
}

// ── Init — runs once at app start ────────────────────────────
let _initialized = false;
export async function initContextEngine(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const { loadLifeGraph }  = await import('./lifeGraph');
  const { loadTimeline }   = await import('./timelineEngine');
  const { loadPatterns }   = await import('./patternEngine');

  await Promise.all([loadLifeGraph(), loadTimeline(), loadPatterns()]);

  // Apply retention policy
  const settings = getPrivacySettings();
  if (settings.retentionDays > 0) {
    const { clearTimelineOlderThan } = await import('./timelineEngine');
    const { clearOlderThan }         = await import('./lifeGraph');
    clearTimelineOlderThan(settings.retentionDays);
    clearOlderThan(settings.retentionDays);
  }

  // Run initial pattern discovery (async, non-blocking)
  setTimeout(async () => {
    const { runPatternDiscovery } = await import('./patternEngine');
    runPatternDiscovery();
    console.log('[Context] Pattern discovery complete');
  }, 3000);

  console.log('[Context] Engine initialized');
}

// ── Periodic pattern refresh (call every ~15 min) ─────────────
export async function refreshPatterns(): Promise<void> {
  const { runPatternDiscovery } = await import('./patternEngine');
  runPatternDiscovery();
}

// ── Master voice command router ───────────────────────────────
// Integrates ALL intelligence layers for voice queries
export async function handleIntelligenceCommand(
  command: string,
  speak:   (text: string) => Promise<void>
): Promise<boolean> {
  const l = command.toLowerCase();

  // Delegate to specific engines
  const { handlePredictionCommand } = await import('./predictionEngine');
  if (await handlePredictionCommand(command, speak)) return true;

  const { handleSpatialCommand }    = await import('../spatial/spatialEngine');
  if (await handleSpatialCommand(command, () => false, speak)) return true;

  // Timeline queries
  if (/timeline|what happened|day summary|week summary|history/i.test(l)) {
    const { getDaySummary, getWeekSummary } = await import('./timelineEngine');
    const result = l.includes('week') ? getWeekSummary() : getDaySummary();
    await speak(result);
    return true;
  }
  if (/search.*timeline|find.*when|when did.*last/i.test(l)) {
    const { searchTimeline } = await import('./timelineEngine');
    const match = l.match(/(?:last|when.*did|find.*when).*?(.+?)(?:\?|$)/);
    const term  = match?.[1]?.trim() ?? command;
    const found = searchTimeline(term, 3);
    if (!found.length) { await speak(`Nothing found for "${term}" in my timeline.`); return true; }
    await speak(found.map(e => `${e.label} — ${new Date(e.timestamp).toLocaleDateString()}`).join('. '));
    return true;
  }

  // Note-taking
  if (/note|remember this|log this|jot down/i.test(l)) {
    const { addUserNote } = await import('./timelineEngine');
    const text = command.replace(/^(note|remember|log|jot down)[:\s]*/i, '').trim();
    addUserNote(text);
    await speak(`Got it. I've noted: ${text}`);
    return true;
  }

  // Privacy controls
  if (/clear.*memory|delete.*data|forget.*everything|reset.*spatial/i.test(l)) {
    await speak("To protect you from accidental deletion, please use the Privacy tab in the Spatial screen to clear data.");
    return true;
  }

  // Context briefing
  if (/context|situation|what.*know|current.*state|awareness/i.test(l)) {
    const ctx = serializeContextForAI();
    const { aiRouter } = await import('../core/aiRouter');
    const answer = await aiRouter(`${ctx}\n\nGive a brief, helpful situational summary for the user.`, 'casual');
    await speak(answer);
    return true;
  }

  return false;
}
