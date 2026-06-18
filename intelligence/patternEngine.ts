/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Pattern Engine                                     ║
 * ║                                                              ║
 * ║  Discovers behavioral patterns from the timeline and        ║
 * ║  life graph:                                                ║
 * ║    • Object location habits ("keys always near door")       ║
 * ║    • Time-of-day routines ("office 9am-5pm weekdays")       ║
 * ║    • Co-occurrence patterns ("charger with laptop")         ║
 * ║    • Routine detection ("leaves for work ~8:30am")          ║
 * ║                                                              ║
 * ║  All pattern discovery runs locally, on-device.             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { getTimeline, TimelineEntry, recordRoutineDetected } from './timelineEngine';
import { getLifeGraph, addLifeEdge, findLifeNode, upsertLifeNode }  from './lifeGraph';

// ── Pattern types ─────────────────────────────────────────────
export interface LocationPattern {
  objectLabel:   string;
  locationName:  string;
  roomName?:     string;
  frequency:     number;   // 0-1 — how often seen there
  count:         number;   // raw observation count
  confidence:    number;   // 0-1
  lastUpdated:   number;
}

export interface TimePattern {
  label:        string;    // "Morning", "Work hours"…
  startHour:    number;    // 0-23
  endHour:      number;    // 0-23
  days:         number[];  // 0=Sun … 6=Sat
  locationName?: string;
  confidence:   number;
  lastUpdated:  number;
}

export interface CoOccurrencePattern {
  objectA:     string;
  objectB:     string;
  coCount:     number;    // times seen together
  confidence:  number;
  lastUpdated: number;
}

export interface RoutinePattern {
  id:           string;
  description:  string;
  timeLabel?:   string;
  days?:        string[];
  steps:        string[];
  confidence:   number;
  lastDetected: number;
}

export interface AllPatterns {
  location:    LocationPattern[];
  time:        TimePattern[];
  coOccurrence: CoOccurrencePattern[];
  routines:    RoutinePattern[];
  updatedAt:   number;
}

// ── In-memory pattern store ───────────────────────────────────
let patterns: AllPatterns = {
  location:    [],
  time:        [],
  coOccurrence: [],
  routines:    [],
  updatedAt:   Date.now(),
};

const PATTERN_KEY = 'AVANT_patterns_v1';

export async function savePatterns(): Promise<void> {
  const json = JSON.stringify(patterns);
  try {
    const { default: AS } = await import('@react-native-async-storage/async-storage');
    await AS.setItem(PATTERN_KEY, json);
  } catch { try { localStorage.setItem(PATTERN_KEY, json); } catch {} }
}

export async function loadPatterns(): Promise<void> {
  try {
    let raw: string | null = null;
    try {
      const { default: AS } = await import('@react-native-async-storage/async-storage');
      raw = await AS.getItem(PATTERN_KEY);
    } catch { raw = localStorage.getItem(PATTERN_KEY); }
    if (raw) patterns = JSON.parse(raw) as AllPatterns;
  } catch {}
}

export function getAllPatterns(): Readonly<AllPatterns> { return patterns; }

// ── Location pattern discovery ────────────────────────────────
export function discoverLocationPatterns(): LocationPattern[] {
  const timeline = getTimeline();
  const seenEvents = timeline.filter(e => e.type === 'object_seen' && e.roomName);

  // Count object-in-room occurrences
  const counts: Record<string, Record<string, number>> = {}; // object → room → count
  for (const e of seenEvents) {
    const obj  = e.label.replace(/^Saw /i, '').toLowerCase();
    const room = e.roomName!;
    if (!counts[obj]) counts[obj] = {};
    counts[obj][room] = (counts[obj][room] ?? 0) + 1;
  }

  const discovered: LocationPattern[] = [];
  for (const [obj, roomCounts] of Object.entries(counts)) {
    const total = Object.values(roomCounts).reduce((s, v) => s + v, 0);
    for (const [room, count] of Object.entries(roomCounts)) {
      const freq = count / total;
      if (freq >= 0.5 && count >= 3) {   // only strong patterns
        discovered.push({
          objectLabel:   obj,
          locationName:  room,
          roomName:      room,
          frequency:     freq,
          count,
          confidence:    Math.min(0.99, freq * 0.8 + count * 0.02),
          lastUpdated:   Date.now(),
        });
        // Reinforce in life graph
        const node = findLifeNode(obj, 'object');
        if (node) {
          addLifeEdge(node.id, node.id, 'usually_near', freq,
            `Usually in ${room} (${(freq*100).toFixed(0)}%)`);
        }
      }
    }
  }

  // Merge with existing
  for (const p of discovered) {
    const existing = patterns.location.find(
      e => e.objectLabel === p.objectLabel && e.roomName === p.roomName
    );
    if (existing) {
      existing.frequency   = p.frequency;
      existing.count       = p.count;
      existing.confidence  = p.confidence;
      existing.lastUpdated = Date.now();
    } else {
      patterns.location.push(p);
    }
  }
  return patterns.location;
}

// ── Time-of-day pattern discovery ─────────────────────────────
export function discoverTimePatterns(): TimePattern[] {
  const timeline = getTimeline();
  const roomEvents = timeline.filter(e => e.type === 'room_entered' && e.roomName);

  // Hour bucket counts per room
  const hourCounts: Record<string, number[]> = {};
  const dayCounts:  Record<string, number[]> = {};

  for (const e of roomEvents) {
    const d   = new Date(e.timestamp);
    const h   = d.getHours();
    const day = d.getDay();
    const key = e.roomName!;
    if (!hourCounts[key]) { hourCounts[key] = new Array(24).fill(0); dayCounts[key] = new Array(7).fill(0); }
    hourCounts[key][h]++;
    dayCounts[key][day]++;
  }

  const discovered: TimePattern[] = [];
  for (const [room, hours] of Object.entries(hourCounts)) {
    const total = hours.reduce((s, v) => s + v, 0);
    if (total < 5) continue;

    // Find peak hours
    const peakHours = hours
      .map((c, h) => ({ h, c }))
      .filter(x => x.c / total > 0.08)
      .map(x => x.h);
    if (!peakHours.length) continue;

    const startH = Math.min(...peakHours);
    const endH   = Math.max(...peakHours);
    const days   = dayCounts[room]
      .map((c, d) => ({ d, c }))
      .filter(x => x.c / total > 0.1)
      .map(x => x.d);

    const label = startH < 6 ? 'Late Night' : startH < 12 ? 'Morning' :
                  startH < 17 ? 'Afternoon' : 'Evening';

    const existing = patterns.time.find(p => p.locationName === room);
    const tp: TimePattern = {
      label:        `${label} in ${room}`,
      startHour:    startH,
      endHour:      endH,
      days,
      locationName: room,
      confidence:   Math.min(0.95, total / 20),
      lastUpdated:  Date.now(),
    };
    if (existing) {
      Object.assign(existing, tp);
    } else {
      patterns.time.push(tp);
      discovered.push(tp);
    }
  }
  return patterns.time;
}

// ── Co-occurrence discovery ────────────────────────────────────
export function discoverCoOccurrencePatterns(): CoOccurrencePattern[] {
  const graph = getLifeGraph();
  const coEdges = graph.edges.filter(e => e.type === 'seen_with');

  const newPatterns: CoOccurrencePattern[] = [];
  for (const edge of coEdges) {
    if (edge.weight < 0.6) continue;
    const a = graph.nodes.find(n => n.id === edge.from);
    const b = graph.nodes.find(n => n.id === edge.to);
    if (!a || !b) continue;

    const existing = patterns.coOccurrence.find(
      p => (p.objectA === a.label && p.objectB === b.label) ||
           (p.objectA === b.label && p.objectB === a.label)
    );
    const p: CoOccurrencePattern = {
      objectA:     a.label,
      objectB:     b.label,
      coCount:     Math.round(edge.weight * 20),
      confidence:  edge.weight,
      lastUpdated: Date.now(),
    };
    if (existing) Object.assign(existing, p);
    else { patterns.coOccurrence.push(p); newPatterns.push(p); }
  }
  return patterns.coOccurrence;
}

// ── Routine detection ──────────────────────────────────────────
export function detectRoutines(): RoutinePattern[] {
  const timeline = getTimeline();
  const now      = Date.now();
  const week     = 7 * 24 * 60 * 60 * 1000;
  const recent   = timeline.filter(e => e.timestamp > now - week);

  const newRoutines: RoutinePattern[] = [];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Detect "morning object check" routine
  const morningEvents = recent.filter(e => {
    const h = new Date(e.timestamp).getHours();
    return h >= 6 && h <= 9 && (e.type === 'object_seen' || e.type === 'room_entered');
  });
  if (morningEvents.length >= 3) {
    const morningDays = [...new Set(morningEvents.map(e => new Date(e.timestamp).getDay()))];
    const r: RoutinePattern = {
      id:           `routine_morning_${Date.now()}`,
      description:  `Morning routine detected (${morningDays.map(d => DAY_NAMES[d]).join(', ')})`,
      timeLabel:    '6-9 AM',
      days:         morningDays.map(d => DAY_NAMES[d]),
      steps:        [...new Set(morningEvents.slice(0, 5).map(e =>
        e.roomName ? `${e.label} in ${e.roomName}` : e.label
      ))],
      confidence:   Math.min(0.9, morningEvents.length / 10),
      lastDetected: now,
    };
    const existing = patterns.routines.find(p => p.id.startsWith('routine_morning'));
    if (existing) Object.assign(existing, r);
    else { patterns.routines.push(r); newRoutines.push(r); recordRoutineDetected(r.description); }
  }

  // Detect "work session" routine
  const workEvents = recent.filter(e => {
    const h = new Date(e.timestamp).getHours();
    const d = new Date(e.timestamp).getDay();
    return h >= 9 && h <= 17 && d >= 1 && d <= 5 && e.roomName?.toLowerCase().includes('office');
  });
  if (workEvents.length >= 4) {
    const r: RoutinePattern = {
      id:           'routine_work_session',
      description:  'Weekday work session detected (office, 9am-5pm)',
      timeLabel:    '9 AM - 5 PM',
      days:         ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      steps:        ['Office environment active', 'Work objects observed'],
      confidence:   Math.min(0.95, workEvents.length / 15),
      lastDetected: now,
    };
    const existing = patterns.routines.find(p => p.id === 'routine_work_session');
    if (existing) { existing.confidence = r.confidence; existing.lastDetected = now; }
    else { patterns.routines.push(r); newRoutines.push(r); recordRoutineDetected(r.description); }
  }

  // Detect "evening wind-down"
  const eveningEvents = recent.filter(e => {
    const h = new Date(e.timestamp).getHours();
    return h >= 20 && h <= 23;
  });
  if (eveningEvents.length >= 3) {
    const r: RoutinePattern = {
      id:           'routine_evening',
      description:  'Evening activity pattern detected',
      timeLabel:    '8 PM - 11 PM',
      steps:        [...new Set(eveningEvents.slice(0, 4).map(e => e.roomName ?? e.label))],
      confidence:   Math.min(0.85, eveningEvents.length / 8),
      lastDetected: now,
    };
    const existing = patterns.routines.find(p => p.id === 'routine_evening');
    if (existing) { existing.confidence = r.confidence; existing.lastDetected = now; }
    else { patterns.routines.push(r); newRoutines.push(r); }
  }

  return patterns.routines;
}

// ── Run full pattern discovery pass ───────────────────────────
export function runPatternDiscovery(): AllPatterns {
  discoverLocationPatterns();
  discoverTimePatterns();
  discoverCoOccurrencePatterns();
  detectRoutines();
  patterns.updatedAt = Date.now();
  savePatterns().catch(() => {});
  return patterns;
}

// ── Pattern queries ───────────────────────────────────────────
export function getObjectLocationPattern(label: string): LocationPattern | undefined {
  const l = label.toLowerCase();
  return patterns.location
    .filter(p => p.objectLabel === l)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

export function getCurrentTimePatterns(): TimePattern[] {
  const h   = new Date().getHours();
  const day = new Date().getDay();
  return patterns.time.filter(p =>
    h >= p.startHour - 1 && h <= p.endHour + 1 &&
    (p.days.length === 0 || p.days.includes(day))
  );
}

export function getActiveRoutines(): RoutinePattern[] {
  const h   = new Date().getHours();
  const day = new Date().getDay();
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return patterns.routines.filter(r => {
    const dayMatch = !r.days?.length || r.days.includes(DAY_NAMES[day]);
    const timeMatch = !r.timeLabel || (() => {
      const [startStr] = r.timeLabel.split('-');
      const startH = parseInt(startStr);
      return Math.abs(h - startH) <= 2;
    })();
    return dayMatch && timeMatch && r.confidence > 0.5;
  });
}

// ── Summarize patterns for AI ──────────────────────────────────
export function serializePatternsForAI(): string {
  const lines: string[] = ['AVANT Behavioral Patterns:'];
  if (patterns.location.length) {
    lines.push('Location habits:');
    patterns.location.slice(0, 10).forEach(p =>
      lines.push(`  ${p.objectLabel} → ${p.roomName} (${(p.confidence*100).toFixed(0)}% confident, seen ${p.count}x)`)
    );
  }
  if (patterns.time.length) {
    lines.push('Time patterns:');
    patterns.time.slice(0, 6).forEach(p =>
      lines.push(`  ${p.locationName}: active ${p.startHour}h-${p.endHour}h (${p.days.length} days/week)`)
    );
  }
  if (patterns.routines.length) {
    lines.push('Routines:');
    patterns.routines.slice(0, 5).forEach(r =>
      lines.push(`  ${r.description} (${(r.confidence*100).toFixed(0)}% confidence)`)
    );
  }
  if (patterns.coOccurrence.length) {
    lines.push('Co-occurrence:');
    patterns.coOccurrence.slice(0, 5).forEach(p =>
      lines.push(`  ${p.objectA} often with ${p.objectB}`)
    );
  }
  return lines.join('\n');
}
