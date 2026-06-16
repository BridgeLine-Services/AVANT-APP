# ⚡ AVANT — AmaVanta: A New Teammate

> *"She's not just an assistant. She's your person."*

AVANT is a full JARVIS-level AI assistant — voice-activated, personality-driven, and connected to the entire internet — built for Android with a React Native frontend and a Python backend for local/Termux use.

---

## 📁 Repository Structure

```
AVANT/                          ← This repository (merged)
│
├── 📱 REACT NATIVE APP (Primary)
│   ├── App.js                  ← App entry, startup greeting, navigation
│   ├── app.json                ← Expo config, permissions, Android settings
│   ├── index.js                ← Register root component
│   ├── package.json            ← All RN dependencies
│   ├── babel.config.js         ← Babel + Reanimated plugin
│   ├── eas.json                ← EAS Build profiles (APK / AAB)
│   └── src/
│       ├── modules/
│       │   ├── avantBrain.js   ← 7-engine AI cascade + 30+ zero-signup APIs
│       │   ├── config.js       ← All API endpoints & keys (with ✅ markers)
│       │   ├── phoneSync.js    ← Contacts, calendar, location, weather
│       │   └── solarSystem.js  ← Planet data, NASA imagery, APOD
│       └── screens/
│           ├── HomeScreen.js   ← JARVIS holographic UI, voice orb, displays
│           └── MapScreen.js    ← Google Maps embed, directions, travel modes
│
└── 🐍 PYTHON BACKEND (Termux / Desktop)
    └── python/
        ├── avant.py            ← Main Python entry point
        ├── .env.example        ← All API key slots with signup links
        ├── requirements.txt    ← Python dependencies
        ├── setup.sh            ← One-command Termux/Linux setup
        ├── core/
        │   ├── brain.py        ← Python LLM cascade (Groq→Gemini→GPT-4o)
        │   ├── wake_word.py    ← openWakeWord offline detection
        │   ├── transcriber.py  ← Whisper speech-to-text
        │   ├── speaker_output.py   ← Edge-TTS voice (feminine)
        │   ├── speaker_verify.py   ← Voice biometrics (owner-only)
        │   ├── tone_detector.py    ← Detects serious/urgent/casual/simple
        │   └── bluetooth_manager.py ← BT headphone auto-connect
        ├── modules/
        │   ├── alarms.py       ← Creative alarm system
        │   ├── app_sync.py     ← Monitors installed apps
        │   ├── calendar_manager.py ← Google Calendar read/write
        │   ├── navigation.py   ← Routes, distances, travel modes
        │   ├── phone_guardian.py   ← GitHub backup on phone loss
        │   ├── reminders.py    ← Smart reminder system
        │   ├── search_engine.py    ← Multi-source web search
        │   ├── weather.py      ← Open-Meteo weather
        │   └── world_news.py   ← Multi-source news aggregator
        └── docs/
            ├── QUICK_START.md
            ├── ANDROID_TERMUX_SETUP.md
            ├── PUBLISH_TO_ANDROID.md
            └── AVANT_WakeWord_Training.ipynb
```

---

## 🚀 Quick Start — React Native App

### Option A — Expo Go (5 minutes, zero setup)
1. Install **Expo Go** from the Play Store
2. Go to [snack.expo.dev](https://snack.expo.dev) → Import from GitHub → `BridgeLine-Services/AVANT-APP`
3. Scan the QR code

### Option B — Real APK via EAS Build
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```
EAS builds on Expo's cloud servers — no computer needed. You get a direct APK download link.

### Option C — Local Dev
```bash
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP
npm install
npx expo start
```

---

## 🐍 Quick Start — Python Backend (Termux)

```bash
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP/python
cp .env.example .env
# Fill in your keys in .env
bash setup.sh
python avant.py
```

Full Termux guide: [`python/docs/ANDROID_TERMUX_SETUP.md`](python/docs/ANDROID_TERMUX_SETUP.md)

---

## 🔑 API Keys — What You Need

### ✅ Works right now — zero signup, zero key
| API | Powers |
|-----|--------|
| Open-Meteo | Weather forecasts |
| NASA Images | Space photos |
| Open Notify | Live ISS tracking |
| Nominatim / OSM | Maps & geocoding |
| REST Countries | Country data & flags |
| Wikipedia | Encyclopedia |
| Wikidata SPARQL | Structured facts |
| DictionaryAPI | Definitions |
| DuckDuckGo | Instant answers |
| SearXNG | Full web search |
| arXiv | Research papers |
| Crossref | Scientific publications |
| OpenAlex | Academic knowledge |
| Europe PMC | Medical research |
| CoinGecko | Crypto prices |
| Hacker News | Tech news |
| USGS | Earthquake data |
| TVMaze | TV shows & schedules |
| Jikan | Anime & manga |
| PokéAPI | Pokémon data |
| Gutendex | 70K free books |
| Open Library | Book search |
| Quotable | Inspirational quotes |
| Dog CEO / Cat API | Fun images |

### 🔑 Optional — adds AI brain (all free tiers)
| Provider | Get Key | Benefit |
|----------|---------|---------|
| **Groq** | [console.groq.com](https://console.groq.com) | 2000+ tok/sec, Llama 3.3 70B |
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | 1,500 req/day |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) | 5M free tokens |
| **Cerebras** | [cloud.cerebras.ai](https://cloud.cerebras.ai) | 1M tokens/day |

Fill keys into `src/modules/config.js` (React Native) or `python/.env` (Python).

---

## 🎙️ AVANT's Capabilities

| Feature | How to trigger |
|---------|---------------|
| Wake word | Say **"AVANT"** |
| Casual chat | Just talk |
| Serious mode | Include *"serious"* |
| Urgent mode | Include *"urgent"* |
| Simple explanation | Include *"explain simply"* or *"7th grade"* |
| Weather | *"What's the weather?"* |
| Navigate | *"Navigate to [place]"* |
| Planets / space | *"Tell me about Saturn"* |
| ISS tracking | *"Where is the ISS?"* |
| Earthquakes | *"Any earthquakes today?"* |
| Tech news | *"Hacker News"* |
| TV schedule | *"What's on TV tonight?"* |
| Anime | *"Best anime"* |
| Pokémon | *"Tell me about Charizard"* |
| Research papers | *"Research papers about AI"* |
| Medical research | *"Medical research on diabetes"* |
| Crypto | *"Bitcoin price"* |
| Calendar | *"What's on my calendar?"* |
| Set reminder | *"Remind me to call John at 3pm"* |

---

## 🏗️ Architecture

```
Voice Input (Microphone / BT Headphones)
        ↓
Wake Word Detection (openWakeWord — offline)
        ↓
Voice Biometrics (owner-only, Resemblyzer)
        ↓
Speech-to-Text (Groq Whisper / on-device)
        ↓
Tone Detection → casual / serious / urgent / simple
        ↓
Intent Router → detectVisualIntent + detectAllIntents
        ↓
Zero-Signup API Layer (SearXNG, Wikipedia, arXiv, etc.)
        ↓
AI Brain Cascade:
  Groq → Cerebras → DeepSeek → Gemini → Mistral → Together → GPT-4o
        ↓
Response → Text-to-Speech (Edge-TTS / expo-speech)
        ↓
Holographic Display (planet, image, map, data panel)
```

---

## 📌 Acronym

**A**maVanta — **A** **N**ew **T**eammate

---

*Built by BridgeLine Services*
