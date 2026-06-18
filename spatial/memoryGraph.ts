/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Spatial Memory Graph                               ║
 * ║                                                              ║
 * ║  The "brain" of AVANT's world model.                        ║
 * ║  Stores objects, rooms, and relationships as a graph        ║
 * ║  that persists across app sessions via AsyncStorage.        ║
 * ║                                                              ║
 * ║  Graph structure:                                           ║
 * ║    Nodes  = objects, rooms, events                          ║
 * ║    Edges  = located_in, near, seen_with, moved_to           ║
 * ║                                                              ║
 * ║  Zero external dependencies — pure TypeScript.             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Types ─────────────────────────────────────────────────────
export type NodeType = 'object' | 'room' | 'event' | 'person';
export type EdgeRelation =
  | 'located_in'
  | 'near'
  | 'seen_with'
  | 'moved_to'
  | 'belongs_to'
  | 'observed_in';

export interface SpatialNode {
  id:          string;
  type:        NodeType;
  label:       string;
  aliases?:    string[];               // alternate names ("couch" / "sofa")
  position?:   Position3D;
  roomId?:     string;                 // which room this belongs to
  firstSeen:   number;                 // ms timestamp
  lastSeen:    number;
  seenCount:   number;
  confidence:  number;                 // 0-1
  metadata?:   Record<string, unknown>;
}

export interface SpatialEdge {
  id:        string;
  from:      string;                   // node id
  to:        string;                   // node id
  relation:  EdgeRelation;
  weight:    number;                   // 0-1 strength of relationship
  timestamp: number;
  note?:     string;
}

export interface Position3D {
  x:     number;                       // meters, right-positive
  y:     number;                       // meters, up-positive
  z:     number;                       // meters, forward-positive
  conf?: number;                       // position confidence 0-1
}

export interface Room {
  id:          string;
  name:        string;
  firstVisited: number;
  lastVisited:  number;
  visitCount:   number;
  objectIds:    string[];              // node ids of objects in this room
}

export interface MemoryGraphData {
  version:   number;
  nodes:     SpatialNode[];
  edges:     SpatialEdge[];
  rooms:     Room[];
  updatedAt: number;
}

// ── Persistence key ───────────────────────────────────────────
const STORAGE_KEY = 'AVANT_spatial_memory_v1';

// ── In-memory graph ───────────────────────────────────────────
let graph: MemoryGraphData = {
  version:   1,
  nodes:     [],
  edges:     [],
  rooms:     [],
  updatedAt: Date.now(),
};

// ── ID generator ──────────────────────────────────────────────
function uid(prefix = 'n'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Persistence ───────────────────────────────────────────────
export async function saveGraph(): Promise<void> {
  graph.updatedAt = Date.now();
  const json = JSON.stringify(graph);
  try {
    // React Native AsyncStorage
    const { default: AsyncStorage } = await import(
      '@react-native-async-storage/async-storage'
    );
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Web fallback
    try { localStorage.setItem(STORAGE_KEY, json); } catch {}
  }
}

export async function loadGraph(): Promise<void> {
  try {
    let raw: string | null = null;
    try {
      const { default: AsyncStorage } = await import(
        '@react-native-async-storage/async-storage'
      );
      raw = await AsyncStorage.getItem(STORAGE_KEY);
    } catch {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    if (raw) {
      const parsed = JSON.parse(raw) as MemoryGraphData;
      graph = {
        version:   parsed.version   ?? 1,
        nodes:     parsed.nodes     ?? [],
        edges:     parsed.edges     ?? [],
        rooms:     parsed.rooms     ?? [],
        updatedAt: parsed.updatedAt ?? Date.now(),
      };
    }
  } catch (e) {
    console.warn('[MemoryGraph] Load failed, starting fresh:', e);
  }
}

export function getGraph(): Readonly<MemoryGraphData> { return graph; }

export function resetGraph(): void {
  graph = { version: 1, nodes: [], edges: [], rooms: [], updatedAt: Date.now() };
}

// ── Node CRUD ─────────────────────────────────────────────────
export function findNode(label: string): SpatialNode | undefined {
  const l = label.toLowerCase().trim();
  return graph.nodes.find(n =>
    n.label.toLowerCase() === l ||
    n.aliases?.some(a => a.toLowerCase() === l)
  );
}

export function findNodeById(id: string): SpatialNode | undefined {
  return graph.nodes.find(n => n.id === id);
}

export function upsertNode(
  label:      string,
  type:       NodeType = 'object',
  position?:  Position3D,
  roomId?:    string,
  confidence = 0.8,
  metadata?:  Record<string, unknown>
): SpatialNode {
  const existing = findNode(label);
  const now = Date.now();

  if (existing) {
    existing.lastSeen  = now;
    existing.seenCount += 1;
    existing.confidence = Math.min(1, existing.confidence + 0.05);
    if (position) existing.position = position;
    if (roomId)   existing.roomId   = roomId;
    if (metadata) existing.metadata = { ...existing.metadata, ...metadata };
    return existing;
  }

  const node: SpatialNode = {
    id:         uid('n'),
    type,
    label:      label.toLowerCase().trim(),
    firstSeen:  now,
    lastSeen:   now,
    seenCount:  1,
    confidence,
    position,
    roomId,
    metadata,
  };
  graph.nodes.push(node);
  return node;
}

export function removeNode(id: string): void {
  graph.nodes = graph.nodes.filter(n => n.id !== id);
  graph.edges = graph.edges.filter(e => e.from !== id && e.to !== id);
  graph.rooms.forEach(r => {
    r.objectIds = r.objectIds.filter(oid => oid !== id);
  });
}

// ── Edge CRUD ─────────────────────────────────────────────────
export function addEdge(
  fromId:   string,
  toId:     string,
  relation: EdgeRelation,
  weight  = 0.8,
  note?:    string
): SpatialEdge {
  // Avoid duplicate edges of the same type
  const existing = graph.edges.find(
    e => e.from === fromId && e.to === toId && e.relation === relation
  );
  if (existing) {
    existing.weight    = Math.min(1, existing.weight + 0.05);
    existing.timestamp = Date.now();
    return existing;
  }
  const edge: SpatialEdge = {
    id:        uid('e'),
    from:      fromId,
    to:        toId,
    relation,
    weight,
    timestamp: Date.now(),
    note,
  };
  graph.edges.push(edge);
  return edge;
}

export function getEdges(nodeId: string): SpatialEdge[] {
  return graph.edges.filter(e => e.from === nodeId || e.to === nodeId);
}

// ── Room CRUD ─────────────────────────────────────────────────
export function upsertRoom(name: string): Room {
  const existing = graph.rooms.find(
    r => r.name.toLowerCase() === name.toLowerCase()
  );
  const now = Date.now();
  if (existing) {
    existing.lastVisited = now;
    existing.visitCount  += 1;
    return existing;
  }
  const room: Room = {
    id:           uid('r'),
    name:         name.trim(),
    firstVisited: now,
    lastVisited:  now,
    visitCount:   1,
    objectIds:    [],
  };
  graph.rooms.push(room);
  return room;
}

export function getCurrentRoom(): Room | undefined {
  if (!graph.rooms.length) return undefined;
  return [...graph.rooms].sort((a, b) => b.lastVisited - a.lastVisited)[0];
}

export function addObjectToRoom(objectId: string, roomId: string): void {
  const room = graph.rooms.find(r => r.id === roomId);
  if (room && !room.objectIds.includes(objectId)) {
    room.objectIds.push(objectId);
  }
}

// ── Scene ingestion — called after each AI vision analysis ────
export interface DetectedObject {
  label:      string;
  xPct?:      number;    // 0-100
  yPct?:      number;    // 0-100
  importance?: number;   // 0-1
  relation?:  string;    // spatial text e.g. "on the left"
}

export interface SceneSnapshot {
  objects:   DetectedObject[];
  roomGuess?: string;   // AI-suggested room name
  timestamp:  number;
}

export function ingestScene(snapshot: SceneSnapshot): {
  newObjects:   SpatialNode[];
  movedObjects: SpatialNode[];
  room:         Room;
} {
  const room = upsertRoom(snapshot.roomGuess ?? 'Unknown Room');
  const now  = snapshot.timestamp;
  const newObjects:   SpatialNode[] = [];
  const movedObjects: SpatialNode[] = [];

  for (const obj of snapshot.objects) {
    if (!obj.label?.trim()) continue;

    const wasKnown = !!findNode(obj.label);

    // Rough pseudo-3D position from 2D screen percentages
    // x: -1 (left) → +1 (right), z: 1 (far) → 0 (near based on y)
    const pos: Position3D | undefined = (obj.xPct !== undefined && obj.yPct !== undefined)
      ? {
          x:    (obj.xPct - 50) / 50,
          y:    0,
          z:    1 - obj.yPct / 100,
          conf: obj.importance ?? 0.7,
        }
      : undefined;

    const node = upsertNode(
      obj.label,
      'object',
      pos,
      room.id,
      obj.importance ?? 0.75
    );

    addObjectToRoom(node.id, room.id);
    addEdge(node.id, room.id, 'located_in', obj.importance ?? 0.8);

    if (!wasKnown) {
      newObjects.push(node);
    } else if (pos && node.position) {
      const dx = Math.abs((node.position.x ?? 0) - pos.x);
      const dz = Math.abs((node.position.z ?? 0) - pos.z);
      if (dx > 0.3 || dz > 0.3) {
        movedObjects.push(node);
        addEdge(node.id, room.id, 'moved_to', 0.9,
          `Moved at ${new Date(now).toLocaleTimeString()}`);
      }
    }
  }

  // Add seen_with edges between co-located objects
  const roomNodes = snapshot.objects
    .map(o => findNode(o.label))
    .filter(Boolean) as SpatialNode[];
  for (let i = 0; i < roomNodes.length; i++) {
    for (let j = i + 1; j < roomNodes.length; j++) {
      addEdge(roomNodes[i].id, roomNodes[j].id, 'seen_with', 0.6);
    }
  }

  // Auto-save every 5 ingestions
  if (graph.nodes.length % 5 === 0) {
    saveGraph().catch(() => {});
  }

  return { newObjects, movedObjects, room };
}

// ── Change detection between two snapshots ────────────────────
export interface SceneChange {
  type:    'new_object' | 'removed_object' | 'moved_object' | 'room_change';
  label:   string;
  nodeId?: string;
  detail?: string;
}

export function detectChanges(
  previousLabels: string[],
  currentLabels:  string[]
): SceneChange[] {
  const changes: SceneChange[] = [];
  const prevSet = new Set(previousLabels.map(l => l.toLowerCase()));
  const currSet = new Set(currentLabels.map(l => l.toLowerCase()));

  // New objects
  for (const label of currSet) {
    if (!prevSet.has(label)) {
      const node = findNode(label);
      changes.push({ type: 'new_object', label, nodeId: node?.id });
    }
  }
  // Removed objects
  for (const label of prevSet) {
    if (!currSet.has(label)) {
      const node = findNode(label);
      changes.push({ type: 'removed_object', label, nodeId: node?.id,
        detail: node ? `Last seen at ${new Date(node.lastSeen).toLocaleTimeString()}` : undefined
      });
    }
  }
  return changes;
}

// ── Memory queries ────────────────────────────────────────────
export function findObjectLocation(label: string): string {
  const node = findNode(label);
  if (!node) return `I don't have ${label} in my memory.`;

  const room = node.roomId
    ? graph.rooms.find(r => r.id === node.roomId)
    : undefined;
  const when = Math.round((Date.now() - node.lastSeen) / 60000);
  const timeAgo = when < 1 ? 'just now' :
                  when < 60 ? `${when} min ago` :
                  `${Math.round(when / 60)} hrs ago`;

  const posText = node.position
    ? ` (${node.position.x > 0.3 ? 'right' : node.position.x < -0.3 ? 'left' : 'center'})`
    : '';

  return room
    ? `${label} was last seen in the ${room.name}${posText}, ${timeAgo}.`
    : `${label} was last seen ${timeAgo}${posText}.`;
}

export function summarizeRoom(roomName?: string): string {
  const room = roomName
    ? graph.rooms.find(r => r.name.toLowerCase().includes(roomName.toLowerCase()))
    : getCurrentRoom();
  if (!room) return "I haven't mapped any rooms yet.";

  const objs = graph.nodes.filter(n => n.roomId === room.id);
  const recent = objs.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 8);
  const names  = recent.map(o => o.label).join(', ');
  const visits = room.visitCount;
  const lastV  = Math.round((Date.now() - room.lastVisited) / 60000);

  return `${room.name}: ${objs.length} tracked objects — ${names || 'none yet'}. ` +
    `Visited ${visits} time${visits !== 1 ? 's' : ''}, last ${lastV < 1 ? 'just now' : lastV + ' min ago'}.`;
}

export function getRecentActivity(maxItems = 5): string {
  const recent = [...graph.nodes]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, maxItems);
  if (!recent.length) return "No spatial memory yet.";
  return recent.map(n => {
    const when = Math.round((Date.now() - n.lastSeen) / 60000);
    const time = when < 1 ? 'just now' : when < 60 ? `${when}m ago` : `${Math.round(when / 60)}h ago`;
    return `${n.label} (${time})`;
  }).join(', ');
}

export function getGraphStats(): {
  nodeCount: number; edgeCount: number; roomCount: number;
  mostSeenObject: string; oldestMemory: string;
} {
  const byCount = [...graph.nodes].sort((a, b) => b.seenCount - a.seenCount);
  const oldest  = [...graph.nodes].sort((a, b) => a.firstSeen - b.firstSeen);
  return {
    nodeCount:      graph.nodes.length,
    edgeCount:      graph.edges.length,
    roomCount:      graph.rooms.length,
    mostSeenObject: byCount[0]?.label    ?? 'none',
    oldestMemory:   oldest[0]?.label     ?? 'none',
  };
}

// ── AI reasoning query — serialize graph for AI prompt ────────
export function serializeGraphForAI(maxNodes = 30): string {
  const recentNodes = [...graph.nodes]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, maxNodes);

  const nodeLines = recentNodes.map(n => {
    const room  = n.roomId ? graph.rooms.find(r => r.id === n.roomId)?.name : null;
    const when  = Math.round((Date.now() - n.lastSeen) / 60000);
    const time  = when < 1 ? 'just now' : when < 60 ? `${when}m ago` : `${Math.round(when / 60)}h ago`;
    const pos   = n.position ? ` [${n.position.x > 0.2 ? 'right' : n.position.x < -0.2 ? 'left' : 'center'}]` : '';
    return `  - ${n.label}${pos} in ${room ?? '?'} (seen ${n.seenCount}x, last: ${time})`;
  });

  const roomLines = graph.rooms.map(r =>
    `  - ${r.name}: ${r.objectIds.length} objects, visited ${r.visitCount}x`
  );

  return [
    `AVANT Spatial Memory (${graph.nodes.length} objects, ${graph.rooms.length} rooms):`,
    'Objects:',
    ...nodeLines,
    'Rooms:',
    ...roomLines,
  ].join('\n');
}
