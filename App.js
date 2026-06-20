/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Root App (FIXED)                                   ║
 * ║                                                              ║
 * ║  FIXES:                                                      ║
 * ║  • CAMERA permission added to requestAllPermissions          ║
 * ║  • Floating overlay service started on boot                  ║
 * ║  • Wake word bridge started on boot                          ║
 * ║  • No camera permission re-prompt if already granted         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  View, Text, TouchableOpacity, StyleSheet,
  AppState, Platform, StatusBar, Alert
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import ARScreen from './src/screens/ARScreen';
import SpatialScreen from './src/screens/SpatialScreen';
import { OWNER_NAME } from './src/modules/config';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
}

// ── Permission request — includes CAMERA & SYSTEM_ALERT_WINDOW ──
async function requestAllPermissions() {
  const { PermissionsAndroid } = require('react-native');
  if (Platform.OS !== 'android') return;

  const perms = [
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
    PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    PermissionsAndroid.PERMISSIONS.CAMERA,  // FIX: was missing
  ].filter(Boolean);

  try {
    const results = await PermissionsAndroid.requestMultiple(perms);
    const denied = Object.entries(results)
      .filter(([, v]) => v !== PermissionsAndroid.RESULTS.GRANTED)
      .map(([k]) => k.split('.').pop());
    if (denied.length > 0) {
      console.log('[AVANT] Permissions not granted:', denied.join(', '));
    }
  } catch (e) {
    console.warn('Permission request error:', e);
  }
}

// ── Start native foreground service ──────────────────────────
function startKernelService() {
  try {
    const { NativeModules } = require('react-native');
    NativeModules?.AvantModule?.startVoiceKernel?.();
    NativeModules?.AvantModule?.startFloatingOverlay?.(); // FIX: start overlay
  } catch (e) {
    console.log('Native kernel not available (Expo Go mode) — using JS voice engine');
  }
}

// ── Init JS wake word bridge ──────────────────────────────────
function initWakeBridge() {
  try {
    import('./voice/voiceEngine').then(({ initWakeWordBridge }) => {
      initWakeWordBridge();
      console.log('[AVANT] Wake word bridge active — say "Hey Avant"');
    }).catch(e => console.log('Voice engine not compiled yet:', e.message));
  } catch (e) {}
}

// ── Bottom tab navigator ──────────────────────────────────────
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#050510', borderTopColor: '#40AAFF33' },
        tabBarActiveTintColor: '#40AAFF',
        tabBarInactiveTintColor: '#40AAFF44',
      }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: () => <Text>⚡</Text> }} />
      <Tab.Screen name="Map"  component={MapScreen}  options={{ tabBarIcon: () => <Text>🌍</Text> }} />
      <Tab.Screen name="AR"   component={ARScreen}   options={{ tabBarIcon: () => <Text>👁</Text> }} />
      <Tab.Screen name="Spatial" component={SpatialScreen} options={{ tabBarIcon: () => <Text>🧠</Text> }} />
    </Tab.Navigator>
  );
}

// ── Root App ──────────────────────────────────────────────────
export default function App() {
  const appState = useRef(AppState.currentState);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    boot();
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        console.log('[AVANT] Foregrounded — wake word engine active');
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  async function boot() {
    try {
      await requestAllPermissions();
      if (Platform.OS !== 'web') await Notifications.requestPermissionsAsync();
      startKernelService();
      initWakeBridge(); // FIX: continuous wake word loop starts here

      // Init intelligence + spatial
      import('./intelligence/contextEngine').then(({ initContextEngine }) => {
        initContextEngine().catch(() => {
          import('./spatial/spatialEngine').then(({ initSpatialEngine }) => {
            initSpatialEngine().catch(() => {});
          }).catch(() => {});
        });
      }).catch(() => {
        import('./spatial/spatialEngine').then(({ initSpatialEngine }) => {
          initSpatialEngine().catch(() => {});
        }).catch(() => {});
      });

      await new Promise(r => setTimeout(r, 1200));
      const hour = new Date().getHours();
      const greeting =
        hour < 5  ? 'Hey, you\'re up late' :
        hour < 12 ? 'Good morning' :
        hour < 17 ? 'Good afternoon' :
                    'Good evening';

      Speech.speak(`${greeting}, ${OWNER_NAME}. AVANT is online. I'm listening.`, {
        language: 'en-US', pitch: 1.1, rate: 0.95,
      });
      setBooted(true);
    } catch (e) {
      console.error('Boot error:', e);
      setBooted(true);
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#050510" />
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
