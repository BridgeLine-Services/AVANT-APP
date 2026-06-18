/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Life Graph                                         ║
 * ║                                                              ║
 * ║  Extends the spatial memory graph into a full personal      ║
 * ║  knowledge graph that models:                               ║
 * ║    Objects · Rooms · Locations · Projects · Tasks ·         ║
 * ║    Events · Routines · People · Notes                       ║
 * ║                                                              ║
 * ║  PRIVACY-FIRST:                                             ║
 * ║  • Stored 100% locally (AsyncStorage / localStorage)        ║
 * ║  • No data leaves the device without explicit user export   ║
 * ║  • Every entity can be deleted individually or in bulk      ║
 * ║  • Full export to JSON at any time                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Node types ────────────────────────────────────────────────
export type LifeNodeType =
  | 'object'     // physical item
  | 'room'       // space inside a location
  | 'location'   // named place (Home, Office, Gym…)
  | 'project'    // work / personal project
  | 'task'       // actionable item
  | 'event'      // one-time occurrence
  | 'routine'    // recurring pattern
  | 'person'     // someone AVANT has observed
  | 'note';      // free-form annotation

export type LifeEdgeType =
  | 'located_in'         // object → room or location
  | 'belongs_to'         // object / task → project
  | 'part_of'            // room → location
  | 'usually_near'       // object → object (pattern)
  | 'frequently_used_at' // object → time-pattern string
  | 'worked_on_at'       // project → location
  | 'seen_with'          // object co-occurrence
  | 'moved_to'           // object moved (timestamped)
  | 'associated_with'    // generic relationship
  | 'owns'               // person → object
  | 'member_of';         // person → project

// ── Core node ─────────────────────────────────────────────────
export interface LifeNode {
  id:           string;
  type:         LifeNodeType;
  label:        string;
  aliases?:     string[];
  description?: string;
  // Observation stats
  seenCount:    number;
  firstSeen:    number;    // ms
  lastSeen:     number;    // ms
  // Spatial
  locationId?:  string;    // top-level location (Home, Office…)
  roomId?:      string;    // room within location
  position?:    { x: number; y: number; z: number };
  // Confidence in this node's existence
  confidence:   number;    // 0-1
  // User-assigned metadata
  tags?:        string[];
  color?:       string;    // user-assigned label color
  pinned?:      boolean;   // user pinned this node
  // Timestamps
  createdAt:    number;
  updatedAt:    number;
}

export interface LifeEdge {
  id:        string;
  from:      string;         // node id
  to:        string;         // node id
  type:      LifeEdgeType;
  weight:    number;         // 0-1 relationship strength
  note?:     string;
  timestamp: number;
}

// ── Full graph ────────────────────────────────────────────────
export interface LifeGraphData {
  version:      number;
  nodes:        LifeNode[];
  edges:        LifeEdge[];
  locations:    NamedLocation[];
  updatedAt:    number;
  // Privacy settings stored alongside data
  privacySettings: PrivacySettings;
}

export interface NamedLocation {
  id:           string;
  name:         string;      // "Home", "Office", "Gym"…
  roomIds:      string[];
  firstVisited: number;
  lastVisited:  number;
  visitCount:   number;
}

export interface PrivacySettings {
  trackingEnabled:    boolean;
  storeImages:        boolean;
  retentionDays:      number;   // auto-delete entries older than N days (0 = keep forever)
  exportFormat:       'json' | 'csv';
}

// ── Storage ───────────────────────────────────────────────────
const STORAGE_KEY = 'AVANT_life_graph_v1';

let graph: LifeGraphData = {
  version:   1,
  nodes:     [],
  edges:     [],
  locations: [],
  updatedAt: Date.now(),
  privacySettings: {
    trackingEnabled: true,
    storeImages:     false,
    retentionDays:   0,
    exportFormat:    'json',
  },
};

// ── Persistence ───────────────────────────────────────────────
export async function saveLifeGraph(): Promise<void> {
  graph.updatedAt = Date.now();
  const json = JSON.stringify(graph);
  try {
    const { default: AS } = await import('@react-native-async-storage/async-storage');
    await AS.setItem(STORAGE_KEY, json);
  } catch {
    try { localStorage.setItem(STORAGE_KEY, json); } catch {}
  }
}

export async function loadLifeGraph(): Promise<void> {
  try {
    let raw: string | null = null;
    try {
      const { default: AS } = await import('@react-native-async-storage/async-storage');
      raw = await AS.getItem(STORAGE_KEY);
    } catch { raw = localStorage.getItem(STORAGE_KEY); }
    if (raw) {
      const p = JSON.parse(raw) as LifeGraphData;
      graph = {
        version:         p.version   ?? 1,
        nodes:           p.nodes     ?? [],
        edges:           p.edges     ?? [],
        locations:       p.locations ?? [],
        updatedAt:       p.updatedAt ?? Date.now(),
        privacySettings: p.privacySettings ?? graph.privacySettings,
      };
    }
  } catch (e) { console.warn('[LifeGraph] Load failed:', e); }
}

export function getLifeGraph(): Readonly<LifeGraphData> { return graph; }
export function getPrivacySettings(): PrivacySettings { return graph.privacySettings; }

export function updatePrivacySettings(patch: Partial<PrivacySettings>): void {
  graph.privacySettings = { ...graph.privacySettings, ...patch };
  saveLifeGraph().catch(() => {});
}

// ── ID generator ──────────────────────────────────────────────
function uid(prefix = 'lg'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Node CRUD ─────────────────────────────────────────────────
export function findLifeNode(label: string, type?: LifeNodeType): LifeNode | undefined {
  const l = label.toLowerCase().trim();
  return graph.nodes.find(n =>
    (n.label.toLowerCase() === l || n.aliases?.some(a => a.toLowerCase() === l)) &&
    (!type || n.type === type)
  );
}

export function getNodeById(id: string): LifeNode | undefined {
  return graph.nodes.find(n => n.id === id);
}

export function upsertLifeNode(
  label:       string,
  type:        LifeNodeType = 'object',
  opts: {
    aliases?:     string[];
    description?: string;
    locationId?:  string;
    roomId?:      string;
    position?:    { x: number; y: number; z: number };
    confidence?:  number;
    tags?:        string[];
    pinned?:      boolean;
  } = {}
): LifeNode {
  if (!graph.privacySettings.trackingEnabled && type !== 'note') return findLifeNode(label, type) ?? createNode(label, type, opts);
  const existing = findLifeNode(label, type);
  const now = Date.now();
  if (existing) {
    existing.lastSeen   = now;
    existing.updatedAt  = now;
    existing.seenCount += 1;
    existing.confidence = Math.min(1, existing.confidence + 0.03);
    if (opts.locationId) existing.locationId = opts.locationId;
    if (opts.roomId)     existing.roomId     = opts.roomId;
    if (opts.position)   existing.position   = opts.position;
    if (opts.tags)       existing.tags       = [...new Set([...(existing.tags ?? []), ...opts.tags])];
    return existing;
  }
  return createNode(label, type, opts);
}

function createNode(label: string, type: LifeNodeType, opts: any = {}): LifeNode {
  const now = Date.now();
  const node: LifeNode = {
    id:          uid('n'),
    type,
    label:       label.toLowerCase().trim(),
    aliases:     opts.aliases,
    description: opts.description,
    seenCount:   1,
    firstSeen:   now,
    lastSeen:    now,
    createdAt:   now,
    updatedAt:   now,
    locationId:  opts.locationId,
    roomId:      opts.roomId,
    position:    opts.position,
    confidence:  opts.confidence ?? 0.75,
    tags:        opts.tags,
    pinned:      opts.pinned,
  };
  graph.nodes.push(node);
  return node;
}

export function deleteNode(id: string): void {
  graph.nodes = graph.nodes.filter(n => n.id !== id);
  graph.edges = graph.edges.filter(e => e.from !== id && e.to !== id);
  saveLifeGraph().catch(() => {});
}

export function deleteNodesByType(type: LifeNodeType): number {
  const ids = graph.nodes.filter(n => n.type === type).map(n => n.id);
  ids.forEach(deleteNode);
  return ids.length;
}

// ── Edge CRUD ─────────────────────────────────────────────────
export function addLifeEdge(
  fromId: string, toId: string,
  type:   LifeEdgeType,
  weight = 0.7,
  note?:  string
): LifeEdge {
  const existing = graph.edges.find(
    e => e.from === fromId && e.to === toId && e.type === type
  );
  if (existing) {
    existing.weight    = Math.min(1, existing.weight + 0.05);
    existing.timestamp = Date.now();
    return existing;
  }
  const edge: LifeEdge = { id: uid('e'), from: fromId, to: toId, type, weight, note, timestamp: Date.now() };
  graph.edges.push(edge);
  return edge;
}

export function getNodeEdges(nodeId: string): LifeEdge[] {
  return graph.edges.filter(e => e.from === nodeId || e.to === nodeId);
}

export function getConnected(nodeId: string, edgeType?: LifeEdgeType): LifeNode[] {
  return graph.edges
    .filter(e => (e.from === nodeId || e.to === nodeId) && (!edgeType || e.type === edgeType))
    .map(e => getNodeById(e.from === nodeId ? e.to : e.from))
    .filter(Boolean) as LifeNode[];
}

// ── Location CRUD ─────────────────────────────────────────────
export function upsertLocation(name: string): NamedLocation {
  const existing = graph.locations.find(l => l.name.toLowerCase() === name.toLowerCase());
  const now = Date.now();
  if (existing) { existing.lastVisited = now; existing.visitCount++; return existing; }
  const loc: NamedLocation = { id: uid('loc'), name: name.trim(), roomIds: [], firstVisited: now, lastVisited: now, visitCount: 1 };
  graph.locations.push(loc);
  return loc;
}

export function getCurrentLocation(): NamedLocation | undefined {
  return [...graph.locations].sort((a, b) => b.lastVisited - a.lastVisited)[0];
}

// ── Privacy: data controls ────────────────────────────────────
export function clearAllData(): void {
  graph.nodes     = [];
  graph.edges     = [];
  graph.locations = [];
  saveLifeGraph().catch(() => {});
}

export function clearOlderThan(days: number): number {
  const cutoff = Date.now() - days * 86400000;
  const before = graph.nodes.length;
  graph.nodes = graph.nodes.filter(n => n.lastSeen > cutoff || n.pinned);
  const removed = before - graph.nodes.length;
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  graph.edges = graph.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
  if (removed > 0) saveLifeGraph().catch(() => {});
  return removed;
}

export function exportLifeGraph(): string {
  return JSON.stringify({
    exportDate:  new Date().toISOString(),
    version:     graph.version,
    nodes:       graph.nodes,
    edges:       graph.edges,
    locations:   graph.locations,
  }, null, 2);
}

// ── Stats ─────────────────────────────────────────────────────
export function getLifeGraphStats() {
  const byType: Record<string, number> = {};
  graph.nodes.forEach(n => { byType[n.type] = (byType[n.type] ?? 0) + 1; });
  return {
    totalNodes:     graph.nodes.length,
    totalEdges:     graph.edges.length,
    totalLocations: graph.locations.length,
    byType,
    mostSeen:       [...graph.nodes].sort((a, b) => b.seenCount - a.seenCount)[0]?.label ?? 'none',
    oldest:         [...graph.nodes].sort((a, b) => a.firstSeen - b.firstSeen)[0]?.label ?? 'none',
  };
}

// ── Serialize for AI reasoning ─────────────────────────────────
export function serializeLifeGraphForAI(maxNodes = 40): string {
  const recent = [...graph.nodes]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, maxNodes);

  const nodeLines = recent.map(n => {
    const loc  = n.locationId ? graph.locations.find(l => l.id === n.locationId)?.name : null;
    const when = Math.round((Date.now() - n.lastSeen) / 60000);
    const time = when < 1 ? 'just now' : when < 60 ? `${when}m ago` : when < 1440 ? `${Math.round(when/60)}h ago` : `${Math.round(when/1440)}d ago`;
    return `  [${n.type}] ${n.label} — ${loc ?? 'unknown location'}, seen ${n.seenCount}x, last ${time}, conf ${(n.confidence*100).toFixed(0)}%`;
  });

  const locLines = graph.locations.map(l => {
    const when = Math.round((Date.now() - l.lastVisited) / 60000);
    const time = when < 60 ? `${when}m ago` : when < 1440 ? `${Math.round(when/60)}h ago` : `${Math.round(when/1440)}d ago`;
    return `  [location] ${l.name} — visited ${l.visitCount}x, last ${time}`;
  });

  return [
    `AVANT Life Graph (${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.locations.length} locations):`,
    ...nodeLines,
    ...locLines,
  ].join('\n');
}
