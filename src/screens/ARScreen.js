/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — AR HUD Screen (Iron Man-style)                    ║
 * ║                                                              ║
 * ║  Camera feed fills the screen.                             ║
 * ║  AI labels float over detected objects.                    ║
 * ║  Voice commands control every mode.                        ║
 * ║  All existing functionality untouched.                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, ScrollView
} from 'react-native';
import { Camera }         from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech        from 'expo-speech';

const { width: W, height: H } = Dimensions.get('window');

// ── Colours ─────────────────────────────────────────────────
const C = {
  bg:        '#000000',
  hud:       '#40AAFF',
  hudDim:    '#40AAFF55',
  hudGlow:   '#40AAFF22',
  danger:    '#FF4444',
  warn:      '#FFB344',
  ok:        '#44FF88',
  text:      '#FFFFFF',
  textDim:   '#FFFFFF88',
};

// ── HUD mode labels ──────────────────────────────────────────
const MODE_LABELS = {
  off:    { icon: '○',  label: 'OFF',    color: C.hudDim },
  idle:   { icon: '◉',  label: 'STANDBY', color: C.hud },
  camera: { icon: '📷', label: 'VISION', color: C.ok },
  screen: { icon: '📱', label: 'SCREEN', color: C.warn },
  ar:     { icon: '🧿', label: 'AR',     color: C.hud },
  live:   { icon: '🔴', label: 'LIVE',   color: C.danger },
};

export default function ARScreen() {
  const [hasPermission,  setHasPermission]  = useState(null);
  const [hudMode,        setHudMode]        = useState('idle');
  const [labels,         setLabels]         = useState([]);
  const [statusText,     setStatusText]     = useState('AVANT AR HUD');
  const [lastAnalysis,   setLastAnalysis]   = useState('');
  const [frameCount,     setFrameCount]     = useState(0);
  const [scanning,       setScanning]       = useState(false);
  const [listening,      setListening]      = useState(false);
  const [logLines,       setLogLines]       = useState([]);
  const [worldMemory,    setWorldMemory]    = useState([]);
  const stopRef    = useRef(false);
  const scanAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const cameraRef  = useRef(null);

  // ── Permissions ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
    return () => { stopRef.current = true; };
  }, []);

  // ── Scan line animation ──────────────────────────────────
  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanAnim.stopAnimation();
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [scanning]);

  // ── HUD engine subscriber ────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    import('../../ar/hudEngine').then(({ subscribeHUD }) => {
      unsub = subscribeHUD(state => {
        setHudMode(state.mode);
        setLabels(state.labels);
        setStatusText(state.statusText || 'AVANT AR HUD');
        setLastAnalysis(state.lastAnalysis);
        setFrameCount(state.frameCount);
        setScanning(state.scanActive);
      });
    }).catch(() => {});
    return () => unsub();
  }, []);

  const addLog = useCallback((line) => {
    setLogLines(prev => [...prev.slice(-8), `[${new Date().toLocaleTimeString()}] ${line}`]);
  }, []);

  const speak = useCallback(async (text) => {
    Speech.speak(text, { language: 'en-US', pitch: 1.1, rate: 0.95 });
    addLog(text.slice(0, 60));
  }, [addLog]);

  // ── Actions ───────────────────────────────────────────────
  const handleSnapshot = useCallback(async () => {
    try {
      const { runSnapshot } = await import('../../ar/hudEngine');
      setScanning(true);
      addLog('Analyzing camera…');
      const result = await runSnapshot('camera');
      setLastAnalysis(result);
      await speak(result);
    } catch (e) {
      speak("Camera analysis failed. Check permissions.");
    } finally {
      setScanning(false);
    }
  }, [speak, addLog]);

  const handleScreenAnalysis = useCallback(async () => {
    try {
      const { runSnapshot } = await import('../../ar/hudEngine');
      setScanning(true);
      addLog('Analyzing screen…');
      const result = await runSnapshot('screen');
      setLastAnalysis(result);
      await speak(result);
    } catch (e) {
      speak("Screen analysis failed.");
    } finally {
      setScanning(false);
    }
  }, [speak, addLog]);

  const handleARMode = useCallback(async () => {
    stopRef.current = false;
    addLog('AR mode started');
    try {
      const { startARMode } = await import('../../ar/hudEngine');
      await speak("AR mode on. Labeling everything I see.");
      await startARMode(() => stopRef.current);
    } catch (e) {
      speak("AR mode unavailable.");
    }
  }, [speak, addLog]);

  const handleLiveMode = useCallback(async () => {
    stopRef.current = false;
    addLog('Live narration started');
    try {
      const { startLiveNarration } = await import('../../ar/hudEngine');
      await speak("Live mode on. I'll narrate what I see.");
      await startLiveNarration({
        stopSignal:  () => stopRef.current,
        onNarration: async (text) => { await speak(text); },
      });
    } catch (e) {
      speak("Live mode unavailable.");
    }
  }, [speak, addLog]);

  const handleStop = useCallback(async () => {
    stopRef.current = true;
    try {
      const { stopHUD } = await import('../../ar/hudEngine');
      stopHUD();
    } catch {}
    addLog('All vision modes stopped');
    await speak("Vision off.");
  }, [speak, addLog]);

  const handleVoice = useCallback(async () => {
    setListening(true);
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { speak("Speech recognition not available in Expo Go."); return; }
      const rec = new SR();
      rec.lang = 'en-US'; rec.maxAlternatives = 1;
      rec.onresult = async (e) => {
        const cmd = e.results[0]?.[0]?.transcript || '';
        addLog(`Voice: "${cmd}"`);
        const { handleVisionCommand } = await import('../../ar/hudEngine');
        const handled = await handleVisionCommand(cmd, () => stopRef.current, speak);
        if (!handled) {
          // Fall through to regular AI
          const { aiRouter } = await import('../../core/aiRouter');
          const reply = await aiRouter(cmd);
          await speak(reply);
        }
      };
      rec.onerror = () => {};
      rec.onend   = () => setListening(false);
      rec.start();
    } catch { setListening(false); }
  }, [speak, addLog]);

  // ── Render ────────────────────────────────────────────────
  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.statusText}>Requesting camera permission…</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.statusText}>Camera permission denied.</Text>
        <Text style={styles.subText}>Enable in Settings → Apps → AVANT → Permissions</Text>
      </View>
    );
  }

  const modeInfo = MODE_LABELS[hudMode] ?? MODE_LABELS.idle;
  const scanY    = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, H * 0.75] });

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* ── Camera Background ─────────────────────────── */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        type={Camera.Constants?.Type?.back ?? 'back'}
        ratio="16:9"
      />

      {/* ── Dark vignette overlay ─────────────────────── */}
      <View style={styles.vignette} pointerEvents="none" />

      {/* ── Scan line ─────────────────────────────────── */}
      {scanning && (
        <Animated.View
          pointerEvents="none"
          style={[styles.scanLine, { transform: [{ translateY: scanY }] }]}
        />
      )}

      {/* ── AR Labels ─────────────────────────────────── */}
      {labels.map(label => (
        <Animated.View
          key={label.id}
          pointerEvents="none"
          style={[
            styles.arLabel,
            {
              left:    `${Math.max(5, Math.min(label.xPct, 80))}%`,
              top:     `${Math.max(8, Math.min(label.yPct, 78))}%`,
              opacity: label.opacity,
              borderColor: label.color ?? C.hud,
            }
          ]}>
          <View style={[styles.arLabelDot, { backgroundColor: label.color ?? C.hud }]} />
          <Text style={[styles.arLabelText, { color: label.color ?? C.hud }]}>
            {label.label.toUpperCase()}
          </Text>
          {label.importance > 0.85 && (
            <Text style={styles.arLabelSub}>{(label.importance * 100).toFixed(0)}%</Text>
          )}
        </Animated.View>
      ))}

      {/* ── Top HUD Bar ───────────────────────────────── */}
      <LinearGradient
        colors={['#000000EE', '#00000000']}
        style={styles.topBar}
        pointerEvents="none">
        <View style={styles.topBarRow}>
          <Text style={styles.avantTitle}>⚡ AVANT</Text>
          <View style={styles.modeBadge}>
            <Text style={[styles.modeIcon]}>{modeInfo.icon}</Text>
            <Text style={[styles.modeLabel, { color: modeInfo.color }]}>{modeInfo.label}</Text>
          </View>
          <Text style={styles.frameCount}>F{frameCount.toString().padStart(4, '0')}</Text>
        </View>
        {scanning && (
          <Text style={[styles.statusText, { marginTop: 4 }]}>
            ◌ {statusText}
          </Text>
        )}
      </LinearGradient>

      {/* ── Corner reticle ────────────────────────────── */}
      <View style={styles.reticle} pointerEvents="none">
        <View style={[styles.reticleCorner, styles.tl]} />
        <View style={[styles.reticleCorner, styles.tr]} />
        <View style={[styles.reticleCorner, styles.bl]} />
        <View style={[styles.reticleCorner, styles.br]} />
      </View>

      {/* ── Analysis Panel ────────────────────────────── */}
      {lastAnalysis ? (
        <View style={styles.analysisPanel} pointerEvents="none">
          <Text style={styles.analysisPanelLabel}>AVANT ANALYSIS</Text>
          <Text style={styles.analysisText} numberOfLines={4}>{lastAnalysis}</Text>
        </View>
      ) : null}

      {/* ── Log Panel ─────────────────────────────────── */}
      {logLines.length > 0 && (
        <View style={styles.logPanel} pointerEvents="none">
          {logLines.slice(-4).map((l, i) => (
            <Text key={i} style={styles.logLine}>{l}</Text>
          ))}
        </View>
      )}

      {/* ── Bottom Controls ───────────────────────────── */}
      <LinearGradient
        colors={['#00000000', '#000000EE']}
        style={styles.bottomBar}>

        {/* Mode buttons row */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btnSm} onPress={handleSnapshot}>
            <Text style={styles.btnSmIcon}>📷</Text>
            <Text style={styles.btnSmLabel}>SCAN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSm} onPress={handleScreenAnalysis}>
            <Text style={styles.btnSmIcon}>📱</Text>
            <Text style={styles.btnSmLabel}>SCREEN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSm} onPress={handleARMode}>
            <Text style={styles.btnSmIcon}>🧿</Text>
            <Text style={styles.btnSmLabel}>AR</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSm} onPress={handleLiveMode}>
            <Text style={[styles.btnSmIcon, { color: C.danger }]}>🔴</Text>
            <Text style={styles.btnSmLabel}>LIVE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btnSm, { borderColor: C.danger + '88' }]} onPress={handleStop}>
            <Text style={styles.btnSmIcon}>⏹</Text>
            <Text style={styles.btnSmLabel}>STOP</Text>
          </TouchableOpacity>
        </View>

        {/* Voice button */}
        <TouchableOpacity
          style={[styles.voiceBtn, listening && styles.voiceBtnActive]}
          onPress={handleVoice}>
          <Text style={styles.voiceBtnText}>{listening ? '🎙 Listening…' : '🎙  Voice Command'}</Text>
        </TouchableOpacity>

      </LinearGradient>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#000' },
  center:       { flex: 1, backgroundColor: '#050510', justifyContent: 'center', alignItems: 'center', padding: 32 },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderWidth: 60,
    borderColor: '#00000088',
  },
  scanLine: {
    position:        'absolute',
    left: 0, right: 0,
    height:          2,
    backgroundColor: '#40AAFF66',
    shadowColor:     '#40AAFF',
    shadowRadius:    8,
    shadowOpacity:   1,
  },
  // ── AR Labels
  arLabel: {
    position:     'absolute',
    flexDirection:'row',
    alignItems:   'center',
    borderWidth:  1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    backgroundColor:   '#00000088',
  },
  arLabelDot:  { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  arLabelText: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  arLabelSub:  { fontFamily: 'monospace', fontSize: 9, color: '#FFFFFF88', marginLeft: 4 },
  // ── Top bar
  topBar:    { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 48, paddingHorizontal: 20, paddingBottom: 24 },
  topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avantTitle:{ color: C.hud, fontFamily: 'monospace', fontSize: 14, fontWeight: '700', letterSpacing: 3 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeIcon:  { fontSize: 14 },
  modeLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  frameCount:{ color: C.hudDim, fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  statusText:{ color: C.hud, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.5 },
  subText:   { color: C.textDim, fontFamily: 'monospace', fontSize: 11, marginTop: 8, textAlign: 'center' },
  // ── Reticle
  reticle:  { position: 'absolute', top: '30%', left: '20%', width: '60%', height: '35%' },
  reticleCorner: { position: 'absolute', width: 20, height: 20, borderColor: C.hud, opacity: 0.5 },
  tl: { top: 0, left: 0,  borderTopWidth: 2,    borderLeftWidth:  2 },
  tr: { top: 0, right: 0, borderTopWidth: 2,    borderRightWidth: 2 },
  bl: { bottom: 0, left: 0,  borderBottomWidth: 2, borderLeftWidth:  2 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  // ── Analysis panel
  analysisPanel: {
    position:        'absolute',
    left:  20, right: 20, bottom: 180,
    backgroundColor: '#00000099',
    borderWidth:     1,
    borderColor:     C.hudDim,
    borderRadius:    8,
    padding:         12,
  },
  analysisPanelLabel: { color: C.hud, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, marginBottom: 6 },
  analysisText:       { color: C.text, fontSize: 13, lineHeight: 20 },
  // ── Log panel
  logPanel: {
    position:        'absolute',
    left:  20, right: 20, bottom: 190,
    backgroundColor: 'transparent',
  },
  logLine:   { color: C.hudDim, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.5, marginBottom: 2 },
  // ── Bottom bar
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingBottom: 36, paddingHorizontal: 16, paddingTop: 24,
  },
  btnRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  btnSm: {
    flex:            1,
    marginHorizontal: 4,
    borderWidth:     1,
    borderColor:     C.hudDim,
    borderRadius:    6,
    paddingVertical: 8,
    alignItems:      'center',
    backgroundColor: '#00000088',
  },
  btnSmIcon:  { fontSize: 16, marginBottom: 2 },
  btnSmLabel: { color: C.hudDim, fontFamily: 'monospace', fontSize: 8, letterSpacing: 1 },
  voiceBtn: {
    borderWidth:     1,
    borderColor:     C.hud,
    borderRadius:    40,
    paddingVertical: 14,
    alignItems:      'center',
    backgroundColor: '#40AAFF18',
  },
  voiceBtnActive:{ backgroundColor: '#40AAFF44', borderColor: C.ok },
  voiceBtnText:  { color: C.hud, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
});
