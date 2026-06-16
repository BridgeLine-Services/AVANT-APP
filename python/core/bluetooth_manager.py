"""
AVANT — Bluetooth Manager
===========================
Automatically detects paired Bluetooth audio devices (earbuds/headphones)
and routes AVANT's audio output + microphone input to those devices.
Monitors for connect/disconnect events in real-time.
"""

import os
import time
import asyncio
import threading
import subprocess
import platform
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

BLUETOOTH_AUTO_CONNECT = os.getenv("BLUETOOTH_AUTO_CONNECT", "true").lower() == "true"


class BluetoothManager:
    """
    Manages Bluetooth audio device detection, connection, and routing.
    Works on macOS, Windows, and Linux.
    """

    def __init__(self):
        self.os_type = platform.system()  # "Darwin" | "Windows" | "Linux"
        self.connected_audio_device = None
        self.paired_devices = []
        self._monitor_thread = None
        self._monitoring = False
        logger.info(f"✅ Bluetooth Manager initialized on {self.os_type}")

    def start_monitoring(self):
        """Start monitoring for Bluetooth device changes in background."""
        if not BLUETOOTH_AUTO_CONNECT:
            logger.info("Bluetooth auto-connect disabled in .env")
            return

        self._monitoring = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True
        )
        self._monitor_thread.start()
        logger.info("🔵 Bluetooth monitoring started")

    def stop_monitoring(self):
        """Stop the Bluetooth monitor."""
        self._monitoring = False
        logger.info("🔵 Bluetooth monitoring stopped")

    def get_connected_audio_device(self) -> str | None:
        """
        Returns name of currently connected Bluetooth audio device,
        or None if using system speakers.
        """
        self._refresh_connected_device()
        return self.connected_audio_device

    def scan_for_audio_devices(self) -> list[dict]:
        """
        Scan for available paired Bluetooth audio devices.
        Returns list of device dicts with 'name' and 'address'.
        """
        devices = []
        try:
            if self.os_type == "Darwin":  # macOS
                devices = self._scan_macos()
            elif self.os_type == "Windows":
                devices = self._scan_windows()
            elif self.os_type == "Linux":
                devices = self._scan_linux()
        except Exception as e:
            logger.error(f"Bluetooth scan failed: {e}")

        self.paired_devices = devices
        if devices:
            logger.info(f"🔵 Found {len(devices)} Bluetooth audio device(s): {[d['name'] for d in devices]}")
        return devices

    def connect_to_device(self, device_name: str) -> bool:
        """
        Connect to a specific Bluetooth device by name.
        Returns True on success.
        """
        try:
            if self.os_type == "Darwin":
                return self._connect_macos(device_name)
            elif self.os_type == "Windows":
                return self._connect_windows(device_name)
            elif self.os_type == "Linux":
                return self._connect_linux(device_name)
        except Exception as e:
            logger.error(f"Failed to connect to {device_name}: {e}")
            return False

    def _monitor_loop(self):
        """Background loop: check every 3 seconds for BT device changes."""
        previous_device = None
        while self._monitoring:
            try:
                self._refresh_connected_device()
                current_device = self.connected_audio_device

                if current_device != previous_device:
                    if current_device:
                        logger.info(f"🎧 Bluetooth device connected: {current_device}")
                        # Switch audio routing to BT device
                        self._route_audio_to_bluetooth(current_device)
                    else:
                        logger.info("🔊 No Bluetooth device — routing to system speakers")
                    previous_device = current_device

            except Exception as e:
                logger.debug(f"BT monitor tick error: {e}")

            time.sleep(3)

    def _refresh_connected_device(self):
        """Update connected_audio_device with current state."""
        try:
            if self.os_type == "Darwin":
                self.connected_audio_device = self._get_connected_macos()
            elif self.os_type == "Windows":
                self.connected_audio_device = self._get_connected_windows()
            elif self.os_type == "Linux":
                self.connected_audio_device = self._get_connected_linux()
        except Exception:
            self.connected_audio_device = None

    # ── macOS Bluetooth ─────────────────────────────────────────────────────

    def _scan_macos(self) -> list:
        """Scan for paired Bluetooth devices on macOS using system_profiler."""
        try:
            result = subprocess.run(
                ["system_profiler", "SPBluetoothDataType"],
                capture_output=True, text=True, timeout=10
            )
            devices = []
            lines = result.stdout.split('\n')
            for i, line in enumerate(lines):
                if 'Audio' in line or 'Headphones' in line or 'Earbuds' in line:
                    # Try to get device name from previous lines
                    name = lines[i-2].strip().rstrip(':') if i > 2 else f"BT Device {i}"
                    devices.append({"name": name, "address": ""})
            return devices
        except Exception as e:
            logger.debug(f"macOS BT scan error: {e}")
            return []

    def _get_connected_macos(self) -> str | None:
        """Get currently connected audio output device on macOS."""
        try:
            result = subprocess.run(
                ["SwitchAudioSource", "-c"],
                capture_output=True, text=True, timeout=5
            )
            device_name = result.stdout.strip()
            # Check if it's a Bluetooth device (not built-in speakers)
            if device_name and "Built-in" not in device_name and "Internal" not in device_name:
                return device_name
        except FileNotFoundError:
            # SwitchAudioSource not installed — try alternative
            try:
                result = subprocess.run(
                    ["system_profiler", "SPBluetoothDataType"],
                    capture_output=True, text=True, timeout=10
                )
                if "Connected: Yes" in result.stdout:
                    return "Bluetooth Headphones"
            except Exception:
                pass
        except Exception:
            pass
        return None

    def _connect_macos(self, device_name: str) -> bool:
        """Switch audio output to device on macOS using SwitchAudioSource."""
        try:
            subprocess.run(
                ["SwitchAudioSource", "-s", device_name],
                check=True, timeout=5
            )
            return True
        except Exception as e:
            logger.debug(f"macOS connect error: {e}")
            return False

    # ── Windows Bluetooth ───────────────────────────────────────────────────

    def _scan_windows(self) -> list:
        """Scan for Bluetooth devices on Windows."""
        try:
            result = subprocess.run(
                ["powershell", "-Command",
                 "Get-PnpDevice -Class Bluetooth | Where-Object {$_.Status -eq 'OK'} | Select-Object FriendlyName"],
                capture_output=True, text=True, timeout=10
            )
            devices = []
            for line in result.stdout.strip().split('\n')[2:]:
                name = line.strip()
                if name:
                    devices.append({"name": name, "address": ""})
            return devices
        except Exception as e:
            logger.debug(f"Windows BT scan error: {e}")
            return []

    def _get_connected_windows(self) -> str | None:
        """Get connected Bluetooth audio device on Windows."""
        try:
            result = subprocess.run(
                ["powershell", "-Command",
                 "Get-AudioDevice -Playback | Where-Object {$_.Name -like '*Bluetooth*' -or $_.Name -like '*Headphone*'}"],
                capture_output=True, text=True, timeout=5
            )
            if result.stdout.strip():
                return result.stdout.strip().split('\n')[0]
        except Exception:
            pass
        return None

    def _connect_windows(self, device_name: str) -> bool:
        """Connect to Bluetooth device on Windows."""
        try:
            subprocess.run(
                ["powershell", "-Command",
                 f"Set-AudioDevice -Name '{device_name}'"],
                check=True, timeout=5
            )
            return True
        except Exception:
            return False

    # ── Linux Bluetooth ─────────────────────────────────────────────────────

    def _scan_linux(self) -> list:
        """Scan for paired Bluetooth devices on Linux using bluetoothctl."""
        try:
            result = subprocess.run(
                ["bluetoothctl", "paired-devices"],
                capture_output=True, text=True, timeout=10
            )
            devices = []
            for line in result.stdout.strip().split('\n'):
                if line.startswith("Device"):
                    parts = line.split(" ", 2)
                    if len(parts) >= 3:
                        devices.append({"address": parts[1], "name": parts[2]})
            return devices
        except Exception as e:
            logger.debug(f"Linux BT scan error: {e}")
            return []

    def _get_connected_linux(self) -> str | None:
        """Get connected Bluetooth audio device on Linux."""
        try:
            result = subprocess.run(
                ["pactl", "info"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.split('\n'):
                if 'Default Sink' in line and 'bluez' in line:
                    return line.split(':', 1)[1].strip()
        except Exception:
            pass
        return None

    def _connect_linux(self, device_name: str) -> bool:
        """Connect Bluetooth device on Linux using bluetoothctl."""
        # Find device address by name
        for device in self.paired_devices:
            if device_name.lower() in device["name"].lower():
                try:
                    subprocess.run(
                        ["bluetoothctl", "connect", device["address"]],
                        check=True, timeout=15
                    )
                    return True
                except Exception as e:
                    logger.debug(f"Linux connect error: {e}")
                    return False
        return False

    def _route_audio_to_bluetooth(self, device_name: str):
        """Switch system audio output to the connected Bluetooth device."""
        if self.os_type == "Linux":
            try:
                # Use PulseAudio/PipeWire to switch output
                result = subprocess.run(
                    ["pactl", "list", "sinks", "short"],
                    capture_output=True, text=True
                )
                for line in result.stdout.split('\n'):
                    if 'bluez' in line.lower():
                        sink_name = line.split('\t')[1]
                        subprocess.run(["pactl", "set-default-sink", sink_name])
                        logger.info(f"🔊 Audio routed to: {sink_name}")
                        break
            except Exception as e:
                logger.debug(f"Audio routing error: {e}")
