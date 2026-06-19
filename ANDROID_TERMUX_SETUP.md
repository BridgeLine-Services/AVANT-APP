# AVANT — Complete Android Setup Guide

## Option A — EAS Cloud Build (Easiest — no local tools needed)

### Step 1: Install Expo CLI
```bash
npm install -g eas-cli expo-cli
```

### Step 2: Clone and install
```bash
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP
npm install
```

### Step 3: Log in to Expo
```bash
eas login
# Create free account at expo.dev if you don't have one
```

### Step 4: Build APK
```bash
eas build --platform android --profile preview
```

- Build takes ~8–12 minutes in the cloud
- EAS sends you a **download link** when done
- Transfer the `.apk` to your phone → tap to install

### Step 5: Allow installation
On your Android phone:
1. Settings → Apps → Special App Access → Install Unknown Apps
2. Find your file manager or browser → Enable "Allow from this source"
3. Tap the downloaded `.apk` → Install

---

## Option B — Local Build (Android Studio)

### Prerequisites
| Tool | Version | Download |
|------|---------|----------|
| Node.js | 20+ | nodejs.org |
| Java JDK | 17 | adoptium.net |
| Android Studio | Latest | developer.android.com/studio |

### Steps
```bash
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP
npm install

# Generate native Android project
npx expo prebuild --platform android --clean

# Build debug APK (for testing)
cd android
./gradlew assembleDebug

# APK location:
# android/app/build/outputs/apk/debug/app-debug.apk

# Build release APK
./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

---

## Option C — Termux (on Android device itself)

```bash
# 1. Install Termux from F-Droid (NOT Google Play)
#    https://f-droid.org/packages/com.termux/

# 2. Open Termux and run:
pkg update && pkg upgrade -y
pkg install nodejs git -y

# 3. Clone
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP

# 4. Install deps
npm install

# 5. Start in Expo Go mode (no build needed)
npx expo start --tunnel

# 6. Install Expo Go from Play Store
# Scan the QR code shown in terminal
```

---

## API Keys Setup

Edit `src/modules/config.js` — the keys you have (OpenRouter, Gemini, Jina)
are already injected. For remaining optional keys:

```js
// src/modules/config.js
export const GROQ_API_KEY    = 'gsk_...';   // console.groq.com — free
export const SERPAPI_KEY     = '...';        // serpapi.com — 100/month free
export const GOOGLE_MAPS_KEY = '...';        // for turn-by-turn navigation
```

---

## What works without any extra keys

✅ AVANT AI chat (via OpenRouter: Gemini → DeepSeek → Qwen → Llama)
✅ Web search and reading (Jina AI)
✅ Wake word detection ("AVANT")
✅ Voice input/output
✅ Spatial mapping + memory
✅ Predictions + timeline
✅ Maps (OpenStreetMap, no key needed)
✅ Weather (Open-Meteo, no key needed)
✅ News (DuckDuckGo, no key needed)

---

## Vercel Web Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Or connect your GitHub repo to vercel.com
# Build command:  npx expo export --platform web --output-dir dist
# Output dir:     dist
# Framework:      Other
```

The `vercel.json` in the repo handles all routing automatically.
