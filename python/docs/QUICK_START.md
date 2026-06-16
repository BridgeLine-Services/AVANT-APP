# 🚀 AVANT Quick Start Guide

## What You Need (API Keys)

Get these free/paid accounts and copy your keys into `.env`:

| Service | What it does | Get key at |
|---|---|---|
| **OpenAI** | AVANT's brain + web search | platform.openai.com |
| **ElevenLabs** | AVANT's realistic female voice | elevenlabs.io |
| **Picovoice** | "AVANT" wake word detection | picovoice.ai |
| **Google Maps** | Navigation & directions | console.cloud.google.com |
| **OpenWeatherMap** | Live weather worldwide | openweathermap.org/api |
| **NewsAPI** | World news headlines | newsapi.org |
| **Perplexity** | Real-time internet search | perplexity.ai/api |

> Google Calendar is set up separately (see below)

---

## Step 1 — Environment Setup

```bash
cd AVANT
bash setup.sh       # Installs everything
```

Then open `.env` and fill in your API keys.

---

## Step 2 — Google Calendar (optional)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Google Calendar API**
3. Create OAuth 2.0 credentials → Download as `google_credentials.json`
4. Place file at `AVANT/data/google_credentials.json`
5. First time AVANT uses calendar, a browser will open for authorization

---

## Step 3 — Train the Custom Wake Word "AVANT"

1. Go to [console.picovoice.ai](https://console.picovoice.ai)
2. Sign up (free tier available)
3. Go to **Porcupine** → **Train Wake Word**
4. Enter the phrase: `AVANT`
5. Download the `.ppn` file
6. Place it at `AVANT/data/avant_wake_word.ppn`
7. Add your Access Key to `.env` as `PICOVOICE_ACCESS_KEY`

---

## Step 4 — Enroll Your Voice

This is how AVANT learns YOUR voice and blocks everyone else:

```bash
python avant.py --enroll
```

You'll record 5 short voice samples (~7 seconds each). Say anything naturally. AVANT creates your voice fingerprint and saves it.

---

## Step 5 — Launch AVANT

```bash
python avant.py
```

AVANT boots up and starts listening. Say **"AVANT"** and she'll respond.

### Test without a microphone
```bash
python avant.py --text
```
Type commands instead of speaking — great for testing your API keys.

---

## How to Talk to AVANT

| Say this | AVANT does this |
|---|---|
| `"AVANT"` | She wakes up and listens |
| `"AVANT, what's the weather in Paris?"` | Live weather for Paris |
| `"AVANT, how far is LAX?"` | Distance by walk/drive/fly |
| `"AVANT, directions to downtown"` | Opens Google Maps with route |
| `"AVANT, what's happening in Nigeria?"` | Live news from Nigeria |
| `"AVANT, add gym appointment Monday at 7am"` | Adds to Google Calendar |
| `"AVANT, remove my dentist appointment"` | Deletes the event |
| `"AVANT, remind me to call Marcus in 2 hours"` | Sets a voice reminder |
| `"AVANT, set an alarm for 7am"` | Creative morning wake-up |
| `"AVANT, explain quantum computing simply"` | 7th-grade explanation |
| `"AVANT, tell me a joke"` | She's funny. Promise. |
| `"AVANT, this is serious — ..."` | Switches to professional mode |
| `"AVANT, this is urgent — ..."` | Fastest possible response |

---

## ElevenLabs Voice Selection

1. Go to [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library)
2. Filter by "Feminine" voices
3. Listen to previews — find AVANT's voice
4. Copy the Voice ID
5. Paste into `.env` as `ELEVENLABS_VOICE_ID`

Recommended voices: **Rachel**, **Bella**, **Nicole**, **Elli**, **Domi**

---

## File Structure Reference

```
AVANT/
├── avant.py              ← Launch this
├── .env                  ← Your API keys (never share this!)
├── setup.sh              ← Run once to install
├── requirements.txt      ← All Python dependencies
├── core/                 ← Voice pipeline
│   ├── wake_word.py      ← "AVANT" detection
│   ├── speaker_verify.py ← Your-voice-only lock
│   ├── transcriber.py    ← Speech → text
│   ├── tone_detector.py  ← Mood/urgency detection
│   ├── brain.py          ← GPT-4o intelligence
│   ├── speaker_output.py ← Text → voice
│   └── bluetooth_manager.py ← BT auto-connect
├── modules/              ← Feature modules
│   ├── search_engine.py  ← Live internet search
│   ├── navigation.py     ← Maps + directions
│   ├── calendar_manager.py ← Google Calendar
│   ├── weather.py        ← World weather
│   ├── world_news.py     ← Global news
│   ├── reminders.py      ← Smart reminders
│   ├── alarms.py         ← Creative wake-ups
│   └── app_sync.py       ← Device app monitoring
└── data/                 ← Runtime data (auto-created)
    ├── voice_profile.pkl ← Your voice fingerprint
    ├── avant_wake_word.ppn ← Wake word model
    ├── google_credentials.json ← Calendar auth
    ├── memory.json        ← AVANT's memory
    ├── reminders.json     ← Saved reminders
    └── alarm_history.json ← Alarm history
```

---

## Troubleshooting

**"Wake word not working"**
- Make sure `avant_wake_word.ppn` is in `data/` folder
- Check `PICOVOICE_ACCESS_KEY` in `.env`

**"AVANT won't respond to my voice"**
- Run `python avant.py --enroll` again (re-enroll)
- Lower `VOICE_MATCH_THRESHOLD` to `0.80` in `.env`

**"No voice output"**
- Check `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`
- Try `pip install pygame playsound`

**"Calendar not connecting"**
- Make sure `google_credentials.json` is in `data/`
- Delete `data/google_token.json` and re-authorize

**"Navigation not working"**
- Verify `GOOGLE_MAPS_API_KEY` has Directions API + Geocoding API enabled

---

*AVANT — She doesn't just answer. She thinks with you.*

---

## Training the Custom "AVANT" Wake Word (FREE)

Since we replaced Picovoice with openWakeWord, here's how to train your custom wake word — takes under an hour, completely free:

**Step 1 — Open Google Colab (no install needed)**
Go to this link (free, runs in your browser):
https://colab.research.google.com/github/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb

**Step 2 — Set your wake word**
In the notebook, find the `TARGET_WORD` variable and change it to:
```
TARGET_WORD = "AVANT"
```

**Step 3 — Run all cells**
Click Runtime → Run all. It will:
- Auto-generate synthetic audio samples of "AVANT"
- Train a small neural classifier
- Takes ~30-45 minutes on Colab's free GPU

**Step 4 — Download your model**
When done, download the file named `avant.onnx` (or `avant.tflite`)

**Step 5 — Place it in AVANT**
```
AVANT/data/avant_wakeword.onnx
```

**Step 6 — Done!**
AVANT will now wake up when you say "AVANT" — no API key, no subscription, runs fully offline.

> **Can't train yet?** No problem — AVANT runs in Whisper fallback mode where it uses OpenAI to transcribe short audio clips and listen for the word "AVANT". It works great, just uses slightly more API calls.

---

## Phone Guardian Setup

**Find your phone's Bluetooth MAC address:**

*Android:* Settings → About Phone → Status → Bluetooth Address

*iPhone:* Settings → General → About → Bluetooth
(Note: iPhones use rotating addresses — use device name approach)

**Add to .env:**
```
PHONE_BT_ADDRESS=XX:XX:XX:XX:XX:XX
```

**GitHub backup setup:**
1. Go to github.com/settings/tokens → Generate new token (classic)
2. Give it `repo` scope
3. Add to .env:
```
GITHUB_TOKEN=ghp_yourtoken
GITHUB_REPO=yourusername/avant-backup
```

The repo will be created automatically (private) on first push.

**Voice commands for Phone Guardian:**
| Say this | What happens |
|---|---|
| `"AVANT, push to GitHub"` | Backs up everything immediately |
| `"AVANT, where is my phone?"` | Checks if phone is in Bluetooth range |
| `"AVANT, emergency backup"` | Same as push to GitHub |

AVANT also **automatically** watches your phone and:
- Warns you after 1 miss: *"Hey Michael, did you leave your phone?"*
- Warns again after 2nd miss (more urgently)
- Auto-pushes to GitHub after 3 misses without your phone returning
