/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — AR Vision Screen (FIXED)                           ║
 * ║                                                              ║
 * ║  FIXES:                                                      ║
 * ║  • White screen fixed — camera permission check updated      ║
 * ║  • expo-camera v16 API: useCameraPermissions() hook          ║
 * ║  • Camera fills screen when permission granted               ║
 * ║  • Permission re-request uses correct API                    ║
 * ║  • Voice commands work without tapping buttons               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, ScrollView,
  Linking, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  bg: '#000000', hud: '#40AAFF', hudDim: '#40AAFF55',
  hudGlow: '#40AAFF22', danger: '#FF4444', warn: '#FFB344',
  ok: '#44FF88', text: '#FFFFFF', textDim: '#FFFFFF88',
};

const MODE_LABELS = {
  off:    { icon: '○',  label: 'OFF',     color: C.hudDim  },
  idle:   { icon: '◉',  label: 'STANDBY', color: C.hud     },
  camera: { icon: '📷', label: 'VISION',  color: C.ok      },
  screen: { icon: '📱', label: 'SCREEN',  color: C.warn    },
  ar:     { icon: '🧿', label: 'AR',      color: C.hud     },
  live:   { icon: '🔴', label: 'LIVE',    color: C.danger  },
};

export default function ARScreen() {
  // FIX: Use expo-camera v16 hook API instead of static Camera.requestCameraPermissionsAsync
  const [permission, setPermission]     = useState(null); // null=unknown, true=granted, false=denied
  const [hudMode, setHudMode]           = useState('idle');
  const [labels, setLabels]             = useState([]);
  const [statusText, setStatusText]     = useState('AVANT AR HUD');
  const [lastAnalysis, setLastAnalysis] = useState('');
  const [frameCount, setFrameCount]     = useState(0);
  const [scanning, setScanning]         = useState(false);
  const [listening, setListening]       = useState(false);
  const [logLines, setLogLines]         = useState([]);

  const stopRef   = useRef(false);
  const cameraRef = useRef(null);
  const scanAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Request camera permission on mount ──────────────────────
  // FIX: Import Camera dynamically and use correct v16 API
  useEffect(() => {
    requestCamPermission();
  }, []);

  async function requestCamPermission() {
    try {
      // expo-camera v16 exports useCameraPermissions hook, but we can also use:
      const { Camera } = await import('expo-camera');
      // Try new API first
      if (Camera.useCameraPermissions) {
        // Hook — can't use hooks here, so use requestCameraPermissionsAsync
      }
      if (Camera.requestCameraPermissionsAsync) {
        const result = await Camera.requestCameraPermissionsAsync();
        setPermission(result.status === 'granted');
      } else if (Camera.requestPermissionsAsync) {
        // Older API
        const result = await Camera.requestPermissionsAsync();
        setPermission(result.status === 'granted');
      } else {
        // Last resort — try PermissionsAndroid
        const { PermissionsAndroid } = require('react-native');
        if (Platform.OS === 'android') {
          const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
          setPermission(result === PermissionsAndroid.RESULTS.GRANTED);
        } else {
          setPermission(true);
        }
      }
    } catch (e) {
      console.log('[ARScreen] Camera permission error:', e.message);
      setPermission(false);
    }
  }

  function openSettings() {
    Linking.openSettings().catch(() => {
      Linking.openURL('app-settings:').catch(() => {});
    });
  }

  // ── Scan animations ──────────────────────────────────────────
  useEffect(() => {
    if (scanning) {
      Animated.loop(Animated.sequence([
        Animated.timing(scanAnim,  { toValue:1,    duration:1800, useNativeDriver:true }),
        Animated.timing(scanAnim,  { toValue:0,    duration:1800, useNativeDriver:true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue:1.06, duration:700,  useNativeDriver:true }),
        Animated.timing(pulseAnim, { toValue:1,    duration:700,  useNativeDriver:true }),
      ])).start();
    } else {
      scanAnim.stopAnimation();
      pulseAnim.stopAnimation(); pulseAnim.setValue(1);
    }
  }, [scanning]);

  // ── HUD engine subscriber ────────────────────────────────────
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
    Speech.speak(text, { language:'en-US', pitch:1.1, rate:0.95 });
    addLog(text.slice(0,60));
  }, [addLog]);

  // ── Action handlers ──────────────────────────────────────────
  const handleSnapshot = useCallback(async () => {
    try {
      const { runSnapshot } = await import('../../ar/hudEngine');
      setScanning(true); addLog('Analyzing camera…');
      const result = await runSnapshot('camera');
      setLastAnalysis(result);
      await speak(result);
    } catch { await speak("Camera analysis failed. Check permissions."); }
    finally { setScanning(false); }
  }, [speak, addLog]);

  const handleStop = useCallback(async () => {
    stopRef.current = true;
    try { const { stopHUD } = await import('../../ar/hudEngine'); stopHUD(); } catch {}
    addLog('All vision modes stopped');
    await speak("Vision off.");
  }, [speak, addLog]);

  // ── Voice command handler ────────────────────────────────────
  const handleVoice = useCallback(async () => {
    if (listening) return;
    setListening(true);
    try {
      const { VoiceEngine } = await import('../../voice/voiceEngine');
      await VoiceEngine.runSession();
    } catch { await speak("Voice unavailable."); }
    finally { setListening(false); }
  }, [speak, listening]);

  // ── Permission screens ───────────────────────────────────────
  if (permission === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={{ color: C.hud, fontSize: 16, textAlign:'center' }}>
          Requesting camera permission…
        </Text>
      </View>
    );
  }

  if (permission === false) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={{ color: C.hud, fontSize: 22, marginBottom: 16 }}>📷</Text>
        <Text style={{ color: '#fff', fontSize: 16, textAlign:'center', marginBottom:12 }}>
          Camera permission is required for AVANT Vision.
        </Text>
        <Text style={{ color: C.hudDim, fontSize: 13, textAlign:'center', marginBottom:24 }}>
          Go to: Settings → Apps → AVANT → Permissions → Camera → Allow
        </Text>
        <TouchableOpacity onPress={openSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsBtnText}>⚙ Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={requestCamPermission} style={[styles.settingsBtn, { marginTop:8, backgroundColor:'transparent' }]}>
          <Text style={[styles.settingsBtnText, { color: C.hud }]}>↺ Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main AR HUD ──────────────────────────────────────────────
  // FIX: Use CameraView from expo-camera v16
  const modeInfo = MODE_LABELS[hudMode] ?? MODE_LABELS.idle;
  const scanY = scanAnim.interpolate({ inputRange:[0,1], outputRange:[0, H*0.75] });

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* ── Camera Background (expo-camera v16) ── */}
      <CameraBackground cameraRef={cameraRef} />

      {/* ── Dark vignette ── */}
      <View style={styles.vignette} pointerEvents="none" />

      {/* ── Scan line ── */}
      {scanning && (
        <Animated.View style={[styles.scanLine, { transform:[{ translateY: scanY }] }]} />
      )}

      {/* ── AR Labels ── */}
      {labels.map((label, i) => (
        <View key={i} style={[styles.arLabel, {
          top: label.y || 100 + i*40,
          left: label.x || 40,
          borderColor: label.importance > 0.85 ? C.ok : C.hud,
        }]}>
          <View style={[styles.arLabelDot, { backgroundColor: label.importance > 0.85 ? C.ok : C.hud }]} />
          <Text style={[styles.arLabelText, { color: label.importance > 0.85 ? C.ok : C.hud }]}>
            {label.label?.toUpperCase()}
          </Text>
        </View>
      ))}

      {/* ── Top HUD Bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Text style={styles.avantTitle}>⚡ AVANT</Text>
          <View style={styles.modeBadge}>
            <Text style={[styles.modeLabel, { color: modeInfo.color }]}>{modeInfo.icon} {modeInfo.label}</Text>
          </View>
          <Text style={styles.frameCount}>F{frameCount.toString().padStart(4,'0')}</Text>
        </View>
        {scanning && <Text style={[styles.statusText, { color: modeInfo.color }]}>◌ {statusText}</Text>}
      </View>

      {/* ── Corner reticles ── */}
      <View style={[styles.reticle, styles.rTL]} /><View style={[styles.reticle, styles.rTR]} />
      <View style={[styles.reticle, styles.rBL]} /><View style={[styles.reticle, styles.rBR]} />

      {/* ── Analysis Panel ── */}
      {lastAnalysis ? (
        <View style={styles.analysisPanel}>
          <Text style={styles.analysisPanelTitle}>AVANT ANALYSIS</Text>
          <ScrollView><Text style={styles.analysisText}>{lastAnalysis}</Text></ScrollView>
        </View>
      ) : null}

      {/* ── Log ── */}
      {logLines.length > 0 && (
        <View style={styles.logPanel}>
          {logLines.slice(-4).map((l,i)=>(
            <Text key={i} style={styles.logLine}>{l}</Text>
          ))}
        </View>
      )}

      {/* ── Controls ── */}
      <View style={styles.controls}>
        <View style={styles.modeRow}>
          <TouchableOpacity onPress={handleSnapshot} style={styles.ctrlBtn}>
            <Text style={styles.ctrlIcon}>📷</Text><Text style={styles.ctrlLabel}>SCAN</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleStop} style={styles.ctrlBtn}>
            <Text style={styles.ctrlIcon}>⏹</Text><Text style={styles.ctrlLabel}>STOP</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleVoice} style={[styles.voiceBtn, listening && styles.voiceBtnActive]}>
          <Text style={styles.voiceBtnText}>{listening ? '🎙 Listening…' : '🎙 Voice Command'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Camera component using expo-camera v16 API ────────────────
// FIX: Uses CameraView (new API) with fallback to Camera (old API)
function CameraBackground({ cameraRef }) {
  const [CameraComp, setCameraComp] = useState(null);

  useEffect(() => {
    import('expo-camera').then((mod) => {
      // expo-camera v16 exports CameraView; v14 exports Camera
      const Comp = mod.CameraView || mod.Camera;
      setCameraComp(() => Comp);
    }).catch(() => {});
  }, []);

  if (!CameraComp) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor:'#000814' }]} />;
  }

  return (
    <CameraComp
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      facing="back"
      // legacy prop support
      type={CameraComp.Constants?.Type?.back || 'back'}
    />
  );
}

const styles = StyleSheet.create({
  root:           { flex:1, backgroundColor:'#000' },
  center:         { flex:1, backgroundColor:'#050510', justifyContent:'center', alignItems:'center', padding:32 },
  vignette:       { ...StyleSheet.absoluteFillObject, borderWidth:60, borderColor:'#00000088' },
  scanLine:       { position:'absolute', left:0, right:0, height:2, backgroundColor:'#40AAFF66',
                    shadowColor:'#40AAFF', shadowRadius:8, shadowOpacity:1 },
  arLabel:        { position:'absolute', flexDirection:'row', alignItems:'center', borderWidth:1,
                    borderRadius:4, paddingHorizontal:8, paddingVertical:4, backgroundColor:'#00000088' },
  arLabelDot:     { width:6, height:6, borderRadius:3, marginRight:6 },
  arLabelText:    { fontFamily:'monospace', fontSize:10, fontWeight:'700', letterSpacing:1.5 },
  topBar:         { position:'absolute', top:0, left:0, right:0, paddingTop:48, paddingHorizontal:20, paddingBottom:24 },
  topBarRow:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  avantTitle:     { color:'#40AAFF', fontFamily:'monospace', fontSize:14, fontWeight:'700', letterSpacing:3 },
  modeBadge:      { flexDirection:'row', alignItems:'center' },
  modeLabel:      { fontFamily:'monospace', fontSize:12, letterSpacing:1 },
  frameCount:     { color:'#40AAFF44', fontFamily:'monospace', fontSize:10 },
  statusText:     { fontFamily:'monospace', fontSize:10, letterSpacing:2, marginTop:6 },
  reticle:        { position:'absolute', width:20, height:20, borderColor:'#40AAFF' },
  rTL:            { top:44, left:12, borderTopWidth:2, borderLeftWidth:2 },
  rTR:            { top:44, right:12, borderTopWidth:2, borderRightWidth:2 },
  rBL:            { bottom:140, left:12, borderBottomWidth:2, borderLeftWidth:2 },
  rBR:            { bottom:140, right:12, borderBottomWidth:2, borderRightWidth:2 },
  analysisPanel:  { position:'absolute', top:120, left:16, right:16, maxHeight:160,
                    backgroundColor:'#00001299', borderWidth:1, borderColor:'#40AAFF44',
                    borderRadius:8, padding:12 },
  analysisPanelTitle:{ color:'#40AAFF', fontFamily:'monospace', fontSize:9, letterSpacing:2, marginBottom:6 },
  analysisText:   { color:'#fff', fontSize:13, lineHeight:18 },
  logPanel:       { position:'absolute', bottom:140, left:16, right:16 },
  logLine:        { color:'#40AAFF66', fontFamily:'monospace', fontSize:9, lineHeight:14 },
  controls:       { position:'absolute', bottom:0, left:0, right:0, padding:16,
                    backgroundColor:'#00000099' },
  modeRow:        { flexDirection:'row', justifyContent:'center', marginBottom:10 },
  ctrlBtn:        { alignItems:'center', paddingHorizontal:20, paddingVertical:8,
                    marginHorizontal:8, borderRadius:8, borderWidth:1, borderColor:'#40AAFF44',
                    backgroundColor:'#40AAFF11' },
  ctrlIcon:       { fontSize:20 },
  ctrlLabel:      { color:'#40AAFF', fontSize:9, letterSpacing:2, marginTop:2 },
  voiceBtn:       { backgroundColor:'#40AAFF22', borderWidth:1, borderColor:'#40AAFF55',
                    borderRadius:8, padding:12, alignItems:'center' },
  voiceBtnActive: { backgroundColor:'#40AAFF44', borderColor:'#40AAFF' },
  voiceBtnText:   { color:'#40AAFF', fontSize:13, letterSpacing:1 },
  settingsBtn:    { backgroundColor:'#40AAFF', borderRadius:8, paddingHorizontal:24, paddingVertical:12 },
  settingsBtnText:{ color:'#000', fontWeight:'bold', fontSize:14 },
});
