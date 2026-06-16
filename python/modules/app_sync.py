"""
AVANT — App Sync & Device Monitor
====================================
Monitors installed apps on connected devices (Android via ADB, iOS via Shortcuts).
When an app is installed → AVANT automatically syncs with it.
When an app is deleted → AVANT permanently disconnects from it until reinstalled.

This mirrors E.D.I.T.H.'s universal device access model from Spider-Man: Far From Home.
"""

import os
import json
import time
import threading
import subprocess
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

APP_SYNC_PATH = "./data/app_sync.json"
OWNER_NAME = os.getenv("OWNER_NAME", "Michael")


class AppSyncManager:
    """
    Tracks installed/uninstalled apps across connected devices.
    Maintains a live registry of AVANT-connected apps.
    """

    def __init__(self, voice_output=None):
        self.voice_output = voice_output
        self.sync_data = self._load_sync_data()
        self._monitoring = False
        self._monitor_thread = None
        logger.info("✅ App Sync Manager initialized")

    def start_monitoring(self):
        """Begin monitoring for app install/uninstall events."""
        self._monitoring = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True
        )
        self._monitor_thread.start()
        logger.info("📱 App sync monitoring started")

    def stop_monitoring(self):
        self._monitoring = False
        logger.info("📱 App sync monitoring stopped")

    def get_connected_apps(self) -> list:
        """Return list of apps AVANT is currently synced with."""
        return [
            app for app in self.sync_data.get("apps", [])
            if app.get("status") == "connected"
        ]

    def list_connected_apps(self) -> str:
        """Return natural language list of connected apps."""
        connected = self.get_connected_apps()
        if not connected:
            return "I'm not currently synced with any apps on your device."
        names = [a["name"] for a in connected[:10]]
        return f"I'm synced with {len(connected)} app(s): {', '.join(names)}."

    def get_android_apps(self) -> list:
        """Get list of installed apps via ADB (Android)."""
        try:
            result = subprocess.run(
                ["adb", "shell", "pm", "list", "packages", "-3"],  # -3 = user-installed only
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode != 0:
                return []

            packages = []
            for line in result.stdout.strip().split("\n"):
                if line.startswith("package:"):
                    pkg = line.replace("package:", "").strip()
                    packages.append(pkg)
            return packages

        except FileNotFoundError:
            logger.debug("ADB not found — Android sync unavailable")
            return []
        except Exception as e:
            logger.debug(f"ADB error: {e}")
            return []

    def sync_with_app(self, app_name: str, app_id: str = None, platform: str = "android") -> str:
        """
        Manually register an app for AVANT sync.
        
        Args:
            app_name: Human-readable app name (e.g. "Spotify")
            app_id: Package/bundle ID (e.g. "com.spotify.music")
            platform: "android" | "ios"
        """
        apps = self.sync_data.get("apps", [])

        # Check if already registered
        existing = next((a for a in apps if a.get("id") == app_id or a.get("name").lower() == app_name.lower()), None)

        if existing:
            if existing["status"] == "connected":
                return f"I'm already synced with {app_name}."
            elif existing["status"] == "disconnected":
                # Reconnect (app was reinstalled)
                existing["status"] = "connected"
                existing["reconnected_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                self._save_sync_data()
                logger.info(f"🔄 Reconnected to {app_name} (reinstalled)")
                return f"Welcome back, {app_name}! I've reconnected with you."

        # New app
        new_app = {
            "name": app_name,
            "id": app_id or app_name.lower().replace(" ", "."),
            "platform": platform,
            "status": "connected",
            "connected_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "disconnected_at": None
        }
        apps.append(new_app)
        self.sync_data["apps"] = apps
        self._save_sync_data()

        logger.info(f"✅ Synced with app: {app_name}")
        return f"Done! I've synced with {app_name}. I'll stay connected as long as it's installed."

    def disconnect_from_app(self, app_name: str, permanent: bool = True) -> str:
        """
        Disconnect AVANT from an app (triggered on uninstall).
        If permanent=True, AVANT won't reconnect until app is reinstalled.
        
        Args:
            app_name: App name or package ID
            permanent: Whether to permanently disconnect (until reinstall)
        """
        apps = self.sync_data.get("apps", [])

        for app in apps:
            if app_name.lower() in app["name"].lower() or app_name.lower() in app.get("id", "").lower():
                app["status"] = "disconnected"
                app["disconnected_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                app["permanent_disconnect"] = permanent
                self._save_sync_data()

                logger.info(f"⛔ Disconnected from {app['name']} (permanent: {permanent})")
                return f"I've disconnected from {app['name']}. If you reinstall it, I'll reconnect automatically."

        return f"I wasn't synced with {app_name}."

    def _monitor_loop(self):
        """Background loop — checks for app changes every 30 seconds."""
        known_android_apps = set(self.sync_data.get("last_android_scan", []))

        while self._monitoring:
            try:
                # Scan Android apps
                current_apps = set(self.get_android_apps())

                if current_apps:
                    # Newly installed apps
                    new_apps = current_apps - known_android_apps
                    for pkg in new_apps:
                        app_name = pkg.split(".")[-1].title()
                        logger.info(f"📲 New app detected: {app_name} ({pkg})")
                        self.sync_with_app(app_name, pkg, "android")
                        if self.voice_output:
                            self.voice_output.speak(
                                f"I noticed you installed {app_name}. I've synced with it!",
                                tone_mode="casual"
                            )

                    # Uninstalled apps
                    removed_apps = known_android_apps - current_apps
                    for pkg in removed_apps:
                        app_name = pkg.split(".")[-1].title()
                        logger.info(f"🗑️ App removed: {app_name} ({pkg})")
                        self.disconnect_from_app(pkg, permanent=True)
                        if self.voice_output:
                            self.voice_output.speak(
                                f"{app_name} was uninstalled. I've disconnected from it.",
                                tone_mode="casual"
                            )

                    # Update known apps
                    known_android_apps = current_apps
                    self.sync_data["last_android_scan"] = list(current_apps)
                    self._save_sync_data()

            except Exception as e:
                logger.debug(f"App sync monitor error: {e}")

            time.sleep(30)  # Check every 30 seconds

    def _load_sync_data(self) -> dict:
        if os.path.exists(APP_SYNC_PATH):
            try:
                with open(APP_SYNC_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {"apps": [], "last_android_scan": []}

    def _save_sync_data(self):
        os.makedirs(os.path.dirname(APP_SYNC_PATH), exist_ok=True)
        try:
            with open(APP_SYNC_PATH, "w") as f:
                json.dump(self.sync_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save app sync data: {e}")
