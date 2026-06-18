/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Prediction Engine                                  ║
 * ║                                                              ║
 * ║  Turns patterns into proactive, useful predictions:         ║
 * ║    "You usually leave for work in 20 min — keys unseen."    ║
 * ║    "Your charger is still on the desk, not in your bag."    ║
 * ║    "Headphones haven't been seen in 4 days."                ║
 * ║                                                              ║
 * ║  Predictions are ranked by relevance:                       ║
 * ║    - Time relevance (is this the right moment to surface?)  ║
 * ║    - Object importance (high-seenCount = high value)        ║
 * ║    - Staleness (unseen for N days = alert)                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import {
  getObjectLocationPattern, getCurrentTimePatterns,
  getActiveRoutines, getAllPatterns,
} from './patternEngine';
import {
  getLifeGraph, findLifeNode, serializeLifeGraphForAI,
} from './lifeGraph';
import {
  getTimeline, getLastSeenEntry, serializeTimelineForAI,
} from './timelineEngine';
import { serializePatternsForAI } from './patternEngine';
import { recordPrediction } from './timelineEngine';

// ── Prediction types ──────────────────────────────────────────
export type PredictionCategory =
  | 'missing_item'        // object not seen recently
  | 'location_reminder'   // "keys usually near door"
  | 'routine_upcoming'    // "you normally leave soon"
  | 'co_occurrence_alert' // "charger not with laptop"
  | 'time_context'        // "it's office time"
  | 'proactive_question'; // "haven't used X in N days"

export interface Prediction {
  id:          string;
  category:    PredictionCategory;
  text:        string;             // human-readable prediction
  detail?:     string;
  confidence:  number;             // 0-1
  urgency:     number;             // 0-1 (higher = surface sooner)
  expiresAt:   number;             // ms — prediction becomes stale
  nodeIds?:    string[];
  actionHint?: string;             // what AVANT can do about it
}

// ── Generate all current predictions ─────────────────────────
export function generatePredictions(): Prediction[] {
  const now         = Date.now();
  const predictions: Prediction[] = [];
  const graph       = getLifeGraph();
  const timeline    = getTimeline();
  const patterns    = getAllPatterns();

  // ── 1. Missing item alerts (not seen for > N hours) ───────
  const MISSING_THRESHOLD_HOURS = [4, 24, 72];  // 4h, 1d, 3d
  for (const node of graph.nodes) {
    if (node.type !== 'object' || node.seenCount < 2) continue;
    const hoursSince = (now - node.lastSeen) / 3600000;
    const threshold  = node.pinned ? 4 : node.seenCount > 10 ? 24 : 72;
    if (hoursSince >= threshold) {
      const locPattern = getObjectLocationPattern(node.label);
      const timeText   = hoursSince < 2 ? 'a couple hours' :
                         hoursSince < 24 ? `${Math.round(hoursSince)} hours` :
                         `${Math.round(hoursSince / 24)} days`;
      predictions.push({
        id:         `missing_${node.id}`,
        category:   'missing_item',
        text:       `${capitalize(node.label)} hasn't been seen in ${timeText}.`,
        detail:     locPattern
          ? `Usually in the ${locPattern.roomName} (${(locPattern.confidence*100).toFixed(0)}% likely).`
          : `Last seen at ${new Date(node.lastSeen).toLocaleString()}.`,
        confidence: Math.min(0.95, hoursSince / (threshold * 3)),
        urgency:    node.pinned ? 0.9 : Math.min(0.8, hoursSince / (threshold * 2)),
        expiresAt:  now + 2 * 3600000,
        nodeIds:    [node.id],
        actionHint: locPattern ? `Check the ${locPattern.roomName}` : undefined,
      });
    }
  }

  // ── 2. Location reminders (pattern-based) ────────────────
  for (const p of patterns.location) {
    if (p.confidence < 0.7) continue;
    const node = findLifeNode(p.objectLabel);
    if (!node) continue;
    const hoursSince = (now - node.lastSeen) / 3600000;
    if (hoursSince > 1 && hoursSince < 24) {    // recently unseen but known habit
      predictions.push({
        id:         `location_${node.id}`,
        category:   'location_reminder',
        text:       `${capitalize(p.objectLabel)} is usually in the ${p.roomName}.`,
        confidence: p.confidence,
        urgency:    0.5,
        expiresAt:  now + 4 * 3600000,
        nodeIds:    [node.id],
      });
    }
  }

  // ── 3. Upcoming routine alerts ─────────────────────────────
  const activeRoutines = getActiveRoutines();
  for (const r of activeRoutines) {
    // Check if any objects typically associated with this routine are missing
    const missingItems: string[] = [];
    for (const pattern of patterns.location) {
      if (pattern.confidence < 0.8) continue;
      const node = findLifeNode(pattern.objectLabel);
      if (node && (now - node.lastSeen) > 2 * 3600000) {
        missingItems.push(pattern.objectLabel);
      }
    }
    predictions.push({
      id:         `routine_${r.id}`,
      category:   'routine_upcoming',
      text:       r.description,
      detail:     missingItems.length
        ? `You may need: ${missingItems.slice(0, 3).join(', ')}.`
        : undefined,
      confidence: r.confidence,
      urgency:    0.7,
      expiresAt:  now + 90 * 60000,
    });
  }

  // ── 4. Co-occurrence alerts ────────────────────────────────
  for (const p of patterns.coOccurrence) {
    if (p.confidence < 0.7) continue;
    const nodeA = findLifeNode(p.objectA);
    const nodeB = findLifeNode(p.objectB);
    if (!nodeA || !nodeB) continue;
    const aRecent = (now - nodeA.lastSeen) < 3600000;
    const bMissing = (now - nodeB.lastSeen) > 4 * 3600000;
    if (aRecent && bMissing) {
      predictions.push({
        id:         `cooccur_${nodeA.id}_${nodeB.id}`,
        category:   'co_occurrence_alert',
        text:       `${capitalize(p.objectB)} is often with your ${p.objectA} — but I haven't seen it recently.`,
        confidence: p.confidence,
        urgency:    0.65,
        expiresAt:  now + 2 * 3600000,
        nodeIds:    [nodeA.id, nodeB.id],
      });
    }
  }

  // ── 5. Time context hints ──────────────────────────────────
  const timePatterns = getCurrentTimePatterns();
  for (const tp of timePatterns) {
    predictions.push({
      id:         `time_${tp.locationName}_${tp.startHour}`,
      category:   'time_context',
      text:       `${tp.label} — typical time for ${tp.locationName}.`,
      confidence: tp.confidence,
      urgency:    0.3,
      expiresAt:  now + 3600000,
    });
  }

  // Sort by urgency desc, deduplicate
  return predictions
    .filter(p => p.confidence >= 0.4)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 10);   // top 10 at any time
}

// ── Proactive briefing ─────────────────────────────────────────
export function getProactiveBriefing(): string {
  const preds   = generatePredictions();
  const urgent  = preds.filter(p => p.urgency >= 0.7).slice(0, 3);
  const context = preds.filter(p => p.category === 'time_context').slice(0, 1);

  if (!urgent.length && !context.length) return '';

  const parts: string[] = [];
  if (context.length) parts.push(context[0].text);
  urgent.forEach(p => {
    parts.push(p.text);
    if (p.detail) parts.push(p.detail);
  });
  return parts.join(' ');
}

// ── AI-powered deep prediction ────────────────────────────────
export async function getAIPrediction(question?: string): Promise<string> {
  try {
    const { aiRouter } = await import('../core/aiRouter');
    const graphContext   = serializeLifeGraphForAI(20);
    const timelineCtx    = serializeTimelineForAI(20);
    const patternCtx     = serializePatternsForAI();
    const preds          = generatePredictions();
    const predText       = preds.slice(0, 5).map(p => `  - ${p.text}${p.detail ? ' ' + p.detail : ''}`).join('\n');

    const prompt = question
      ? `${graphContext}\n\n${timelineCtx}\n\n${patternCtx}\n\nCurrent predictions:\n${predText}\n\nUser question: ${question}`
      : `${graphContext}\n\n${patternCtx}\n\nBased on the patterns above, what are the 2-3 most useful proactive suggestions for the user right now? Keep it brief and practical.`;

    const answer = await aiRouter(prompt, 'casual');
    if (question) recordPrediction(answer.slice(0, 100));
    return answer;
  } catch (e: any) {
    return getProactiveBriefing() || "No predictions available right now.";
  }
}

// ── Voice command handler ─────────────────────────────────────
export async function handlePredictionCommand(
  command: string,
  speak:   (text: string) => Promise<void>
): Promise<boolean> {
  const l = command.toLowerCase();

  if (/predict|what.*should|proactive|heads? up|brief me|morning brief/i.test(l)) {
    const briefing = getProactiveBriefing();
    await speak(briefing || "No urgent predictions right now. Everything looks good.");
    return true;
  }
  if (/pattern|habit|routine|what.*usually|tend to/i.test(l)) {
    const routines = getActiveRoutines();
    if (!routines.length) { await speak("No active routines detected yet. I need more data."); return true; }
    await speak(`Active patterns: ${routines.map(r => r.description).join('. ')}`);
    return true;
  }
  if (/missing|can't find|lost|where.*put|haven't seen/i.test(l)) {
    const missing = generatePredictions().filter(p => p.category === 'missing_item').slice(0, 3);
    if (!missing.length) { await speak("Nothing appears to be missing based on my records."); return true; }
    await speak(missing.map(p => p.text + (p.detail ? ' ' + p.detail : '')).join(' '));
    return true;
  }
  if (/ai.*predict|deep.*predict|think.*what|reason.*about/i.test(l)) {
    const result = await getAIPrediction(command);
    await speak(result);
    return true;
  }
  return false;
}

// ── Utility ───────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
