"""
AVANT — Creative Alarm System
================================
AVANT wakes you up in creative, unique ways — never the same twice.
She rotates through different wake-up experiences: music, fun facts,
jokes, challenges, motivational speeches, news briefs, riddles, etc.
New experiences automatically cycle so mornings stay interesting.
"""

import os
import json
import random
import datetime
from loguru import logger
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

load_dotenv()

ALARM_HISTORY_PATH = "./data/alarm_history.json"
OWNER_NAME = os.getenv("OWNER_NAME", "Michael")

# ── Alarm Wake-Up Styles ──────────────────────────────────────────────────────
# Rotates through these — never repeats the same style twice in a row
WAKEUP_STYLES = [
    "fun_fact",
    "joke",
    "motivational",
    "news_brief",
    "riddle",
    "challenge",
    "inspiring_quote",
    "trivia",
    "compliment",
    "today_history",
    "weather_and_plan",
    "word_of_the_day",
    "brain_teaser",
    "celebrity_birthday",
    "sports_recap"
]

WAKEUP_PROMPTS = {
    "fun_fact": (
        f"Wake up {OWNER_NAME}! Open your eyes — here's something wild to start your day: "
        "Give me a fascinating, surprising fact that most people don't know. "
        "Make it sound exciting and start with 'Did you know...' Keep it to 2-3 sentences."
    ),
    "joke": (
        f"Good morning {OWNER_NAME}! Rise and shine — I've got a joke for you. "
        "Tell a funny, original joke — setup and punchline. Make it actually clever, not cheesy. "
        "Then wish them a great day in your own fun way."
    ),
    "motivational": (
        f"Wake up {OWNER_NAME}! Time to get up and crush it. "
        "Give a short, genuinely motivating message (not generic) — something that actually "
        "fires you up. Make it personal and powerful. Then tell them today is going to be great."
    ),
    "news_brief": (
        f"Good morning {OWNER_NAME}! Here's your 60-second world briefing to wake up to. "
        "Give 3 of the most interesting current events happening today (be specific with details). "
        "Keep each one to one sentence. Then say 'That's your morning brief. Now get up!'"
    ),
    "riddle": (
        f"Rise and shine {OWNER_NAME}! Can't check your phone until you solve this: "
        "Give me a clever riddle — then after a short pause, give the answer. "
        "Make it actually challenging but solvable."
    ),
    "challenge": (
        f"Good morning {OWNER_NAME}! Here's your morning challenge. "
        "Give me an interesting 30-second physical or mental challenge to do right after waking up. "
        "Something fun and energizing — not just 'do 10 pushups'."
    ),
    "inspiring_quote": (
        f"Hey {OWNER_NAME}, time to start the day! "
        "Share a powerful quote from a historical figure, leader, or innovator. "
        "Then explain in 1-2 sentences why it's relevant right now."
    ),
    "trivia": (
        f"Good morning {OWNER_NAME}! Before you get up, answer this: "
        "Ask a genuinely interesting trivia question from history, science, or culture. "
        "Then give the answer with a brief explanation."
    ),
    "compliment": (
        f"Wake up, {OWNER_NAME}! Starting your day with some real talk. "
        "Give a genuine, specific compliment about the kind of person who takes on big goals. "
        "Make it feel personal and earned, not generic flattery."
    ),
    "today_history": (
        f"Rise and shine {OWNER_NAME}! Here's what happened on this day in history. "
        "Tell me 2 fascinating historical events that happened on today's date from different eras. "
        "Make each one interesting and specific."
    ),
    "weather_and_plan": (
        f"Good morning {OWNER_NAME}! Quick weather and day-planning check. "
        "Remind them to check their schedule for the day and give general advice on how to "
        "structure a productive morning. Keep it practical."
    ),
    "word_of_the_day": (
        f"Morning {OWNER_NAME}! Here's your word of the day. "
        "Give me a genuinely useful, interesting word that most English speakers don't know — "
        "with its pronunciation, definition, and an example sentence. "
        "Make it a word they'd actually want to use."
    ),
    "brain_teaser": (
        f"Hey {OWNER_NAME}, your brain needs to warm up! "
        "Give me a short logic puzzle or lateral thinking question. "
        "Make it genuinely tricky but solvable. Then provide the answer."
    ),
    "celebrity_birthday": (
        f"Good morning {OWNER_NAME}! Celebrity corner — who's celebrating today? "
        "Tell me which famous person (actor, athlete, musician, scientist) was born today, "
        "what they're known for, and one surprising fact about them."
    ),
    "sports_recap": (
        f"Rise and shine {OWNER_NAME}! Here's your sports update from yesterday. "
        "Give a quick recap of notable sporting events, scores, or storylines from the past 24 hours. "
        "Cover different sports to keep it interesting."
    )
}


class AlarmManager:
    """
    Creative alarm system that delivers unique wake-up experiences every morning.
    Tracks history to avoid repeating styles too soon.
    """

    def __init__(self, voice_output=None, brain=None):
        """
        Args:
            voice_output: VoiceOutput instance for spoken alarms
            brain: AVANTBrain instance for generating alarm content
        """
        self.voice_output = voice_output
        self.brain = brain
        self.alarm_history = self._load_history()
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self._restore_alarms()
        logger.info("✅ Alarm Manager ready")

    def set_alarm(self, time_str: str, label: str = "", repeat_days: list = None) -> str:
        """
        Set a new alarm.
        
        Args:
            time_str: Time in "HH:MM" 24h or "7:30am" format
            label: Optional alarm label
            repeat_days: List of days to repeat (["monday", "tuesday"]) or None for once
            
        Returns:
            Confirmation message
        """
        try:
            # Parse time
            alarm_time = self._parse_time(time_str)
            if not alarm_time:
                return f"I couldn't understand '{time_str}' as a time. Try '7:30am' or '08:00'."

            alarm_id = f"alarm_{alarm_time.strftime('%H%M')}_{label.replace(' ', '_')}"

            alarm_record = {
                "id": alarm_id,
                "time": alarm_time.strftime("%H:%M"),
                "label": label or "Morning alarm",
                "repeat_days": repeat_days or [],
                "active": True,
                "created_at": datetime.datetime.now().isoformat()
            }

            # Schedule the alarm
            if repeat_days:
                # Repeating alarm
                day_map = {"mon": 0, "monday": 0, "tue": 1, "tuesday": 1, "wed": 2, "wednesday": 2,
                           "thu": 3, "thursday": 3, "fri": 4, "friday": 4, "sat": 5, "saturday": 5,
                           "sun": 6, "sunday": 6}
                day_ints = [day_map.get(d.lower(), 0) for d in repeat_days]
                day_str = ",".join(str(d) for d in day_ints)

                self.scheduler.add_job(
                    func=self._trigger_alarm,
                    trigger=CronTrigger(
                        day_of_week=day_str,
                        hour=alarm_time.hour,
                        minute=alarm_time.minute
                    ),
                    args=[alarm_id, alarm_record["label"]],
                    id=alarm_id,
                    replace_existing=True
                )
                days_str = ", ".join(repeat_days)
                msg = f"Alarm set for {alarm_time.strftime('%I:%M %p')} every {days_str}."
            else:
                # One-time alarm (next occurrence of this time)
                now = datetime.datetime.now()
                alarm_dt = now.replace(
                    hour=alarm_time.hour,
                    minute=alarm_time.minute,
                    second=0,
                    microsecond=0
                )
                if alarm_dt <= now:
                    alarm_dt += datetime.timedelta(days=1)

                self.scheduler.add_job(
                    func=self._trigger_alarm,
                    trigger=DateTrigger(run_date=alarm_dt),
                    args=[alarm_id, alarm_record["label"]],
                    id=alarm_id,
                    replace_existing=True
                )
                msg = f"Alarm set for {alarm_dt.strftime('%A at %I:%M %p')}."

            # Save alarm record
            self._save_alarm_record(alarm_record)
            logger.info(f"⏰ Alarm set: {alarm_id}")

            return f"{msg} I'll have something special to wake you up — it won't be boring, I promise."

        except Exception as e:
            logger.error(f"Failed to set alarm: {e}")
            return "Ran into an issue setting that alarm. Try again?"

    def _trigger_alarm(self, alarm_id: str, label: str):
        """Called when an alarm fires — generate and deliver creative wake-up."""
        logger.info(f"🔔 Alarm firing: {alarm_id}")

        # Pick a wake-up style (not recently used)
        style = self._pick_wakeup_style()

        # Generate content using AVANT's brain
        wakeup_content = self._generate_wakeup_content(style)

        # Deliver via voice
        if self.voice_output:
            # Play an attention sound first (optional)
            self.voice_output.speak(wakeup_content, tone_mode="excited")
        else:
            print(f"\n🔔 AVANT ALARM ({label}): {wakeup_content}\n")

        # Track this style in history
        self._record_style_used(style)

    def _generate_wakeup_content(self, style: str) -> str:
        """Generate wake-up content using AVANT's brain or fallback prompts."""
        prompt = WAKEUP_PROMPTS.get(style, WAKEUP_PROMPTS["fun_fact"])

        if self.brain:
            try:
                content = self.brain.think(
                    user_input=prompt,
                    tone_mode="excited",
                    use_web_search=(style in ["news_brief", "sports_recap", "weather_and_plan", "celebrity_birthday"])
                )
                return content
            except Exception as e:
                logger.error(f"Brain failed to generate alarm content: {e}")

        # Fallback content
        return (
            f"Good morning {OWNER_NAME}! Time to wake up and start your amazing day. "
            "You've got big things ahead — let's get moving!"
        )

    def _pick_wakeup_style(self) -> str:
        """Pick a wake-up style not used recently."""
        recently_used = set(self.alarm_history.get("recent_styles", [])[-5:])
        available = [s for s in WAKEUP_STYLES if s not in recently_used]

        if not available:
            available = WAKEUP_STYLES  # Reset if all used

        return random.choice(available)

    def _record_style_used(self, style: str):
        """Record which style was used."""
        if "recent_styles" not in self.alarm_history:
            self.alarm_history["recent_styles"] = []
        self.alarm_history["recent_styles"].append(style)
        # Keep only last 10
        self.alarm_history["recent_styles"] = self.alarm_history["recent_styles"][-10:]
        self._save_history()

    def _parse_time(self, time_str: str):
        """Parse time string to datetime object."""
        formats = ["%H:%M", "%I:%M%p", "%I:%M %p", "%I%p", "%I %p"]
        time_str = time_str.strip().upper()
        for fmt in formats:
            try:
                return datetime.datetime.strptime(time_str, fmt)
            except ValueError:
                continue

        # Try parsedatetime
        try:
            import parsedatetime
            cal = parsedatetime.Calendar()
            struct, status = cal.parse(time_str)
            if status > 0:
                return datetime.datetime(*struct[:6])
        except Exception:
            pass
        return None

    def _save_alarm_record(self, alarm: dict):
        """Save alarm to history file."""
        alarms = self.alarm_history.get("alarms", [])
        alarms.append(alarm)
        self.alarm_history["alarms"] = alarms
        self._save_history()

    def _restore_alarms(self):
        """Restore active alarms from history on startup."""
        alarms = self.alarm_history.get("alarms", [])
        active = [a for a in alarms if a.get("active", True)]
        if active:
            logger.info(f"⏰ Found {len(active)} saved alarm(s) — restoring...")
            # Note: For full restoration, re-schedule each alarm

    def _load_history(self) -> dict:
        if os.path.exists(ALARM_HISTORY_PATH):
            try:
                with open(ALARM_HISTORY_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"recent_styles": [], "alarms": []}

    def _save_history(self):
        os.makedirs(os.path.dirname(ALARM_HISTORY_PATH), exist_ok=True)
        try:
            with open(ALARM_HISTORY_PATH, "w") as f:
                json.dump(self.alarm_history, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save alarm history: {e}")

    def shutdown(self):
        self.scheduler.shutdown(wait=False)
