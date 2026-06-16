# 🚀 How to Officially Publish AVANT to Android
## Get AVANT on the Google Play Store — Complete Guide

---

## The Big Picture

Publishing AVANT to Android officially means:
1. **Packaging** AVANT (Python) into an Android APK/AAB file
2. **Signing** it with your personal developer key
3. **Creating** a Google Play Developer account
4. **Uploading** to the Play Store
5. **Passing** Google's review (3-7 days for new accounts)

There are **2 routes** — choose based on your skills:

| Route | Difficulty | Time | Best For |
|-------|-----------|------|---------|
| **Route A: Buildozer + Kivy** | Medium | 2-4 hours | Full control, AVANT as a native app |
| **Route B: BeeWare Briefcase** | Medium | 2-3 hours | Cleaner Python support |

> **Recommended: Route A (Buildozer)** — most widely used, most support online.

---

# ═══════════════════════════════════════
# PHASE 1 — ONE-TIME SETUP ($25)
# ═══════════════════════════════════════

## Step 1 — Create Your Google Play Developer Account

1. Go to: **https://play.google.com/console**
2. Sign in with your Google account
3. Click **"Get started"**
4. Fill in:
   - Developer name: `BridgeLine Services` (or your name)
   - Email address
   - Phone number
5. Pay the **one-time $25 registration fee** (credit/debit card)
6. Upload a **government-issued ID** (driver's license or passport)
   - This is now required for all new accounts (2026 rule)
   - Verification takes 1-3 business days

> ✅ **This $25 is FOREVER** — one account, unlimited apps, never pay again.

---

# ═══════════════════════════════════════
# PHASE 2 — BUILD THE APK
# ═══════════════════════════════════════

## Route A — Buildozer (Recommended)

Buildozer converts your Python app into an Android APK automatically.
**Must be done on Linux** (Ubuntu, or Ubuntu inside WSL on Windows).

---

### Step 2A — Set Up Ubuntu (Windows users: use WSL)

**If you're on Windows:**
```
1. Open Microsoft Store → search "Ubuntu 22.04" → Install
2. Launch Ubuntu from Start menu
3. Set a username and password when prompted
```

**If you're already on Mac/Linux:** open your terminal.

---

### Step 3A — Install Build Dependencies

In your Ubuntu terminal, run these one by one:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install all build tools
sudo apt install -y \
  python3 python3-pip python3-venv \
  git zip unzip openjdk-17-jdk \
  autoconf libtool libffi-dev libssl-dev \
  build-essential libsqlite3-dev sqlite3 \
  libncursesw5-dev libreadline-gplv2-dev \
  zlib1g-dev libbz2-dev libexpat1-dev \
  ffmpeg

# Install Buildozer + Cython
pip3 install --user buildozer cython
```

---

### Step 4A — Create a Kivy Launcher Wrapper for AVANT

AVANT is a Python backend app. To make it an Android APK, we wrap it in a minimal Kivy shell that launches AVANT's core when the app opens.

Create a new folder on your computer:

```bash
mkdir ~/AVANT-android
cd ~/AVANT-android

# Clone your AVANT project
git clone https://github.com/BridgeLine-Services/AVANT.git src/

# Create the Kivy entry point
cat > main.py << 'EOF'
"""
AVANT Android Launcher
Wraps AVANT's Python backend in a Kivy shell for Android packaging.
"""
import os, sys, threading
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.scrollview import ScrollView
from kivy.core.window import Window
from kivy.clock import Clock

# Add AVANT src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

class AVANTApp(App):
    def build(self):
        Window.clearcolor = (0.05, 0.05, 0.1, 1)  # Dark navy background

        layout = BoxLayout(orientation='vertical', padding=20, spacing=10)

        # Header
        title = Label(
            text='⚡ AVANT',
            font_size='32sp',
            bold=True,
            color=(0.4, 0.8, 1, 1),
            size_hint_y=None,
            height=60
        )

        subtitle = Label(
            text='AmaVanta — A New Teammate\nListening for your voice...',
            font_size='14sp',
            color=(0.7, 0.9, 1, 0.8),
            size_hint_y=None,
            height=50,
            halign='center'
        )

        # Status display
        scroll = ScrollView(size_hint=(1, 1))
        self.log_label = Label(
            text='Initializing AVANT...',
            font_size='13sp',
            color=(0.8, 1, 0.8, 1),
            size_hint_y=None,
            text_size=(Window.width - 40, None),
            halign='left',
            valign='top'
        )
        self.log_label.bind(texture_size=self.log_label.setter('size'))
        scroll.add_widget(self.log_label)

        # Control button
        self.toggle_btn = Button(
            text='🎙️  SAY "AVANT" TO ACTIVATE',
            font_size='16sp',
            background_color=(0.2, 0.5, 0.9, 1),
            size_hint_y=None,
            height=55
        )
        self.toggle_btn.bind(on_press=self.toggle_avant)

        layout.add_widget(title)
        layout.add_widget(subtitle)
        layout.add_widget(scroll)
        layout.add_widget(self.toggle_btn)

        # Start AVANT in background thread
        self.avant_thread = threading.Thread(
            target=self._start_avant, daemon=True
        )
        self.avant_thread.start()

        return layout

    def _start_avant(self):
        """Launch AVANT's core engine in background."""
        try:
            self._log("Loading AVANT modules...")
            from src.avant import AVANT
            self.avant_instance = AVANT()
            self._log("✅ AVANT online — say 'AVANT' to wake her up!")
            Clock.schedule_once(
                lambda dt: setattr(
                    self.toggle_btn, 'text',
                    '🟢  AVANT IS LISTENING — Say "AVANT"'
                ), 0
            )
            self.avant_instance.run()
        except Exception as e:
            self._log(f"⚠️ AVANT error: {e}")
            self._log("Check your .env file has the required API keys.")

    def _log(self, message):
        """Thread-safe UI log update."""
        def update(dt):
            current = self.log_label.text
            lines = current.split('\n')
            lines.append(message)
            # Keep last 20 lines
            if len(lines) > 20:
                lines = lines[-20:]
            self.log_label.text = '\n'.join(lines)
        Clock.schedule_once(update, 0)

    def toggle_avant(self, instance):
        self._log("Tap noted — use your voice to talk to AVANT!")

if __name__ == '__main__':
    AVANTApp().run()
EOF
```

---

### Step 5A — Create buildozer.spec (the build config)

```bash
cat > buildozer.spec << 'EOF'
[app]
title = AVANT
package.name = avant
package.domain = com.bridgeline.avant
source.dir = .
source.include_exts = py,png,jpg,jpeg,kv,atlas,json,txt,onnx,pkl,env
version = 1.0.0
requirements = python3,kivy,requests,openai,edge-tts,numpy,scipy,loguru,python-dotenv,schedule,APScheduler,pytz,python-dateutil,bleak
android.permissions = RECORD_AUDIO,INTERNET,ACCESS_NETWORK_STATE,ACCESS_FINE_LOCATION,ACCESS_COARSE_LOCATION,BLUETOOTH,BLUETOOTH_ADMIN,BLUETOOTH_CONNECT,BLUETOOTH_SCAN,RECEIVE_BOOT_COMPLETED,VIBRATE,POST_NOTIFICATIONS,FOREGROUND_SERVICE
android.api = 33
android.minapi = 24
android.ndk = 25b
android.archs = arm64-v8a, armeabi-v7a
android.allow_backup = True
fullscreen = 0
android.orientation = portrait
icon.filename = %(source.dir)s/assets/icon.png
presplash.filename = %(source.dir)s/assets/splash.png

[buildozer]
log_level = 2
warn_on_root = 1
EOF
```

---

### Step 6A — Add App Icons

```bash
# Create assets folder
mkdir -p assets

# Download placeholder icon (replace with your own 512x512 PNG)
curl -o assets/icon.png "https://via.placeholder.com/512x512/0a0a1a/40aaff?text=AVANT"
curl -o assets/splash.png "https://via.placeholder.com/1024x500/0a0a1a/40aaff?text=AVANT+by+BridgeLine"
```

> 💡 **Better option:** Design a real icon at **canva.com** (free).
> Make it 512x512 PNG. AVANT's colors: dark navy `#0a0a1a`, electric blue `#40aaff`.

---

### Step 7A — Build the APK

```bash
# This takes 20-40 minutes the first time (downloads Android SDK)
buildozer -v android debug
```

When it finishes, your APK is at:
```
bin/avant-1.0.0-arm64-v8a-debug.apk
```

**Test it on your phone first:**
```bash
# Install directly to your phone via USB
# First enable: Settings → Developer Options → USB Debugging
buildozer android deploy run logcat
```

---

### Step 8A — Build the RELEASE APK (for Play Store)

```bash
# Generate a signing keystore (ONE TIME — save this file forever)
keytool -genkey -v \
  -keystore avant-release-key.keystore \
  -alias avant \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# You'll be asked for:
# - Keystore password (make it strong, NEVER lose it)
# - First/last name, org, city, country
# - Key password (can be same as keystore password)

# Build signed release AAB (what Play Store wants)
buildozer -v android release
```

> ⚠️ **CRITICAL:** Back up `avant-release-key.keystore` to Google Drive or GitHub.
> If you lose it, you can NEVER update your app on the Play Store. Ever.

---

# ═══════════════════════════════════════
# PHASE 3 — UPLOAD TO PLAY STORE
# ═══════════════════════════════════════

## Step 9 — Create Your App in Play Console

1. Go to **https://play.google.com/console**
2. Click **"Create app"**
3. Fill in:
   - App name: `AVANT - Your AI Voice Assistant`
   - Default language: English (United States)
   - App or Game: **App**
   - Free or Paid: **Free**
4. Click **"Create app"**

---

## Step 10 — Fill In Store Listing

Go to **"Store listing"** in the left sidebar:

**App name (30 chars max):**
```
AVANT - AI Voice Assistant
```

**Short description (80 chars max):**
```
Your personal JARVIS-level AI — voice-locked, always listening for you.
```

**Full description (4000 chars max):**
```
AVANT — AmaVanta, A New Teammate.

AVANT is your personal AI assistant inspired by Tony Stark's JARVIS, F.R.I.D.A.Y., and E.D.I.T.H. She listens for your voice only, responds like a brilliant best friend, and can do almost anything.

What AVANT can do:
🎙️ Wake up on your voice — just say "AVANT"
🔒 Voice-locked — only responds to you
🗺️ Live turn-by-turn navigation with real traffic
🌍 Real-time world news from 120,000+ sources
🌤️ Hyperlocal weather anywhere on earth
📅 Google Calendar read, create, and delete
⏰ Smart alarms with creative wake-up styles
🔔 Reminders for calls, texts, and appointments
🎧 Auto-connects to your Bluetooth earbuds
✈️ Live flight search and prices
💬 Casual conversation, jokes, deep discussions
📚 Explains anything at any level — even 7th grade
🆘 Urgent mode — instant responses when it matters
🐙 Emergency GitHub backup of your data

Powered by: GPT-4o, Groq Llama3, Google Gemini, and SerpApi.

AVANT doesn't just answer questions — she knows you.
```

---

## Step 11 — Upload Your Graphics

| Asset | Size | Required |
|-------|------|---------|
| App icon | 512x512 PNG | ✅ Yes |
| Feature graphic | 1024x500 PNG | ✅ Yes |
| Phone screenshots | 2-8 screenshots | ✅ Yes |

**Take screenshots** by running AVANT on your phone and screenshotting the UI.

**Design graphics free at:** canva.com → search "App Store Icon"

---

## Step 12 — Set Up Content Rating

1. Left sidebar → **"Content rating"**
2. Click **"Start questionnaire"**
3. Select category: **Utility**
4. Answer questions (AVANT collects voice — answer yes to audio recording)
5. Submit → you'll get a rating like **"Everyone"**

---

## Step 13 — Privacy Policy (Required)

Google requires a privacy policy. Here's how to make one free:

1. Go to **https://www.privacypolicygenerator.info**
2. Fill in: App name = AVANT, Company = BridgeLine Services
3. Select: collects voice data, microphone access, internet access
4. Generate → copy the URL

Add the URL in Play Console → **"App content"** → **"Privacy policy"**

---

## Step 14 — Upload Your AAB

1. Left sidebar → **"Production"** → **"Create new release"**
2. Click **"Upload"** → select your signed `.aab` file
   - File is at: `bin/avant-1.0.0-arm64-v8a-release.aab`
3. Add release notes:
   ```
   AVANT v1.0 — Initial Release
   • Full voice-locked AI assistant
   • Live navigation with traffic
   • World news, weather, calendar
   ```
4. Click **"Review release"** → **"Start rollout to Production"**

---

## Step 15 — IMPORTANT: 14-Day Testing Requirement

> ⚠️ **New Google rule (2026):** New developer accounts must complete
> **14 days of closed testing with at least 12 testers** before going live.

**How to handle this:**

1. Left sidebar → **"Closed testing"** → **"Create track"**
2. Name it: `Alpha`
3. Add testers — ask 12 friends/family to sign up:
   - Give them this link from the Console
   - They install the app and "use" it for 14 days (just needs to be installed)
4. After 14 days, come back and promote to Production

**Workaround:** Add yourself + 11 Gmail accounts as testers (Google allows this as long as they're real accounts that actually install the app).

---

## Step 16 — Wait for Review

| Account Type | Review Time |
|---|---|
| New developer | 3-7 business days |
| Established (2+ apps) | Under 24 hours |

You'll receive an email when approved. AVANT will be live on the Play Store! 🎉

---

# ═══════════════════════════════════════
# ROUTE B — BeeWare Briefcase (Alternative)
# ═══════════════════════════════════════

If Buildozer gives you trouble, use BeeWare — it has cleaner Python support.

```bash
# Install BeeWare
pip install briefcase

# Create new project scaffold
briefcase new
# App name: AVANT
# Bundle ID: com.bridgeline.avant
# Framework: None (pure Python)

# Add your AVANT code to the src/ folder

# Build for Android
briefcase build android

# Run on connected phone
briefcase run android

# Build release
briefcase package android
```

Full guide: **https://docs.beeware.org/en/latest/tutorial/tutorial-0.html**

---

# ═══════════════════════════════════════
# ALTERNATIVE: SIDELOADING (No Play Store)
# ═══════════════════════════════════════

If you just want AVANT on YOUR phone without the Play Store:

```bash
# Build the debug APK
buildozer android debug

# Transfer APK to your phone (email, Google Drive, USB, etc.)
# On your phone:
# 1. Settings → Security → "Install unknown apps" → allow your browser/Files app
# 2. Tap the APK file → Install
# Done! AVANT is installed.
```

This takes 30 minutes instead of 3+ weeks. You just can't share it publicly.

---

# ═══════════════════════════════════════
# QUICK COST SUMMARY
# ═══════════════════════════════════════

| Item | Cost | Notes |
|------|------|-------|
| Google Play Developer account | **$25 one-time** | Never pay again |
| Building the APK | **$0** | Buildozer is free |
| Hosting the app | **$0** | Play Store hosts it |
| Updates | **$0** | Unlimited free updates |
| API keys (Groq, Gemini, etc.) | **$0** | All free tier |
| OpenAI GPT-4o | ~$0.01/query | Only if Groq/Gemini fail |
| **Total to launch** | **~$25** | That's it |

---

# ═══════════════════════════════════════
# CHECKLIST BEFORE SUBMITTING
# ═══════════════════════════════════════

- [ ] Google Play Developer account created + verified
- [ ] App icon 512x512 PNG
- [ ] Feature graphic 1024x500 PNG
- [ ] At least 2 phone screenshots
- [ ] Privacy policy URL (privacypolicygenerator.info)
- [ ] Signed release AAB built
- [ ] Content rating questionnaire completed
- [ ] 12 closed testers enrolled (14-day wait)
- [ ] Release notes written
- [ ] All API keys in the app's .env

---

*AVANT — from your pocket to the Play Store.*
