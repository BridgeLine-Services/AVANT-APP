"""
AVANT — Navigation (JARVIS-Level Turn-by-Turn)
================================================
Powered by SerpApi Google Maps Directions API — same data Google Maps uses.

Features:
  • Live real-time traffic data
  • Turn-by-turn spoken directions (like a co-pilot)
  • All transport modes: driving, walking, transit, cycling, flying, boat
  • Avoid: tolls, highways, ferries
  • Distance in miles/km, time accounting for current traffic
  • Opens Google Maps / Apple Maps deeplink with the route pre-loaded
  • Fallback: OpenStreetMap Nominatim (no key needed)

Voice commands AVANT handles:
  "Navigate to school"                     → best route with live traffic
  "How do I get to Times Square?"          → turn-by-turn directions
  "How far is LAX if I drive?"             → distance + time all modes
  "Set destination: downtown"              → opens Maps with route
  "Avoid tolls to the airport"             → toll-free route
  "What's traffic like on I-95?"          → live traffic report
"""

import os, json, re, math, requests, urllib.parse
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

SERPAPI_KEY  = os.getenv("SERPAPI_KEY", "")
OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")
GROQ_KEY     = os.getenv("GROQ_API_KEY", "")
GEMINI_KEY   = os.getenv("GEMINI_API_KEY", "")
HOME_ADDRESS = os.getenv("DEFAULT_HOME_ADDRESS", "")
OPEN_DEEPLINK = os.getenv("MAPS_OPEN_DEEPLINK", "true").lower() == "true"

SERPAPI_BASE = "https://serpapi.com/search"

# SerpApi travel_mode codes
TRAVEL_MODES = {
    "driving":  0,
    "drive":    0,
    "car":      0,
    "walking":  2,
    "walk":     2,
    "foot":     2,
    "cycling":  1,
    "bike":     1,
    "bicycle":  1,
    "transit":  3,
    "bus":      3,
    "train":    3,
    "subway":   3,
    "flight":   4,
    "fly":      4,
    "plane":    4,
    "best":     6,
}

AVOID_OPTIONS = {
    "tolls":     "tolls",
    "toll":      "tolls",
    "highways":  "highways",
    "highway":   "highways",
    "freeway":   "highways",
    "ferries":   "ferries",
    "ferry":     "ferries",
}


class NavigationManager:
    """
    AVANT's navigation co-pilot — live traffic, turn-by-turn, all modes.
    """

    def __init__(self):
        if SERPAPI_KEY:
            logger.info("✅ Navigation: SerpApi Google Maps Directions (live traffic)")
        else:
            logger.warning("⚠️  Navigation: No SerpApi key — using OpenStreetMap fallback")

    # ══════════════════════════════════════════════════════
    # PUBLIC: Main Navigation Methods
    # ══════════════════════════════════════════════════════

    def get_directions(self, destination: str, origin: str = None,
                       mode: str = "driving", avoid: list = None) -> str:
        """
        Get full turn-by-turn directions with live traffic.

        Args:
            destination: Where to go
            origin: Starting point (defaults to HOME_ADDRESS)
            mode: driving / walking / transit / cycling / flight
            avoid: ["tolls", "highways", "ferries"]

        Returns:
            Spoken directions string AVANT reads aloud
        """
        origin = origin or HOME_ADDRESS or "current location"
        mode_code = TRAVEL_MODES.get(mode.lower(), 0)

        logger.info(f"Directions: {origin} → {destination} ({mode})")

        # Try SerpApi (live traffic)
        directions = self._serpapi_directions(destination, origin, mode_code, avoid)

        if directions:
            return self._format_directions_spoken(directions, destination, mode, avoid)

        # Fallback: OpenStreetMap
        return self._osm_fallback_directions(origin, destination, mode)

    def get_all_modes_distance(self, destination: str, origin: str = None) -> str:
        """
        Get distance + travel time for ALL transport modes at once.
        Like asking "How far is it by every method?"
        """
        origin = origin or HOME_ADDRESS or "current location"
        results = {}

        modes_to_check = [
            ("driving",  0, "🚗 Driving"),
            ("walking",  2, "🚶 Walking"),
            ("transit",  3, "🚇 Transit"),
            ("cycling",  1, "🚲 Cycling"),
            ("flight",   4, "✈️  Flying"),
        ]

        for mode_name, mode_code, label in modes_to_check:
            try:
                data = self._serpapi_directions(destination, origin, mode_code)
                if data and data.get("routes"):
                    route = data["routes"][0]
                    duration = route.get("duration", {})
                    distance = route.get("distance", {})
                    dur_text = duration.get("text", "unknown")
                    dist_text = distance.get("text", "unknown")
                    results[label] = f"{dist_text} — {dur_text}"
                else:
                    results[label] = "route not available"
            except Exception as e:
                logger.debug(f"Mode {mode_name} error: {e}")

        if not results:
            return self._llm_estimate_distances(origin, destination)

        lines = [f"{label}: {val}" for label, val in results.items()]
        response = f"Here's how far {destination} is from {origin}:\n" + "\n".join(lines)
        response += f"\n\nWant me to open Google Maps with the best route?"
        return response

    def open_maps(self, destination: str, origin: str = None, mode: str = "driving") -> str:
        """Generate Google Maps deeplink and return it."""
        origin = origin or HOME_ADDRESS or ""
        mode_map = {"driving": "driving", "walking": "walking",
                    "transit": "transit", "cycling": "bicycling"}
        travelmode = mode_map.get(mode.lower(), "driving")

        if origin:
            url = (f"https://www.google.com/maps/dir/?api=1"
                   f"&origin={urllib.parse.quote(origin)}"
                   f"&destination={urllib.parse.quote(destination)}"
                   f"&travelmode={travelmode}")
        else:
            url = (f"https://www.google.com/maps/search/?api=1"
                   f"&query={urllib.parse.quote(destination)}")

        # Also generate Apple Maps deeplink
        apple_url = f"maps://?daddr={urllib.parse.quote(destination)}&dirflg=d"

        logger.info(f"Maps link generated: {url}")
        return f"MAPS_DEEPLINK:{url}|APPLE:{apple_url}"

    def get_traffic_report(self, location: str) -> str:
        """Get live traffic conditions for a specific road or area."""
        if not SERPAPI_KEY:
            return self._llm_traffic_estimate(location)

        # Search for live traffic info via Google
        try:
            params = {
                "engine": "google",
                "q": f"live traffic {location} right now",
                "api_key": SERPAPI_KEY,
                "num": 5
            }
            r = requests.get(SERPAPI_BASE, params=params, timeout=10)
            data = r.json()

            chunks = []
            ab = data.get("answer_box", {})
            if ab.get("snippet"):
                chunks.append(ab["snippet"])
            for res in data.get("organic_results", [])[:3]:
                if res.get("snippet"):
                    chunks.append(res["snippet"])

            if chunks:
                return self._llm_format(
                    f"Summarize live traffic on {location}: " + " | ".join(chunks)
                )
        except Exception as e:
            logger.debug(f"Traffic report error: {e}")

        return self._llm_traffic_estimate(location)

    # ══════════════════════════════════════════════════════
    # INTERNAL: SerpApi Directions
    # ══════════════════════════════════════════════════════

    def _serpapi_directions(self, destination: str, origin: str,
                            mode_code: int, avoid: list = None) -> dict:
        """Call SerpApi Google Maps Directions API."""
        if not SERPAPI_KEY:
            return None

        params = {
            "engine":      "google_maps_directions",
            "start_addr":  origin,
            "end_addr":    destination,
            "travel_mode": mode_code,
            "api_key":     SERPAPI_KEY,
            "hl":          "en",
            "gl":          "us",
            "distance_unit": 1,  # miles
        }

        if avoid:
            avoid_str = ",".join(AVOID_OPTIONS.get(a.lower(), a) for a in avoid)
            params["avoid"] = avoid_str

        try:
            r = requests.get(SERPAPI_BASE, params=params, timeout=15)
            data = r.json()

            if "error" in data:
                logger.warning(f"SerpApi directions error: {data['error']}")
                return None

            logger.debug(f"SerpApi directions response keys: {list(data.keys())}")
            return data

        except Exception as e:
            logger.error(f"SerpApi directions request failed: {e}")
            return None

    def _format_directions_spoken(self, data: dict, destination: str,
                                   mode: str, avoid: list = None) -> str:
        """
        Convert raw SerpApi directions into natural spoken navigation.
        This is what AVANT reads aloud — like a co-pilot.
        """
        try:
            routes = data.get("directions", [])
            if not routes:
                return self._llm_fallback_directions(destination, mode)

            # Pick the first (best) route
            best = routes[0]

            # Summary info
            summary   = best.get("summary", "")
            duration  = best.get("duration", {})
            distance  = best.get("distance", {})
            dur_text  = duration.get("text", "") if isinstance(duration, dict) else str(duration)
            dist_text = distance.get("text", "") if isinstance(distance, dict) else str(distance)

            # Traffic info
            traffic_dur = best.get("duration_in_traffic", {})
            traffic_text = traffic_dur.get("text", "") if isinstance(traffic_dur, dict) else ""

            # Turn-by-turn steps
            legs = best.get("legs", [])
            steps_spoken = []
            all_steps = []
            for leg in legs:
                for step in leg.get("steps", []):
                    instruction = step.get("html_instructions", step.get("instruction", ""))
                    # Strip HTML tags
                    clean = re.sub(r"<[^>]+>", " ", instruction).strip()
                    clean = re.sub(r"\s+", " ", clean)
                    dist_s = step.get("distance", {})
                    dist_s_text = dist_s.get("text", "") if isinstance(dist_s, dict) else ""
                    if clean:
                        all_steps.append(f"{clean} ({dist_s_text})" if dist_s_text else clean)

            # Build the spoken response
            avoid_note = ""
            if avoid:
                avoid_note = f" avoiding {', '.join(avoid)}"

            traffic_note = ""
            if traffic_text and traffic_text != dur_text:
                traffic_note = f" (with current traffic: {traffic_text})"
            elif traffic_text:
                traffic_note = " — traffic looks good right now"

            intro = (
                f"Alright, here's your route to {destination} by {mode}{avoid_note}. "
                f"It's about {dist_text}, roughly {dur_text}{traffic_note}."
            )

            # Speak first 8 turns
            if all_steps:
                step_text = " Then ".join(all_steps[:8])
                spoken = f"{intro} Here's how to get there: {step_text}."
                if len(all_steps) > 8:
                    spoken += f" Plus {len(all_steps)-8} more turns after that."
            else:
                spoken = intro

            # Add traffic alerts if present
            alerts = data.get("traffic_incidents", [])
            if alerts:
                alert_text = "; ".join([a.get("description","") for a in alerts[:2] if a.get("description")])
                if alert_text:
                    spoken += f" Heads up — traffic alert on your route: {alert_text}"

            # Add maps deeplink
            maps_link = self.open_maps(destination, mode=mode)
            spoken += f"\n\n{maps_link}"

            return spoken

        except Exception as e:
            logger.error(f"Directions formatting error: {e}")
            return self._llm_fallback_directions(destination, mode)

    def _osm_fallback_directions(self, origin: str, destination: str, mode: str) -> str:
        """OpenStreetMap Nominatim fallback — no API key needed."""
        try:
            # Geocode both addresses
            headers = {"User-Agent": "AVANT-Assistant/1.0"}

            def geocode(addr):
                r = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": addr, "format": "json", "limit": 1},
                    headers=headers, timeout=8
                )
                results = r.json()
                if results:
                    return float(results[0]["lat"]), float(results[0]["lon"])
                return None

            orig_coords = geocode(origin)
            dest_coords = geocode(destination)

            if orig_coords and dest_coords:
                # Calculate straight-line distance
                lat1, lon1 = orig_coords
                lat2, lon2 = dest_coords
                R = 3959  # Earth radius in miles
                dlat = math.radians(lat2 - lat1)
                dlon = math.radians(lon2 - lon1)
                a = (math.sin(dlat/2)**2 +
                     math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
                     math.sin(dlon/2)**2)
                dist = R * 2 * math.asin(math.sqrt(a))

                # Rough time estimates
                speeds = {"driving": 35, "walking": 3, "cycling": 12, "transit": 20}
                speed = speeds.get(mode.lower(), 35)
                hours = dist / speed
                mins = int(hours * 60)

                result = (
                    f"Based on straight-line distance, {destination} is about "
                    f"{dist:.1f} miles from {origin}. "
                    f"Estimated {mode} time: {mins} minutes (no traffic data — "
                    f"add a SerpApi key for live traffic)."
                )
                maps_link = self.open_maps(destination, origin, mode)
                return result + f"\n\n{maps_link}"

        except Exception as e:
            logger.debug(f"OSM fallback error: {e}")

        return self._llm_fallback_directions(destination, mode)

    def _llm_fallback_directions(self, destination: str, mode: str) -> str:
        """Ask LLM for general directions when APIs fail."""
        return self._llm_format(
            f"Give general directions to {destination} by {mode}. "
            "Note that you don't have live traffic data right now."
        )

    def _llm_estimate_distances(self, origin: str, destination: str) -> str:
        return self._llm_format(
            f"Estimate the distance and travel time from '{origin}' to '{destination}' "
            "by driving, walking, transit, cycling, and flying. Be conversational."
        )

    def _llm_traffic_estimate(self, location: str) -> str:
        return self._llm_format(
            f"Give a general description of typical traffic conditions on or near {location}. "
            "Note you don't have live data."
        )

    def _llm_format(self, prompt: str) -> str:
        """Use best available LLM for a response."""
        full_prompt = f"You are AVANT, a brilliant AI assistant like JARVIS. {prompt}"

        # Try Groq first (fastest)
        if GROQ_KEY:
            try:
                headers = {"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"}
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": full_prompt}],
                    "max_tokens": 400
                }
                r = requests.post("https://api.groq.com/openai/v1/chat/completions",
                                  json=payload, headers=headers, timeout=10)
                return r.json()["choices"][0]["message"]["content"].strip()
            except Exception:
                pass

        # Gemini
        if GEMINI_KEY:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}"
                payload = {"contents": [{"parts": [{"text": full_prompt}]}]}
                r = requests.post(url, json=payload, timeout=10)
                return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            except Exception:
                pass

        # GPT-4o
        if OPENAI_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=OPENAI_KEY)
                resp = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": full_prompt}],
                    max_tokens=400
                )
                return resp.choices[0].message.content.strip()
            except Exception:
                pass

        return f"I couldn't get navigation data for that right now."
