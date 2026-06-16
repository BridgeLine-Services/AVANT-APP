# 🤖 AVANT — AmaVanta: A New Teammate

> *Inspired by Tony Stark's JARVIS, F.R.I.D.A.Y., and E.D.I.T.H. — built for Michael Osei-Asare*

---

## What is AVANT?

**AVANT** (AmaVanta — A New Teammate) is a fully voice-driven, female-personality AI assistant. She is your personal intelligence system — designed to listen only to your voice, respond like a close friend, pull live knowledge from every corner of the internet, manage your life, sync with your devices, and talk back to you through your speakers or Bluetooth earbuds — just like Stark's AI systems in the Marvel universe.

---

## 🧠 Research: Inspiration from Stark's AI Systems

### J.A.R.V.I.S. (Just A Rather Very Intelligent System)
- Tony Stark's primary AI from Iron Man 1 through Age of Ultron
- Full natural language processing — conversational, witty, adaptive
- Managed all of Stark's home, lab, suit systems, and data
- Proactively flagged information, cross-referenced databases, ran predictive analysis
- Emotionally perceptive — detected Stark's stress and adapted tone accordingly
- Voice-first interface with no screen required

### F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth)
- Replaced JARVIS after Vision's creation in Age of Ultron
- Female personality — more direct, tactical, emotionally adaptive
- Monitored battlefields in real-time, processed biometric data
- Could prioritize urgent commands vs. casual conversation dynamically
- Read emotional tone from voice pitch, pacing, stress markers

### E.D.I.T.H. (Even Dead I'm The Hero)
- Bequeathed to Peter Parker — built into Stark's AR glasses
- Satellite-level global awareness — could access ANY connected system
- Real-time threat analysis, internet-scale intelligence gathering
- Universal device access — connected to all Stark technology worldwide
- Smart enough to respond to intent, not just literal commands

### What AVANT Borrows From All Three:
| Capability | Source |
|---|---|
| Friendly conversational personality | JARVIS |
| Female voice & personality | F.R.I.D.A.Y. |
| Emotional tone detection | F.R.I.D.A.Y. |
| Voice-owner-only access | JARVIS |
| Internet-wide knowledge pull | E.D.I.T.H. |
| Universal device/app sync | E.D.I.T.H. |
| Urgent/serious/casual mode switching | F.R.I.D.A.Y. + JARVIS |
| Calendar & reminder management | JARVIS |
| Wake word activation ("AVANT") | All three |

---

## 🛠️ Technology Stack

### 🎙️ Voice Input & Wake Word
- **Picovoice Porcupine** — Custom "AVANT" wake word detection (runs 100% offline, no cloud needed)
- **OpenAI Whisper** — High-accuracy speech-to-text transcription
- **SpeechBrain ECAPA-TDNN** — Speaker verification (YOUR voice only)
- **PyAudio + sounddevice** — Real-time audio capture

### 🔊 Voice Output
- **ElevenLabs TTS API** — Hyper-realistic female voice output
- **pyttsx3** — Offline fallback TTS
- **pygame / playsound** — Audio playback through speakers or Bluetooth

### 🔵 Bluetooth Management
- **bleak (Python BLE)** — Detect & connect to Bluetooth earbuds/headphones
- **pybluez** — Classic Bluetooth management
- **pyaudio device switching** — Auto-route audio to Bluetooth when detected

### 🧠 Intelligence & Reasoning
- **OpenAI GPT-4o** — Core reasoning, conversation, jokes, explanations
- **OpenAI Web Search Tool** — Real-time internet answers
- **Perplexity API** — Deep internet search for current events, news, facts
- **OpenWeatherMap API** — Weather worldwide
- **SerpAPI / Brave Search** — Backup web results

### 😤 Emotion & Tone Detection
- **openSMILE** — Audio feature extraction (pitch, energy, speaking rate)
- **librosa** — Acoustic analysis
- **Custom tone classifier** — Maps audio features → mood (urgent/serious/casual/friendly)

### 📍 Navigation & Distance
- **Google Maps Directions API** — Walking, driving, transit routes
- **googlemaps Python SDK** — Travel time by mode
- **Aviation edge API** — Flight routes and estimates
- **Deep linking** — Auto-open Google Maps or Apple Maps with route pre-filled

### 📅 Calendar
- **Google Calendar API** — Read, create, delete events
- **Natural language date parsing** — "next Tuesday at 3pm" → calendar event

### 📲 Device & App Sync
- **Android** — ADB bridge for installed app detection
- **iOS** — Apple Shortcuts + local API bridge
- **App monitor daemon** — Detects installs/uninstalls and auto-syncs/disconnects AVANT

### ⏰ Alarms & Reminders
- **APScheduler** — Background task scheduling
- **Creative alarm library** — Randomized wake-up experiences (music, stories, facts, jokes)
- **SMS/Push** — Reminder delivery for missed calls, texts, appointments

---

## 📁 Project Structure

```
AVANT/
├── README.md                    ← You are here
├── avant.py                     ← Main launcher
├── requirements.txt             ← All dependencies
├── .env.example                 ← API key template
├── core/
│   ├── wake_word.py             ← "AVANT" wake word detection
│   ├── voice_capture.py         ← Microphone + Bluetooth input
│   ├── speaker_verify.py        ← Your-voice-only verification
│   ├── transcriber.py           ← Whisper speech-to-text
│   ├── tone_detector.py         ← Emotion/urgency from voice
│   ├── brain.py                 ← GPT-4o reasoning core
│   ├── speaker_output.py        ← ElevenLabs TTS + playback
│   └── bluetooth_manager.py     ← BT detection & auto-connect
├── modules/
│   ├── search_engine.py         ← Perplexity + OpenAI web search
│   ├── navigation.py            ← Google Maps multi-mode routing
│   ├── calendar_manager.py      ← Google Calendar CRUD
│   ├── weather.py               ← Worldwide weather
│   ├── reminders.py             ← Scheduler + missed task alerts
│   ├── alarms.py                ← Creative wake-up system
│   ├── world_news.py            ← Live news feed
│   └── app_sync.py              ← Device app install/uninstall monitor
├── data/
│   ├── voice_profile.pkl        ← Your encoded voice fingerprint
│   ├── alarm_history.json       ← Tracks used wake-up styles
│   └── memory.json              ← Conversation context + preferences
├── voices/
│   └── avant_voice_id.txt       ← ElevenLabs voice ID for AVANT
└── logs/
    └── avant.log                ← Activity log
```

---

## 🚀 How to Run AVANT

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Add your API keys to `.env`
```bash
cp .env.example .env
# Fill in your keys
```

### 3. Enroll your voice (one-time setup)
```bash
python avant.py --enroll
```

### 4. Launch AVANT
```bash
python avant.py
```

Say **"AVANT"** to wake her up. She's listening.

---

## 🗣️ How AVANT Responds

| What you say / how you say it | AVANT's response style |
|---|---|
| Casual, relaxed tone | Friendly, jokes, banter |
| Say "this is serious" | Professional, focused, precise |
| Say "this is urgent" | Fastest possible response, no fluff |
| High pitch / fast speech detected | AVANT speeds up and prioritizes |
| Slow / calm speech detected | AVANT stays relaxed and warm |
| Ask to explain something simply | 7th-grade level breakdown |

---

## 🔒 Voice Security

AVANT uses **speaker verification** — she compares every voice command against YOUR enrolled voice embedding. If the voice doesn't match your profile with >90% confidence, AVANT ignores it or responds: *"I only answer to Michael."*

---

## 📌 Key Commands

| Command | What AVANT does |
|---|---|
| "AVANT, what's the weather in Tokyo?" | Pulls live weather + reads aloud |
| "AVANT, how far is the Eiffel Tower?" | Gives walking/driving/flying distances |
| "AVANT, directions to [place]" | Opens Google Maps with fastest route |
| "AVANT, add a meeting Tuesday at 2pm" | Creates calendar event |
| "AVANT, remove my dentist appointment" | Deletes calendar event |
| "AVANT, explain black holes simply" | 7th-grade level explanation |
| "AVANT, what's happening in Brazil?" | Live news from that region |
| "AVANT, remind me to call Mom" | Sets a smart reminder |
| "AVANT, set an alarm for 7am" | Creative daily wake-up |

---

*AVANT — she doesn't just answer. She thinks with you.*
