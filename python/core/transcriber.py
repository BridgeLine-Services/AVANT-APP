"""
AVANT — Speech-to-Text Transcription Module
=============================================
Uses OpenAI Whisper (local or API) to convert spoken audio to text.
Supports real-time capture via PyAudio with silence detection.
"""

import os
import io
import wave
import time
import struct
import tempfile
import pyaudio
import numpy as np
from loguru import logger
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

SAMPLE_RATE = int(os.getenv("AUDIO_SAMPLE_RATE", "16000"))
CHANNELS = int(os.getenv("AUDIO_CHANNELS", "1"))
CHUNK_SIZE = int(os.getenv("AUDIO_CHUNK_SIZE", "1024"))

# Silence detection parameters
SILENCE_THRESHOLD = 500     # RMS amplitude below this = silence
SILENCE_DURATION = 1.5      # Seconds of silence to stop recording
MAX_RECORD_SECONDS = 30     # Max recording time per command


class Transcriber:
    """
    Captures microphone audio and transcribes it to text using Whisper.
    Auto-stops when the user stops speaking.
    """

    def __init__(self, use_api: bool = True):
        """
        Args:
            use_api: True = use OpenAI Whisper API (faster, needs internet)
                     False = use local Whisper model (offline, slower first run)
        """
        self.use_api = use_api
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        if not use_api:
            self._load_local_whisper()
        
        logger.info(f"✅ Transcriber ready ({'API' if use_api else 'Local Whisper'})")

    def _load_local_whisper(self):
        """Load local Whisper model for offline use."""
        try:
            import whisper
            self.local_model = whisper.load_model("base.en")
            logger.info("✅ Local Whisper model loaded")
        except ImportError:
            logger.warning("whisper not installed. Falling back to API mode.")
            self.use_api = True
            self.local_model = None
        except Exception as e:
            logger.error(f"Failed to load local Whisper: {e}")
            self.use_api = True
            self.local_model = None

    def capture_and_transcribe(self, input_device_index: int = None) -> str:
        """
        Record audio from microphone until silence, then transcribe.
        
        Args:
            input_device_index: PyAudio device index (None = default mic)
            
        Returns:
            Transcribed text string
        """
        logger.info("🎙️ Listening for command...")
        audio_data = self._record_until_silence(input_device_index)

        if audio_data is None or len(audio_data) == 0:
            return ""

        # Save to temp WAV file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
            self._save_wav(tmp_path, audio_data)

        try:
            text = self._transcribe_file(tmp_path)
            logger.info(f"📝 Transcribed: '{text}'")
            return text.strip()
        finally:
            os.unlink(tmp_path)

    def transcribe_file(self, audio_path: str) -> str:
        """Transcribe an existing audio file."""
        return self._transcribe_file(audio_path)

    def _record_until_silence(self, input_device_index: int = None) -> list:
        """
        Record audio frames until silence is detected.
        Returns list of audio bytes.
        """
        pa = pyaudio.PyAudio()
        
        stream_kwargs = dict(
            format=pyaudio.paInt16,
            channels=CHANNELS,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SIZE
        )
        if input_device_index is not None:
            stream_kwargs["input_device_index"] = input_device_index

        stream = pa.open(**stream_kwargs)
        frames = []
        silent_chunks = 0
        max_silent_chunks = int(SAMPLE_RATE / CHUNK_SIZE * SILENCE_DURATION)
        max_chunks = int(SAMPLE_RATE / CHUNK_SIZE * MAX_RECORD_SECONDS)
        started_speaking = False
        chunk_count = 0

        try:
            while chunk_count < max_chunks:
                data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                frames.append(data)
                chunk_count += 1

                # Calculate RMS amplitude
                rms = self._calculate_rms(data)

                if rms > SILENCE_THRESHOLD:
                    started_speaking = True
                    silent_chunks = 0
                elif started_speaking:
                    silent_chunks += 1
                    if silent_chunks >= max_silent_chunks:
                        logger.debug("Silence detected — stopping recording")
                        break
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()

        return frames

    def _transcribe_file(self, audio_path: str) -> str:
        """Transcribe audio file using Whisper API or local model."""
        if self.use_api:
            try:
                with open(audio_path, "rb") as f:
                    response = self.client.audio.transcriptions.create(
                        model="whisper-1",
                        file=f,
                        language="en",
                        response_format="text"
                    )
                return str(response).strip()
            except Exception as e:
                logger.error(f"Whisper API transcription failed: {e}")
                return ""
        else:
            # Local Whisper
            try:
                result = self.local_model.transcribe(audio_path, language="en")
                return result["text"].strip()
            except Exception as e:
                logger.error(f"Local Whisper transcription failed: {e}")
                return ""

    @staticmethod
    def _calculate_rms(data: bytes) -> float:
        """Calculate RMS amplitude of audio chunk."""
        count = len(data) // 2
        if count == 0:
            return 0.0
        shorts = struct.unpack(f"{count}h", data[:count * 2])
        rms = (sum(s ** 2 for s in shorts) / count) ** 0.5
        return rms

    @staticmethod
    def _save_wav(path: str, frames: list):
        """Save audio frames to WAV file."""
        pa = pyaudio.PyAudio()
        with wave.open(path, 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(b''.join(frames))
        pa.terminate()
