# 📱 AVANT on Android — Termux Setup Guide
## AmaVanta running natively on your Android phone

This guide gets AVANT running directly on your Android device using Termux — a powerful Linux terminal app. No rooting required. AVANT will use your phone's microphone and speakers natively.

---

## What You'll Need
- Android phone (Android 7+)
- ~2GB free storage
- Internet connection for setup
- ~20 minutes

---

## Step 1 — Install Termux (IMPORTANT: Use F-Droid, NOT Play Store)

> ⚠️ The Play Store version of Termux is outdated and broken. Use F-Droid.

1. Download F-Droid from: **https://f-droid.org**
2. Open F-Droid → search "Termux" → install
3. Also install **Termux:API** from F-Droid (needed for microphone/notifications)

---

## Step 2 — First Launch Setup

Open Termux and run these commands one by one:

```bash
# Update package lists
pkg update && pkg upgrade -y

# Install core system packages
pkg install -y python git curl wget ffmpeg mpg123 portaudio clang make

# Install Termux API (for microphone + notifications)
pkg install -y termux-api

# Grant microphone permission
termux-microphone-record --help
# If it asks for permissions, tap ALLOW
```

---

## Step 3 — Install Python Dependencies

```bash
# Upgrade pip
pip install --upgrade pip

# Install core AVANT packages (these all work on Android)
pip install edge-tts groq openai python-dotenv loguru rich requests numpy

# Install audio packages
pip install sounddevice scipy

# Install pyaudio (needs portaudio installed above)
pip install pyaudio

# Install calendar & scheduling
pip install google-auth google-auth-oauthlib google-api-python-client schedule APScheduler python-dateutil pytz

# Install GitHub backup
pip install PyGithub

# Install wake word (may take a few minutes)
pip install openwakeword onnxruntime

# Optional: voice fingerprint (large download ~500MB — skip if low storage)
pip install speechbrain torch torchaudio
```

> 💡 **Low storage?** Skip speechbrain/torch — AVANT will run in "open voice mode" (anyone can talk to her). You can re-enroll later.

---

## Step 4 — Clone AVANT

```bash
# Go to home directory
cd ~

# Clone the repository
git clone https://github.com/BridgeLine-Services/AVANT.git

# Enter the project
cd AVANT

# Create data directory
mkdir -p data logs
```

---

## Step 5 — Configure Your API Keys

```bash
# Copy the template
cp .env.example .env

# Open it for editing
nano .env
```

Fill in these keys (see the Free APIs section below):

```
OWNER_NAME=Michael
OPENAI_API_KEY=sk-your-key-here
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
SERPAPI_KEY=your-serpapi-key
CURRENTS_API_KEY=your-currents-key
DEFAULT_HOME_ADDRESS=Your Home Address
DEFAULT_TIMEZONE=America/Los_Angeles
GITHUB_TOKEN=your-github-token
GITHUB_REPO=BridgeLine-Services/AVANT
```

Save with: `Ctrl+X` → `Y` → `Enter`

---

## Step 6 — Get Your Free API Keys

All of these are 100% free, no credit card:

| API | Sign Up | What It Does |
|-----|---------|--------------|
| **Groq** (fastest AI) | console.groq.com | AVANT's ultra-fast brain |
| **Gemini** (Google AI) | aistudio.google.com/apikey | Backup AI brain |
| **SerpApi** (search) | serpapi.com | Google Maps, News, Search |
| **Currents** (news) | currentsapi.services | World news 120k+ sources |
| **OpenWeather** | openweathermap.org/api | Weather (Open-Meteo needs no key) |

> Note: OpenAI key costs money but you already have it. Groq + Gemini are completely free replacements for most things.

---

## Step 7 — Train the AVANT Wake Word (Google Colab — Free)

1. On your phone browser, go to:
   **https://colab.research.google.com/github/BridgeLine-Services/AVANT/blob/main/AVANT_WakeWord_Training.ipynb**

2. Tap the three dots → "Open in Desktop mode" for better experience

3. Change Runtime to **T4 GPU** (Runtime → Change runtime type → T4)

4. Run all cells — takes ~40 minutes

5. Download `avant.onnx` when done

6. Move it to AVANT/data/:
```bash
# In Termux, once you download the file to Downloads:
cp /storage/emulated/0/Download/avant.onnx ~/AVANT/data/avant_wakeword.onnx
```

> **Can't train yet?** AVANT still works in Whisper fallback mode — say "AVANT" clearly and she'll hear you.

---

## Step 8 — Enroll Your Voice

```bash
cd ~/AVANT
python avant.py --enroll
```

This records 7 short voice samples (~5 seconds each). Speak naturally. AVANT creates your voice fingerprint — after this only your voice activates her.

---

## Step 9 — Launch AVANT! 🚀

```bash
cd ~/AVANT
python avant.py
```

Wait for the startup messages, then say **"AVANT"** — she'll respond through your phone's speaker.

---

## Keep AVANT Running (Background)

To keep AVANT running even when Termux is minimized:

```bash
# Install tmux (session manager)
pkg install tmux

# Start a persistent session
tmux new -s avant

# Launch AVANT inside it
python avant.py

# Detach (keep running): Ctrl+B then D
# Reattach later: tmux attach -t avant
```

---

## Grant All Needed Permissions

Go to **Settings → Apps → Termux → Permissions** and enable:
- ✅ Microphone
- ✅ Storage (for file access)
- ✅ Notifications (for reminders + alarms)

Also enable **Background Activity** so Termux stays running when the screen is off.

---

## Android-Specific Tips

**Bluetooth earbuds:**
```bash
# List paired Bluetooth devices
termux-bluetooth-scandevices
# AVANT auto-connects — just pair your earbuds normally in Android Settings
```

**Get your phone's Bluetooth MAC address (for Phone Guardian):**
```bash
# This shows your device's BT address
termux-telephony-deviceinfo
# OR go to: Settings → About Phone → Status → Bluetooth Address
```
Add it to .env: `PHONE_BT_ADDRESS=XX:XX:XX:XX:XX:XX`

**Wake AVANT without Termux being visible:**
- Pin Termux to Recent Apps (long-press the app in recents)
- Or use Termux:Widget to add a launcher

**Battery optimization:**
- Settings → Battery → Termux → "Don't optimize"
- This prevents Android from killing AVANT in the background

---

## Troubleshooting

**"No module named pyaudio"**
```bash
pkg install portaudio
pip install pyaudio
```

**"Permission denied" on microphone**
```bash
pkg install termux-api
termux-setup-storage
# Then restart Termux
```

**"edge-tts not working"**
```bash
pip install --upgrade edge-tts
# Make sure mpg123 is installed for playback:
pkg install mpg123
```

**"Can't hear AVANT through Bluetooth"**
- Pair your earbuds in Android Settings first
- Android auto-routes audio to the active Bluetooth device
- AVANT uses the system audio output automatically

**"Wake word not detecting"**
- Make sure `data/avant_wakeword.onnx` exists
- Or use Whisper fallback — works fine, uses slightly more battery

**Slow responses:**
- Make sure GROQ_API_KEY is set — Groq is 10x faster than GPT-4 on mobile
- Groq is free and runs Llama3-70b at 2000+ tokens/sec

---

## Text-Only Mode (No Microphone)

If you want to test without voice:
```bash
python avant.py --text
```
Type your commands instead of speaking.

---

## Voice Commands Quick Reference

| Say | AVANT Does |
|-----|-----------|
| `"AVANT"` | Wakes up and listens |
| `"AVANT, navigate to [place]"` | Live traffic directions + opens Maps |
| `"AVANT, weather in Tokyo"` | Live weather (Open-Meteo, no key) |
| `"AVANT, what's happening in Ghana?"` | Live news from Ghana |
| `"AVANT, how far is the airport?"` | All transport modes with times |
| `"AVANT, add dentist Tuesday 3pm"` | Google Calendar event |
| `"AVANT, remind me to call mom in 2 hours"` | Smart reminder |
| `"AVANT, push to GitHub"` | Emergency backup now |
| `"AVANT, explain quantum physics simply"` | 7th grade breakdown |
| `"AVANT, this is urgent — [question]"` | Instant Groq response |
| `"AVANT, search YouTube for [topic]"` | YouTube results |
| `"AVANT, find flights to New York"` | Live flight search |

---

## File Locations on Android

```
~/AVANT/
├── avant.py              ← Launch this
├── .env                  ← Your API keys
├── data/
│   ├── avant_wakeword.onnx  ← Wake word model (from Colab)
│   ├── voice_profile.pkl    ← Your voice fingerprint
│   └── google_credentials.json ← Calendar auth
└── QUICK_START.md        ← Full setup guide
```

---

*AVANT — She runs in your pocket. She thinks faster than anyone in the room.*
