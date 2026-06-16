"""
AVANT — Tone & Emotion Detector
=================================
Analyzes audio features to detect the speaker's tone/mood.
Maps detected emotion to AVANT's response mode:
  - casual/happy    → friendly, witty, jokes OK
  - serious/formal  → professional, no jokes, focused
  - urgent/stressed → fastest possible response, no fluff
  - sad/low         → warm, empathetic tone
"""

import os
import numpy as np
import librosa
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

# Trigger keywords override auto-detection
SERIOUS_TRIGGERS = os.getenv(
    "AVANT_SERIOUS_TRIGGERS",
    "this is serious,seriously,important matter,I need to tell you something"
).split(",")

URGENT_TRIGGERS = os.getenv(
    "AVANT_URGENT_TRIGGERS",
    "this is urgent,urgent,emergency,right now,ASAP,hurry"
).split(",")

SIMPLE_EXPLAIN_TRIGGERS = os.getenv(
    "AVANT_7TH_GRADE_TRIGGER",
    "explain simply,explain like I'm 12,break it down,simple terms,for a kid"
).split(",")


class ToneDetector:
    """
    Detects emotional tone from audio AND text content.
    Returns a response mode string for AVANT to use.
    """

    MODES = {
        "casual":       "😊 Friendly & casual — jokes and banter welcome",
        "serious":      "🧐 Professional & focused — no jokes",
        "urgent":       "⚡ URGENT — fastest response, zero fluff",
        "empathetic":   "💙 Warm & supportive",
        "excited":      "🎉 Energetic & enthusiastic",
        "simple":       "📚 7th-grade explanation mode"
    }

    def detect(self, audio_path: str = None, text: str = "") -> str:
        """
        Detect response mode from audio + text.
        
        Args:
            audio_path: Path to WAV audio file (optional)
            text: Transcribed text (optional but important)
            
        Returns:
            Mode string: "casual" | "serious" | "urgent" | "empathetic" | "excited" | "simple"
        """
        # 1. Check text for explicit triggers first (highest priority)
        text_mode = self._detect_from_text(text)
        if text_mode in ("urgent", "serious", "simple"):
            logger.info(f"🎭 Tone (text-triggered): {text_mode}")
            return text_mode

        # 2. Analyze audio features if available
        if audio_path and os.path.exists(audio_path):
            audio_mode = self._detect_from_audio(audio_path)
        else:
            audio_mode = "casual"

        # 3. Text mode wins if it detected something specific
        final_mode = text_mode if text_mode != "casual" else audio_mode
        logger.info(f"🎭 Tone detected: {final_mode}")
        return final_mode

    def _detect_from_text(self, text: str) -> str:
        """Check for explicit trigger phrases in text."""
        if not text:
            return "casual"

        text_lower = text.lower()

        # Check urgent triggers
        for trigger in URGENT_TRIGGERS:
            if trigger.lower().strip() in text_lower:
                return "urgent"

        # Check serious triggers
        for trigger in SERIOUS_TRIGGERS:
            if trigger.lower().strip() in text_lower:
                return "serious"

        # Check simple explanation triggers
        for trigger in SIMPLE_EXPLAIN_TRIGGERS:
            if trigger.lower().strip() in text_lower:
                return "simple"

        return "casual"

    def _detect_from_audio(self, audio_path: str) -> str:
        """
        Analyze audio features to infer emotional tone.
        Uses librosa for feature extraction.
        
        Features analyzed:
        - Pitch (fundamental frequency) — high pitch = excited/urgent
        - Energy (RMS) — high energy = loud/urgent
        - Speaking rate — fast speech = excited/urgent
        - Spectral rolloff — darker sound = sad/serious
        """
        try:
            y, sr = librosa.load(audio_path, sr=None)

            # RMS Energy
            rms = float(np.mean(librosa.feature.rms(y=y)))

            # Pitch (fundamental frequency)
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
            pitch_values = pitches[magnitudes > np.median(magnitudes)]
            mean_pitch = float(np.mean(pitch_values)) if len(pitch_values) > 0 else 0.0

            # Zero Crossing Rate (proxy for speaking speed/energy)
            zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))

            # Spectral Centroid (brightness of voice)
            spec_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

            logger.debug(
                f"Audio features — RMS: {rms:.4f}, Pitch: {mean_pitch:.1f}Hz, "
                f"ZCR: {zcr:.4f}, Centroid: {spec_centroid:.1f}Hz"
            )

            # Rule-based classification
            if rms > 0.08 and mean_pitch > 300:
                return "urgent"      # Loud + high pitch = stressed/urgent
            elif rms > 0.06 and spec_centroid > 2500:
                return "excited"     # Energetic + bright voice
            elif rms < 0.02 and mean_pitch < 150:
                return "empathetic"  # Quiet + low pitch = sad/subdued
            elif spec_centroid < 1500 and rms < 0.03:
                return "serious"     # Dark, slow, deliberate speech
            else:
                return "casual"      # Normal everyday tone

        except Exception as e:
            logger.warning(f"Audio tone detection failed, defaulting to casual: {e}")
            return "casual"

    @staticmethod
    def get_system_prompt_modifier(mode: str) -> str:
        """
        Returns a system prompt fragment that tells AVANT how to respond
        based on the detected tone mode.
        """
        modifiers = {
            "casual": (
                "The user is in a casual, relaxed mood. Respond like a close friend — "
                "be warm, fun, crack jokes, use light humor, and keep things conversational. "
                "You can use casual language and slang if appropriate."
            ),
            "serious": (
                "The user is speaking seriously or about an important matter. "
                "Respond in a professional, focused, and respectful manner. "
                "No jokes or casual banter. Be thorough and precise."
            ),
            "urgent": (
                "URGENT MODE: The user needs help IMMEDIATELY. "
                "Get straight to the point — no pleasantries, no fluff. "
                "Give the most critical information first. Be fast and direct."
            ),
            "empathetic": (
                "The user seems to be in a subdued or emotional state. "
                "Be warm, gentle, and supportive. Show empathy first before "
                "diving into information. Don't be dismissive."
            ),
            "excited": (
                "The user is excited or enthusiastic! Match their energy — "
                "be upbeat, fast-paced, and equally enthusiastic. "
                "This is a great moment to be high-energy and fun."
            ),
            "simple": (
                "The user wants a simple explanation. Explain everything at a "
                "7th-grade reading level. Use simple words, relatable analogies, "
                "short sentences, and everyday examples a 12-year-old would understand. "
                "Avoid jargon completely."
            )
        }
        return modifiers.get(mode, modifiers["casual"])
