/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Spatial OS Screen (V∞)                            ║
 * ║                                                              ║
 * ║  Tabs:                                                      ║
 * ║  🗺  Map       — memory graph, rooms + objects             ║
 * ║  👁  Scan      — spatial scan + live mapping               ║
 * ║  🔍  Query     — voice/text queries over all memory        ║
 * ║  ⏳  Timeline  — searchable life timeline                  ║
 * ║  🔮  Predict   — pattern display + predictions             ║
 * ║  📊  Stats     — graph stats + briefing                    ║
 * ║  🔐  Privacy   — controls, export, clear data              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Animated, Dimensions, ActivityIndicator, Switch, Alert
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
  purple:  '#AA44FF',
  text:    '#FFFFFF',
  textDim: '#FFFFFF66',
};

const TABS = ['Map', 'Scan', 'Query', 'Timeline', 'Predict', 'Stats', 'Privacy'];

export default function SpatialScreen() {
  const [activeTab,      setActiveTab]      = useState('Map');
  const [spatialState,   setSpatialState]   = useState(null);
  const [graphData,      setGraphData]      = useState({ nodes: [], rooms: [], locations: [] });
  const [timeline,       setTimeline]       = useState([]);
  const [predictions,    setPredictions]    = useState([]);
  const [patterns,       setPatterns]       = useState({ location: [], routines: [], time: [] });
  const [briefing,       setBriefing]       = useState('');
  const [query,          setQuery]          = useState('');
  const [queryResult,    setQueryResult]    = useState('');
  const [queryLoading,   setQueryLoading]   = useState(false);
  const [scanResult,     setScanResult]     = useState('');
  const [scanning,       setScanning]       = useState(false);
  const [mapping,        setMapping]        = useState(false);
  const [arLabels,       setARLabels]       = useState([]);
  const [stats,          setStats]          = useState(null);
  const [privacySettings, setPrivacySettings] = useState({ trackingEnabled: true, retentionDays: 0 });
  const [recentLog,      setRecentLog]      = useState([]);
  const [timelineSearch, setTimelineSearch] = useState('');
  const stopRef  = useRef(false);
  const scanAnim = useRef(new Animated.Value(0)).current;

  const speak = useCallback((text) => {
    Speech.speak(text, { language: 'en-US', pitch: 1.1, rate: 0.95 });
  }, []);

  const log = useCallback((line) => {
    setRecentLog(prev => [...prev.slice(-14), `[${new Date().toLocaleTimeString()}] ${line}`]);
  }, []);

  // ── Init all engines ───────────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const { initContextEngine } = await import('../../intelligence/contextEngine');
        await initContextEngine();
        log('Intelligence engines loaded');
      } catch (e) { log('Intelligence (compile pending): ' + e?.message); }

      try {
        const { subscribeSpatial, initSpatialEngine } = await import('../../spatial/spatialEngine');
        await initSpatialEngine();
        unsub = subscribeSpatial(s => setSpatialState(s));
      } catch (e) { log('Spatial engine: ' + e?.message); }

      refreshAll();
    })();
    return () => { unsub(); stopRef.current = true; };
  }, []);

  useEffect(() => { refreshAll(); }, [activeTab]);

  // ── Scan animation ─────────────────────────────────────────
  useEffect(() => {
    if (scanning || mapping) {
      Animated.loop(Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])).start();
    } else { scanAnim.stopAnimation(); }
  }, [scanning, mapping]);

  const refreshAll = useCallback(async () => {
    try {
      const { getLifeGraph, getLifeGraphStats, getPrivacySettings } = await import('../../intelligence/lifeGraph');
      const g = getLifeGraph();
      setGraphData({ nodes: [...g.nodes], rooms: [...(g.rooms ?? [])], locations: [...g.locations] });
      setStats(getLifeGraphStats());
      setPrivacySettings(getPrivacySettings());
    } catch {}
    try {
      const { getTimeline } = await import('../../intelligence/timelineEngine');
      setTimeline([...getTimeline()].reverse().slice(0, 80));
    } catch {}
    try {
      const { generatePredictions, getProactiveBriefing } = await import('../../intelligence/predictionEngine');
      setPredictions(generatePredictions());
      setBriefing(getProactiveBriefing());
    } catch {}
    try {
      const { getAllPatterns } = await import('../../intelligence/patternEngine');
      setPatterns(getAllPatterns());
    } catch {}
  }, []);

  // ── Actions ────────────────────────────────────────────────
  const handleQuickScan = useCallback(async () => {
    setScanning(true); setScanResult('');
    log('Quick scan started');
    try {
      const { runSpatialScan } = await import('../../spatial/spatialEngine');
      const result = await runSpatialScan();
      setScanResult(result); speak(result);
      log('Scan: ' + result.slice(0, 60));
    } catch (e) { setScanResult('Scan failed — check camera permissions.'); }
    finally { setScanning(false); await refreshAll(); }
  }, [speak, log, refreshAll]);

  const handleToggleMapping = useCallback(async () => {
    if (mapping) {
      stopRef.current = true;
      const { stopSpatialMapping } = await import('../../spatial/spatialEngine');
      stopSpatialMapping(); setMapping(false); speak('Mapping stopped.');
      await refreshAll(); return;
    }
    stopRef.current = false; setMapping(true);
    speak('Starting spatial mapping. I\'ll build a memory of this space.');
    log('Live mapping started');
    try {
      const { startSpatialMapping } = await import('../../spatial/spatialEngine');
      await startSpatialMapping(
        () => stopRef.current,
        (result) => { setARLabels(result.labels); if (result.changes.length) log('Changes: ' + result.changes.map(c => c.label).join(', ')); },
        speak,
      );
    } catch (e) { log('Mapping error: ' + e.message); }
    finally { setMapping(false); await refreshAll(); }
  }, [mapping, speak, log, refreshAll]);

  const handleQuery = useCallback(async (q) => {
    if (!q.trim()) return;
    setQueryLoading(true); setQueryResult('');
    log('Query: "' + q + '"');
    try {
      const { handleIntelligenceCommand } = await import('../../intelligence/contextEngine');
      let answered = false;
      const speakCapture = async (text) => { setQueryResult(text); answered = true; };
      answered = await handleIntelligenceCommand(q, speakCapture);
      if (!answered) {
        const { aiRouter } = await import('../../core/aiRouter');
        const { serializeLifeGraphForAI } = await import('../../intelligence/lifeGraph');
        const { serializeTimelineForAI }  = await import('../../intelligence/timelineEngine');
        const { serializePatternsForAI }  = await import('../../intelligence/patternEngine');
        const ctx = [serializeLifeGraphForAI(20), serializeTimelineForAI(15), serializePatternsForAI()].join('\n\n');
        const answer = await aiRouter(`${ctx}\n\nUser: ${q}`, 'casual');
        setQueryResult(answer);
      }
      if (queryResult) speak(queryResult);
    } catch { setQueryResult("Couldn't process that query."); }
    finally { setQueryLoading(false); }
  }, [speak, log]);

  const handleVoiceQuery = useCallback(async () => {
    try {
      const SR = window?.SpeechRecognition || window?.webkitSpeechRecognition;
      if (!SR) { speak("Type your question for now."); return; }
      const rec = new SR(); rec.lang = 'en-US';
      rec.onresult = (e) => { const t = e.results[0]?.[0]?.transcript || ''; if (t) { setQuery(t); handleQuery(t); } };
      rec.onerror = () => {}; rec.start();
    } catch {}
  }, [speak, handleQuery]);

  const handleClearData = useCallback((scope) => {
    Alert.alert(
      'Clear Data',
      `This will permanently delete your ${scope}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            if (scope === 'all memory') {
              const { clearAllData }  = await import('../../intelligence/lifeGraph');
              const { clearTimeline } = await import('../../intelligence/timelineEngine');
              clearAllData(); clearTimeline();
            } else if (scope === 'timeline') {
              const { clearTimeline } = await import('../../intelligence/timelineEngine');
              clearTimeline();
            }
            speak(`${scope} cleared.`);
            await refreshAll();
          } catch {}
        }},
      ]
    );
  }, [speak, refreshAll]);

  const handleExport = useCallback(async () => {
    try {
      const { exportLifeGraph }  = await import('../../intelligence/lifeGraph');
      const { exportTimeline }   = await import('../../intelligence/timelineEngine');
      const data = { lifeGraph: JSON.parse(exportLifeGraph()), timeline: JSON.parse(exportTimeline()) };
      log('Export ready: ' + JSON.stringify(data).length + ' chars');
      speak("Export prepared. In a production build this would save to your Files app.");
    } catch { speak("Export failed."); }
  }, [speak, log]);

  const handlePrivacyToggle = useCallback(async (key, value) => {
    try {
      const { updatePrivacySettings } = await import('../../intelligence/lifeGraph');
      updatePrivacySettings({ [key]: value });
      setPrivacySettings(prev => ({ ...prev, [key]: value }));
    } catch {}
  }, []);

  // ── Render helpers ─────────────────────────────────────────
  const RoomCard = ({ room }) => {
    const objects = graphData.nodes.filter(n => n.roomId === room.id);
    const since   = Math.round((Date.now() - (room.lastVisited || Date.now())) / 60000);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{room.name}</Text>
          <Text style={styles.cardMeta}>{since < 1 ? 'now' : since < 60 ? `${since}m` : `${Math.round(since/60)}h`} ago</Text>
        </View>
        <Text style={styles.cardSub}>{objects.length} objects · {room.visitCount || 1} visit{room.visitCount !== 1 ? 's' : ''}</Text>
        <View style={styles.tagRow}>
          {objects.slice(0, 6).map((o, i) => (
            <View key={i} style={[styles.tag, { borderColor: o.pinned ? C.warn : C.hud }]}>
              <Text style={[styles.tagText, { color: o.pinned ? C.warn : C.hud }]}>{o.label}</Text>
            </View>
          ))}
          {objects.length > 6 && <View style={styles.tag}><Text style={[styles.tagText, { color: C.textDim }]}>+{objects.length - 6}</Text></View>}
        </View>
      </View>
    );
  };

  const TimelineRow = ({ entry }) => {
    const when = new Date(entry.timestamp);
    const timeStr = when.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const color = entry.type === 'object_moved' ? C.warn : entry.type === 'routine_detected' ? C.purple : entry.type === 'prediction_made' ? C.ok : C.hudDim;
    return (
      <View style={styles.timelineRow}>
        <View style={[styles.timelineDot, { backgroundColor: color }]} />
        <View style={styles.timelineContent}>
          <Text style={styles.timelineLabel}>{entry.label}</Text>
          {entry.detail ? <Text style={styles.timelineDetail}>{entry.detail}</Text> : null}
        </View>
        <Text style={styles.timelineTime}>{timeStr}</Text>
      </View>
    );
  };

  const PredictionCard = ({ pred }) => {
    const color = pred.urgency > 0.7 ? C.danger : pred.urgency > 0.4 ? C.warn : C.hud;
    return (
      <View style={[styles.card, { borderColor: color + '44' }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.predCategory, { color }]}>
            {pred.category === 'missing_item' ? '⚠ MISSING' :
             pred.category === 'location_reminder' ? '📍 LOCATION' :
             pred.category === 'routine_upcoming' ? '🔄 ROUTINE' :
             pred.category === 'co_occurrence_alert' ? '🔗 PAIR' :
             pred.category === 'time_context' ? '⏰ CONTEXT' : '🔮 PREDICT'}
          </Text>
          <Text style={styles.cardMeta}>{(pred.confidence * 100).toFixed(0)}%</Text>
        </View>
        <Text style={styles.predText}>{pred.text}</Text>
        {pred.detail ? <Text style={styles.predDetail}>{pred.detail}</Text> : null}
        {pred.actionHint ? <Text style={styles.predHint}>→ {pred.actionHint}</Text> : null}
      </View>
    );
  };

  const QuickQueryBtn = ({ text }) => (
    <TouchableOpacity style={styles.quickBtn} onPress={() => { setQuery(text); handleQuery(text); }}>
      <Text style={styles.quickBtnText}>{text}</Text>
    </TouchableOpacity>
  );

  const filteredTimeline = timelineSearch
    ? timeline.filter(e =>
        e.label?.toLowerCase().includes(timelineSearch.toLowerCase()) ||
        e.detail?.toLowerCase().includes(timelineSearch.toLowerCase()) ||
        e.roomName?.toLowerCase().includes(timelineSearch.toLowerCase())
      )
    : timeline;

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={['#0A0A1E', '#050510']} style={styles.header}>
        <Text style={styles.headerTitle}>🧠 SPATIAL OS</Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {briefing || spatialState?.statusText || `${graphData.nodes.length} objects · ${graphData.locations.length} locations`}
        </Text>
      </LinearGradient>

      {/* Tab bar — horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ══════════════ MAP TAB ══════════════════════════ */}
      {activeTab === 'Map' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {graphData.locations.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>LOCATIONS</Text>
              {graphData.locations.map(loc => (
                <View key={loc.id} style={[styles.card, { borderColor: C.purple + '44' }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>📍 {loc.name}</Text>
                    <Text style={styles.cardMeta}>{loc.visitCount}x</Text>
                  </View>
                  <Text style={styles.cardSub}>{loc.roomIds?.length ?? 0} rooms</Text>
                </View>
              ))}
            </>
          )}
          {graphData.rooms.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🗺</Text>
              <Text style={styles.emptyTitle}>No spatial memory yet</Text>
              <Text style={styles.emptyText}>Go to Scan → Quick Scan or Start Mapping to begin.</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>ROOMS</Text>
              {graphData.rooms.map(room => <RoomCard key={room.id} room={room} />)}
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>RECENT OBJECTS</Text>
              {[...graphData.nodes].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 25).map(n => (
                <View key={n.id} style={styles.objectRow}>
                  <View style={[styles.objDot, { backgroundColor: n.confidence > 0.8 ? C.ok : C.hud }]} />
                  <Text style={styles.objLabel}>{n.label}</Text>
                  <Text style={styles.objMeta}>{graphData.rooms.find(r => r.id === n.roomId)?.name ?? graphData.locations.find(l => l.id === n.locationId)?.name ?? '?'}</Text>
                  <Text style={styles.objTime}>{formatAge(n.lastSeen)}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ══════════════ SCAN TAB ══════════════════════════ */}
      {activeTab === 'Scan' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {(scanning || mapping) && (
            <View style={styles.scanStatus}>
              <ActivityIndicator color={C.hud} size="small" />
              <Text style={styles.scanStatusText}>{mapping ? 'Spatial mapping active…' : 'Scanning…'}</Text>
            </View>
          )}
          {arLabels.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Live Labels</Text>
              <View style={styles.tagRow}>
                {arLabels.slice(0, 8).map((l, i) => (
                  <View key={i} style={[styles.tag, { borderColor: l.color || C.hud }]}>
                    <Text style={[styles.tagText, { color: l.color || C.hud }]}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {scanResult ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Last Scan</Text>
              <Text style={styles.resultText}>{scanResult}</Text>
              <TouchableOpacity onPress={() => speak(scanResult)} style={styles.speakBtn}>
                <Text style={styles.speakBtnText}>🔊 Replay</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity style={[styles.btn, scanning && styles.btnDisabled]} onPress={handleQuickScan} disabled={scanning}>
            <Text style={styles.btnText}>📷  Quick Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, mapping && styles.btnActive]} onPress={handleToggleMapping}>
            <Text style={styles.btnText}>{mapping ? '⏹  Stop Mapping' : '🧿  Start Live Mapping'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={refreshAll}>
            <Text style={styles.btnSecondaryText}>🔄  Refresh All Memory</Text>
          </TouchableOpacity>
          {recentLog.length > 0 && (
            <View style={styles.logBox}>
              {recentLog.slice(-6).map((l, i) => <Text key={i} style={styles.logLine}>{l}</Text>)}
            </View>
          )}
        </ScrollView>
      )}

      {/* ══════════════ QUERY TAB ══════════════════════════ */}
      {activeTab === 'Query' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>ASK AVANT ABOUT YOUR WORLD</Text>
          <View style={styles.quickBtnRow}><QuickQueryBtn text="Where are my keys?" /><QuickQueryBtn text="What's in this room?" /></View>
          <View style={styles.quickBtnRow}><QuickQueryBtn text="What changed today?" /><QuickQueryBtn text="Brief me on my space" /></View>
          <View style={styles.quickBtnRow}><QuickQueryBtn text="What have I been tracking?" /><QuickQueryBtn text="Any predictions for me?" /></View>
          <View style={styles.quickBtnRow}><QuickQueryBtn text="Show week summary" /><QuickQueryBtn text="What did I move recently?" /></View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={query} onChangeText={setQuery}
              placeholder="Ask anything…" placeholderTextColor={C.textDim}
              onSubmitEditing={() => handleQuery(query)} returnKeyType="search" />
            <TouchableOpacity style={styles.inputBtn} onPress={handleVoiceQuery}><Text>🎙</Text></TouchableOpacity>
            <TouchableOpacity style={styles.inputBtn} onPress={() => handleQuery(query)}><Text style={{ color: C.hud }}>→</Text></TouchableOpacity>
          </View>
          {queryLoading && <View style={styles.loadingRow}><ActivityIndicator color={C.hud} /><Text style={styles.loadingText}>Searching all memory…</Text></View>}
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

      {/* ══════════════ TIMELINE TAB ══════════════════════ */}
      {activeTab === 'Timeline' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={timelineSearch} onChangeText={setTimelineSearch}
              placeholder="Search timeline…" placeholderTextColor={C.textDim} />
            {timelineSearch ? (
              <TouchableOpacity style={styles.inputBtn} onPress={() => setTimelineSearch('')}>
                <Text style={{ color: C.danger }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {filteredTimeline.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⏳</Text>
              <Text style={styles.emptyTitle}>No timeline events yet</Text>
              <Text style={styles.emptyText}>Events are recorded as AVANT observes your space.</Text>
            </View>
          ) : (
            filteredTimeline.slice(0, 60).map(e => <TimelineRow key={e.id} entry={e} />)
          )}
        </ScrollView>
      )}

      {/* ══════════════ PREDICT TAB ══════════════════════ */}
      {activeTab === 'Predict' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {briefing ? (
            <View style={[styles.card, { borderColor: C.ok + '55' }]}>
              <Text style={styles.cardTitle}>⚡ Proactive Briefing</Text>
              <Text style={styles.resultText}>{briefing}</Text>
              <TouchableOpacity onPress={() => speak(briefing)} style={styles.speakBtn}>
                <Text style={styles.speakBtnText}>🔊 Play</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {predictions.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>ACTIVE PREDICTIONS</Text>
              {predictions.map((p, i) => <PredictionCard key={p.id ?? i} pred={p} />)}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔮</Text>
              <Text style={styles.emptyTitle}>No predictions yet</Text>
              <Text style={styles.emptyText}>AVANT needs more observations to detect patterns. Use Live Mapping to build up data.</Text>
            </View>
          )}

          {patterns.routines?.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>DETECTED ROUTINES</Text>
              {patterns.routines.map((r, i) => (
                <View key={i} style={[styles.card, { borderColor: C.purple + '44' }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.predCategory, { color: C.purple }]}>🔄 ROUTINE</Text>
                    <Text style={styles.cardMeta}>{(r.confidence * 100).toFixed(0)}%</Text>
                  </View>
                  <Text style={styles.predText}>{r.description}</Text>
                  {r.timeLabel ? <Text style={styles.predDetail}>⏰ {r.timeLabel}</Text> : null}
                  {r.days?.length ? <Text style={styles.predDetail}>📅 {r.days.join(', ')}</Text> : null}
                </View>
              ))}
            </>
          )}

          {patterns.location?.filter(p => p.confidence > 0.7).length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>LOCATION HABITS</Text>
              {patterns.location.filter(p => p.confidence > 0.7).slice(0, 8).map((p, i) => (
                <View key={i} style={styles.objectRow}>
                  <View style={[styles.objDot, { backgroundColor: C.ok }]} />
                  <Text style={styles.objLabel}>{p.objectLabel}</Text>
                  <Text style={styles.objMeta}>{p.roomName}</Text>
                  <Text style={styles.objTime}>{(p.confidence * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={[styles.btn, { marginTop: 16 }]} onPress={async () => {
            try {
              const { getAIPrediction } = await import('../../intelligence/predictionEngine');
              const result = await getAIPrediction();
              speak(result); setQueryResult(result); setActiveTab('Query');
            } catch {}
          }}>
            <Text style={styles.btnText}>🧠  AI Deep Prediction</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ══════════════ STATS TAB ══════════════════════════ */}
      {activeTab === 'Stats' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {stats ? (
            <>
              <View style={styles.statsGrid}>
                {[
                  { label: 'Objects',   value: stats.totalNodes,     color: C.hud },
                  { label: 'Edges',     value: stats.totalEdges,     color: C.ok },
                  { label: 'Locations', value: stats.totalLocations, color: C.purple },
                  { label: 'Patterns',  value: patterns.location?.length ?? 0, color: C.warn },
                ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Memory Highlights</Text>
                <Text style={styles.cardSub}>Most tracked: <Text style={{ color: C.hud }}>{stats.mostSeen}</Text></Text>
                <Text style={styles.cardSub}>Oldest memory: <Text style={{ color: C.warn }}>{stats.oldest}</Text></Text>
                {Object.entries(stats.byType ?? {}).map(([type, count]) => (
                  <Text key={type} style={styles.cardSub}>{type}: {count}</Text>
                ))}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent Activity</Text>
                {[...graphData.nodes].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 8).map(n => (
                  <View key={n.id} style={styles.activityRow}>
                    <Text style={styles.activityDot}>◉</Text>
                    <Text style={styles.activityLabel}>{n.label}</Text>
                    <Text style={styles.activityTime}>{formatAge(n.lastSeen)}</Text>
                  </View>
                ))}
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

      {/* ══════════════ PRIVACY TAB ══════════════════════ */}
      {activeTab === 'Privacy' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>DATA CONTROLS</Text>
          <Text style={styles.privacyNote}>
            All data is stored 100% locally on your device. Nothing is sent to any server without your explicit action.
          </Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Tracking Enabled</Text>
                <Text style={styles.settingDesc}>Record objects, rooms, and timeline events</Text>
              </View>
              <Switch
                value={privacySettings.trackingEnabled}
                onValueChange={v => handlePrivacyToggle('trackingEnabled', v)}
                trackColor={{ true: C.hud + '88', false: C.border }}
                thumbColor={privacySettings.trackingEnabled ? C.hud : C.textDim}
              />
            </View>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>EXPORT DATA</Text>
          <TouchableOpacity style={styles.btn} onPress={handleExport}>
            <Text style={styles.btnText}>📤  Export All Data (JSON)</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>DELETE DATA</Text>
          <TouchableOpacity style={[styles.btnDanger]} onPress={() => handleClearData('timeline')}>
            <Text style={styles.btnDangerText}>🗑  Clear Timeline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnDanger, { marginTop: 10 }]} onPress={() => handleClearData('all memory')}>
            <Text style={styles.btnDangerText}>⚠️  Clear All Spatial Memory</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>WHAT AVANT STORES</Text>
          <View style={styles.card}>
            {[
              ['Objects seen', 'Label, room, position, confidence, timestamps'],
              ['Rooms & locations', 'Name, visit count, object list'],
              ['Timeline', 'Event type, label, room, timestamp'],
              ['Patterns', 'Location habits, time patterns, routines'],
            ].map(([title, desc]) => (
              <View key={title} style={styles.privacyItem}>
                <Text style={styles.privacyItemTitle}>• {title}</Text>
                <Text style={styles.privacyItemDesc}>{desc}</Text>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.privacyNote}>
              🔒 AVANT does NOT store:{'\n'}
              • Photos or video frames{'\n'}
              • Audio recordings{'\n'}
              • Personal communications{'\n'}
              • Location GPS coordinates{'\n'}
              • Any data outside this app
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function formatAge(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1)   return 'now';
  if (min < 60)  return `${min}m`;
  if (min < 1440) return `${Math.round(min/60)}h`;
  return `${Math.round(min/1440)}d`;
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header:  { paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { color: C.hud, fontFamily: 'monospace', fontSize: 15, fontWeight: '700', letterSpacing: 3 },
  headerSub:   { color: C.textDim, fontFamily: 'monospace', fontSize: 10, marginTop: 4 },
  tabBarScroll:{ borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.card, flexGrow: 0 },
  tabBar:      { flexDirection: 'row', paddingHorizontal: 4 },
  tabBtn:      { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  tabBtnActive:{ borderBottomWidth: 2, borderBottomColor: C.hud },
  tabLabel:    { color: C.textDim, fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 },
  tabLabelActive: { color: C.hud },
  scroll:      { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionLabel:  { color: C.hudDim, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, marginBottom: 10 },
  card:       { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle:  { color: C.text, fontFamily: 'monospace', fontSize: 13, fontWeight: '600' },
  cardMeta:   { color: C.hudDim, fontFamily: 'monospace', fontSize: 10 },
  cardSub:    { color: C.textDim, fontSize: 12, marginTop: 2 },
  tagRow:     { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  tag:        { borderWidth: 1, borderColor: C.hud, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  tagText:    { color: C.hud, fontFamily: 'monospace', fontSize: 9 },
  objectRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderColor: C.border },
  objDot:     { width: 7, height: 7, borderRadius: 4, marginRight: 10 },
  objLabel:   { flex: 1, color: C.text, fontSize: 13 },
  objMeta:    { color: C.hudDim, fontFamily: 'monospace', fontSize: 10, marginRight: 8 },
  objTime:    { color: C.textDim, fontFamily: 'monospace', fontSize: 9, width: 30, textAlign: 'right' },
  btn:        { borderWidth: 1, borderColor: C.hud, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginBottom: 10, backgroundColor: '#40AAFF0F' },
  btnActive:  { backgroundColor: '#40AAFF33', borderColor: C.ok },
  btnDisabled:{ opacity: 0.4 },
  btnText:    { color: C.hud, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  btnSecondary: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  btnSecondaryText: { color: C.textDim, fontFamily: 'monospace', fontSize: 11 },
  btnDanger:  { borderWidth: 1, borderColor: C.danger + '88', borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: C.danger + '0F' },
  btnDangerText: { color: C.danger, fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  quickBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickBtn:    { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 9, alignItems: 'center', backgroundColor: C.card },
  quickBtnText:{ color: C.textDim, fontSize: 11, textAlign: 'center' },
  inputRow:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 10, marginBottom: 14, backgroundColor: C.card },
  input:      { flex: 1, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 },
  inputBtn:   { padding: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  loadingText:{ color: C.textDim, fontFamily: 'monospace', fontSize: 11 },
  resultCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hud + '44', borderRadius: 10, padding: 16, marginBottom: 12 },
  resultLabel:{ color: C.hud, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, marginBottom: 8 },
  resultText: { color: C.text, fontSize: 14, lineHeight: 22 },
  speakBtn:   { marginTop: 10, alignSelf: 'flex-end' },
  speakBtnText:{ color: C.hudDim, fontFamily: 'monospace', fontSize: 10 },
  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard:   { flex: 1, minWidth: (W - 52) / 2, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 16, alignItems: 'center' },
  statValue:  { fontFamily: 'monospace', fontSize: 26, fontWeight: '700' },
  statLabel:  { color: C.textDim, fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginTop: 4 },
  activityRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  activityDot:  { color: C.ok, fontSize: 9, marginRight: 10 },
  activityLabel:{ flex: 1, color: C.text, fontSize: 12 },
  activityTime: { color: C.textDim, fontFamily: 'monospace', fontSize: 10 },
  timelineRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.border },
  timelineDot:  { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
  timelineContent: { flex: 1 },
  timelineLabel:   { color: C.text, fontSize: 12, fontWeight: '500' },
  timelineDetail:  { color: C.textDim, fontSize: 11, marginTop: 2 },
  timelineTime:    { color: C.hudDim, fontFamily: 'monospace', fontSize: 9, marginLeft: 8 },
  predCategory:    { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  predText:        { color: C.text, fontSize: 13, marginTop: 6, lineHeight: 20 },
  predDetail:      { color: C.textDim, fontSize: 11, marginTop: 4 },
  predHint:        { color: C.ok, fontFamily: 'monospace', fontSize: 10, marginTop: 6 },
  scanStatus:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, padding: 12, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.hudDim },
  scanStatusText:  { color: C.hud, fontFamily: 'monospace', fontSize: 11 },
  logBox:    { backgroundColor: '#000000AA', borderRadius: 8, padding: 10, marginTop: 10 },
  logLine:   { color: C.hudDim, fontFamily: 'monospace', fontSize: 9, marginBottom: 2 },
  emptyState:{ alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle:{ color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: C.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  // Privacy
  privacyNote:    { color: C.textDim, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  settingRow:     { flexDirection: 'row', alignItems: 'center' },
  settingLabel:   { color: C.text, fontSize: 14, fontWeight: '500' },
  settingDesc:    { color: C.textDim, fontSize: 11, marginTop: 2 },
  privacyItem:    { marginBottom: 8 },
  privacyItemTitle: { color: C.hud, fontSize: 12, fontWeight: '600' },
  privacyItemDesc:  { color: C.textDim, fontSize: 11, marginTop: 2 },
});
