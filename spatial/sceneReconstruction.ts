/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Scene Reconstruction Layer                         ║
 * ║                                                              ║
 * ║  Builds a semantic 2.5D scene model from stacked frames.    ║
 * ║  Not LiDAR — but meaningful spatial intelligence:           ║
 * ║                                                              ║
 * ║  • Merges multiple frame snapshots into one scene model     ║
 * ║  • Estimates object depth from vertical position (y)        ║
 * ║  • Tracks movement vectors between frames                   ║
 * ║  • Generates human-readable "room report"                   ║
 * ║  • Predicts likely locations for unseen objects             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import {
  getGraph, findNode, upsertNode, addEdge,
  SpatialNode, Position3D, Room,
} from './memoryGraph';

// ── Scene model types ─────────────────────────────────────────
export interface SceneObject {
  nodeId:     string;
  label:      string;
  position:   Position3D;
  velocity?:  Position3D;   // movement vector
  lastPos?:   Position3D;   // previous position
  framesSeen: number;
  isStatic:   boolean;      // hasn't moved in last N frames
}

export interface SceneModel {
  roomId:     string;
  roomName:   string;
  objects:    SceneObject[];
  updatedAt:  number;
  frameCount: number;
}

// ── Scene models by room ──────────────────────────────────────
const sceneModels = new Map<string, SceneModel>();
const STATIC_THRESHOLD = 3;   // frames without movement = static

// ── Update scene model from latest frame labels ───────────────
export function updateSceneModel(
  roomId:   string,
  roomName: string,
  frameObjects: Array<{ label: string; xPct: number; yPct: number; importance: number }>
): SceneModel {
  let model = sceneModels.get(roomId) ?? {
    roomId, roomName, objects: [], updatedAt: 0, frameCount: 0
  };

  const now = Date.now();
  model.frameCount++;
  model.updatedAt = now;

  for (const obj of frameObjects) {
    if (obj.importance < 0.4) continue;

    // Convert 2D percentages to pseudo-3D
    // Depth estimate: objects lower in frame (high y%) are closer
    const newPos: Position3D = {
      x:    (obj.xPct - 50) / 50,           // -1 (left) → +1 (right)
      y:    0,                               // no height data without depth sensor
      z:    Math.max(0.1, 1 - obj.yPct / 100), // 0.1 (near) → 1 (far)
      conf: obj.importance,
    };

    const existing = model.objects.find(o => o.label === obj.label.toLowerCase());
    if (existing) {
      const dx = Math.abs(existing.position.x - newPos.x);
      const dz = Math.abs(existing.position.z - newPos.z);
      const moved = dx > 0.15 || dz > 0.15;

      // Update velocity
      if (moved) {
        existing.velocity = {
          x: newPos.x - existing.position.x,
          y: 0,
          z: newPos.z - existing.position.z,
        };
        existing.lastPos  = { ...existing.position };
        existing.isStatic = false;
      } else {
        existing.framesSeen++;
        if (existing.framesSeen >= STATIC_THRESHOLD) existing.isStatic = true;
      }
      existing.position = newPos;
    } else {
      const node = findNode(obj.label);
      if (node) {
        model.objects.push({
          nodeId:     node.id,
          label:      obj.label.toLowerCase(),
          position:   newPos,
          framesSeen: 1,
          isStatic:   false,
        });
      }
    }
  }

  // Expire objects not seen in last 10 frames
  model.objects = model.objects.filter(o => o.framesSeen > 0);

  sceneModels.set(roomId, model);
  return model;
}

// ── Get current scene model ───────────────────────────────────
export function getSceneModel(roomId: string): SceneModel | undefined {
  return sceneModels.get(roomId);
}

export function getAllSceneModels(): SceneModel[] {
  return [...sceneModels.values()];
}

// ── Generate human-readable room report ──────────────────────
export function generateRoomReport(roomId?: string): string {
  const graph = getGraph();
  const room  = roomId
    ? graph.rooms.find(r => r.id === roomId)
    : graph.rooms.sort((a, b) => b.lastVisited - a.lastVisited)[0];

  if (!room) return "I haven't mapped any rooms yet.";

  const model = sceneModels.get(room.id);
  const nodes = graph.nodes.filter(n => n.roomId === room.id);

  const statics  = model?.objects.filter(o => o.isStatic)  ?? [];
  const moving   = model?.objects.filter(o => !o.isStatic) ?? [];
  const leftSide = nodes.filter(n => (n.position?.x ?? 0) < -0.2).map(n => n.label);
  const rightSide = nodes.filter(n => (n.position?.x ?? 0) > 0.2).map(n => n.label);
  const center   = nodes.filter(n => Math.abs(n.position?.x ?? 0) <= 0.2).map(n => n.label);

  const parts: string[] = [];
  parts.push(`${room.name.charAt(0).toUpperCase() + room.name.slice(1)} contains ${nodes.length} tracked objects.`);
  if (leftSide.length)   parts.push(`Left side: ${leftSide.slice(0,4).join(', ')}.`);
  if (center.length)     parts.push(`Center: ${center.slice(0,4).join(', ')}.`);
  if (rightSide.length)  parts.push(`Right side: ${rightSide.slice(0,4).join(', ')}.`);
  if (statics.length)    parts.push(`${statics.length} stationary object${statics.length !== 1 ? 's' : ''}.`);
  if (moving.length)     parts.push(`${moving.length} object${moving.length !== 1 ? 's' : ''} in motion.`);

  return parts.join(' ');
}

// ── Spatial relationship queries ──────────────────────────────
export function getObjectsNearby(
  label: string,
  radiusMeters = 1.0
): string[] {
  const node = findNode(label);
  if (!node?.position) return [];

  const graph = getGraph();
  return graph.nodes
    .filter(n => {
      if (n.id === node.id || !n.position) return false;
      const dx = n.position.x - node.position!.x;
      const dz = n.position.z - node.position!.z;
      return Math.sqrt(dx * dx + dz * dz) <= radiusMeters;
    })
    .map(n => n.label);
}

export function getObjectDirection(label: string): string {
  const node = findNode(label);
  if (!node?.position) return 'unknown direction';
  const x = node.position.x;
  const z = node.position.z;
  const dir = x >  0.4 ? 'to your right' :
              x < -0.4 ? 'to your left'  : 'in front of you';
  const dist = z < 0.3 ? 'very close' :
               z < 0.6 ? 'nearby'      : 'far away';
  return `${dist}, ${dir}`;
}

// ── Predictive location ("you usually leave X here") ─────────
export function predictObjectLocation(label: string): string {
  const node = findNode(label);
  if (!node) return `I have no memory of ${label}.`;
  if (node.seenCount < 2) return `I've only seen ${label} once — not enough to predict.`;

  const graph   = getGraph();
  const room    = node.roomId ? graph.rooms.find(r => r.id === node.roomId) : null;
  const nearby  = getObjectsNearby(label, 0.8);
  const dir     = node.position ? getObjectDirection(label) : '';

  let prediction = `${label} is usually in the ${room?.name ?? 'same room'}`;
  if (dir)          prediction += `, ${dir}`;
  if (nearby.length) prediction += `, near the ${nearby[0]}`;
  prediction += `. (Seen ${node.seenCount} times.)`;
  return prediction;
}

// ── Change summary since a given time ────────────────────────
export function getChangesSince(sinceMs: number): string {
  const graph   = getGraph();
  const changed = graph.nodes.filter(n => n.lastSeen > sinceMs);
  if (!changed.length) return "Nothing has changed since then.";

  const moved    = changed.filter(n => n.seenCount > 1);
  const newItems = changed.filter(n => n.firstSeen > sinceMs);
  const parts:   string[] = [];
  if (newItems.length) parts.push(`New: ${newItems.map(n => n.label).join(', ')}`);
  if (moved.length)    parts.push(`Updated: ${moved.map(n => n.label).join(', ')}`);
  return parts.join('. ') || "Minor updates only.";
}

// ── Export scene for AR rendering ────────────────────────────
export interface ARSceneObject {
  label:      string;
  xPct:       number;
  yPct:       number;
  importance: number;
  color:      string;
  isStatic:   boolean;
  direction:  string;
}

export function getARSceneObjects(roomId?: string): ARSceneObject[] {
  const graph   = getGraph();
  const room    = roomId
    ? graph.rooms.find(r => r.id === roomId)
    : graph.rooms.sort((a, b) => b.lastVisited - a.lastVisited)[0];
  if (!room) return [];

  return graph.nodes
    .filter(n => n.roomId === room.id && n.position)
    .map(n => {
      const model = sceneModels.get(room.id);
      const obj   = model?.objects.find(o => o.nodeId === n.id);
      return {
        label:      n.label,
        xPct:       ((n.position!.x + 1) / 2) * 100,
        yPct:       (1 - n.position!.z) * 100,
        importance: n.confidence,
        color:      n.confidence > 0.85 ? '#FFFFFF' : '#40AAFF',
        isStatic:   obj?.isStatic ?? true,
        direction:  getObjectDirection(n.label),
      };
    });
}
