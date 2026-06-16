/**
 * AVANT — AmaVanta: A New Teammate
 * Main App Entry Point
 * Full JARVIS-level AI assistant for Android
 */

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar, View, Text, StyleSheet, AppState, Vibration, Alert } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import * as Contacts from 'expo-contacts';

import HomeScreen   from './src/screens/HomeScreen';
import MapScreen    from './src/screens/MapScreen';
import { OWNER_NAME } from './src/modules/config';
import { getCalendarEvents } from './src/modules/phoneSync';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#050510',
          borderTopColor: '#40AAFF22',
          borderTopWidth: 1,
          paddingBottom: 5,
          height: 60,
        },
        tabBarActiveTintColor: '#40AAFF',
        tabBarInactiveTintColor: '#40AAFF44',
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1 },
      }}>
      <Tab.Screen name="AVANT"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚡</Text> }}
      />
      <Tab.Screen name="Earth"
        component={MapScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🌍</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const appState = useRef(AppState.currentState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initAVANT();
    requestPermissions();
  }, []);

  async function initAVANT() {
    // Brief startup delay then greet
    await new Promise(r => setTimeout(r, 1500));
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? 'Good morning' :
      hour < 17 ? 'Good afternoon' : 'Good evening';

    const message = `${greeting}, ${OWNER_NAME}. AVANT is online and ready. How can I help you today?`;
    Speech.speak(message, {
      language: 'en-US',
      pitch: 1.1,
      rate: 0.95,
    });
    setIsReady(true);
  }

  async function requestPermissions() {
    await Notifications.requestPermissionsAsync();
    await Contacts.requestPermissionsAsync();
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#050510" />
      <NavigationContainer theme={{
        dark: true,
        colors: {
          primary: '#40AAFF',
          background: '#050510',
          card: '#050510',
          text: '#ffffff',
          border: '#40AAFF22',
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
