/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Root App (React Native / Expo)                    ║
 * ║                                                              ║
 * ║  Boots in order:                                            ║
 * ║  1. Request Android permissions                             ║
 * ║  2. Start foreground voice kernel (native)                  ║
 * ║  3. Init wake word bridge (JS ↔ Kotlin)                     ║
 * ║  4. Load offline cache                                      ║
 * ║  5. Greet owner                                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer }  from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { GestureHandlerRootView }   from 'react-native-gesture-handler';
import {
  View, Text, TouchableOpacity, StyleSheet,
  AppState, Platform, StatusBar, Alert
} from 'react-native';
import * as Speech       from 'expo-speech';
import * as Notifications from 'expo-notifications';

import HomeScreen from './src/screens/HomeScreen';
import MapScreen  from './src/screens/MapScreen';
import { OWNER_NAME } from './src/modules/config';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Notification handler ───────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false
  }),
});

// ── Permission request list ────────────────────────────────────
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
  ].filter(Boolean);

  try {
    await PermissionsAndroid.requestMultiple(perms);
  } catch (e) { console.warn('Permission request error:', e); }
}

// ── Start the native foreground service ───────────────────────
function startKernelService() {
  try {
    const { NativeModules } = require('react-native');
    NativeModules?.AvantModule?.startVoiceKernel?.();
  } catch (e) {
    console.log('Native kernel not available (Expo Go mode) — using JS voice engine');
  }
}

// ── Init JS wake word bridge ───────────────────────────────────
function initWakeBridge() {
  try {
    // Dynamic import so missing TS compiler doesn't break Expo Go
    import('./voice/voiceEngine').then(({ initWakeWordBridge }) => {
      initWakeWordBridge();
    }).catch(e => console.log('Voice engine (TS) not compiled yet:', e.message));
  } catch (e) {}
}

// ── Bottom tab navigator ───────────────────────────────────────
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#050510',
          borderTopColor:  '#40AAFF22',
          borderTopWidth:  1,
          paddingBottom:   6,
          height:          62,
        },
        tabBarActiveTintColor:   '#40AAFF',
        tabBarInactiveTintColor: '#40AAFF33',
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1, fontWeight: '600' },
      }}>
      <Tab.Screen
        name="AVANT"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚡</Text> }}
      />
      <Tab.Screen
        name="Earth"
        component={MapScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🌍</Text> }}
      />
    </Tab.Navigator>
  );
}

// ── Root App ───────────────────────────────────────────────────
export default function App() {
  const appState  = useRef(AppState.currentState);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    boot();

    // Re-activate when app comes to foreground
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        console.log('AVANT foregrounded');
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  async function boot() {
    try {
      // 1. Permissions
      await requestAllPermissions();

      // 2. Notification channel
      await Notifications.requestPermissionsAsync();

      // 3. Start native foreground service
      startKernelService();

      // 4. Init JS wake word bridge (fallback / web mode)
      initWakeBridge();

      // 5. Brief pause then greet
      await new Promise(r => setTimeout(r, 1200));
      const hour = new Date().getHours();
      const greeting =
        hour < 5  ? 'Hey, you\'re up late' :
        hour < 12 ? 'Good morning' :
        hour < 17 ? 'Good afternoon' : 'Good evening';

      Speech.speak(`${greeting}, ${OWNER_NAME}. AVANT is online.`, {
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
      <NavigationContainer theme={{
        dark: true,
        colors: {
          primary:      '#40AAFF',
          background:   '#050510',
          card:         '#050510',
          text:         '#ffffff',
          border:       '#40AAFF22',
          notification: '#40AAFF',
        }
      }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="Map"  component={MapScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
