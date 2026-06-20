/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — HomeScreen (FIXED)                                 ║
 * ║                                                              ║
 * ║  FIXES:                                                      ║
 * ║  • Holographic orb tap starts real microphone STT            ║
 * ║  • VoiceEngine wired — AVANT always speaks back              ║
 * ║  • Wake word state reflected in UI (listening ring)          ║
 * ║  • Navigation voice command handled (go to / navigate to)   ║
 * ║  • Alert.prompt removed — real microphone used               ║
 * ║  • Voice-activated tab switching (open map, open vision…)   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, StatusBar, Image, Vibration
} from 'react-native';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import {
  think, searchWebFull, detectVisualIntent, detectAllIntents,
  getISSPosition, formatISSForSpeech, getRecentEarthquakes,
  getHackerNews, getRandomCat, getRandomDog, getCryptoPrice,
  searchArxiv, searchCrossref, searchOpenAlex, searchEuropePMC,
  getWikidataFact, searxngSearch, searchTVShow, getTVSchedule,
  searchAnime, searchManga, getPokemon, formatPokemonForSpeech,
  detectTone as detectToneBrain
} from '../modules/avantBrain';
import { getCalendarEvents, getCurrentLocation, getWeather } from '../modules/phoneSync';
import { getPlanetFromText, PLANETS } from '../modules/solarSystem';
import { OWNER_NAME, VOICE_PITCH, VOICE_RATE } from '../modules/config';

const { width, height } = Dimensions.get('window');

const DISPLAY_MODES = {
  IDLE: 'idle', LISTENING: 'listening', THINKING: 'thinking',
  SPEAKING: 'speaking', PLANET: 'planet', MAP: 'map',
  IMAGE: 'image', SOLAR: 'solar_system',
};

export default function HomeScreen({ navigation }) {
  const [displayMode, setDisplayMode] = useState(DISPLAY_MODES.IDLE);
  const [transcript, setTranscript]   = useState('');
  const [response, setResponse]       = useState('');
  const [holoImages, setHoloImages]   = useState([]);
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [weather, setWeather]         = useState(null);
  const [time, setTime]               = useState(new Date());
  const [calEvents, setCalEvents]     = useState([]);
  const [listening, setListening]     = useState(false);
  const [wakeActive, setWakeActive]   = useState(false); // wake word indicator

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scanAnim  = useRef(new Animated.Value(0)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;

  // ── Register global navigation handler for voice commands ───
  useEffect(() => {
    global.__avantNavigate = (dest) => {
      navigation.navigate('Map', { destination: dest });
    };
    return () => { global.__avantNavigate = null; };
  }, [navigation]);

  // ── Wire VoiceEngine state changes to UI ────────────────────
  useEffect(() => {
    let VE;
    import('../../voice/voiceEngine').then(({ VoiceEngine }) => {
      VE = VoiceEngine;
      VoiceEngine.onStateChange = (state) => {
        if (state === 'listening') {
          setListening(true); setDisplayMode(DISPLAY_MODES.LISTENING); startGlowAnim();
        } else if (state === 'thinking') {
          setListening(false); setDisplayMode(DISPLAY_MODES.THINKING); startScanAnim();
        } else if (state === 'speaking') {
          setDisplayMode(DISPLAY_MODES.SPEAKING);
        } else {
          setListening(false); setDisplayMode(DISPLAY_MODES.IDLE);
        }
      };
    }).catch(() => {});
    return () => { if (VE) VE.onStateChange = null; };
  }, []);

  useEffect(() => {
    startPulse();
    loadInitialData();
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadInitialData() {
    try { const events = await getCalendarEvents(7); setCalEvents(events); } catch {}
    try {
      const loc = await getCurrentLocation();
      if (loc) { const w = await getWeather(loc.lat, loc.lon); if (w) setWeather(w); }
    } catch {}
  }

  // ── Animations ───────────────────────────────────────────────
  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0,  duration: 1500, useNativeDriver: true }),
    ])).start();
  }
  function startGlowAnim() {
    glowAnim.stopAnimation();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ])).start();
  }
  function startScanAnim() {
    scanAnim.stopAnimation();
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
  }

  // ── VOICE PRESS — tap the orb to start listening ─────────────
  // FIX: Uses real microphone, not Alert.prompt
  async function handleVoicePress() {
    if (listening) return;
    Vibration.vibrate(50);
    try {
      const { VoiceEngine } = await import('../../voice/voiceEngine');
      await VoiceEngine.runSession();
    } catch (e) {
      console.log('[HomeScreen] Voice session error:', e.message);
      speakText("I'm having trouble with the microphone. Check permissions.");
    }
  }

  // ── Process typed / pre-transcribed input ────────────────────
  async function processInput(text) {
    if (!text.trim()) { setListening(false); setDisplayMode(DISPLAY_MODES.IDLE); return; }
    setListening(false);
    setTranscript(text);
    setDisplayMode(DISPLAY_MODES.THINKING);
    startScanAnim();

    // Check for voice navigation
    if (/navigate|go to|take me to|directions to/i.test(text)) {
      const dest = text.replace(/navigate|go to|take me to|directions to/gi, '').trim();
      if (dest) {
        navigation.navigate('Map', { destination: dest });
        speakText(`Navigating to ${dest}.`);
        return;
      }
    }

    // Check for tab navigation
    if (/open (map|navigation|earth)/i.test(text)) { navigation.navigate('Map'); speakText('Opening the map.'); return; }
    if (/open (vision|camera|ar|hud)/i.test(text))  { navigation.navigate('AR');  speakText('Opening vision.'); return; }
    if (/open (spatial|brain|intelligence)/i.test(text)) { navigation.navigate('Spatial'); speakText('Opening spatial intelligence.'); return; }

    const visual   = detectVisualIntent(text);
    const extended = detectAllIntents(text);
    let context = '';
    if (text.length > 3) {
      try { const webData = await searchWebFull(text); if (webData) context = webData; } catch {}
    }

    const extResult = await handleExtendedIntent(extended);
    if (extResult) { displayAndSpeak(extResult, extended?.type); return; }
    if (visual?.type === 'planet') { showPlanet(visual.planet); return; }
    if (visual?.type === 'solar')  { showSolarSystem(); return; }

    // AI fallback
    const reply = await think(text, 'casual', context);
    displayAndSpeak(reply || "I didn't catch that. Try again?", 'text');
  }

  async function handleExtendedIntent(intent) {
    if (!intent) return null;
    try {
      switch (intent.type) {
        case 'iss':       { const d = await getISSPosition(); return formatISSForSpeech(d); }
        case 'earthquake':{ const d = await getRecentEarthquakes(); return d; }
        case 'news':      { const d = await getHackerNews(); return d; }
        case 'crypto':    { const d = await getCryptoPrice(intent.target); return d; }
        case 'arxiv':     { const d = await searchArxiv(intent.target); return d; }
        case 'europepmc': { const d = await searchEuropePMC(intent.target); return d; }
        case 'crossref':  { const d = await searchCrossref(intent.target); return d; }
        case 'openalex':  { const d = await searchOpenAlex(intent.target); return d; }
        case 'wikidata':  { const d = await getWikidataFact(intent.target); return d; }
        case 'tvshow':    { const d = await searchTVShow(intent.target); return d; }
        case 'tvschedule':{ const d = await getTVSchedule(); return d; }
        case 'anime':     { const d = await searchAnime(intent.target); return d; }
        case 'manga':     { const d = await searchManga(intent.target); return d; }
        case 'pokemon': {
          const p = await getPokemon(intent.target);
          return formatPokemonForSpeech(p);
        }
        case 'web':       { const d = await searxngSearch(intent.target); return d; }
        default:          return null;
      }
    } catch { return null; }
  }

  function displayAndSpeak(text, type = 'text') {
    setResponse(text);
    setDisplayMode(DISPLAY_MODES.SPEAKING);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    speakText(text);
  }

  function speakText(text) {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US', pitch: VOICE_PITCH, rate: VOICE_RATE,
      onDone: () => setDisplayMode(DISPLAY_MODES.IDLE),
    });
  }

  function showPlanet(planet) {
    setSelectedPlanet(planet);
    setDisplayMode(DISPLAY_MODES.PLANET);
    speakText(`${planet.name}. ${planet.description}`);
  }

  function showSolarSystem() {
    setDisplayMode(DISPLAY_MODES.SOLAR);
    speakText("Here's our solar system.");
  }

  // ── UI ───────────────────────────────────────────────────────
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.0] });
  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, height * 0.5] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050510" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ AVANT</Text>
        <Text style={styles.headerTime}>
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {weather && <Text style={styles.headerWeather}>{weather.temp}° {weather.condition}</Text>}
      </View>

      {/* ── Wake word status badge ── */}
      <View style={styles.wakeBadge}>
        <Animated.View style={[styles.wakeDot, {
          backgroundColor: listening ? '#00FF9F' : '#40AAFF44'
        }]} />
        <Text style={styles.wakeText}>
          {listening ? 'LISTENING' : displayMode === DISPLAY_MODES.THINKING ? 'THINKING' : displayMode === DISPLAY_MODES.SPEAKING ? 'SPEAKING' : '● READY — say "Hey Avant"'}
        </Text>
      </View>

      {/* ── Holographic Orb ── */}
      <View style={styles.orbSection}>
        <TouchableOpacity onPress={handleVoicePress} activeOpacity={0.8}>
          <Animated.View style={[styles.orbOuter, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View style={[styles.orbGlow, { opacity: glowOpacity }]} />
            <LinearGradient
              colors={
                listening ? ['#00FF9F', '#40AAFF', '#0055FF'] :
                displayMode === DISPLAY_MODES.THINKING ? ['#FFB344', '#FF6622', '#FF0044'] :
                displayMode === DISPLAY_MODES.SPEAKING ? ['#00FF9F', '#00AAFF', '#0022FF'] :
                ['#40AAFF', '#0044FF', '#000088']
              }
              style={styles.orb}>
              <Text style={styles.orbIcon}>
                {listening ? '🎙' : displayMode === DISPLAY_MODES.THINKING ? '⚙' : displayMode === DISPLAY_MODES.SPEAKING ? '💬' : '⚡'}
              </Text>
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>

        {/* Scan line during thinking */}
        {displayMode === DISPLAY_MODES.THINKING && (
          <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
        )}

        <Text style={styles.orbLabel}>
          {listening ? 'Listening...' : displayMode === DISPLAY_MODES.THINKING ? 'Processing...' : displayMode === DISPLAY_MODES.SPEAKING ? 'AVANT Speaking' : 'Tap or say "Hey Avant"'}
        </Text>
      </View>

      {/* ── Transcript & Response ── */}
      {transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>YOU</Text>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      ) : null}

      {response ? (
        <Animated.View style={[styles.responseBox, { opacity: fadeAnim }]}>
          <Text style={styles.responseLabel}>AVANT</Text>
          <ScrollView style={{ maxHeight: 160 }}>
            <Text style={styles.responseText}>{response}</Text>
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* ── Quick Voice Commands guide ── */}
      {displayMode === DISPLAY_MODES.IDLE && !response && (
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>VOICE COMMANDS</Text>
          {[
            '"Hey Avant, what\'s the weather?"',
            '"Navigate to downtown"',
            '"Open map"',
            '"Show me Saturn"',
            '"What\'s on TV tonight?"',
            '"Open vision"',
          ].map((h, i) => (
            <Text key={i} style={styles.hint}>{h}</Text>
          ))}
        </View>
      )}

      {/* ── Planet Display ── */}
      {displayMode === DISPLAY_MODES.PLANET && selectedPlanet && (
        <View style={styles.planetBox}>
          <Text style={styles.planetName}>{selectedPlanet.emoji} {selectedPlanet.name}</Text>
          <Text style={styles.planetDesc}>{selectedPlanet.description}</Text>
          {selectedPlanet.moons != null && (
            <Text style={styles.planetStat}>🌙 Moons: {selectedPlanet.moons}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#050510' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 },
  headerTitle:    { color: '#40AAFF', fontSize: 18, letterSpacing: 4, fontWeight: 'bold' },
  headerTime:     { color: '#40AAFF', fontSize: 14, fontFamily: 'monospace' },
  headerWeather:  { color: '#00FF9F', fontSize: 12 },

  wakeBadge:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  wakeDot:        { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  wakeText:       { color: '#40AAFF88', fontSize: 11, letterSpacing: 2 },

  orbSection:     { alignItems: 'center', marginVertical: 24, position: 'relative' },
  orbOuter:       { alignItems: 'center', justifyContent: 'center' },
  orbGlow:        { position: 'absolute', width: 180, height: 180, borderRadius: 90,
                    backgroundColor: '#40AAFF22', shadowColor: '#40AAFF', shadowRadius: 40, shadowOpacity: 1 },
  orb:            { width: 140, height: 140, borderRadius: 70, alignItems: 'center',
                    justifyContent: 'center', borderWidth: 2, borderColor: '#40AAFF88' },
  orbIcon:        { fontSize: 48 },
  orbLabel:       { color: '#40AAFF88', fontSize: 12, letterSpacing: 2, marginTop: 12 },

  scanLine:       { position: 'absolute', left: -50, right: -50, height: 1,
                    backgroundColor: '#40AAFF', shadowColor: '#40AAFF', shadowRadius: 6, shadowOpacity: 1 },

  transcriptBox:  { marginHorizontal: 20, marginBottom: 8, padding: 12,
                    backgroundColor: '#001022', borderRadius: 8, borderWidth: 1, borderColor: '#40AAFF33' },
  transcriptLabel:{ color: '#40AAFF88', fontSize: 9, letterSpacing: 2 },
  transcriptText: { color: '#fff', fontSize: 14, marginTop: 4 },

  responseBox:    { marginHorizontal: 20, marginBottom: 12, padding: 14,
                    backgroundColor: '#000A1A', borderRadius: 8, borderWidth: 1, borderColor: '#00FF9F44' },
  responseLabel:  { color: '#00FF9F', fontSize: 9, letterSpacing: 2 },
  responseText:   { color: '#ccc', fontSize: 14, marginTop: 4, lineHeight: 20 },

  hintBox:        { marginHorizontal: 20, padding: 14, backgroundColor: '#000814',
                    borderRadius: 8, borderWidth: 1, borderColor: '#40AAFF22' },
  hintTitle:      { color: '#40AAFF44', fontSize: 9, letterSpacing: 3, marginBottom: 8 },
  hint:           { color: '#40AAFF88', fontSize: 12, marginBottom: 4, fontStyle: 'italic' },

  planetBox:      { marginHorizontal: 20, padding: 16, backgroundColor: '#000A22',
                    borderRadius: 12, borderWidth: 1, borderColor: '#40AAFF55' },
  planetName:     { color: '#40AAFF', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  planetDesc:     { color: '#ccc', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  planetStat:     { color: '#00FF9F', fontSize: 12 },
});
