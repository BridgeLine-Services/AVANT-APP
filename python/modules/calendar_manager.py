"""
AVANT — Calendar Manager Module
=================================
Reads, creates, and deletes Google Calendar events using the Google Calendar API.
AVANT can add appointments, remove them, and remind you of upcoming events.
Supports natural language date/time parsing ("next Tuesday at 3pm").
"""

import os
import json
from datetime import datetime, timedelta
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

CREDENTIALS_PATH = os.getenv("GOOGLE_CALENDAR_CREDENTIALS_PATH", "./data/google_credentials.json")
TOKEN_PATH = os.getenv("GOOGLE_CALENDAR_TOKEN_PATH", "./data/google_token.json")
CALENDAR_ID = "primary"

# Google Calendar API scopes
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events"
]


class CalendarManager:
    """
    Full Google Calendar integration.
    Create, read, update, and delete calendar events via voice.
    """

    def __init__(self):
        self.service = None
        self._init_calendar_service()

    def _init_calendar_service(self):
        """Initialize Google Calendar API service."""
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            from google_auth_oauthlib.flow import InstalledAppFlow
            from googleapiclient.discovery import build

            creds = None

            # Load existing token
            if os.path.exists(TOKEN_PATH):
                creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

            # Refresh or get new credentials
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                elif os.path.exists(CREDENTIALS_PATH):
                    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
                    creds = flow.run_local_server(port=0)
                    # Save token for future runs
                    os.makedirs(os.path.dirname(TOKEN_PATH), exist_ok=True)
                    with open(TOKEN_PATH, "w") as f:
                        f.write(creds.to_json())
                else:
                    logger.warning(
                        f"⚠️  Google Calendar credentials not found at {CREDENTIALS_PATH}. "
                        "Download from Google Cloud Console and place there."
                    )
                    return

            self.service = build("calendar", "v3", credentials=creds)
            logger.info("✅ Google Calendar service connected")

        except ImportError:
            logger.warning("Google API libraries not installed. Run: pip install google-api-python-client google-auth-oauthlib")
        except Exception as e:
            logger.error(f"Calendar init error: {e}")

    def get_upcoming_events(self, days_ahead: int = 7, max_events: int = 10) -> str:
        """
        Get upcoming calendar events.
        
        Args:
            days_ahead: How many days forward to look
            max_events: Maximum events to return
            
        Returns:
            Natural language description of events
        """
        if not self.service:
            return "Calendar isn't connected yet. I need Google Calendar credentials to check your schedule."

        try:
            now = datetime.utcnow().isoformat() + "Z"
            future = (datetime.utcnow() + timedelta(days=days_ahead)).isoformat() + "Z"

            events_result = self.service.events().list(
                calendarId=CALENDAR_ID,
                timeMin=now,
                timeMax=future,
                maxResults=max_events,
                singleEvents=True,
                orderBy="startTime"
            ).execute()

            events = events_result.get("items", [])

            if not events:
                return f"You've got nothing scheduled in the next {days_ahead} days — clean slate!"

            parts = [f"Here's what's coming up in the next {days_ahead} days:"]
            for event in events:
                start = event["start"].get("dateTime", event["start"].get("date", ""))
                try:
                    if "T" in start:
                        dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                        time_str = dt.strftime("%A, %B %d at %I:%M %p")
                    else:
                        dt = datetime.fromisoformat(start)
                        time_str = dt.strftime("%A, %B %d") + " (all day)"
                except Exception:
                    time_str = start

                summary = event.get("summary", "Untitled event")
                parts.append(f"{summary} — {time_str}")

            return ". ".join(parts) + "."

        except Exception as e:
            logger.error(f"Failed to get calendar events: {e}")
            return "I hit a snag fetching your calendar. Let me try again in a sec."

    def create_event(
        self,
        title: str,
        datetime_str: str,
        duration_minutes: int = 60,
        description: str = "",
        location: str = ""
    ) -> str:
        """
        Create a new calendar event.
        
        Args:
            title: Event name
            datetime_str: Natural language datetime OR ISO format
            duration_minutes: Event duration
            description: Optional event description
            location: Optional event location
            
        Returns:
            Confirmation message
        """
        if not self.service:
            return "Calendar isn't connected yet — I need your Google Calendar credentials."

        try:
            # Parse the datetime
            start_dt = self._parse_datetime(datetime_str)
            if not start_dt:
                return f"I couldn't figure out when '{datetime_str}' is. Try something like 'Tuesday at 3pm' or 'June 20 at 10am'."

            end_dt = start_dt + timedelta(minutes=duration_minutes)

            event_body = {
                "summary": title,
                "description": description,
                "location": location,
                "start": {
                    "dateTime": start_dt.isoformat(),
                    "timeZone": os.getenv("DEFAULT_TIMEZONE", "America/Los_Angeles")
                },
                "end": {
                    "dateTime": end_dt.isoformat(),
                    "timeZone": os.getenv("DEFAULT_TIMEZONE", "America/Los_Angeles")
                },
                "reminders": {
                    "useDefault": False,
                    "overrides": [
                        {"method": "popup", "minutes": 30},
                        {"method": "popup", "minutes": 10}
                    ]
                }
            }

            event = self.service.events().insert(
                calendarId=CALENDAR_ID,
                body=event_body
            ).execute()

            time_str = start_dt.strftime("%A, %B %d at %I:%M %p")
            logger.info(f"✅ Calendar event created: '{title}' on {time_str}")
            return f"Done! I added '{title}' to your calendar for {time_str}. You'll get a reminder 30 minutes and 10 minutes before."

        except Exception as e:
            logger.error(f"Failed to create event '{title}': {e}")
            return f"Something went wrong adding '{title}' to your calendar. Double-check your Google credentials."

    def delete_event(self, event_name: str) -> str:
        """
        Find and delete a calendar event by name (fuzzy match).
        
        Args:
            event_name: Name or partial name of event to delete
            
        Returns:
            Confirmation or error message
        """
        if not self.service:
            return "Calendar isn't connected yet."

        try:
            # Search for the event
            now = datetime.utcnow().isoformat() + "Z"
            future = (datetime.utcnow() + timedelta(days=90)).isoformat() + "Z"

            events_result = self.service.events().list(
                calendarId=CALENDAR_ID,
                timeMin=now,
                timeMax=future,
                maxResults=50,
                singleEvents=True,
                orderBy="startTime"
            ).execute()

            events = events_result.get("items", [])

            # Find best match
            event_name_lower = event_name.lower()
            matched_event = None
            for event in events:
                summary = event.get("summary", "").lower()
                if event_name_lower in summary or summary in event_name_lower:
                    matched_event = event
                    break

            if not matched_event:
                return f"I couldn't find any upcoming event called '{event_name}'. Want me to check with a different name?"

            event_title = matched_event.get("summary", "Unknown event")
            start = matched_event["start"].get("dateTime", matched_event["start"].get("date", ""))
            
            try:
                if "T" in start:
                    dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                    time_str = dt.strftime("%A, %B %d at %I:%M %p")
                else:
                    time_str = start
            except Exception:
                time_str = start

            # Delete it
            self.service.events().delete(
                calendarId=CALENDAR_ID,
                eventId=matched_event["id"]
            ).execute()

            logger.info(f"🗑️ Deleted calendar event: '{event_title}'")
            return f"Removed! '{event_title}' on {time_str} has been deleted from your calendar."

        except Exception as e:
            logger.error(f"Failed to delete event '{event_name}': {e}")
            return f"Ran into an issue deleting '{event_name}'. Try again or check your calendar manually."

    def _parse_datetime(self, datetime_str: str):
        """
        Parse natural language datetime strings.
        Examples: "next Tuesday at 3pm", "June 20 at 10am", "tomorrow at 2:30pm"
        """
        try:
            import parsedatetime
            cal = parsedatetime.Calendar()
            time_struct, parse_status = cal.parse(datetime_str)
            if parse_status == 0:
                return None
            return datetime(*time_struct[:6])
        except ImportError:
            try:
                from dateutil import parser
                return parser.parse(datetime_str, fuzzy=True)
            except Exception:
                pass
        except Exception as e:
            logger.warning(f"parsedatetime failed: {e}")
            try:
                from dateutil import parser
                return parser.parse(datetime_str, fuzzy=True)
            except Exception:
                pass
        return None
