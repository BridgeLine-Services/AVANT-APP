"""
AVANT — Reminders & Missed Task Tracker
=========================================
Schedules and delivers smart reminders.
Tracks things you said you'd do but might forget:
  - Calls to return
  - People you forgot to text back  
  - Work schedules
  - Custom reminders
  
Uses APScheduler for background task execution.
"""

import os
import json
import time
from datetime import datetime, timedelta
from loguru import logger
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

load_dotenv()

REMINDERS_PATH = "./data/reminders.json"
OWNER_NAME = os.getenv("OWNER_NAME", "Michael")


class ReminderManager:
    """
    Manages all of AVANT's reminder and alert functionality.
    Delivers reminders through AVANT's voice when they're due.
    """

    def __init__(self, voice_output=None):
        """
        Args:
            voice_output: VoiceOutput instance for spoken reminders
        """
        self.voice_output = voice_output
        self.reminders = self._load_reminders()
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self._restore_pending_reminders()
        logger.info("✅ Reminder Manager started")

    def add_reminder(self, message: str, when: str = None, delay_minutes: int = None) -> str:
        """
        Set a new reminder.
        
        Args:
            message: What to remind about
            when: Natural language time ("in 30 minutes", "tomorrow at 9am")
            delay_minutes: Simple delay in minutes (overrides 'when')
            
        Returns:
            Confirmation message
        """
        try:
            # Parse when to remind
            if delay_minutes:
                remind_at = datetime.now() + timedelta(minutes=delay_minutes)
            elif when:
                remind_at = self._parse_reminder_time(when)
                if not remind_at:
                    return f"I couldn't figure out when '{when}' is. Try 'in 30 minutes' or 'tomorrow at 9am'."
            else:
                # Default: 30 minutes
                remind_at = datetime.now() + timedelta(minutes=30)

            # Create reminder record
            reminder = {
                "id": f"reminder_{int(time.time())}",
                "message": message,
                "remind_at": remind_at.isoformat(),
                "created_at": datetime.now().isoformat(),
                "delivered": False,
                "type": "manual"
            }

            self.reminders.append(reminder)
            self._save_reminders()

            # Schedule the alert
            self._schedule_reminder(reminder)

            time_str = remind_at.strftime("%A, %B %d at %I:%M %p")
            logger.info(f"⏰ Reminder set: '{message}' at {time_str}")
            return f"Set! I'll remind you to '{message}' on {time_str}."

        except Exception as e:
            logger.error(f"Failed to set reminder: {e}")
            return "Something went wrong setting that reminder. Try again?"

    def add_person_followup(self, person_name: str, reason: str, delay_hours: int = 2) -> str:
        """
        Remind to follow up with a person (missed text, call, etc.)
        
        Args:
            person_name: Name of person to follow up with
            reason: Why ("forgot to text back", "missed call", etc.)
            delay_hours: Hours until reminder
        """
        message = f"Follow up with {person_name} — {reason}"
        remind_at = datetime.now() + timedelta(hours=delay_hours)
        return self.add_reminder(message, delay_minutes=delay_hours * 60)

    def list_reminders(self) -> str:
        """List all pending (undelivered) reminders."""
        pending = [r for r in self.reminders if not r.get("delivered", False)]

        if not pending:
            return "You've got no pending reminders right now — you're all caught up!"

        parts = [f"Here are your {len(pending)} pending reminder(s):"]
        for r in pending[:10]:  # Max 10
            try:
                remind_at = datetime.fromisoformat(r["remind_at"])
                time_str = remind_at.strftime("%A at %I:%M %p")
                parts.append(f"'{r['message']}' — due {time_str}")
            except Exception:
                parts.append(f"'{r['message']}'")

        return ". ".join(parts) + "."

    def cancel_reminder(self, message_fragment: str) -> str:
        """Cancel a reminder by partial message match."""
        for i, r in enumerate(self.reminders):
            if not r.get("delivered") and message_fragment.lower() in r["message"].lower():
                # Remove from scheduler
                try:
                    self.scheduler.remove_job(r["id"])
                except Exception:
                    pass
                # Mark as delivered (cancelled)
                self.reminders[i]["delivered"] = True
                self._save_reminders()
                return f"Cancelled! The reminder about '{r['message']}' is gone."

        return f"I couldn't find a reminder matching '{message_fragment}'."

    def check_missed_tasks(self) -> str:
        """
        Check for any forgotten reminders or overdue tasks.
        This can be called proactively by AVANT.
        """
        now = datetime.now()
        overdue = []
        
        for r in self.reminders:
            if r.get("delivered"):
                continue
            try:
                remind_at = datetime.fromisoformat(r["remind_at"])
                if remind_at < now:
                    overdue.append(r["message"])
            except Exception:
                continue

        if overdue:
            parts = [f"Hey, I noticed you have {len(overdue)} thing(s) I should have reminded you about:"]
            parts.extend(overdue[:5])
            return ". ".join(parts) + ". Want me to reschedule any of these?"

        return ""

    def _deliver_reminder(self, reminder_id: str):
        """Called by scheduler when a reminder is due."""
        # Find the reminder
        reminder = next((r for r in self.reminders if r["id"] == reminder_id), None)
        if not reminder:
            return

        message = reminder["message"]
        speech = f"Hey {OWNER_NAME}, just a reminder — {message}."

        logger.info(f"🔔 Delivering reminder: '{message}'")

        if self.voice_output:
            self.voice_output.speak(speech, tone_mode="casual")
        else:
            print(f"\n🔔 AVANT REMINDER: {speech}\n")

        # Mark as delivered
        for i, r in enumerate(self.reminders):
            if r["id"] == reminder_id:
                self.reminders[i]["delivered"] = True
                break
        self._save_reminders()

    def _schedule_reminder(self, reminder: dict):
        """Add reminder to APScheduler."""
        try:
            remind_at = datetime.fromisoformat(reminder["remind_at"])
            if remind_at <= datetime.now():
                # Already past — deliver immediately
                self._deliver_reminder(reminder["id"])
                return

            self.scheduler.add_job(
                func=self._deliver_reminder,
                trigger=DateTrigger(run_date=remind_at),
                args=[reminder["id"]],
                id=reminder["id"],
                replace_existing=True
            )
        except Exception as e:
            logger.error(f"Failed to schedule reminder {reminder['id']}: {e}")

    def _restore_pending_reminders(self):
        """Restore undelivered reminders from disk after restart."""
        pending = [r for r in self.reminders if not r.get("delivered", False)]
        for r in pending:
            self._schedule_reminder(r)
        if pending:
            logger.info(f"⏰ Restored {len(pending)} pending reminder(s)")

    def _parse_reminder_time(self, when_str: str):
        """Parse natural language time string to datetime."""
        try:
            import parsedatetime
            cal = parsedatetime.Calendar()
            time_struct, status = cal.parse(when_str)
            if status > 0:
                return datetime(*time_struct[:6])
        except ImportError:
            pass
        try:
            from dateutil import parser
            return parser.parse(when_str, fuzzy=True)
        except Exception:
            pass
        return None

    def _load_reminders(self) -> list:
        """Load reminders from disk."""
        if os.path.exists(REMINDERS_PATH):
            try:
                with open(REMINDERS_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_reminders(self):
        """Save reminders to disk."""
        os.makedirs(os.path.dirname(REMINDERS_PATH), exist_ok=True)
        try:
            with open(REMINDERS_PATH, "w") as f:
                json.dump(self.reminders, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save reminders: {e}")

    def shutdown(self):
        """Shutdown the scheduler gracefully."""
        self.scheduler.shutdown(wait=False)
