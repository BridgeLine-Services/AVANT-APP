# AVANT — Download & Build APK from GitHub

## Prerequisites (one-time setup, ~15 min)

| Tool | Install |
|------|---------|
| Node.js 20+ | https://nodejs.org |
| Git | https://git-scm.com |
| Java JDK 17 | https://adoptium.net |
| Android Studio | https://developer.android.com/studio |
| EAS CLI | `npm install -g eas-cli` |

---

## Option A — Cloud Build via EAS (Easiest, no local Android needed)

```bash
# 1. Clone the repo
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP

# 2. Install deps
npm install

# 3. Log in to Expo (free account at expo.dev)
eas login

# 4. Build APK (preview = installable APK, not Play Store)
eas build --platform android --profile preview

# 5. EAS emails you a download link when done (~5-10 min)
#    OR run this to open the download page:
eas build:list
```

Download the `.apk` file from the link EAS provides → transfer to phone → install.

---

## Option B — Local Build (Full control, no EAS account)

```bash
# 1. Clone
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP

# 2. Install deps
npm install

# 3. Generate native Android project
npx expo prebuild --platform android --clean

# 4. Open in Android Studio
npx cap open android
# OR directly:
cd android && ./gradlew assembleRelease

# 5. APK is at:
#    android/app/build/outputs/apk/release/app-release.apk
```

---

## Option C — EAS Preview Build (Quickest if you already have Expo account)

```bash
git clone https://github.com/BridgeLine-Services/AVANT-APP.git
cd AVANT-APP
npm install
eas build -p android --profile preview --non-interactive
```

---

## Installing the APK on your phone

1. Transfer the `.apk` to your phone (USB, Google Drive, email)
2. On your phone: **Settings → Security → Install unknown apps → allow**
3. Open the APK file → Install

---

## API Keys (required before building)

Edit `src/modules/config.js` and fill in your keys:

```js
export const GROQ_API_KEY    = 'gsk_YOUR_KEY';   // groq.com (free)
export const GEMINI_API_KEY  = 'AIza...';         // aistudio.google.com (free)
export const OPENAI_API_KEY  = 'sk-...';          // optional
export const OWNER_NAME      = 'Michael';         // your name
```

Free keys:
- **Groq**: https://console.groq.com → free, fastest
- **Gemini**: https://aistudio.google.com → free tier

---

## eas.json profiles reference

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

`preview` = APK (sideload)  
`production` = AAB (Play Store)
