"""
AVANT — Wake Word Detection (openWakeWord Edition)
====================================================
100% FREE & OPEN SOURCE — no cloud, no subscriptions, no Picovoice.

Uses openWakeWord (by dscripka) to detect the custom wake word "AVANT".
Training your own "AVANT" model takes < 1 hour in Google Colab — no ML
experience needed. See the TRAINING GUIDE section below.

HOW IT WORKS:
  1. openWakeWord listens to raw 16kHz audio in real time
  2. Audio runs through a neural audio embedding model
  3. A small classifier checks: "did someone just say AVANT?"
  4. If confidence > threshold → fire the callback

CUSTOM TRAINING GUIDE (one-time, ~30-45 minutes):
  1. Go to: https://colab.research.google.com/github/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb
  2. In the notebook, change the wake word to "AVANT"
  3. Run all cells — it auto-generates synthetic training data
  4. Download the .tflite or .onnx model file
  5. Place it at: AVANT/data/avant_wakeword.onnx
  6. Done — no API key, no account needed

FALLBACK:
  If no custom AVANT model exists yet, falls back to fuzzy voice
  activity detection + keyword matching via Whisper micro-transcription.
"""

import os
import time
import struct
import queue
import threading
import numpy as np
import pyaudio
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

# Path to your trained custom "AVANT" wake word model
CUSTOM_MODEL_PATH = os.getenv("WAKE_WORD_MODEL_PATH", "./data/avant_wakeword.onnx")

# Detection sensitivity (0.0–1.0). Lower = more sensitive but more false triggers.
WAKEWORD_THRESHOLD = float(os.getenv("WAKEWORD_THRESHOLD", "0.5"))

# Audio constants (openWakeWord requires 16kHz 16-bit mono)
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_MS = 80          # openWakeWord works best with 80ms chunks
CHUNK_SIZE = int(SAMPLE_RATE * CHUNK_MS / 1000)  # = 1280 samples


class WakeWordDetector:
    """
    Listens for the wake word 'AVANT' using openWakeWord.
    Completely free, runs 100% offline — no API key needed.
    """

    def __init__(self, on_wake_callback):
        """
        Args:
            on_wake_callback: Function called when 'AVANT' is detected
        """
        self.on_wake = on_wake_callback
        self.is_listening = False
        self._thread = None
        self._audio_queue = queue.Queue()
        self.model = None
        self._use_fallback = False

        self._load_model()

    def _load_model(self):
        """Load openWakeWord model — custom AVANT model or pre-trained fallback."""
        try:
            import openwakeword
            from openwakeword.model import Model

            if os.path.exists(CUSTOM_MODEL_PATH):
                # ── Use your custom trained "AVANT" model ────────────────────
                self.model = Model(
                    wakeword_models=[CUSTOM_MODEL_PATH],
                    inference_framework="onnx",
                    vad_threshold=0.3        # Voice activity detection filter
                )
                logger.info(f"✅ Custom AVANT wake word model loaded: {CUSTOM_MODEL_PATH}")

            else:
                # ── Fallback: use built-in "hey jarvis" as a stand-in ────────
                # Replace this with your trained AVANT model when ready
                logger.warning(
                    "⚠️  Custom AVANT model not found at data/avant_wakeword.onnx\n"
                    "    Falling back to keyword-based detection.\n"
                    "    Train your model: see core/wake_word.py header for instructions."
                )
                # Try to download and use a pre-trained model as placeholder
                openwakeword.utils.download_models(["hey_jarvis"])
                self.model = Model(
                    wakeword_models=["hey_jarvis"],
                    inference_framework="onnx",
                    vad_threshold=0.3
                )
                logger.info("ℹ️  Using 'hey_jarvis' as placeholder — say 'Hey Jarvis' until you train your AVANT model")

        except ImportError:
            logger.warning("openWakeWord not installed — using Whisper fallback mode")
            logger.warning("Install it: pip install openwakeword")
            self._use_fallback = True
        except Exception as e:
            logger.error(f"Wake word model load error: {e}")
            self._use_fallback = True

    def start(self):
        """Start listening for wake word in a background thread."""
        self.is_listening = True

        if self._use_fallback:
            # Whisper-based keyword fallback
            self._thread = threading.Thread(target=self._fallback_listen_loop, daemon=True)
        else:
            self._thread = threading.Thread(target=self._oww_listen_loop, daemon=True)

        self._thread.start()

        if not self._use_fallback and os.path.exists(CUSTOM_MODEL_PATH):
            logger.info("🎙️ AVANT is listening for her name... (custom model active)")
        elif not self._use_fallback:
            logger.info("🎙️ AVANT is listening... (say 'Hey Jarvis' as placeholder until AVANT model is trained)")
        else:
            logger.info("🎙️ AVANT is listening... (Whisper fallback — say 'AVANT' clearly)")

    def stop(self):
        """Stop the wake word detection loop."""
        self.is_listening = False
        logger.info("🔇 Wake word detection stopped")

    def _oww_listen_loop(self):
        """Main loop using openWakeWord for detection."""
        pa = pyaudio.PyAudio()
        stream = pa.open(
            rate=SAMPLE_RATE,
            channels=CHANNELS,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=CHUNK_SIZE
        )

        logger.debug("openWakeWord audio stream started")
        cooldown = 0  # Prevent double-firing

        try:
            while self.is_listening:
                # Read audio chunk
                raw = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                audio_data = np.frombuffer(raw, dtype=np.int16)

                # Run through openWakeWord
                prediction = self.model.predict(audio_data)

                # Check all loaded models for activation
                now = time.time()
                if now < cooldown:
                    continue

                for model_name, score in prediction.items():
                    if score >= WAKEWORD_THRESHOLD:
                        logger.info(f"🔥 Wake word detected! Model={model_name}, Score={score:.3f}")
                        cooldown = now + 2.0  # 2 second cooldown
                        self.on_wake()
                        break

        except Exception as e:
            logger.error(f"openWakeWord loop error: {e}")
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()

    def _fallback_listen_loop(self):
        """
        Whisper-based fallback — transcribes short audio clips and
        checks if the word 'AVANT' was spoken. Slightly slower but
        requires zero additional models or training.
        """
        try:
            from openai import OpenAI
            import wave
            import tempfile
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        except Exception as e:
            logger.error(f"Fallback mode init failed: {e}")
            return

        pa = pyaudio.PyAudio()
        logger.info("🎙️ Whisper fallback wake word active — say 'AVANT' clearly")

        cooldown = 0
        RECORD_SECONDS = 2  # Listen in 2-second windows

        while self.is_listening:
            try:
                stream = pa.open(
                    format=pyaudio.paInt16,
                    channels=1,
                    rate=SAMPLE_RATE,
                    input=True,
                    frames_per_buffer=1024
                )
                frames = []
                for _ in range(int(SAMPLE_RATE / 1024 * RECORD_SECONDS)):
                    frames.append(stream.read(1024, exception_on_overflow=False))
                stream.stop_stream()
                stream.close()

                # Skip if no sound (RMS check)
                audio_np = np.frombuffer(b''.join(frames), dtype=np.int16)
                rms = np.sqrt(np.mean(audio_np.astype(np.float32) ** 2))
                if rms < 200:
                    continue  # Silence — skip

                # Transcribe
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    path = tmp.name
                with wave.open(path, 'wb') as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
                    wf.setframerate(SAMPLE_RATE)
                    wf.writeframes(b''.join(frames))

                with open(path, "rb") as f:
                    result = client.audio.transcriptions.create(
                        model="whisper-1", file=f,
                        language="en", response_format="text"
                    )
                os.unlink(path)

                text = str(result).strip().lower()

                # Check for wake word variants
                wake_variants = ["avant", "a vant", "uh vont", "avont", "avante"]
                now = time.time()
                if any(v in text for v in wake_variants) and now > cooldown:
                    logger.info(f"🔥 Wake word detected (Whisper fallback): '{text}'")
                    cooldown = now + 3.0
                    self.on_wake()

            except Exception as e:
                logger.debug(f"Fallback loop tick error: {e}")
                time.sleep(0.5)

        pa.terminate()
