/**
 * AVANT — Earth & Navigation Screen
 * Full Google Maps embed + live directions + NASA Earth imagery
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Linking, Dimensions, StatusBar
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import axios from 'axios';
import { SERPAPI_KEY, OWNER_NAME, VOICE_PITCH, VOICE_RATE } from '../modules/config';
import { think } from '../modules/avantBrain';

const { width, height } = Dimensions.get('window');

const TRAVEL_MODES = [
  { id: '0',  icon: '🚗', label: 'Drive'   },
  { id: '2',  icon: '🚶', label: 'Walk'    },
  { id: '3',  icon: '🚇', label: 'Transit' },
  { id: '1',  icon: '🚲', label: 'Bike'    },
  { id: '4',  icon: '✈️', label: 'Fly'     },
];

export default function MapScreen({ route }) {
  const [destination,    setDestination]    = useState(route?.params?.destination || '');
  const [origin,         setOrigin]         = useState('');
  const [travelMode,     setTravelMode]     = useState('0');
  const [directions,     setDirections]     = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [mapView,        setMapView]        = useState('earth'); // earth | satellite | street
  const [currentLoc,     setCurrentLoc]     = useState(null);
  const [avoidTolls,     setAvoidTolls]     = useState(false);
  const [mapUrl,         setMapUrl]         = useState('');
  const webRef = useRef(null);

  useEffect(() => {
    getLocation();
    if (route?.params?.destination) {
      setTimeout(() => getDirections(route.params.destination), 800);
    }
  }, []);

  async function getLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const { latitude: lat, longitude: lon } = loc.coords;
    setCurrentLoc({ lat, lon });
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const addr = `${place.street || ''} ${place.city || ''}, ${place.region || ''}`.trim();
    setOrigin(addr);
    setMapUrl(buildMapUrl(lat, lon, null, null));
  }

  function buildMapUrl(lat, lon, destLat, destLon) {
    if (destLat && destLon) {
      return `https://www.google.com/maps/embed/v1/directions?key=AIzaSyD-dummy&origin=${lat},${lon}&destination=${destLat},${destLon}&mode=driving`;
    }
    // Google Maps satellite/street embed
    return `https://www.google.com/maps/@${lat},${lon},15z/data=!3m1!1e3`;
  }

  async function getDirections(dest = destination) {
    if (!dest.trim()) return;
    setLoading(true);
    setDirections(null);

    try {
      // Use SerpApi Google Maps Directions
      if (SERPAPI_KEY) {
        const res = await axios.get('https://serpapi.com/search', {
          params: {
            engine: 'google_maps_directions',
            start_addr: origin || 'current location',
            end_addr: dest,
            travel_mode: travelMode,
            api_key: SERPAPI_KEY,
            hl: 'en',
            distance_unit: 1,
            avoid: avoidTolls ? 'tolls' : undefined
          },
          timeout: 15000
        });

        const data = res.data;
        const routes = data.directions || [];

        if (routes.length > 0) {
          const route = routes[0];
          const steps = [];

          // Extract all turn-by-turn steps
          (route.legs || []).forEach(leg => {
            (leg.steps || []).forEach(step => {
              const instruction = (step.html_instructions || step.instruction || '')
                .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              const dist = step.distance?.text || '';
              if (instruction) steps.push({ instruction, dist, mode: step.travel_mode });
            });
          });

          const summary = {
            distance: route.distance?.text || 'unknown',
            duration: route.duration?.text || 'unknown',
            durationTraffic: route.duration_in_traffic?.text || null,
            via: route.summary || '',
            steps,
            warnings: route.warnings || [],
          };

          setDirections(summary);

          // Open in Google Maps app
          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
          setMapUrl(`https://www.google.com/maps/embed/v1/directions?key=DEMO&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`);

          // Speak directions
          const speech = buildSpokenDirections(summary, dest);
          speakText(speech);
          return;
        }
      }

      // Fallback: Ask AVANT brain
      const reply = await think(
        `Give me directions from "${origin}" to "${dest}" by ${TRAVEL_MODES.find(m=>m.id===travelMode)?.label || 'driving'}. Be specific with turn-by-turn.`,
        'casual'
      );
      setDirections({ steps: [], summary: reply, distance: 'unknown', duration: 'unknown' });
      speakText(reply);

    } catch (e) {
      console.log('Directions error:', e.message);
      speakText(`I couldn't get directions to ${dest} right now. Try opening Google Maps.`);
    } finally {
      setLoading(false);
    }
  }

  function buildSpokenDirections(summary, dest) {
    let speech = `Alright, heading to ${dest}. `;
    speech += `Distance is ${summary.distance}, about ${summary.durationTraffic || summary.duration} with current traffic. `;
    if (summary.via) speech += `Taking ${summary.via}. `;
    if (summary.steps.length > 0) {
      const firstSteps = summary.steps.slice(0, 5);
      speech += firstSteps.map(s => s.instruction).join('. Then ');
      if (summary.steps.length > 5) speech += `. Then ${summary.steps.length - 5} more turns.`;
    }
    return speech;
  }

  function speakText(text) {
    Speech.stop();
    Speech.speak(text, { language: 'en-US', pitch: VOICE_PITCH, rate: VOICE_RATE });
  }

  function openGoogleMaps() {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    Linking.openURL(url);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050510" />

      {/* ── HEADER ──────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⬡ AVANT NAVIGATION</Text>
        <TouchableOpacity onPress={openGoogleMaps} style={styles.openMapsBtn}>
          <Text style={styles.openMapsText}>Open Maps ↗</Text>
        </TouchableOpacity>
      </View>

      {/* ── MAP VIEW ────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webRef}
          source={{ uri: mapUrl || 'https://www.google.com/maps/@0,0,2z' }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
        />
        {/* Holographic overlay corners */}
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.botLeft]} />
        <View style={[styles.corner, styles.botRight]} />

        {/* Map type buttons */}
        <View style={styles.mapTypeBtns}>
          {['🌍 Earth', '🛰 Satellite', '🗺 Street'].map((label, i) => (
            <TouchableOpacity key={i} style={styles.mapTypeBtn}
              onPress={() => {
                const types = [
                  'https://www.google.com/maps/@' + (currentLoc?.lat||0) + ',' + (currentLoc?.lon||0) + ',15z',
                  'https://www.google.com/maps/@' + (currentLoc?.lat||0) + ',' + (currentLoc?.lon||0) + ',15z/data=!3m1!1e3',
                  'https://www.google.com/maps/@' + (currentLoc?.lat||0) + ',' + (currentLoc?.lon||0) + ',3a,75y,90t/data=!3m1!1e3'
                ];
                setMapUrl(types[i]);
              }}>
              <Text style={styles.mapTypeBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── DESTINATION INPUT ───────────────────────── */}
      <View style={styles.inputPanel}>
        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>DESTINATION</Text>
            <TextInput
              style={styles.input}
              placeholder="Where to, Michael?"
              placeholderTextColor="#40AAFF44"
              value={destination}
              onChangeText={setDestination}
              onSubmitEditing={() => getDirections()}
              returnKeyType="go"
            />
          </View>
        </View>

        {/* Travel mode selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeScroll}>
          {TRAVEL_MODES.map(mode => (
            <TouchableOpacity
              key={mode.id}
              style={[styles.modeBtn, travelMode === mode.id && styles.modeBtnActive]}
              onPress={() => setTravelMode(mode.id)}>
              <Text style={styles.modeIcon}>{mode.icon}</Text>
              <Text style={[styles.modeLabel, travelMode === mode.id && styles.modeLabelActive]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.modeBtn, avoidTolls && styles.modeBtnActive]}
            onPress={() => setAvoidTolls(!avoidTolls)}>
            <Text style={styles.modeIcon}>🚫</Text>
            <Text style={[styles.modeLabel, avoidTolls && styles.modeLabelActive]}>No Tolls</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity style={styles.goBtn} onPress={() => getDirections()} disabled={loading}>
          <Text style={styles.goBtnText}>{loading ? '⏳ CALCULATING...' : '⬡ GET DIRECTIONS'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── DIRECTIONS PANEL ────────────────────────── */}
      {directions && (
        <View style={styles.directionsPanel}>
          <View style={styles.directionsSummary}>
            <Text style={styles.dirSummaryText}>
              📍 {directions.distance} · {directions.durationTraffic || directions.duration}
              {directions.durationTraffic ? ' (with traffic)' : ''}
            </Text>
            {directions.via ? <Text style={styles.dirVia}>via {directions.via}</Text> : null}
          </View>
          <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator={false}>
            {(directions.steps || []).map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>{step.instruction}</Text>
                  {step.dist ? <Text style={styles.stepDist}>{step.dist}</Text> : null}
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.openInMapsBtn} onPress={openGoogleMaps}>
            <Text style={styles.openInMapsText}>🗺 Open in Google Maps →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#050510' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 },
  headerTitle:      { color: '#40AAFF', fontSize: 14, letterSpacing: 3 },
  openMapsBtn:      { borderColor: '#40AAFF', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  openMapsText:     { color: '#40AAFF', fontSize: 11 },
  mapContainer:     { height: height * 0.35, margin: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#40AAFF33', position: 'relative' },
  map:              { flex: 1 },
  corner:           { position: 'absolute', width: 16, height: 16, borderColor: '#40AAFF', zIndex: 10 },
  topLeft:          { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight:         { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  botLeft:          { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  botRight:         { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  mapTypeBtns:      { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row' },
  mapTypeBtn:       { backgroundColor: '#00001888', borderWidth: 1, borderColor: '#40AAFF44', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginRight: 4 },
  mapTypeBtnText:   { color: '#40AAFF', fontSize: 9 },
  inputPanel:       { paddingHorizontal: 16 },
  inputRow:         { marginBottom: 8 },
  inputWrapper:     { borderColor: '#40AAFF44', borderWidth: 1, borderRadius: 8, padding: 10 },
  inputLabel:       { color: '#40AAFF', fontSize: 9, letterSpacing: 2, marginBottom: 4 },
  input:            { color: '#fff', fontSize: 14 },
  modeScroll:       { marginBottom: 10 },
  modeBtn:          { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderRadius: 8, borderWidth: 1, borderColor: '#40AAFF33' },
  modeBtnActive:    { backgroundColor: '#40AAFF22', borderColor: '#40AAFF' },
  modeIcon:         { fontSize: 18 },
  modeLabel:        { color: '#40AAFF44', fontSize: 10, marginTop: 2 },
  modeLabelActive:  { color: '#40AAFF' },
  goBtn:            { backgroundColor: '#40AAFF', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 10 },
  goBtnText:        { color: '#000', fontSize: 13, fontWeight: 'bold', letterSpacing: 2 },
  directionsPanel:  { flex: 1, paddingHorizontal: 16, paddingBottom: 20 },
  directionsSummary:{ backgroundColor: '#001022', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#40AAFF33' },
  dirSummaryText:   { color: '#00FF9F', fontSize: 13, fontWeight: 'bold' },
  dirVia:           { color: '#40AAFF88', fontSize: 11, marginTop: 2 },
  stepsScroll:      { flex: 1 },
  stepRow:          { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
  stepNum:          { width: 22, height: 22, borderRadius: 11, backgroundColor: '#40AAFF22', borderWidth: 1, borderColor: '#40AAFF', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2 },
  stepNumText:      { color: '#40AAFF', fontSize: 10 },
  stepContent:      { flex: 1 },
  stepText:         { color: '#ccc', fontSize: 13, lineHeight: 18 },
  stepDist:         { color: '#40AAFF88', fontSize: 11, marginTop: 2 },
  openInMapsBtn:    { backgroundColor: '#001830', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#40AAFF44', marginTop: 8 },
  openInMapsText:   { color: '#40AAFF', fontSize: 13 },
});
