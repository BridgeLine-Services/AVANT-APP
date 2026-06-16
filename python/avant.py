"""
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   ██████╗    ██╗   ██╗    █████╗    ███╗  ██╗    ████████╗              ║
║  ██╔══██╗   ██║   ██║   ██╔══██╗   ████╗ ██║       ██╔══╝              ║
║  ███████║   ██║   ██║   ███████║   ██╔██╗██║       ██║                 ║
║  ██╔══██║   ╚██╗ ██╔╝   ██╔══██║   ██║╚████║       ██║                 ║
║  ██║  ██║    ╚████╔╝    ██║  ██║   ██║ ╚███║       ██║                 ║
║  ╚═╝  ╚═╝     ╚═══╝     ╚═╝  ╚═╝   ╚═╝  ╚══╝       ╚═╝                 ║
║                                                                          ║
║        AmaVanta — A New Teammate  |  Personal AI for Michael            ║
║        Inspired by JARVIS · F.R.I.D.A.Y. · E.D.I.T.H.                  ║
╚══════════════════════════════════════════════════════════════════════════╝

AVANT — Main Entry Point
===========================
The central orchestrator that wires all modules together.
Runs the wake word → speaker verify → transcribe → tone detect →
brain → search → respond pipeline in a continuous loop.
"""

import os
import sys
import time
import argparse
import tempfile
import threading
from loguru import logger
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

load_dotenv()

# ── Setup logging ────────────────────────────────────────────────────────────
logger.remove()
logger.add(
    "logs/avant.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"
)
logger.add(
    sys.stderr,
    level="INFO",
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}"
)

console = Console()
OWNER_NAME = os.getenv("OWNER_NAME", "Michael")


class AVANT:
    """
    AmaVanta — A New Teammate.
    The complete AI assistant orchestrator.
    
    Pipeline:
    1. Wake Word ("AVANT") detected → activate
    2. Capture audio from mic or Bluetooth
    3. Verify speaker is the owner
    4. Transcribe speech to text
    5. Detect emotional tone
    6. Route to appropriate module (search, nav, calendar, etc.)
    7. Generate intelligent response
    8. Speak response through speakers/Bluetooth
    9. Return to listening
    """

    def __init__(self):
        self.is_active = False
        self.is_initialized = False
        self._init_modules()

    def _init_modules(self):
        """Initialize all AVANT subsystems."""
        console.print(Panel.fit(
            "[bold cyan]Initializing AVANT — AmaVanta, A New Teammate[/bold cyan]\n"
            "[dim]Inspired by JARVIS · F.R.I.D.A.Y. · E.D.I.T.H.[/dim]",
            border_style="cyan"
        ))

        # ── Core Modules ─────────────────────────────────────────────────────
        logger.info("Loading core modules...")

        try:
            from core.bluetooth_manager import BluetoothManager
            self.bluetooth = BluetoothManager()
            self.bluetooth.start_monitoring()
        except Exception as e:
            logger.warning(f"Bluetooth module failed: {e}")
            self.bluetooth = None

        try:
            from core.speaker_output import VoiceOutput
            self.voice = VoiceOutput(bluetooth_manager=self.bluetooth)
        except Exception as e:
            logger.error(f"Voice output failed to load: {e}")
            self.voice = None

        try:
            from core.speaker_verify import SpeakerVerifier
            self.verifier = SpeakerVerifier()
        except Exception as e:
            logger.warning(f"Speaker verifier failed: {e}")
            self.verifier = None

        try:
            from core.transcriber import Transcriber
            self.transcriber = Transcriber(use_api=True)
        except Exception as e:
            logger.error(f"Transcriber failed to load: {e}")
            self.transcriber = None

        try:
            from core.tone_detector import ToneDetector
            self.tone_detector = ToneDetector()
        except Exception as e:
            logger.warning(f"Tone detector failed: {e}")
            self.tone_detector = None

        try:
            from core.brain import AVANTBrain
            self.brain = AVANTBrain()
        except Exception as e:
            logger.error(f"Brain failed to load: {e}")
            self.brain = None

        # ── Feature Modules ──────────────────────────────────────────────────
        logger.info("Loading feature modules...")

        try:
            from modules.search_engine import SearchEngine
            self.search = SearchEngine()
        except Exception as e:
            logger.warning(f"Search engine failed: {e}")
            self.search = None

        try:
            from modules.navigation import Navigator
            self.navigator = Navigator()
        except Exception as e:
            logger.warning(f"Navigator failed: {e}")
            self.navigator = None

        try:
            from modules.calendar_manager import CalendarManager
            self.calendar = CalendarManager()
        except Exception as e:
            logger.warning(f"Calendar manager failed: {e}")
            self.calendar = None

        try:
            from modules.weather import WeatherService
            self.weather = WeatherService()
        except Exception as e:
            logger.warning(f"Weather service failed: {e}")
            self.weather = None

        try:
            from modules.world_news import WorldNews
            self.news = WorldNews()
        except Exception as e:
            logger.warning(f"News service failed: {e}")
            self.news = None

        try:
            from modules.reminders import ReminderManager
            self.reminders = ReminderManager(voice_output=self.voice)
        except Exception as e:
            logger.warning(f"Reminder manager failed: {e}")
            self.reminders = None

        try:
            from modules.alarms import AlarmManager
            self.alarms = AlarmManager(voice_output=self.voice, brain=self.brain)
        except Exception as e:
            logger.warning(f"Alarm manager failed: {e}")
            self.alarms = None

        try:
            from modules.app_sync import AppSyncManager
            self.app_sync = AppSyncManager(voice_output=self.voice)
            self.app_sync.start_monitoring()
        except Exception as e:
            logger.warning(f"App sync failed: {e}")
            self.app_sync = None

        try:
            from modules.phone_guardian import PhoneGuardian
            self.phone_guardian = PhoneGuardian(voice_output=self.voice)
            self.phone_guardian.start_monitoring()
        except Exception as e:
            logger.warning(f"Phone guardian failed: {e}")
            self.phone_guardian = None

        # ── Wake Word (last — starts listening) ──────────────────────────────
        try:
            from core.wake_word import WakeWordDetector
            self.wake_word = WakeWordDetector(on_wake_callback=self._on_wake_word_detected)
        except Exception as e:
            logger.warning(f"Wake word detector failed: {e}")
            self.wake_word = None

        self.is_initialized = True
        console.print("[bold green]✅ AVANT is online and ready.[/bold green]")

    def start(self):
        """Start AVANT — begin listening for wake word."""
        if not self.is_initialized:
            logger.error("AVANT failed to initialize. Check logs.")
            return

        # Greeting
        self._speak(
            f"Hey {OWNER_NAME}! AVANT is online. "
            "I'm listening — just say my name whenever you need me.",
            tone_mode="casual"
        )

        if self.wake_word:
            self.wake_word.start()
            console.print("[dim]Listening for wake word 'AVANT'... (Ctrl+C to stop)[/dim]")
            try:
                while True:
                    time.sleep(0.5)
            except KeyboardInterrupt:
                self.shutdown()
        else:
            # Fallback: text input mode (for testing without microphone/Porcupine)
            logger.warning("Wake word unavailable — running in text input mode")
            self._run_text_mode()

    def _on_wake_word_detected(self):
        """Called when 'AVANT' wake word is heard."""
        if self.is_active:
            return  # Already processing

        self.is_active = True
        logger.info("🔥 Wake word detected — activating pipeline")

        # Play activation sound / acknowledgment
        self._speak("Yeah?", tone_mode="casual")

        # Run the full pipeline in a thread so wake word can keep listening
        thread = threading.Thread(target=self._process_command, daemon=True)
        thread.start()

    def _process_command(self):
        """Full command processing pipeline."""
        audio_path = None
        try:
            # Step 1: Capture audio
            if not self.transcriber:
                logger.error("No transcriber available")
                return

            # Record to temp file for voice verification
            audio_path = tempfile.mktemp(suffix=".wav")
            frames = self.transcriber._record_until_silence()

            if not frames:
                self.is_active = False
                return

            self.transcriber._save_wav(audio_path, frames)

            # Step 2: Verify speaker identity
            if self.verifier:
                is_owner, confidence = self.verifier.verify(audio_path)
                if not is_owner:
                    logger.warning(f"⛔ Unknown voice rejected (confidence: {confidence:.2f})")
                    self._speak(
                        "Sorry, I only answer to Michael.",
                        tone_mode="serious"
                    )
                    return

            # Step 3: Transcribe
            text = self.transcriber.transcribe_file(audio_path)
            if not text or len(text.strip()) < 2:
                logger.debug("Empty or too-short transcription")
                self.is_active = False
                return

            console.print(f"[bold yellow]You:[/bold yellow] {text}")

            # Step 4: Detect tone/emotion
            if self.tone_detector:
                tone_mode = self.tone_detector.detect(audio_path=audio_path, text=text)
            else:
                tone_mode = "casual"

            console.print(f"[dim]Tone: {tone_mode}[/dim]")

            # Step 5: Route to appropriate module
            response = self._route_command(text, tone_mode, audio_path)

            # Step 6: Speak response
            console.print(f"[bold cyan]AVANT:[/bold cyan] {response}")
            self._speak(response, tone_mode=tone_mode)

        except Exception as e:
            logger.error(f"Command processing error: {e}")
            self._speak("Something went sideways on my end. Try again?", tone_mode="casual")
        finally:
            # Clean up temp audio file
            if audio_path and os.path.exists(audio_path):
                try:
                    os.unlink(audio_path)
                except Exception:
                    pass
            self.is_active = False

    def _route_command(self, text: str, tone_mode: str, audio_path: str = None) -> str:
        """
        Intelligent command router — decides which module handles the request.
        Routes to: search, navigation, calendar, weather, news, reminders, alarms, or brain.
        """
        text_lower = text.lower().strip()

        # ── Navigation / Directions ──────────────────────────────────────────
        if any(kw in text_lower for kw in ["directions to", "how far is", "how do i get to",
                                            "navigate to", "route to", "take me to",
                                            "how long to drive", "how long to walk"]):
            return self._handle_navigation(text, text_lower)

        # ── Calendar ────────────────────────────────────────────────────────
        if any(kw in text_lower for kw in ["add to my calendar", "schedule a", "set a meeting",
                                            "add an appointment", "add a meeting",
                                            "what's on my calendar", "my schedule",
                                            "upcoming events"]):
            return self._handle_calendar(text, text_lower)

        if any(kw in text_lower for kw in ["remove from my calendar", "delete the",
                                            "cancel my", "remove my appointment",
                                            "delete appointment"]):
            return self._handle_calendar_delete(text, text_lower)

        # ── Alarms ──────────────────────────────────────────────────────────
        if any(kw in text_lower for kw in ["set an alarm", "wake me up", "alarm for",
                                            "alarm at"]):
            return self._handle_alarm(text, text_lower)

        # ── Reminders ───────────────────────────────────────────────────────
        if any(kw in text_lower for kw in ["remind me", "don't let me forget",
                                            "remember to", "set a reminder",
                                            "my reminders"]):
            return self._handle_reminder(text, text_lower)

        # ── Weather ─────────────────────────────────────────────────────────
        if any(kw in text_lower for kw in ["weather", "temperature", "forecast",
                                            "rain", "sunny", "snow"]):
            return self._handle_weather(text, text_lower)

        # ── News ────────────────────────────────────────────────────────────
        if any(kw in text_lower for kw in ["what's happening in", "news from",
                                            "news about", "what's going on in",
                                            "headlines", "world news", "breaking news"]):
            return self._handle_news(text, text_lower)

        # ── Simple explanation ───────────────────────────────────────────────
        if any(kw in text_lower for kw in ["explain simply", "explain like", "simple terms",
                                            "break it down", "for a kid", "7th grade",
                                            "like i'm 12"]):
            return self._handle_simple_explain(text, text_lower)

        # ── GitHub Emergency Push ────────────────────────────────────────────
        if any(kw in text_lower for kw in ["push to github", "backup to github",
                                            "push everything", "github backup",
                                            "save to github", "emergency backup"]):
            if self.phone_guardian:
                result = self.phone_guardian.push_to_github()
                return result
            return "GitHub backup isn't configured. Add GITHUB_TOKEN and GITHUB_REPO to .env."

        # ── Phone location ────────────────────────────────────────────────────
        if any(kw in text_lower for kw in ["where is my phone", "is my phone nearby",
                                            "phone nearby", "lost my phone",
                                            "find my phone"]):
            if self.phone_guardian:
                nearby = self.phone_guardian.is_phone_nearby()
                if nearby:
                    return "Your phone is nearby — I can detect its Bluetooth signal."
                else:
                    return ("I can't detect your phone's Bluetooth signal. "
                            "It might be out of range or powered off. "
                            "Want me to push a backup to GitHub just in case?")
            return "Phone monitoring isn't configured. Add PHONE_BT_ADDRESS to .env."

        # ── App sync ─────────────────────────────────────────────────────────
        if any(kw in text_lower for kw in ["what apps", "connected apps", "synced apps"]):
            if self.app_sync:
                return self.app_sync.list_connected_apps()
            return "App sync isn't set up yet."

        # ── General conversation / web search ────────────────────────────────
        return self._handle_general(text, tone_mode)

    # ── Route Handlers ───────────────────────────────────────────────────────

    def _handle_navigation(self, text: str, text_lower: str) -> str:
        if not self.navigator:
            return "Navigation isn't configured yet. I need a Google Maps API key."

        # Extract destination from text
        destination = self._extract_destination(text_lower)
        if not destination:
            return "Where do you want to go? I didn't catch the destination."

        # Check if asking for all modes or fastest route
        if any(w in text_lower for w in ["directions", "route", "navigate", "take me"]):
            mode = "driving"
            if "walk" in text_lower:
                mode = "walking"
            elif "transit" in text_lower or "bus" in text_lower or "train" in text_lower:
                mode = "transit"
            return self.navigator.get_fastest_route(destination, mode=mode)
        else:
            # Asking "how far" — show all modes
            modes = ["walking", "driving", "transit", "flying"]
            if "boat" in text_lower or "ship" in text_lower:
                modes.append("boat")
            return self.navigator.get_travel_info(
                os.getenv("DEFAULT_HOME_ADDRESS", "current location"),
                destination,
                modes=modes
            )

    def _handle_calendar(self, text: str, text_lower: str) -> str:
        if not self.calendar:
            return "Calendar isn't connected yet. I need your Google Calendar credentials set up."

        if "upcoming" in text_lower or "what's on" in text_lower or "my schedule" in text_lower:
            return self.calendar.get_upcoming_events()

        # Extract event details using brain
        if self.brain:
            extraction_prompt = (
                f"Extract the calendar event details from this request: '{text}'. "
                "Return ONLY a JSON object with keys: title, datetime, duration_minutes, location. "
                "For datetime, use natural language like 'next Tuesday at 3pm'. "
                "If something isn't mentioned, use reasonable defaults."
            )
            try:
                import json
                raw = self.brain.think(extraction_prompt, tone_mode="serious", use_web_search=False)
                # Try to parse JSON from response
                start = raw.find("{")
                end = raw.rfind("}") + 1
                if start >= 0 and end > start:
                    details = json.loads(raw[start:end])
                    return self.calendar.create_event(
                        title=details.get("title", "Meeting"),
                        datetime_str=details.get("datetime", "tomorrow at 10am"),
                        duration_minutes=details.get("duration_minutes", 60),
                        location=details.get("location", "")
                    )
            except Exception as e:
                logger.warning(f"Calendar extraction failed: {e}")

        return "Tell me the event name and when — like 'add dentist appointment Tuesday at 2pm'."

    def _handle_calendar_delete(self, text: str, text_lower: str) -> str:
        if not self.calendar:
            return "Calendar isn't connected yet."

        # Extract event name
        for phrase in ["remove my", "delete the", "cancel my", "remove the", "delete my"]:
            if phrase in text_lower:
                event_name = text_lower.split(phrase)[-1].strip()
                if "appointment" in event_name:
                    event_name = event_name.replace("appointment", "").strip()
                if "meeting" in event_name:
                    event_name = event_name.replace("meeting", "").strip()
                return self.calendar.delete_event(event_name)

        return "Which event do you want to remove? Say the event name."

    def _handle_alarm(self, text: str, text_lower: str) -> str:
        if not self.alarms:
            return "Alarm system isn't ready yet."

        # Extract time
        time_indicators = ["for ", "at ", "wake me up at ", "alarm at "]
        alarm_time = None
        for indicator in time_indicators:
            if indicator in text_lower:
                alarm_time = text_lower.split(indicator)[-1].strip()
                # Clean up trailing words
                for word in [" tomorrow", " today", " am", " pm"]:
                    pass  # Keep AM/PM
                break

        if not alarm_time:
            return "What time should I set the alarm for?"

        return self.alarms.set_alarm(alarm_time)

    def _handle_reminder(self, text: str, text_lower: str) -> str:
        if not self.reminders:
            return "Reminder system isn't ready yet."

        if "my reminders" in text_lower or "list reminders" in text_lower:
            return self.reminders.list_reminders()

        # Extract reminder message and time
        reminder_msg = text
        for phrase in ["remind me to", "remind me about", "don't let me forget to",
                       "remember to", "set a reminder to", "remind me"]:
            if phrase in text_lower:
                reminder_msg = text_lower.split(phrase)[-1].strip()
                break

        # Look for time in the reminder
        when = None
        time_phrases = ["in ", "at ", "tomorrow", "tonight", "this evening",
                        "next ", "on Monday", "on Tuesday"]
        for tp in time_phrases:
            if tp.lower() in text_lower:
                when = tp + text_lower.split(tp.lower())[-1].strip()
                # Remove from reminder message
                reminder_msg = reminder_msg.replace(when, "").strip()
                break

        return self.reminders.add_reminder(reminder_msg, when=when)

    def _handle_weather(self, text: str, text_lower: str) -> str:
        if not self.weather:
            return "Weather service isn't configured. Add OPENWEATHER_API_KEY to .env."

        # Extract location
        location = self._extract_location(text_lower)
        if not location:
            location = os.getenv("DEFAULT_HOME_ADDRESS", "").split(",")[0] or "New York"

        if "forecast" in text_lower or "week" in text_lower:
            return self.weather.get_forecast(location)
        return self.weather.get_weather(location)

    def _handle_news(self, text: str, text_lower: str) -> str:
        if not self.news:
            return "News service isn't configured. Add NEWSAPI_KEY to .env."

        # Extract region/topic
        region_keywords = ["in ", "from ", "about ", "on "]
        topic = None
        for kw in region_keywords:
            if kw in text_lower:
                topic = text_lower.split(kw)[-1].strip().split(" ")[0:3]
                topic = " ".join(topic)
                break

        if topic:
            return self.news.get_regional_news(topic)
        return self.news.get_world_briefing()

    def _handle_simple_explain(self, text: str, text_lower: str) -> str:
        # Extract what to explain
        for phrase in ["explain simply", "explain like i'm 12", "break down",
                       "simple terms", "like a kid", "7th grade explain",
                       "explain", "what is", "what are"]:
            if phrase in text_lower:
                topic = text_lower.split(phrase)[-1].strip()
                if topic and self.search:
                    return self.search.explain_simply(topic)
                break

        if self.brain:
            return self.brain.think(
                text + " Explain this at a 7th grade level.",
                tone_mode="simple",
                use_web_search=True
            )
        return "What would you like me to explain in simple terms?"

    def _handle_general(self, text: str, tone_mode: str) -> str:
        """Handle general conversation, questions, and web search queries."""
        if not self.brain:
            return "My brain module isn't loaded right now. Check your OpenAI API key."

        # Use web search for factual/current questions
        needs_search = any(kw in text.lower() for kw in [
            "what is", "who is", "how does", "when did", "where is",
            "how many", "tell me about", "what happened", "history of",
            "latest", "current", "right now", "today"
        ])

        return self.brain.think(
            user_input=text,
            tone_mode=tone_mode,
            use_web_search=needs_search
        )

    # ── Utility Methods ──────────────────────────────────────────────────────

    def _speak(self, text: str, tone_mode: str = "casual"):
        """Speak text through voice output."""
        if self.voice:
            self.voice.speak(text, tone_mode=tone_mode)
        else:
            print(f"[AVANT]: {text}")

    def _extract_destination(self, text: str) -> str:
        """Extract destination from navigation request."""
        for phrase in ["directions to ", "navigate to ", "route to ", "take me to ",
                       "how far is ", "how do i get to ", "to "]:
            if phrase in text:
                dest = text.split(phrase)[-1].strip()
                # Remove trailing words
                for stop in [" by ", " using ", " walking", " driving"]:
                    dest = dest.split(stop)[0]
                return dest.strip()
        return ""

    def _extract_location(self, text: str) -> str:
        """Extract location from weather/news request."""
        for phrase in ["weather in ", "weather for ", "forecast for ",
                       "forecast in ", "temperature in ", "happening in ",
                       "news from ", "news in "]:
            if phrase in text:
                location = text.split(phrase)[-1].strip()
                return location.split(" ")[0:3]
        return ""

    # ── Text Input Mode (fallback without mic) ───────────────────────────────

    def _run_text_mode(self):
        """Run AVANT in text-input mode for testing."""
        console.print("[yellow]Running in TEXT MODE (no microphone/wake word)[/yellow]")
        console.print("[dim]Type your commands. Type 'quit' to exit.[/dim]\n")

        while True:
            try:
                user_input = input(f"[{OWNER_NAME}]: ").strip()
                if user_input.lower() in ("quit", "exit", "bye"):
                    self.shutdown()
                    break
                if not user_input:
                    continue

                tone_mode = "casual"
                if self.tone_detector:
                    tone_mode = self.tone_detector.detect(text=user_input)

                response = self._route_command(user_input, tone_mode)
                console.print(f"[bold cyan]AVANT:[/bold cyan] {response}\n")
                self._speak(response, tone_mode=tone_mode)

            except KeyboardInterrupt:
                self.shutdown()
                break
            except Exception as e:
                logger.error(f"Text mode error: {e}")

    # ── Voice Enrollment ─────────────────────────────────────────────────────

    def enroll_voice(self):
        """Enroll the owner's voice for speaker verification."""
        if not self.verifier:
            print("Speaker verifier not loaded. Check SpeechBrain installation.")
            return

        console.print(Panel(
            "[bold]Voice Enrollment — AVANT Speaker Verification[/bold]\n\n"
            "I'll record 5 samples of your voice.\n"
            "Say anything natural for 5-10 seconds each time.\n"
            "Speak clearly, at a normal distance from the microphone.",
            border_style="cyan"
        ))

        import pyaudio
        import wave
        sample_paths = []

        for i in range(5):
            input(f"\nPress ENTER for sample {i+1}/5 (then speak for ~7 seconds)...")
            print("🎙️ Recording... speak now!")

            # Record 7 seconds
            CHUNK = 1024
            RATE = 16000
            pa = pyaudio.PyAudio()
            stream = pa.open(format=pyaudio.paInt16, channels=1, rate=RATE,
                             input=True, frames_per_buffer=CHUNK)
            frames = []
            for _ in range(int(RATE / CHUNK * 7)):
                frames.append(stream.read(CHUNK, exception_on_overflow=False))
            stream.stop_stream()
            stream.close()
            pa.terminate()

            # Save sample
            sample_path = f"./data/enroll_sample_{i+1}.wav"
            os.makedirs("./data", exist_ok=True)
            with wave.open(sample_path, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(pa.get_sample_size(pyaudio.paInt16))
                wf.setframerate(RATE)
                wf.writeframes(b''.join(frames))
            sample_paths.append(sample_path)
            print(f"✅ Sample {i+1} recorded.")

        print("\n🧠 Processing voice profile...")
        success = self.verifier.enroll(sample_paths)

        # Clean up samples
        for path in sample_paths:
            try:
                os.unlink(path)
            except Exception:
                pass

        if success:
            print(f"\n✅ Voice profile enrolled for {OWNER_NAME}! AVANT will now only respond to your voice.")
        else:
            print("\n❌ Enrollment failed. Please try again.")

    def shutdown(self):
        """Graceful shutdown of all AVANT systems."""
        console.print("\n[yellow]Shutting down AVANT...[/yellow]")

        if self.voice:
            self._speak("Shutting down. Talk to you later!", tone_mode="casual")

        if self.wake_word:
            self.wake_word.stop()
        if self.bluetooth:
            self.bluetooth.stop_monitoring()
        if self.reminders:
            self.reminders.shutdown()
        if self.alarms:
            self.alarms.shutdown()
        if self.app_sync:
            self.app_sync.stop_monitoring()
        if self.phone_guardian:
            self.phone_guardian.stop_monitoring()

        console.print("[bold red]AVANT offline.[/bold red]")
        sys.exit(0)


# ── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AVANT — AmaVanta: A New Teammate",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  python avant.py            Start AVANT (listening for wake word)
  python avant.py --enroll   Enroll your voice (one-time setup)
  python avant.py --text     Run in text input mode (no mic required)
        """
    )
    parser.add_argument("--enroll", action="store_true",
                        help="Enroll your voice for speaker verification")
    parser.add_argument("--text", action="store_true",
                        help="Run in text input mode (no microphone)")
    args = parser.parse_args()

    avant = AVANT()

    if args.enroll:
        avant.enroll_voice()
    elif args.text:
        avant._run_text_mode()
    else:
        avant.start()


if __name__ == "__main__":
    main()
