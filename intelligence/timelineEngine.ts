/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Timeline Engine                                    ║
 * ║                                                              ║
 * ║  Records a searchable, human-readable life timeline:        ║
 * ║    What happened · Where · When                             ║
 * ║                                                              ║
 * ║  Enables:                                                   ║
 * ║    "When did I last use my headphones?"                     ║
 * ║    "What happened in my office this week?"                  ║
 * ║    "Show me everything that changed Monday"                 ║
 * ║                                                              ║
 * ║  Privacy: stored locally, user can clear/export at will.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { saveLifeGraph, loadLifeGraph, getLifeGraph, getPrivacySettings } from './lifeGraph';

// ── Timeline entry types ──────────────────────────────────────
export type TimelineEventType =
  | 'object_seen'
  | 'object_moved'
  | 'object_missing'    // was seen, now gone
  | 'room_entered'
  | 'location_visited'
  | 'task_completed'
  | 'project_updated'
  | 'routine_detected'
  | 'prediction_made'
  | 'user_note'
  | 'system_event';

export interface TimelineEntry {
  id:          string;
  type:        TimelineEventType;
  timestamp:   number;             // ms
  label:       string;             // human-readable summary
  detail?:     string;             // extra context
  nodeIds?:    string[];           // related life graph node IDs
  locationId?: string;
  roomName?:   string;
  tags?:       string[];
  importance:  number;             // 0-1 — higher = surface proactively
}

// ── Storage ───────────────────────────────────────────────────
const TIMELINE_KEY = 'AVANT_timeline_v1';
const MAX_ENTRIES  = 2000;          // cap to avoid unbounded growth

let timeline: TimelineEntry[] = [];

export async function saveTimeline(): Promise<void> {
  const json = JSON.stringify(timeline.slice(-MAX_ENTRIES));
  try {
    const { default: AS } = await import('@react-native-async-storage/async-storage');
    await AS.setItem(TIMELINE_KEY, json);
  } catch { try { localStorage.setItem(TIMELINE_KEY, json); } catch {} }
}

export async function loadTimeline(): Promise<void> {
  try {
    let raw: string | null = null;
    try {
      const { default: AS } = await import('@react-native-async-storage/async-storage');
      raw = await AS.getItem(TIMELINE_KEY);
    } catch { raw = localStorage.getItem(TIMELINE_KEY); }
    if (raw) timeline = JSON.parse(raw) as TimelineEntry[];
  } catch (e) { console.warn('[Timeline] Load failed:', e); }
}

export function getTimeline(): Readonly<TimelineEntry[]> { return timeline; }

// ── ID generator ──────────────────────────────────────────────
function uid(): string {
  return `te_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Record an event ───────────────────────────────────────────
export function recordEvent(
  type:      TimelineEventType,
  label:     string,
  opts: {
    detail?:     string;
    nodeIds?:    string[];
    locationId?: string;
    roomName?:   string;
    tags?:       string[];
    importance?: number;
  } = {}
): TimelineEntry {
  if (!getPrivacySettings().trackingEnabled) {
    // Return a non-persisted entry when tracking is off
    return { id: uid(), type, timestamp: Date.now(), label, importance: 0, ...opts };
  }

  const entry: TimelineEntry = {
    id:         uid(),
    type,
    timestamp:  Date.now(),
    label,
    detail:     opts.detail,
    nodeIds:    opts.nodeIds,
    locationId: opts.locationId,
    roomName:   opts.roomName,
    tags:       opts.tags,
    importance: opts.importance ?? 0.5,
  };
  timeline.push(entry);

  // Debounced save (don't hit storage every frame)
  if (timeline.length % 10 === 0) saveTimeline().catch(() => {});

  return entry;
}

// ── Convenience recorders ─────────────────────────────────────
export function recordObjectSeen(label: string, roomName: string, locationId?: string, nodeId?: string) {
  return recordEvent('object_seen', `Saw ${label}`, {
    detail:     `In ${roomName}`,
    nodeIds:    nodeId ? [nodeId] : undefined,
    locationId,
    roomName,
    importance: 0.3,
  });
}

export function recordObjectMoved(label: string, fromRoom: string, toRoom: string, nodeId?: string) {
  return recordEvent('object_moved', `${label} moved`, {
    detail:     `From ${fromRoom} → ${toRoom}`,
    nodeIds:    nodeId ? [nodeId] : undefined,
    roomName:   toRoom,
    importance: 0.7,
  });
}

export function recordRoomEntered(roomName: string, locationId?: string) {
  return recordEvent('room_entered', `Entered ${roomName}`, { locationId, roomName, importance: 0.4 });
}

export function recordLocationVisited(locationName: string, locationId?: string) {
  return recordEvent('location_visited', `Visited ${locationName}`, { locationId, importance: 0.5 });
}

export function recordRoutineDetected(description: string, nodeIds?: string[]) {
  return recordEvent('routine_detected', description, { nodeIds, importance: 0.8 });
}

export function recordPrediction(description: string) {
  return recordEvent('prediction_made', description, { importance: 0.9 });
}

export function addUserNote(text: string, tags?: string[]) {
  return recordEvent('user_note', text, { tags, importance: 0.6 });
}

// ── Queries ───────────────────────────────────────────────────
export function getEntriesSince(sinceMs: number): TimelineEntry[] {
  return timeline.filter(e => e.timestamp >= sinceMs);
}

export function getEntriesForDay(date: Date): TimelineEntry[] {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);
  return timeline.filter(e => e.timestamp >= start.getTime() && e.timestamp <= end.getTime());
}

export function getEntriesByType(type: TimelineEventType, limit = 20): TimelineEntry[] {
  return [...timeline].filter(e => e.type === type).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export function getEntriesForNode(nodeId: string): TimelineEntry[] {
  return timeline.filter(e => e.nodeIds?.includes(nodeId));
}

export function getLastSeenEntry(label: string): TimelineEntry | undefined {
  const l = label.toLowerCase();
  return [...timeline]
    .filter(e => e.label.toLowerCase().includes(l) || e.detail?.toLowerCase().includes(l))
    .sort((a, b) => b.timestamp - a.timestamp)[0];
}

export function searchTimeline(query: string, limit = 15): TimelineEntry[] {
  const q = query.toLowerCase();
  return [...timeline]
    .filter(e =>
      e.label.toLowerCase().includes(q) ||
      e.detail?.toLowerCase().includes(q) ||
      e.roomName?.toLowerCase().includes(q) ||
      e.tags?.some(t => t.toLowerCase().includes(q))
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function getRecentHighImportance(limit = 5): TimelineEntry[] {
  return [...timeline]
    .filter(e => e.importance >= 0.7)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

// ── Day summary ───────────────────────────────────────────────
export function getDaySummary(date?: Date): string {
  const d = date ?? new Date();
  const entries = getEntriesForDay(d);
  if (!entries.length) return `Nothing recorded for ${d.toLocaleDateString()}.`;

  const moved    = entries.filter(e => e.type === 'object_moved');
  const seen     = entries.filter(e => e.type === 'object_seen');
  const routines = entries.filter(e => e.type === 'routine_detected');
  const rooms    = [...new Set(entries.map(e => e.roomName).filter(Boolean))];

  const parts: string[] = [
    `${d.toLocaleDateString('en-US', { weekday: 'long' })}: ${entries.length} events.`
  ];
  if (rooms.length)    parts.push(`Spaces: ${rooms.slice(0, 4).join(', ')}.`);
  if (moved.length)    parts.push(`${moved.length} item${moved.length > 1 ? 's' : ''} moved.`);
  if (routines.length) parts.push(`${routines.length} routine${routines.length > 1 ? 's' : ''} detected.`);
  if (seen.length > 5) parts.push(`${seen.length} objects observed.`);
  return parts.join(' ');
}

// ── Week summary ──────────────────────────────────────────────
export function getWeekSummary(): string {
  const now    = Date.now();
  const week   = 7 * 24 * 60 * 60 * 1000;
  const recent = getEntriesSince(now - week);
  if (!recent.length) return "No timeline data for the past week.";

  const days    = new Set(recent.map(e => new Date(e.timestamp).toLocaleDateString())).size;
  const moved   = recent.filter(e => e.type === 'object_moved').length;
  const locs    = [...new Set(recent.map(e => e.locationId).filter(Boolean))].length;
  return `This week: ${recent.length} events across ${days} day${days !== 1 ? 's' : ''}, ${locs} location${locs !== 1 ? 's' : ''}, ${moved} item${moved !== 1 ? 's' : ''} moved.`;
}

// ── Timeline to AI prompt ─────────────────────────────────────
export function serializeTimelineForAI(limit = 30): string {
  const recent = [...timeline]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  const lines = recent.map(e => {
    const when  = new Date(e.timestamp);
    const time  = when.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const where = e.roomName ? ` in ${e.roomName}` : '';
    return `  [${time}] ${e.label}${where}${e.detail ? ' — ' + e.detail : ''}`;
  });

  return [`AVANT Timeline (last ${recent.length} events):`, ...lines].join('\n');
}

// ── Privacy controls ──────────────────────────────────────────
export function clearTimeline(): void {
  timeline = [];
  saveTimeline().catch(() => {});
}

export function clearTimelineOlderThan(days: number): number {
  const cutoff = Date.now() - days * 86400000;
  const before = timeline.length;
  timeline = timeline.filter(e => e.timestamp >= cutoff);
  if (timeline.length !== before) saveTimeline().catch(() => {});
  return before - timeline.length;
}

export function exportTimeline(): string {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    entries:    timeline,
  }, null, 2);
}
