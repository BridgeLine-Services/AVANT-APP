/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Spatial OS Screen                                  ║
 * ║                                                              ║
 * ║  Digital twin + memory graph interface.                     ║
 * ║  Shows AVANT's persistent model of your physical world.     ║
 * ║                                                              ║
 * ║  Tabs:                                                      ║
 * ║  🗺  Map     — memory graph visualised as room cards        ║
 * ║  👁  Scan    — spatial scan with live AR label overlay      ║
 * ║  🔍  Query   — voice/text query over spatial memory         ║
 * ║  📊  Stats   — graph statistics + recent activity           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Animated, Dimensions, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';

const { width: W } = Dimensions.get('window');

const C = {
  bg:      '#050510',
  card:    '#0A0A1E',
  border:  '#40AAFF22',
  hud:     '#40AAFF',
  hudDim:  '#40AAFF55',
  ok:      '#44FF88',
  warn:    '#FFB344',
  danger:  '#FF6644',
  text:    '#FFFFFF',
  textDim: '#FFFFFF66',
};

// ── Sub-tab labels ─────────────────────────────────────────────
const TABS = ['Map', 'Scan', 'Query', 'Stats'];

export default function SpatialScreen() {
  const [activeTab,    setActiveTab]    = useState('Map');
  const [spatialState, setSpatialState] = useState(null);
  const [graphData,    setGraphData]    = useState({ nodes: [], rooms: [] });
  const [query,        setQuery]        = useState('');
  const [queryResult,  setQueryResult]  = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [scanResult,   setScanResult]   = useState('');
  const [scanning,     setScanning]     = useState(false);
  const [mapping,      setMapping]      = useState(false);
  const [arLabels,     setARLabels]     = useState([]);
  const [stats,        setStats]        = useState(null);
  const [recentLog,    setRecentLog]    = useState([]);
  const stopRef  = useRef(false);
  const scanAnim = useRef(new Animated.Value(0)).current;

  const speak = useCallback((text) => {
    Speech.speak(text, { language: 'en-US', pitch: 1.1, rate: 0.95 });
  }, []);

  const log = useCallback((line) => {
    setRecentLog(prev => [...prev.slice(-12), `[${new Date().toLocaleTimeString()}] ${line}`]);
  }, []);

  // ── Init engine + subscribe ────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const { initSpatialEngine, subscribeSpatial } = await import('../../spatial/spatialEngine');
        await initSpatialEngine();
        unsub = subscribeSpatial(s => setSpatialState(s));
      } catch (e) { console.warn('Spatial engine not compiled yet:', e.message); }
    })();
    return () => { unsub(); stopRef.current = true; };
  }, []);

  // ── Refresh graph data when tab changes ───────────────────
  useEffect(() => {
    refreshGraph();
  }, [activeTab]);

  const refreshGraph = useCallback(async () => {
    try {
      const { getGraph, getGraphStats, getRecentActivity } = await import('../../spatial/memoryGraph');
      const g = getGraph();
      setGraphData({ nodes: [...g.nodes], rooms: [...g.rooms] });
      setStats(getGraphStats());
      log(`Refreshed — ${g.nodes.length} objects, ${g.rooms.length} rooms`);
    } catch {}
  }, [log]);

  // ── Scan animation ─────────────────────────────────────────
  useEffect(() => {
    if (scanning || mapping) {
      Animated.loop(Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])).start();
    } else { scanAnim.stopAnimation(); }
  }, [scanning, mapping]);

  // ── Actions ────────────────────────────────────────────────
  const handleQuickScan = useCallback(async () => {
    setScanning(true); setScanResult('');
    log('Quick scan started');
    try {
      const { runSpatialScan } = await import('../../spatial/spatialEngine');
      const result = await runSpatialScan();
      setScanResult(result);
      speak(result);
      log(`Scan: ${result.slice(0, 60)}`);
      await refreshGraph();
    } catch (e) {
      setScanResult("Scan failed — check camera permissions.");
    } finally { setScanning(false); }
  }, [speak, log, refreshGraph]);

  const handleStartMapping = useCallback(async () => {
    if (mapping) {
      stopRef.current = true;
      const { stopSpatialMapping } = await import('../../spatial/spatialEngine');
      stopSpatialMapping();
      setMapping(false);
      speak("Mapping stopped.");
      await refreshGraph();
      return;
    }
    stopRef.current = false;
    setMapping(true);
    log('Live mapping started');
    speak("Starting spatial mapping. I'll build a memory of this space.");
    try {
      const { startSpatialMapping } = await import('../../spatial/spatialEngine');
      await startSpatialMapping(
        () => stopRef.current,
        (result) => {
          setARLabels(result.labels);
          if (result.changes.length) {
            log(`Changes: ${result.changes.map(c => c.label).join(', ')}`);
          }
        },
        speak,
      );
    } catch (e) {
      log('Mapping error: ' + e.message);
    } finally { setMapping(false); await refreshGraph(); }
  }, [mapping, speak, log, refreshGraph]);

  const handleQuery = useCallback(async (q) => {
    if (!q.trim()) return;
    setQueryLoading(true); setQueryResult('');
    log(`Query: "${q}"`);
    try {
      const { queryMemory } = await import('../../spatial/spatialEngine');
      const answer = await queryMemory(q);
      setQueryResult(answer);
      speak(answer);
      log(`Answer: ${answer.slice(0, 60)}`);
    } catch {
      setQueryResult("Couldn't query spatial memory right now.");
    } finally { setQueryLoading(false); }
  }, [speak, log]);

  const handleVoiceQuery = useCallback(async () => {
    try {
      const SR = window?.SpeechRecognition || window?.webkitSpeechRecognition;
      if (!SR) { speak("Voice not available here — type your question."); return; }
      const rec = new SR();
      rec.lang = 'en-US'; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript || '';
        if (text) { setQuery(text); handleQuery(text); }
      };
      rec.onerror = () => {};
      rec.start();
    } catch {}
  }, [speak, handleQuery]);

  // ── Render helpers ─────────────────────────────────────────
  const RoomCard = ({ room }) => {
    const objects = graphData.nodes.filter(n => n.roomId === room.id);
    const since   = Math.round((Date.now() - room.lastVisited) / 60000);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{room.name}</Text>
          <Text style={styles.cardMeta}>{since < 1 ? 'now' : since < 60 ? `${since}m` : `${Math.round(since/60)}h`} ago</Text>
        </View>
        <Text style={styles.cardSub}>
          {objects.length} objects · {room.visitCount} visit{room.visitCount !== 1 ? 's' : ''}
        </Text>
        <View style={styles.tagRow}>
          {objects.slice(0, 6).map((o, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{o.label}</Text>
            </View>
          ))}
          {objects.length > 6 && (
            <View style={[styles.tag, { borderColor: C.hudDim }]}>
              <Text style={[styles.tagText, { color: C.textDim }]}>+{objects.length - 6}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const ObjectRow = ({ node }) => {
    const room  = graphData.rooms.find(r => r.id === node.roomId);
    const since = Math.round((Date.now() - node.lastSeen) / 60000);
    return (
      <View style={styles.objectRow}>
        <View style={[styles.objDot, { backgroundColor: node.confidence > 0.8 ? C.ok : C.hud }]} />
        <Text style={styles.objLabel}>{node.label}</Text>
        <Text style={styles.objMeta}>{room?.name ?? '?'}</Text>
        <Text style={styles.objTime}>{since < 1 ? 'now' : since < 60 ? `${since}m` : `${Math.round(since/60)}h`}</Text>
      </View>
    );
  };

  const QuickQueryBtn = ({ text }) => (
    <TouchableOpacity style={styles.quickBtn} onPress={() => { setQuery(text); handleQuery(text); }}>
      <Text style={styles.quickBtnText}>{text}</Text>
    </TouchableOpacity>
  );

  // ── Main render ────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={['#0A0A1E', '#050510']} style={styles.header}>
        <Text style={styles.headerTitle}>🧠 SPATIAL OS</Text>
        <Text style={styles.headerSub}>
          {spatialState?.statusText ||
            `${graphData.nodes.length} objects · ${graphData.rooms.length} rooms`}
        </Text>
      </LinearGradient>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── MAP TAB ─────────────────────────────────────── */}
      {activeTab === 'Map' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {graphData.rooms.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🗺</Text>
              <Text style={styles.emptyTitle}>No spatial memory yet</Text>
              <Text style={styles.emptyText}>
                Go to Scan → Quick Scan or Start Mapping to build AVANT's memory of this space.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>ROOMS</Text>
              {graphData.rooms.map(room => <RoomCard key={room.id} room={room} />)}
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>RECENT OBJECTS</Text>
              {[...graphData.nodes]
                .sort((a, b) => b.lastSeen - a.lastSeen)
                .slice(0, 20)
                .map(n => <ObjectRow key={n.id} node={n} />)
              }
            </>
          )}
        </ScrollView>
      )}

      {/* ── SCAN TAB ─────────────────────────────────────── */}
      {activeTab === 'Scan' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Scan status */}
          {(scanning || mapping) && (
            <View style={styles.scanStatus}>
              <ActivityIndicator color={C.hud} size="small" />
              <Text style={styles.scanStatusText}>
                {mapping ? 'Spatial mapping active…' : 'Scanning…'}
              </Text>
            </View>
          )}

          {/* AR label preview */}
          {arLabels.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Live AR Labels</Text>
              <View style={styles.tagRow}>
                {arLabels.slice(0, 8).map((l, i) => (
                  <View key={i} style={[styles.tag, { borderColor: l.color || C.hud }]}>
                    <Text style={[styles.tagText, { color: l.color || C.hud }]}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Scan result */}
          {scanResult ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Last Scan</Text>
              <Text style={styles.resultText}>{scanResult}</Text>
            </View>
          ) : null}

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.btn, scanning && styles.btnDisabled]}
            onPress={handleQuickScan}
            disabled={scanning}>
            <Text style={styles.btnText}>📷  Quick Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, mapping && styles.btnActive]}
            onPress={handleStartMapping}>
            <Text style={styles.btnText}>
              {mapping ? '⏹  Stop Mapping' : '🧿  Start Live Mapping'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSecondary} onPress={refreshGraph}>
            <Text style={styles.btnSecondaryText}>🔄  Refresh Memory</Text>
          </TouchableOpacity>

          {/* Log */}
          {recentLog.length > 0 && (
            <View style={styles.logBox}>
              {recentLog.slice(-6).map((l, i) => (
                <Text key={i} style={styles.logLine}>{l}</Text>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── QUERY TAB ─────────────────────────────────────── */}
      {activeTab === 'Query' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>ASK AVANT ABOUT YOUR SPACE</Text>

          {/* Quick query buttons */}
          <View style={styles.quickBtnRow}>
            <QuickQueryBtn text="Where are my keys?" />
            <QuickQueryBtn text="What's in this room?" />
          </View>
          <View style={styles.quickBtnRow}>
            <QuickQueryBtn text="What changed recently?" />
            <QuickQueryBtn text="What have you tracked?" />
          </View>
          <View style={styles.quickBtnRow}>
            <QuickQueryBtn text="Memory statistics" />
            <QuickQueryBtn text="What did you see today?" />
          </View>

          {/* Text input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Ask anything about your space…"
              placeholderTextColor={C.textDim}
              onSubmitEditing={() => handleQuery(query)}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.inputBtn} onPress={handleVoiceQuery}>
              <Text>🎙</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputBtn} onPress={() => handleQuery(query)}>
              <Text style={{ color: C.hud }}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Result */}
          {queryLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={C.hud} />
              <Text style={styles.loadingText}>Searching spatial memory…</Text>
            </View>
          )}
          {queryResult ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>AVANT:</Text>
              <Text style={styles.resultText}>{queryResult}</Text>
              <TouchableOpacity onPress={() => speak(queryResult)} style={styles.speakBtn}>
                <Text style={styles.speakBtnText}>🔊 Play</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ── STATS TAB ─────────────────────────────────────── */}
      {activeTab === 'Stats' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {stats ? (
            <>
              <View style={styles.statsGrid}>
                {[
                  { label: 'Objects',   value: stats.nodeCount     },
                  { label: 'Rooms',     value: stats.roomCount     },
                  { label: 'Relations', value: getGraph()?.edges?.length ?? '—' },
                  { label: 'Sessions',  value: graphData.rooms.reduce((s, r) => s + r.visitCount, 0) },
                ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Memory Highlights</Text>
                <Text style={styles.cardSub}>Most seen: <Text style={{ color: C.hud }}>{stats.mostSeenObject}</Text></Text>
                <Text style={styles.cardSub}>Oldest memory: <Text style={{ color: C.warn }}>{stats.oldestMemory}</Text></Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent Activity</Text>
                {[...graphData.nodes]
                  .sort((a, b) => b.lastSeen - a.lastSeen)
                  .slice(0, 8)
                  .map((n, i) => {
                    const since = Math.round((Date.now() - n.lastSeen) / 60000);
                    return (
                      <View key={n.id} style={styles.activityRow}>
                        <Text style={styles.activityDot}>◉</Text>
                        <Text style={styles.activityLabel}>{n.label}</Text>
                        <Text style={styles.activityTime}>
                          {since < 1 ? 'now' : since < 60 ? `${since}m` : `${Math.round(since/60)}h`}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>No data yet</Text>
              <Text style={styles.emptyText}>Run a scan to start building spatial memory.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  header:    { paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { color: C.hud, fontFamily: 'monospace', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  headerSub:   { color: C.textDim, fontFamily: 'monospace', fontSize: 10, marginTop: 4, letterSpacing: 1 },
  tabBar:      { flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.card },
  tabBtn:      { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive:{ borderBottomWidth: 2, borderBottomColor: C.hud },
  tabLabel:    { color: C.textDim, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 },
  tabLabelActive: { color: C.hud },
  scroll:    { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionLabel:  { color: C.hudDim, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, marginBottom: 10 },
  // Cards
  card:      { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 12 },
  cardHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { color: C.text, fontFamily: 'monospace', fontSize: 13, fontWeight: '600' },
  cardMeta:  { color: C.hudDim, fontFamily: 'monospace', fontSize: 10 },
  cardSub:   { color: C.textDim, fontSize: 12, marginTop: 2 },
  tagRow:    { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  tag:       { borderWidth: 1, borderColor: C.hud, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  tagText:   { color: C.hud, fontFamily: 'monospace', fontSize: 9 },
  // Object rows
  objectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderColor: C.border },
  objDot:    { width: 7, height: 7, borderRadius: 4, marginRight: 10 },
  objLabel:  { flex: 1, color: C.text, fontSize: 13 },
  objMeta:   { color: C.hudDim, fontFamily: 'monospace', fontSize: 10, marginRight: 8 },
  objTime:   { color: C.textDim, fontFamily: 'monospace', fontSize: 9, width: 30, textAlign: 'right' },
  // Buttons
  btn:       { borderWidth: 1, borderColor: C.hud, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginBottom: 10, backgroundColor: '#40AAFF0F' },
  btnActive: { backgroundColor: '#40AAFF33', borderColor: C.ok },
  btnDisabled: { opacity: 0.4 },
  btnText:   { color: C.hud, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  btnSecondary: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  btnSecondaryText: { color: C.textDim, fontFamily: 'monospace', fontSize: 11 },
  // Quick query btns
  quickBtnRow:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickBtn:     { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 9, alignItems: 'center', backgroundColor: C.card },
  quickBtnText: { color: C.textDim, fontSize: 11, textAlign: 'center' },
  // Input
  inputRow:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 10, marginBottom: 14, backgroundColor: C.card },
  input:     { flex: 1, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 },
  inputBtn:  { padding: 12 },
  // Results
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  loadingText:{ color: C.textDim, fontFamily: 'monospace', fontSize: 11 },
  resultCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hud + '44', borderRadius: 10, padding: 16, marginBottom: 12 },
  resultLabel:{ color: C.hud, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, marginBottom: 8 },
  resultText: { color: C.text, fontSize: 14, lineHeight: 22 },
  speakBtn:   { marginTop: 10, alignSelf: 'flex-end' },
  speakBtnText:{ color: C.hudDim, fontFamily: 'monospace', fontSize: 10 },
  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard:  { flex: 1, minWidth: (W - 52) / 2, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, alignItems: 'center' },
  statValue: { color: C.hud, fontFamily: 'monospace', fontSize: 26, fontWeight: '700' },
  statLabel: { color: C.textDim, fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginTop: 4 },
  activityRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  activityDot:  { color: C.ok, fontSize: 9, marginRight: 10 },
  activityLabel:{ flex: 1, color: C.text, fontSize: 12 },
  activityTime: { color: C.textDim, fontFamily: 'monospace', fontSize: 10 },
  // Scan
  scanStatus:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, padding: 12, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.hudDim },
  scanStatusText: { color: C.hud, fontFamily: 'monospace', fontSize: 11 },
  // Log
  logBox:  { backgroundColor: '#000000AA', borderRadius: 8, padding: 10, marginTop: 10 },
  logLine: { color: C.hudDim, fontFamily: 'monospace', fontSize: 9, marginBottom: 2 },
  // Empty state
  emptyState:{ alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle:{ color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: C.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});

// Helper used in Stats tab
function getGraph() {
  try {
    // Synchronous read from in-memory graph
    const m = require('../../spatial/memoryGraph');
    return m.getGraph();
  } catch { return null; }
}
