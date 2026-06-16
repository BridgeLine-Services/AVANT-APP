"""
AVANT — Voice Output (Free Microsoft Edge Neural TTS)
======================================================
Primary: edge-tts — Microsoft's neural TTS engine, 100% FREE
         No API key. No account. No credit card. 400+ voices.
         Same engine behind Microsoft Edge's "Read Aloud" — extremely natural.
         Best female voices: en-US-AriaNeural, en-US-JennyNeural, en-US-MichelleNeural

Backup:  ElevenLabs (if API key provided — highest quality)
Fallback: pyttsx3 (offline, built-in, robotic but works)

AVANT's voice characteristics:
  - Warm, confident, natural female voice
  - Slightly faster pace than default (feels sharp and smart)
  - Empathetic tone for reminders, upbeat for good news
  - Serious/flat delivery for professional mode
  - Maximum speed for urgent mode
"""

import os, asyncio, tempfile, threading, queue, time
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

VOICE_ENGINE       = os.getenv("VOICE_ENGINE", "edge-tts")
EDGE_TTS_VOICE     = os.getenv("EDGE_TTS_VOICE", "en-US-AriaNeural")
ELEVENLABS_KEY     = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE   = os.getenv("ELEVENLABS_VOICE_ID", "")

# Edge TTS voice options by tone
EDGE_VOICES = {
    "casual":    "en-US-AriaNeural",       # Warm, conversational
    "serious":   "en-US-JennyNeural",      # Professional, clear
    "urgent":    "en-US-MichelleNeural",   # Crisp, fast
    "empathetic":"en-US-AriaNeural",       # Warm
    "simple":    "en-US-AriaNeural",       # Clear and friendly
}


class SpeakerOutput:
    """
    AVANT's voice — Microsoft Edge Neural TTS (free) with ElevenLabs upgrade path.
    """

    def __init__(self):
        self._speech_queue = queue.Queue()
        self._worker_thread = threading.Thread(
            target=self._speech_worker, daemon=True
        )
        self._worker_thread.start()
        self._engine_ready = False
        self._test_engine()

    def _test_engine(self):
        """Verify the TTS engine is available."""
        try:
            import edge_tts
            self._engine_ready = True
            logger.info(f"✅ Voice: Edge-TTS ({EDGE_TTS_VOICE}) — FREE Microsoft neural voice")
        except ImportError:
            logger.warning("edge-tts not installed. Run: pip install edge-tts")
            try:
                import pyttsx3
                self._pyttsx3 = pyttsx3.init()
                self._engine_ready = True
                logger.info("✅ Voice: pyttsx3 fallback (robotic but works offline)")
            except ImportError:
                logger.error("No TTS engine found. Install: pip install edge-tts")

    def speak(self, text: str, tone_mode: str = "casual", priority: bool = False):
        """
        Queue text for speech output.

        Args:
            text: Text to speak
            tone_mode: casual / serious / urgent / empathetic / simple
            priority: True = jump to front of queue (for urgent)
        """
        if not text or not text.strip():
            return

        # Clean text for speech
        text = self._clean_for_speech(text)

        item = {"text": text, "tone": tone_mode}
        if priority:
            # Insert at front — urgent responses skip the queue
            with self._speech_queue.mutex:
                self._speech_queue.queue.appendleft(item)
        else:
            self._speech_queue.put(item)

    def speak_sync(self, text: str, tone_mode: str = "casual"):
        """Speak immediately (blocking) — for critical alerts."""
        text = self._clean_for_speech(text)
        self._say(text, tone_mode)

    def stop(self):
        """Stop current speech and clear queue."""
        with self._speech_queue.mutex:
            self._speech_queue.queue.clear()
        logger.debug("Speech queue cleared")

    def _speech_worker(self):
        """Background thread that processes speech queue."""
        while True:
            try:
                item = self._speech_queue.get(timeout=0.5)
                self._say(item["text"], item["tone"])
                self._speech_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Speech worker error: {e}")

    def _say(self, text: str, tone_mode: str = "casual"):
        """Actually produce speech output."""
        # Try ElevenLabs first if configured (highest quality)
        if ELEVENLABS_KEY and ELEVENLABS_VOICE:
            if self._elevenlabs_speak(text):
                return

        # Edge-TTS (free Microsoft neural TTS)
        try:
            import edge_tts
            voice = EDGE_VOICES.get(tone_mode, EDGE_TTS_VOICE)

            # Rate adjustment based on tone
            rate_map = {
                "urgent":    "+25%",   # Fast for urgency
                "casual":    "+8%",    # Slightly punchy
                "serious":   "+0%",    # Measured and clear
                "empathetic": "-5%",   # Slightly slower, warm
                "simple":    "-5%",    # Slower for clarity
            }
            rate = rate_map.get(tone_mode, "+8%")

            # Volume
            volume = "+0%"

            asyncio.run(self._edge_tts_async(text, voice, rate, volume))
            return
        except ImportError:
            pass
        except Exception as e:
            logger.debug(f"Edge-TTS error: {e}")

        # pyttsx3 fallback
        try:
            import pyttsx3
            engine = pyttsx3.init()
            voices = engine.getProperty("voices")
            # Try to pick a female voice
            for v in voices:
                if "female" in v.name.lower() or "zira" in v.name.lower() or "aria" in v.name.lower():
                    engine.setProperty("voice", v.id)
                    break
            rate_map2 = {"urgent": 220, "casual": 185, "serious": 175, "simple": 165}
            engine.setProperty("rate", rate_map2.get(tone_mode, 185))
            engine.say(text)
            engine.runAndWait()
            return
        except Exception as e:
            logger.debug(f"pyttsx3 error: {e}")

        # Last resort: print it
        print(f"\n🔊 AVANT: {text}\n")

    async def _edge_tts_async(self, text: str, voice: str,
                               rate: str, volume: str):
        """Async Edge-TTS generation and playback."""
        import edge_tts

        communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume)

        # Save to temp file then play
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            await communicate.save(tmp_path)
            self._play_audio(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    def _play_audio(self, file_path: str):
        """Play audio file through speakers/Bluetooth."""
        # Try pygame first (handles BT routing better)
        try:
            import pygame
            pygame.mixer.init()
            pygame.mixer.music.load(file_path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                time.sleep(0.05)
            pygame.mixer.quit()
            return
        except Exception:
            pass

        # Try playsound
        try:
            from playsound import playsound
            playsound(file_path)
            return
        except Exception:
            pass

        # Try mpg123 (Linux/Termux)
        try:
            import subprocess
            subprocess.run(["mpg123", "-q", file_path], check=True, timeout=60)
            return
        except Exception:
            pass

        # Try afplay (macOS)
        try:
            import subprocess
            subprocess.run(["afplay", file_path], check=True, timeout=60)
            return
        except Exception:
            pass

        logger.warning(f"Could not play audio. Install: pip install pygame")

    def _elevenlabs_speak(self, text: str) -> bool:
        """ElevenLabs TTS — highest quality (optional upgrade)."""
        try:
            import requests
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE}"
            headers = {
                "xi-api-key": ELEVENLABS_KEY,
                "Content-Type": "application/json"
            }
            payload = {
                "text": text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.8,
                    "style": 0.4,
                    "use_speaker_boost": True
                }
            }
            r = requests.post(url, json=payload, headers=headers,
                              stream=True, timeout=15)
            if r.status_code == 200:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    for chunk in r.iter_content(chunk_size=1024):
                        tmp.write(chunk)
                    tmp_path = tmp.name
                self._play_audio(tmp_path)
                os.unlink(tmp_path)
                return True
        except Exception as e:
            logger.debug(f"ElevenLabs error: {e}")
        return False

    def _clean_for_speech(self, text: str) -> str:
        """Remove markdown, URLs, and other non-speech elements."""
        import re
        # Remove maps deeplinks (speak a short version instead)
        if "MAPS_DEEPLINK:" in text:
            text = re.sub(r"MAPS_DEEPLINK:[^\n]+", "I've pulled up the route on Maps.", text)
        # Remove markdown
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)   # Bold
        text = re.sub(r"\*(.+?)\*", r"\1", text)         # Italic
        text = re.sub(r"#{1,6}\s+", "", text)             # Headers
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)  # Links
        text = re.sub(r"https?://\S+", "the link", text) # URLs
        text = re.sub(r"`[^`]+`", "", text)               # Code
        text = re.sub(r"\n{2,}", ". ", text)              # Paragraph breaks
        text = re.sub(r"\n", " ", text)                   # Line breaks
        text = re.sub(r"\s+", " ", text)                  # Extra spaces
        text = text.strip()
        # Limit length for speech (split into chunks if very long)
        if len(text) > 2000:
            text = text[:2000] + "... and there's more if you want me to continue."
        return text

    def list_available_voices(self) -> list:
        """Return all available Edge-TTS voices (async)."""
        try:
            import edge_tts
            voices = asyncio.run(edge_tts.list_voices())
            female_en = [v for v in voices
                         if "Female" in v.get("Gender","") and "en-US" in v.get("Locale","")]
            return female_en
        except Exception:
            return []
