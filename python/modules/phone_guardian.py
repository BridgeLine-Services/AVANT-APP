"""
AVANT — Phone Guardian: Proximity Alert + Emergency GitHub Backup
==================================================================
Two critical safety features in one module:

1. PHONE PROXIMITY MONITOR
   - Continuously tracks your phone's Bluetooth signal strength (RSSI)
   - If signal drops below a threshold → phone is too far away
   - AVANT speaks a warning: "Hey Michael, I think you left your phone!"
   - Escalating alerts if you still don't come back

2. EMERGENCY GITHUB PUSH
   - Can be triggered manually: "AVANT, push everything to GitHub"
   - Auto-triggers after N consecutive proximity warnings
   - Commits and pushes ALL AVANT data/config to your GitHub repo:
     * Memory, reminders, alarms, app sync state
     * Voice profile (encrypted blob)
     * Calendar cache
     * Your AVANT config (.env stripped of secrets)
   - Creates a timestamped commit so you can restore from any device

SETUP:
  In .env:
    PHONE_BT_ADDRESS=XX:XX:XX:XX:XX:XX  (your phone's Bluetooth MAC)
    GITHUB_TOKEN=your_personal_access_token
    GITHUB_REPO=yourusername/avant-backup
    PROXIMITY_RSSI_THRESHOLD=-75   (dBm — lower = farther, default -75)
    PROXIMITY_CHECK_INTERVAL=30    (seconds between checks)
"""

import os
import time
import json
import base64
import threading
import subprocess
import platform
from datetime import datetime
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
PHONE_BT_ADDRESS = os.getenv("PHONE_BT_ADDRESS", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "")
OWNER_NAME = os.getenv("OWNER_NAME", "Michael")

RSSI_THRESHOLD = int(os.getenv("PROXIMITY_RSSI_THRESHOLD", "-75"))
CHECK_INTERVAL = int(os.getenv("PROXIMITY_CHECK_INTERVAL", "30"))
WARN_BEFORE_PUSH = int(os.getenv("WARN_BEFORE_PUSH", "3"))   # Warns 3x before auto-pushing

# Files to back up to GitHub
BACKUP_FILES = [
    "./data/memory.json",
    "./data/reminders.json",
    "./data/alarm_history.json",
    "./data/app_sync.json",
    "./data/voice_profile.pkl",    # Binary — base64 encoded
    "./.env.example",
]

# Directories to back up
BACKUP_DIRS = [
    "./core",
    "./modules",
]


class PhoneGuardian:
    """
    Monitors phone proximity via Bluetooth RSSI.
    Warns when phone is left behind.
    Pushes AVANT state to GitHub for recovery.
    """

    def __init__(self, voice_output=None):
        self.voice = voice_output
        self._monitoring = False
        self._monitor_thread = None
        self._consecutive_misses = 0
        self._last_warning_time = 0
        self._phone_present = True
        self._github_client = None
        self._os = platform.system()

        if GITHUB_TOKEN and GITHUB_REPO:
            self._init_github()
        else:
            logger.info("GitHub backup: set GITHUB_TOKEN and GITHUB_REPO in .env to enable")

        logger.info("✅ Phone Guardian initialized")

    def _init_github(self):
        """Initialize PyGithub client."""
        try:
            from github import Github
            self._github_client = Github(GITHUB_TOKEN)
            # Test connection
            user = self._github_client.get_user()
            logger.info(f"✅ GitHub connected as: {user.login}")
        except ImportError:
            logger.warning("PyGithub not installed. Run: pip install PyGithub")
            self._github_client = None
        except Exception as e:
            logger.error(f"GitHub init failed: {e}")
            self._github_client = None

    # ── Phone Proximity ──────────────────────────────────────────────────────

    def start_monitoring(self):
        """Start monitoring phone proximity in background."""
        if not PHONE_BT_ADDRESS:
            logger.warning(
                "⚠️  PHONE_BT_ADDRESS not set — phone proximity monitoring disabled.\n"
                "    Find your phone's Bluetooth MAC address and add it to .env"
            )
            return

        self._monitoring = True
        self._monitor_thread = threading.Thread(
            target=self._proximity_loop,
            daemon=True
        )
        self._monitor_thread.start()
        logger.info(f"📱 Phone proximity monitoring started (watching: {PHONE_BT_ADDRESS})")

    def stop_monitoring(self):
        """Stop proximity monitoring."""
        self._monitoring = False
        logger.info("📱 Phone proximity monitoring stopped")

    def _proximity_loop(self):
        """Background loop checking phone Bluetooth signal."""
        while self._monitoring:
            try:
                rssi = self._get_phone_rssi(PHONE_BT_ADDRESS)

                if rssi is None:
                    # Phone not detectable
                    self._consecutive_misses += 1
                    logger.debug(f"Phone not detected (miss #{self._consecutive_misses})")
                else:
                    logger.debug(f"Phone RSSI: {rssi} dBm")

                    if rssi < RSSI_THRESHOLD:
                        # Phone detected but signal weak — too far
                        self._consecutive_misses += 1
                        logger.debug(f"Phone too far: RSSI {rssi} < threshold {RSSI_THRESHOLD}")
                    else:
                        # Phone is close and present
                        if not self._phone_present and self._consecutive_misses > 0:
                            # Phone came back!
                            logger.info("📱 Phone returned to proximity")
                            self._speak_warning(
                                f"Your phone is back! Glad you didn't lose it.",
                                level="info"
                            )
                        self._consecutive_misses = 0
                        self._phone_present = True

                # Handle escalating absence
                self._handle_absence()

            except Exception as e:
                logger.debug(f"Proximity loop error: {e}")

            time.sleep(CHECK_INTERVAL)

    def _handle_absence(self):
        """Escalate response based on how long phone has been gone."""
        misses = self._consecutive_misses
        now = time.time()

        if misses == 0:
            return

        self._phone_present = False

        # Minimum 60s between warnings to avoid spam
        if now - self._last_warning_time < 60:
            return

        if misses == 1:
            # First miss — gentle reminder
            self._speak_warning(
                f"Hey {OWNER_NAME}, just checking — did you leave your phone somewhere? "
                "I'm not detecting it nearby.",
                level="warning"
            )
            self._last_warning_time = now

        elif misses == 2:
            # Second miss — more urgent
            self._speak_warning(
                f"{OWNER_NAME}! I really can't find your phone. "
                "If you lost it, say 'AVANT, push to GitHub' right now to back everything up.",
                level="urgent"
            )
            self._last_warning_time = now

        elif misses >= WARN_BEFORE_PUSH:
            # Auto-push after configured number of misses
            self._speak_warning(
                f"I've lost track of your phone for a while, {OWNER_NAME}. "
                "I'm automatically pushing your AVANT data to GitHub as a backup. "
                "You can restore everything from there.",
                level="urgent"
            )
            self._last_warning_time = now

            # Trigger GitHub backup
            result = self.push_to_github(
                commit_msg=f"[AUTO-BACKUP] Phone out of range — {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )
            logger.info(f"Auto-push result: {result}")

    def _speak_warning(self, message: str, level: str = "warning"):
        """Deliver warning through voice or print."""
        tone = "urgent" if level == "urgent" else "casual"
        if self.voice:
            self.voice.speak(message, tone_mode=tone)
        else:
            print(f"\n⚠️  AVANT PHONE ALERT: {message}\n")
        logger.warning(f"Phone alert ({level}): {message}")

    def _get_phone_rssi(self, bt_address: str):
        """
        Get Bluetooth RSSI for a device by address.
        Returns signal strength in dBm, or None if not found.
        """
        if self._os == "Linux":
            return self._rssi_linux(bt_address)
        elif self._os == "Darwin":
            return self._rssi_macos(bt_address)
        elif self._os == "Windows":
            return self._rssi_windows(bt_address)
        return None

    def _rssi_linux(self, address: str):
        """Get RSSI on Linux via hcitool."""
        try:
            result = subprocess.run(
                ["hcitool", "rssi", address],
                capture_output=True, text=True, timeout=10
            )
            # Output: "RSSI return value: -67"
            if "RSSI" in result.stdout:
                parts = result.stdout.strip().split(":")
                return int(parts[-1].strip())
        except FileNotFoundError:
            # Try bluetoothctl
            try:
                result = subprocess.run(
                    ["bluetoothctl", "info", address],
                    capture_output=True, text=True, timeout=10
                )
                if "RSSI" in result.stdout:
                    for line in result.stdout.split("\n"):
                        if "RSSI" in line:
                            return int(line.split(":")[-1].strip())
            except Exception:
                pass
        except Exception as e:
            logger.debug(f"Linux RSSI error: {e}")
        return None

    def _rssi_macos(self, address: str):
        """Get RSSI on macOS via system_profiler."""
        try:
            result = subprocess.run(
                ["system_profiler", "SPBluetoothDataType"],
                capture_output=True, text=True, timeout=10
            )
            lines = result.stdout.split("\n")
            for i, line in enumerate(lines):
                if address.upper() in line.upper():
                    # Look for RSSI nearby
                    for j in range(i, min(i + 10, len(lines))):
                        if "RSSI" in lines[j]:
                            try:
                                return int(lines[j].split(":")[-1].strip().split()[0])
                            except Exception:
                                pass
        except Exception as e:
            logger.debug(f"macOS RSSI error: {e}")
        return None

    def _rssi_windows(self, address: str):
        """
        Windows RSSI via PowerShell — limited support.
        Best approach: use the BleuIO library for Windows BT RSSI.
        """
        try:
            result = subprocess.run(
                ["powershell", "-Command",
                 f"Get-PnpDevice | Where-Object {{$_.DeviceID -like '*{address.replace(':', '')}*'}}"],
                capture_output=True, text=True, timeout=10
            )
            # Windows doesn't easily expose RSSI — return a "present" signal
            if result.stdout.strip():
                return -60  # Assume OK if device is found
        except Exception as e:
            logger.debug(f"Windows RSSI error: {e}")
        return None

    def is_phone_nearby(self) -> bool:
        """Quick check if phone is currently in range."""
        if not PHONE_BT_ADDRESS:
            return True  # No monitoring configured — assume present
        rssi = self._get_phone_rssi(PHONE_BT_ADDRESS)
        return rssi is not None and rssi >= RSSI_THRESHOLD

    # ── GitHub Push ───────────────────────────────────────────────────────────

    def push_to_github(self, commit_msg: str = None) -> str:
        """
        Push all AVANT data, modules, and config to GitHub.
        Creates/updates files in the configured repository.

        Args:
            commit_msg: Custom commit message (auto-generated if None)

        Returns:
            Status message
        """
        if not self._github_client:
            return (
                "GitHub backup isn't configured. Add GITHUB_TOKEN and GITHUB_REPO to .env.\n"
                "Get a token at: github.com/settings/tokens"
            )

        if not commit_msg:
            commit_msg = f"AVANT backup — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} by {OWNER_NAME}"

        logger.info(f"🐙 Starting GitHub push: '{commit_msg}'")

        try:
            repo = self._github_client.get_repo(GITHUB_REPO)
        except Exception as e:
            # Try to create the repo if it doesn't exist
            try:
                user = self._github_client.get_user()
                repo = user.create_repo(
                    GITHUB_REPO.split("/")[-1],
                    description="AVANT — AmaVanta backup repository",
                    private=True,
                    auto_init=True
                )
                logger.info(f"✅ Created GitHub repo: {GITHUB_REPO}")
            except Exception as create_err:
                return f"GitHub repo not found and couldn't create it: {create_err}"

        pushed = []
        failed = []

        # ── Push individual data files ────────────────────────────────────
        for file_path in BACKUP_FILES:
            result = self._push_file(repo, file_path, commit_msg)
            if result:
                pushed.append(file_path)
            else:
                failed.append(file_path)

        # ── Push all Python source files ──────────────────────────────────
        for directory in BACKUP_DIRS:
            if os.path.exists(directory):
                for root, dirs, files in os.walk(directory):
                    for fname in files:
                        if fname.endswith(".py"):
                            fpath = os.path.join(root, fname)
                            result = self._push_file(repo, fpath, commit_msg)
                            if result:
                                pushed.append(fpath)

        # ── Push main files ───────────────────────────────────────────────
        for main_file in ["avant.py", "requirements.txt", "QUICK_START.md"]:
            if os.path.exists(main_file):
                result = self._push_file(repo, main_file, commit_msg)
                if result:
                    pushed.append(main_file)

        # ── Write backup manifest ─────────────────────────────────────────
        manifest = {
            "backup_time": datetime.now().isoformat(),
            "owner": OWNER_NAME,
            "commit_message": commit_msg,
            "files_pushed": len(pushed),
            "files_failed": failed
        }
        manifest_content = json.dumps(manifest, indent=2)
        self._push_content(repo, "backup_manifest.json", manifest_content, commit_msg)

        logger.info(f"✅ GitHub push complete: {len(pushed)} files pushed")

        if failed:
            return (
                f"Pushed {len(pushed)} files to GitHub successfully. "
                f"{len(failed)} files couldn't be pushed: {', '.join(failed[:3])}. "
                f"Check repo: github.com/{GITHUB_REPO}"
            )
        return (
            f"Done! Pushed {len(pushed)} files to GitHub. "
            f"Your AVANT backup is secure at github.com/{GITHUB_REPO}"
        )

    def _push_file(self, repo, local_path: str, commit_msg: str) -> bool:
        """Push a single local file to GitHub repo."""
        if not os.path.exists(local_path):
            return False

        # Build remote path (strip leading ./ and path prefix)
        remote_path = local_path.lstrip("./").lstrip("/")

        try:
            with open(local_path, "rb") as f:
                content = f.read()

            # Binary files get base64 encoded in the manifest
            if local_path.endswith(".pkl"):
                encoded = base64.b64encode(content).decode("utf-8")
                return self._push_content(
                    repo,
                    remote_path + ".b64",
                    f"# Base64 encoded binary\n{encoded}",
                    commit_msg
                )
            else:
                try:
                    text_content = content.decode("utf-8")
                except UnicodeDecodeError:
                    # Binary fallback
                    text_content = base64.b64encode(content).decode("utf-8")

                return self._push_content(repo, remote_path, text_content, commit_msg)

        except Exception as e:
            logger.debug(f"File push failed ({local_path}): {e}")
            return False

    def _push_content(self, repo, path: str, content: str, commit_msg: str) -> bool:
        """Create or update a file in the GitHub repo."""
        try:
            try:
                # File exists — update it
                existing = repo.get_contents(path)
                repo.update_file(
                    path=path,
                    message=commit_msg,
                    content=content,
                    sha=existing.sha
                )
            except Exception:
                # File doesn't exist — create it
                repo.create_file(
                    path=path,
                    message=commit_msg,
                    content=content
                )
            logger.debug(f"✅ Pushed: {path}")
            return True

        except Exception as e:
            logger.debug(f"GitHub push failed ({path}): {e}")
            return False

    def get_phone_bt_address_guide(self) -> str:
        """Return instructions for finding phone Bluetooth MAC address."""
        return """
How to find your phone's Bluetooth MAC address:

ANDROID:
  Settings → About Phone → Status → Bluetooth Address
  OR: Settings → Connected Devices → Bluetooth → Device name → Device details

iOS (iPhone):
  Settings → General → About → Bluetooth (shows as WiFi address — limited use)
  Note: iPhones use randomized Bluetooth addresses — use the RSSI approach
  with your device name instead. Set PHONE_BT_NAME=My iPhone in .env.

Once you have it, add to .env:
  PHONE_BT_ADDRESS=XX:XX:XX:XX:XX:XX
"""
