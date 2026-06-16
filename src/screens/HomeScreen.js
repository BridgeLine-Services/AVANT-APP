/**
 * AVANT — Main Home Screen
 * The JARVIS interface — holographic display, voice orb, live data
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, StatusBar, Image, Alert, Vibration
} from 'react-native';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { think, searchWeb, searchImages, detectVisualIntent } from '../modules/avantBrain';
import { getCalendarEvents, formatEventsForSpeech, getCurrentLocation, getWeather } from '../modules/phoneSync';
import { getPlanetFromText, PLANETS } from '../modules/solarSystem';
import { OWNER_NAME, VOICE_PITCH, VOICE_RATE } from '../modules/config';

const { width, height } = Dimensions.get('window');

// ─── HOLOGRAPHIC DISPLAY MODES ─────────────────────────────
const DISPLAY_MODES = {
  IDLE:       'idle',
  LISTENING:  'listening',
  THINKING:   'thinking',
  SPEAKING:   'speaking',
  PLANET:     'planet',
  MAP:        'map',
  IMAGE:      'image',
  SOLAR:      'solar_system',
};

export default function HomeScreen({ navigation }) {
  const [displayMode, setDisplayMode]   = useState(DISPLAY_MODES.IDLE);
  const [transcript,  setTranscript]    = useState('');
  const [response,    setResponse]      = useState('');
  const [holoImages,  setHoloImages]    = useState([]);
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [weather,     setWeather]       = useState(null);
  const [time,        setTime]          = useState(new Date());
  const [calEvents,   setCalEvents]     = useState([]);
  const [listening,   setListening]     = useState(false);
  const [callerInfo,  setCallerInfo]    = useState(null);

  // Animations
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const scanAnim    = useRef(new Animated.Value(0)).current;

  // ── INIT ──────────────────────────────────────────────────
  useEffect(() => {
    startPulse();
    loadInitialData();
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadInitialData() {
    // Load calendar
    const events = await getCalendarEvents(7);
    setCalEvents(events);
    // Load weather
    const loc = await getCurrentLocation();
    if (loc) {
      const w = await getWeather(loc.lat, loc.lon);
      if (w) setWeather(w);
    }
  }

  // ── ANIMATIONS ────────────────────────────────────────────
  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }

  function startListeningAnim() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }

  function startScanAnim() {
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
  }

  // ── VOICE INPUT (using Web Speech via typing fallback) ────
  // Full voice via expo-av recording + Whisper API
  async function handleVoicePress() {
    if (listening) return;
    Vibration.vibrate(50);
    setListening(true);
    setDisplayMode(DISPLAY_MODES.LISTENING);
    startListeningAnim();

    // Show listening indicator — user types or voice captured
    // In full native build, this triggers the microphone
    // For Expo Go testing, prompts text input
    Alert.prompt(
      '🎙️ AVANT is Listening...',
      'What would you like to ask?',
      [
        { text: 'Cancel', onPress: () => { setListening(false); setDisplayMode(DISPLAY_MODES.IDLE); } },
        { text: 'Send', onPress: (text) => processInput(text || '') }
      ],
      'plain-text',
      '',
      'default'
    );
  }

  // ── PROCESS INPUT ─────────────────────────────────────────
  async function processInput(text) {
    if (!text.trim()) { setListening(false); setDisplayMode(DISPLAY_MODES.IDLE); return; }
    setListening(false);
    setTranscript(text);
    setDisplayMode(DISPLAY_MODES.THINKING);
    startScanAnim();

    // Detect visual intent
    const visual = detectVisualIntent(text);

    // Get web data if needed
    let context = '';
    if (text.length > 3) {
      const webData = await searchWeb(text);
      if (webData) context = webData;
    }

    // Get AVANT's response
    const reply = await think(text, detectTone(text), context);
    setResponse(reply);

    // Handle visual display
    await handleVisualDisplay(visual, text);

    // Speak the response
    setDisplayMode(DISPLAY_MODES.SPEAKING);
    speakResponse(reply);
  }

  function detectTone(text) {
    const lower = text.toLowerCase();
    if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('asap')) return 'urgent';
    if (lower.includes('serious') || lower.includes('important')) return 'serious';
    if (lower.includes('simply') || lower.includes('explain') || lower.includes('7th grade')) return 'simple';
    return 'casual';
  }

  async function handleVisualDisplay(visual, originalText) {
    if (visual.type === 'planet' || visual.type === 'solar_system') {
      const planet = getPlanetFromText(originalText);
      if (planet) {
        setSelectedPlanet(planet);
        setDisplayMode(DISPLAY_MODES.PLANET);
        return;
      }
      setDisplayMode(DISPLAY_MODES.SOLAR);
      return;
    }
    if (visual.type === 'map') {
      setDisplayMode(DISPLAY_MODES.MAP);
      navigation.navigate('Map', { destination: visual.target });
      return;
    }
    if (visual.type === 'image' && visual.target) {
      const imgs = await searchImages(visual.target);
      if (imgs.length > 0) {
        setHoloImages(imgs);
        setDisplayMode(DISPLAY_MODES.IMAGE);

        Animated.timing(fadeAnim, {
          toValue: 1, duration: 800, useNativeDriver: true
        }).start();
        return;
      }
    }
    setDisplayMode(DISPLAY_MODES.SPEAKING);
  }

  function speakResponse(text) {
    Speech.stop();
    const cleanText = text.replace(/[#*`]/g, '').trim();
    Speech.speak(cleanText, {
      language: 'en-US',
      pitch: VOICE_PITCH,
      rate: VOICE_RATE,
      voice: 'com.apple.voice.compact.en-US.Samantha',
      onDone: () => setDisplayMode(DISPLAY_MODES.IDLE),
      onError: () => setDisplayMode(DISPLAY_MODES.IDLE),
    });
  }

  // ── RENDER ─────────────────────────────────────────────────
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050510" />
      <LinearGradient colors={['#050510', '#0a0a2a', '#050510']} style={StyleSheet.absoluteFill} />

      {/* Scanning grid lines */}
      <ScanLines />

      {/* ── TOP STATUS BAR ──────────────────────────────── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.timeText}>{timeStr}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
        <View style={styles.topRight}>
          {weather && (
            <Text style={styles.weatherText}>
              {weather.temp}°F · {weather.condition}
            </Text>
          )}
          <Text style={[styles.statusDot,
            { color: displayMode === DISPLAY_MODES.IDLE ? '#00FF9F' : '#40AAFF' }]}>
            {displayMode === DISPLAY_MODES.IDLE ? '● STANDBY' :
             displayMode === DISPLAY_MODES.LISTENING ? '● LISTENING' :
             displayMode === DISPLAY_MODES.THINKING ? '● PROCESSING' : '● ACTIVE'}
          </Text>
        </View>
      </View>

      {/* ── INCOMING CALL BANNER ────────────────────────── */}
      {callerInfo && (
        <View style={styles.callerBanner}>
          <Text style={styles.callerIcon}>📞</Text>
          <View>
            <Text style={styles.callerName}>{callerInfo.name}</Text>
            <Text style={styles.callerNum}>{callerInfo.number}</Text>
          </View>
          <TouchableOpacity onPress={() => setCallerInfo(null)} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── MAIN HOLOGRAPHIC DISPLAY ─────────────────────── */}
      <View style={styles.holoContainer}>

        {/* Planet View */}
        {(displayMode === DISPLAY_MODES.PLANET && selectedPlanet) && (
          <PlanetDisplay planet={selectedPlanet} onClose={() => setDisplayMode(DISPLAY_MODES.IDLE)} />
        )}

        {/* Solar System View */}
        {displayMode === DISPLAY_MODES.SOLAR && (
          <SolarSystemDisplay onPlanetSelect={(p) => {
            setSelectedPlanet(PLANETS[p]);
            setDisplayMode(DISPLAY_MODES.PLANET);
          }} />
        )}

        {/* Holographic Image Grid */}
        {(displayMode === DISPLAY_MODES.IMAGE && holoImages.length > 0) && (
          <Animated.View style={[styles.holoImages, { opacity: fadeAnim }]}>
            <Text style={styles.holoLabel}>⬡ AVANT VISUAL SCAN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {holoImages.map((img, i) => (
                <View key={i} style={styles.holoImageFrame}>
                  <View style={styles.holoCorner} />
                  <Image
                    source={{ uri: img.url }}
                    style={styles.holoImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.holoImageLabel}>{img.title.slice(0, 30)}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => { setDisplayMode(DISPLAY_MODES.IDLE); fadeAnim.setValue(0); }}>
              <Text style={styles.closeHolo}>✕ CLOSE DISPLAY</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* AVANT Voice Orb */}
        {[DISPLAY_MODES.IDLE, DISPLAY_MODES.THINKING, DISPLAY_MODES.SPEAKING, DISPLAY_MODES.LISTENING].includes(displayMode) && (
          <View style={styles.orbSection}>
            {/* Outer glow rings */}
            <Animated.View style={[styles.orbRing3, { transform: [{ scale: pulseAnim }], opacity: 0.15 }]} />
            <Animated.View style={[styles.orbRing2, { transform: [{ scale: pulseAnim }], opacity: 0.25 }]} />
            <Animated.View style={[styles.orbRing1, { transform: [{ scale: pulseAnim }], opacity: 0.4 }]} />

            {/* Core orb */}
            <TouchableOpacity onPress={handleVoicePress} activeOpacity={0.8}>
              <LinearGradient
                colors={
                  displayMode === DISPLAY_MODES.LISTENING ? ['#00FF9F', '#00CC80'] :
                  displayMode === DISPLAY_MODES.THINKING  ? ['#FFB800', '#FF8C00'] :
                  displayMode === DISPLAY_MODES.SPEAKING  ? ['#40AAFF', '#0066CC'] :
                  ['#40AAFF', '#0044AA']
                }
                style={styles.orb}
              >
                <Text style={styles.orbIcon}>
                  {displayMode === DISPLAY_MODES.LISTENING ? '🎙️' :
                   displayMode === DISPLAY_MODES.THINKING  ? '⚡' :
                   displayMode === DISPLAY_MODES.SPEAKING  ? '🔊' : 'A'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.orbLabel}>
              {displayMode === DISPLAY_MODES.IDLE     ? `Tap to speak to AVANT` :
               displayMode === DISPLAY_MODES.LISTENING ? 'I\'m listening, Michael...' :
               displayMode === DISPLAY_MODES.THINKING  ? 'Processing...' :
               'Speaking...'}
            </Text>
          </View>
        )}
      </View>

      {/* ── TRANSCRIPT / RESPONSE PANEL ─────────────────── */}
      {(transcript || response) && (
        <View style={styles.responsePanel}>
          {transcript ? (
            <View style={styles.transcriptBubble}>
              <Text style={styles.transcriptLabel}>YOU</Text>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          ) : null}
          {response ? (
            <View style={styles.responseBubble}>
              <Text style={styles.responseLabel}>AVANT</Text>
              <ScrollView style={{ maxHeight: 120 }}>
                <Text style={styles.responseText}>{response}</Text>
              </ScrollView>
              <TouchableOpacity onPress={() => speakResponse(response)} style={styles.replayBtn}>
                <Text style={styles.replayText}>🔊 Replay</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* ── QUICK ACTION BUTTONS ─────────────────────────── */}
      <View style={styles.quickActions}>
        {[
          { icon: '🌍', label: 'Earth', onPress: () => navigation.navigate('Map') },
          { icon: '🪐', label: 'Space', onPress: () => { setDisplayMode(DISPLAY_MODES.SOLAR); setResponse(''); setTranscript(''); } },
          { icon: '📅', label: 'Events', onPress: async () => {
            const events = await getCalendarEvents(7);
            const speech = formatEventsForSpeech(events);
            setResponse(speech);
            speakResponse(speech);
          }},
          { icon: '🌤️', label: 'Weather', onPress: async () => {
            const loc = await getCurrentLocation();
            if (loc) {
              const w = await getWeather(loc.lat, loc.lon);
              if (w) {
                const msg = `Right now it's ${w.temp}°F, feels like ${w.feelsLike}°F, ${w.condition}, winds at ${w.wind}mph.`;
                setResponse(msg);
                speakResponse(msg);
              }
            }
          }},
          { icon: '🔍', label: 'Search', onPress: handleVoicePress },
        ].map((btn, i) => (
          <TouchableOpacity key={i} style={styles.quickBtn} onPress={btn.onPress}>
            <Text style={styles.quickIcon}>{btn.icon}</Text>
            <Text style={styles.quickLabel}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── PLANET DISPLAY COMPONENT ─────────────────────────────
function PlanetDisplay({ planet, onClose }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.planetContainer}>
      <Text style={styles.planetTitle}>{planet.name.toUpperCase()}</Text>

      {/* Planet visualization */}
      <Animated.View style={[styles.planetOrb, {
        backgroundColor: planet.color,
        shadowColor: planet.glowColor,
        transform: [{ rotate: spin }]
      }]}>
        {planet.hasRings && <View style={[styles.ringOuter, { borderColor: planet.ringColor }]} />}
        {planet.hasRings && <View style={[styles.ringInner, { borderColor: planet.ringColor }]} />}
      </Animated.View>

      {/* Planet image from NASA */}
      <Image
        source={{ uri: planet.nasaUrl }}
        style={styles.planetNASAImg}
        resizeMode="cover"
      />

      {/* Facts */}
      <View style={styles.factsContainer}>
        <Text style={styles.factsTitle}>⬡ SCAN COMPLETE</Text>
        {(planet.facts || []).map((fact, i) => (
          <Text key={i} style={styles.factLine}>◈ {fact}</Text>
        ))}
      </View>

      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
        <Text style={styles.closeBtnText}>✕ CLOSE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── SOLAR SYSTEM DISPLAY ─────────────────────────────────
function SolarSystemDisplay({ onPlanetSelect }) {
  const planetKeys = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto'];

  return (
    <View style={styles.solarContainer}>
      <Text style={styles.solarTitle}>⬡ SOLAR SYSTEM — TAP A PLANET</Text>
      {/* Sun */}
      <View style={[styles.sunOrb, { backgroundColor: PLANETS.sun.color, shadowColor: PLANETS.sun.glowColor }]}>
        <Text style={styles.sunLabel}>☀</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planetsRow}>
        {planetKeys.map(key => {
          const p = PLANETS[key];
          return (
            <TouchableOpacity key={key} style={styles.planetItem} onPress={() => onPlanetSelect(key)}>
              <View style={[styles.miniPlanet, {
                backgroundColor: p.color,
                width: Math.max(p.size * 0.6, 18),
                height: Math.max(p.size * 0.6, 18),
                borderRadius: Math.max(p.size * 0.3, 9),
                shadowColor: p.glowColor
              }]} />
              <Text style={styles.miniPlanetName}>{p.name.replace('The ','')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── SCAN LINES OVERLAY ───────────────────────────────────
function ScanLines() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 20 }).map((_, i) => (
        <View key={i} style={[styles.scanLine, { top: i * (height / 20) }]} />
      ))}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#050510' },
  topBar:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 },
  topRight:         { alignItems: 'flex-end' },
  timeText:         { color: '#40AAFF', fontSize: 28, fontWeight: '200', letterSpacing: 4 },
  dateText:         { color: '#40AAFF88', fontSize: 12, letterSpacing: 2, marginTop: 2 },
  weatherText:      { color: '#00FF9F', fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  statusDot:        { fontSize: 11, letterSpacing: 2 },
  callerBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#001830', borderColor: '#40AAFF', borderWidth: 1, marginHorizontal: 20, borderRadius: 12, padding: 12, marginBottom: 8 },
  callerIcon:       { fontSize: 24, marginRight: 12 },
  callerName:       { color: '#40AAFF', fontSize: 16, fontWeight: 'bold' },
  callerNum:        { color: '#888', fontSize: 12 },
  dismissBtn:       { marginLeft: 'auto', padding: 8 },
  dismissText:      { color: '#888', fontSize: 16 },
  holoContainer:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbSection:       { alignItems: 'center', justifyContent: 'center' },
  orbRing3:         { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#40AAFF' },
  orbRing2:         { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: '#40AAFF' },
  orbRing1:         { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#40AAFF' },
  orb:              { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', elevation: 20 },
  orbIcon:          { fontSize: 36, color: '#fff' },
  orbLabel:         { color: '#40AAFF88', fontSize: 13, marginTop: 20, letterSpacing: 1 },
  holoImages:       { alignItems: 'center', width: width },
  holoLabel:        { color: '#40AAFF', fontSize: 12, letterSpacing: 3, marginBottom: 12 },
  holoImageFrame:   { marginHorizontal: 8, borderWidth: 1, borderColor: '#40AAFF44', borderRadius: 8, overflow: 'hidden', position: 'relative' },
  holoCorner:       { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#40AAFF', zIndex: 1 },
  holoImage:        { width: 150, height: 150 },
  holoImageLabel:   { color: '#40AAFF', fontSize: 10, padding: 4, backgroundColor: '#00001888' },
  closeHolo:        { color: '#FF4444', fontSize: 12, letterSpacing: 2, marginTop: 16 },
  planetContainer:  { alignItems: 'center', width: width, paddingHorizontal: 20 },
  planetTitle:      { color: '#40AAFF', fontSize: 16, letterSpacing: 4, marginBottom: 12 },
  planetOrb:        { width: 80, height: 80, borderRadius: 40, shadowOpacity: 0.8, shadowRadius: 20, elevation: 15, marginBottom: 8 },
  ringOuter:        { position: 'absolute', top: -15, left: -25, width: 130, height: 110, borderRadius: 65, borderWidth: 3, borderColor: '#C8A84B', opacity: 0.7 },
  ringInner:        { position: 'absolute', top: -8, left: -15, width: 110, height: 96, borderRadius: 55, borderWidth: 2, borderColor: '#C8A84B', opacity: 0.4 },
  planetNASAImg:    { width: width - 80, height: 160, borderRadius: 8, borderWidth: 1, borderColor: '#40AAFF44', marginBottom: 12 },
  factsContainer:   { width: '100%', backgroundColor: '#001830', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#40AAFF22' },
  factsTitle:       { color: '#40AAFF', fontSize: 11, letterSpacing: 3, marginBottom: 8 },
  factLine:         { color: '#88CCFF', fontSize: 12, marginBottom: 4, lineHeight: 18 },
  closeBtn:         { marginTop: 12, borderColor: '#FF4444', borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 4 },
  closeBtnText:     { color: '#FF4444', fontSize: 12, letterSpacing: 2 },
  solarContainer:   { alignItems: 'center', width: width },
  solarTitle:       { color: '#40AAFF', fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  sunOrb:           { width: 50, height: 50, borderRadius: 25, shadowOpacity: 1, shadowRadius: 20, elevation: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  sunLabel:         { fontSize: 28 },
  planetsRow:       { maxHeight: 100 },
  planetItem:       { alignItems: 'center', marginHorizontal: 12 },
  miniPlanet:       { shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
  miniPlanetName:   { color: '#40AAFF88', fontSize: 10, marginTop: 4, letterSpacing: 1 },
  responsePanel:    { paddingHorizontal: 16, paddingBottom: 8, maxHeight: 200 },
  transcriptBubble: { backgroundColor: '#001022', borderRadius: 8, padding: 10, marginBottom: 6, borderLeftWidth: 2, borderLeftColor: '#40AAFF' },
  transcriptLabel:  { color: '#40AAFF', fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  transcriptText:   { color: '#ccc', fontSize: 13 },
  responseBubble:   { backgroundColor: '#000F20', borderRadius: 8, padding: 10, borderLeftWidth: 2, borderLeftColor: '#00FF9F' },
  responseLabel:    { color: '#00FF9F', fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  responseText:     { color: '#aaffcc', fontSize: 13, lineHeight: 20 },
  replayBtn:        { marginTop: 6, alignSelf: 'flex-end' },
  replayText:       { color: '#40AAFF', fontSize: 11 },
  quickActions:     { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingBottom: 30, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#40AAFF22' },
  quickBtn:         { alignItems: 'center' },
  quickIcon:        { fontSize: 22 },
  quickLabel:       { color: '#40AAFF88', fontSize: 9, marginTop: 4, letterSpacing: 1 },
  scanLine:         { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#40AAFF', opacity: 0.04 },
});
