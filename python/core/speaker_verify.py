"""
AVANT — Speaker Verification (Open-Source Edition)
=====================================================
100% FREE — uses SpeechBrain + PyTorch. No API keys, no cloud, no Picovoice.

HOW IT WORKS:
  - Uses SpeechBrain's ECAPA-TDNN model (trained on VoxCeleb)
  - Records several voice samples from you during enrollment
  - Creates a "voice fingerprint" (embedding vector) unique to your voice
  - On every command: compares incoming voice to your fingerprint
  - Cosine similarity < threshold → AVANT ignores the speaker

ENROLLMENT: Just run:
  python avant.py --enroll
  (Records 7 samples, ~5 seconds each)

The voice profile is saved locally to data/voice_profile.pkl
"""

import os
import pickle
import wave
import time
import struct
import threading
import numpy as np
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

VOICE_PROFILE_PATH = os.getenv("VOICE_PROFILE_PATH", "./data/voice_profile.pkl")
VOICE_MATCH_THRESHOLD = float(os.getenv("VOICE_MATCH_THRESHOLD", "0.75"))
OWNER_NAME = os.getenv("OWNER_NAME", "Michael")

# Sample rate SpeechBrain ECAPA-TDNN expects
MODEL_SAMPLE_RATE = 16000


class SpeakerVerifier:
    """
    Voice fingerprint enrollment and real-time verification.
    Only enrolled voice passes through to AVANT.
    """

    def __init__(self):
        self.model = None
        self.owner_embedding = None
        self._model_lock = threading.Lock()
        self._load_model()
        self._load_profile()

    def _load_model(self):
        """Load SpeechBrain ECAPA-TDNN speaker embedding model."""
        try:
            import torch
            import torchaudio
            from speechbrain.inference.speaker import SpeakerRecognition

            self.model = SpeakerRecognition.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir="./data/speechbrain_model",
                run_opts={"device": "cpu"}
            )
            self._torch = torch
            self._torchaudio = torchaudio
            logger.info("✅ SpeechBrain ECAPA-TDNN speaker model loaded")

        except ImportError as e:
            logger.warning(f"SpeechBrain/torch not installed: {e}")
            logger.warning("Install: pip install speechbrain torch torchaudio")
            self.model = None
        except Exception as e:
            logger.error(f"SpeechBrain model load failed: {e}")
            self.model = None

    def _load_profile(self):
        """Load saved voice profile from disk."""
        if os.path.exists(VOICE_PROFILE_PATH):
            try:
                with open(VOICE_PROFILE_PATH, "rb") as f:
                    data = pickle.load(f)
                self.owner_embedding = data.get("embedding")
                enrolled_name = data.get("name", "Unknown")
                enrolled_date = data.get("date", "unknown date")
                logger.info(f"✅ Voice profile loaded — enrolled: {enrolled_name} on {enrolled_date}")
            except Exception as e:
                logger.warning(f"Could not load voice profile: {e}")
                self.owner_embedding = None
        else:
            logger.warning(
                f"⚠️  No voice profile found at {VOICE_PROFILE_PATH}\n"
                "    Run: python avant.py --enroll  to set up your voice lock"
            )
            self.owner_embedding = None

    def enroll_interactive(self):
        """
        Interactive voice enrollment session.
        Records multiple samples, builds robust voice fingerprint.
        Called by: python avant.py --enroll
        """
        import pyaudio
        from rich.console import Console
        from rich.panel import Panel
        from rich.progress import track

        console = Console()

        console.print(Panel(
            f"[bold cyan]🎙️  AVANT Voice Enrollment[/bold cyan]\n\n"
            f"Hi {OWNER_NAME}! I'm going to learn your voice so only you can activate me.\n\n"
            "You'll record [bold]7 short samples[/bold] (about 5 seconds each).\n"
            "Speak [bold]naturally[/bold] — like you're talking to a friend.\n"
            "Use sentences like:\n"
            "  • 'AVANT, what's the weather today?'\n"
            "  • 'Hey AVANT, play some music'\n"
            "  • 'AVANT, I need your help with something'\n"
            "  • Or just talk naturally about anything\n\n"
            "[dim]Tip: Record from the same distance you'll normally use.[/dim]",
            title="Voice Enrollment",
            border_style="cyan"
        ))

        if not self.model:
            console.print("[red]❌ SpeechBrain model not loaded. Install: pip install speechbrain torch torchaudio[/red]")
            return False

        RECORD_SECONDS = 5
        RATE = MODEL_SAMPLE_RATE
        CHUNK = 1024
        NUM_SAMPLES = 7

        pa = pyaudio.PyAudio()
        sample_paths = []

        for i in range(NUM_SAMPLES):
            console.print(f"\n[yellow]Sample {i+1} of {NUM_SAMPLES}[/yellow]")
            input("  Press [ENTER] when ready, then speak for 5 seconds...")

            console.print("  [bold green]🔴 Recording...[/bold green] Speak now!")

            # Record
            stream = pa.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK
            )
            frames = []
            for _ in range(int(RATE / CHUNK * RECORD_SECONDS)):
                frames.append(stream.read(CHUNK, exception_on_overflow=False))
            stream.stop_stream()
            stream.close()

            # Save sample
            path = f"./data/enroll_sample_{i+1}.wav"
            os.makedirs("./data", exist_ok=True)
            with wave.open(path, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
                wf.setframerate(RATE)
                wf.writeframes(b''.join(frames))

            sample_paths.append(path)
            console.print("  [green]✅ Sample saved.[/green]")

        pa.terminate()

        # Build voice fingerprint
        console.print("\n[cyan]🧠 Building your voice fingerprint...[/cyan]")

        success = self._build_profile(sample_paths)

        # Clean up raw samples
        for path in sample_paths:
            try:
                os.unlink(path)
            except Exception:
                pass

        if success:
            console.print(Panel(
                f"[bold green]✅ Voice enrollment complete![/bold green]\n\n"
                f"AVANT is now voice-locked to [bold]{OWNER_NAME}[/bold].\n"
                "She will only respond to your voice.\n\n"
                "If she's not responding to you, re-run enrollment:\n"
                "  [dim]python avant.py --enroll[/dim]\n\n"
                "To adjust sensitivity, change VOICE_MATCH_THRESHOLD in .env\n"
                "  (current: {:.0f}% match required)".format(VOICE_MATCH_THRESHOLD * 100),
                border_style="green"
            ))
            return True
        else:
            console.print("[red]❌ Enrollment failed. Try again in a quieter environment.[/red]")
            return False

    def _build_profile(self, sample_paths: list) -> bool:
        """Build voice embedding profile from multiple audio samples."""
        embeddings = []

        for path in sample_paths:
            try:
                emb = self._extract_embedding(path)
                if emb is not None:
                    embeddings.append(emb)
                    logger.debug(f"Processed: {path}")
            except Exception as e:
                logger.warning(f"Skipping {path}: {e}")

        if len(embeddings) < 3:
            logger.error(f"Not enough valid samples ({len(embeddings)}/7)")
            return False

        # Average embeddings → robust voice fingerprint
        self.owner_embedding = np.mean(embeddings, axis=0)

        # Normalize
        norm = np.linalg.norm(self.owner_embedding)
        if norm > 0:
            self.owner_embedding = self.owner_embedding / norm

        # Save to disk
        os.makedirs(os.path.dirname(VOICE_PROFILE_PATH), exist_ok=True)
        profile_data = {
            "embedding": self.owner_embedding,
            "name": OWNER_NAME,
            "date": time.strftime("%Y-%m-%d %H:%M"),
            "num_samples": len(embeddings),
            "threshold": VOICE_MATCH_THRESHOLD
        }
        with open(VOICE_PROFILE_PATH, "wb") as f:
            pickle.dump(profile_data, f)

        logger.success(f"✅ Voice profile saved ({len(embeddings)} samples)")
        return True

    def verify(self, audio_path: str) -> tuple:
        """
        Verify incoming audio matches the enrolled owner's voice.

        Args:
            audio_path: WAV file path to verify

        Returns:
            (is_owner: bool, confidence_score: float)
        """
        # If no profile → open mode (warn but allow)
        if self.owner_embedding is None:
            logger.warning("No voice profile — open mode (run --enroll to lock)")
            return True, 1.0

        # If model failed to load → allow (fail-open)
        if self.model is None:
            return True, 1.0

        try:
            incoming = self._extract_embedding(audio_path)
            if incoming is None:
                return False, 0.0

            score = float(np.dot(self.owner_embedding, incoming) /
                          (np.linalg.norm(self.owner_embedding) * np.linalg.norm(incoming) + 1e-9))

            is_owner = score >= VOICE_MATCH_THRESHOLD
            logger.debug(f"Voice match score: {score:.3f} (need ≥{VOICE_MATCH_THRESHOLD})")

            return is_owner, score

        except Exception as e:
            logger.error(f"Voice verification error: {e}")
            return True, 1.0  # Fail-open

    def _extract_embedding(self, audio_path: str):
        """Extract voice embedding vector from audio file."""
        try:
            import torch
            signal, sr = self._torchaudio.load(audio_path)

            # Resample to 16kHz if needed
            if sr != MODEL_SAMPLE_RATE:
                resamp = self._torchaudio.transforms.Resample(sr, MODEL_SAMPLE_RATE)
                signal = resamp(signal)

            # Ensure mono
            if signal.shape[0] > 1:
                signal = signal.mean(dim=0, keepdim=True)

            with torch.no_grad():
                emb = self.model.encode_batch(signal)
                return emb.squeeze().numpy()

        except Exception as e:
            logger.debug(f"Embedding extraction error: {e}")
            return None

    def reset_profile(self):
        """Delete stored voice profile (re-enrollment required)."""
        if os.path.exists(VOICE_PROFILE_PATH):
            os.unlink(VOICE_PROFILE_PATH)
            self.owner_embedding = None
            logger.info("🗑️ Voice profile deleted — run --enroll to re-enroll")
            return True
        return False

    def profile_info(self) -> str:
        """Return info about the current voice profile."""
        if not os.path.exists(VOICE_PROFILE_PATH):
            return "No voice profile enrolled yet. Run: python avant.py --enroll"
        try:
            with open(VOICE_PROFILE_PATH, "rb") as f:
                data = pickle.load(f)
            return (
                f"Voice profile: {data.get('name', 'Unknown')}, "
                f"enrolled {data.get('date', 'unknown date')}, "
                f"{data.get('num_samples', '?')} samples, "
                f"threshold: {data.get('threshold', VOICE_MATCH_THRESHOLD)}"
            )
        except Exception:
            return "Voice profile found but couldn't read details."
