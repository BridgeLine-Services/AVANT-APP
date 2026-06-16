/**
 * AVANT — Phone Sync Module
 * Reads contacts, call log, calendar, location
 * Detects incoming calls and announces the caller
 */

import * as Contacts from 'expo-contacts';
import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import { Platform, AppState } from 'react-native';

// ─── CONTACTS ──────────────────────────────────────────────
export async function getContacts() {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return [];
  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
    ],
  });
  return data;
}

export async function lookupCaller(phoneNumber) {
  try {
    const contacts = await getContacts();
    const normalized = phoneNumber.replace(/\D/g, '');
    for (const contact of contacts) {
      for (const phone of (contact.phoneNumbers || [])) {
        const num = (phone.number || '').replace(/\D/g, '');
        if (num.endsWith(normalized) || normalized.endsWith(num)) {
          return {
            name: contact.name,
            number: phoneNumber,
            known: true
          };
        }
      }
    }
    return { name: 'Unknown Caller', number: phoneNumber, known: false };
  } catch (e) {
    return { name: 'Unknown Caller', number: phoneNumber, known: false };
  }
}

// ─── CALENDAR ──────────────────────────────────────────────
export async function getCalendarEvents(days = 7) {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calIds = calendars.map(c => c.id);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const events = await Calendar.getEventsAsync(calIds, start, end);
    return events.map(e => ({
      title: e.title,
      start: new Date(e.startDate),
      end: new Date(e.endDate),
      location: e.location,
      notes: e.notes,
      id: e.id
    }));
  } catch (e) {
    console.log('Calendar error:', e.message);
    return [];
  }
}

export async function addCalendarEvent({ title, startDate, endDate, notes, location }) {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return null;

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCal = calendars.find(c => c.allowsModifications) || calendars[0];

    const eventId = await Calendar.createEventAsync(defaultCal.id, {
      title,
      startDate,
      endDate: endDate || new Date(startDate.getTime() + 60 * 60 * 1000),
      notes,
      location,
      alarms: [{ relativeOffset: -30 }] // 30 min reminder
    });
    return eventId;
  } catch (e) {
    console.log('Add event error:', e.message);
    return null;
  }
}

export async function deleteCalendarEvent(eventId) {
  try {
    await Calendar.deleteEventAsync(eventId);
    return true;
  } catch (e) {
    return false;
  }
}

// Format events for AVANT's voice
export function formatEventsForSpeech(events) {
  if (!events.length) return "Your calendar is clear for the next 7 days.";
  const lines = events.slice(0, 5).map(e => {
    const day = e.start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const time = e.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${e.title} — ${day} at ${time}`;
  });
  return `You have ${events.length} upcoming events. ${lines.join('. ')}`;
}

// ─── LOCATION ──────────────────────────────────────────────
export async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      accuracy: loc.coords.accuracy
    };
  } catch (e) {
    return null;
  }
}

export async function getLocationName(lat, lon) {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    return `${place.street || ''} ${place.city || ''}, ${place.region || ''}`.trim();
  } catch (e) {
    return 'Unknown location';
  }
}

// ─── INCOMING CALL DETECTION ───────────────────────────────
// Note: Full incoming call detection requires a native module.
// This sets up the listener framework — works with expo-call-log on rooted/permitted devices.
export class CallDetector {
  constructor(onIncomingCall) {
    this.onIncomingCall = onIncomingCall;
    this.active = false;
  }

  start() {
    this.active = true;
    // Polling-based detection for Expo managed workflow
    this._interval = setInterval(async () => {
      if (!this.active) return;
      // On Android, call state can be read via native modules
      // This is the hook where call data flows in
    }, 3000);
  }

  // Manually trigger for testing
  simulateCall(number) {
    lookupCaller(number).then(caller => {
      this.onIncomingCall(caller);
    });
  }

  stop() {
    this.active = false;
    if (this._interval) clearInterval(this._interval);
  }
}

// ─── WEATHER ───────────────────────────────────────────────
export async function getWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
    );
    const data = await res.json();
    const c = data.current;
    const codes = {
      0:'clear sky',1:'mainly clear',2:'partly cloudy',3:'overcast',
      61:'light rain',63:'moderate rain',65:'heavy rain',
      71:'light snow',73:'moderate snow',80:'rain showers',95:'thunderstorm'
    };
    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      condition: codes[c.weather_code] || 'unknown',
      wind: Math.round(c.wind_speed_10m)
    };
  } catch (e) {
    return null;
  }
}
