"""
AVANT — Weather Module (Completely Free, No API Key Needed)
============================================================
Primary: Open-Meteo — 100% free forever, no key, 10,000 calls/day
          90+ weather models, hyperlocal, historical + 16-day forecast
Backup:  OpenWeatherMap (free 1000 calls/day with key)
Geocoding: Open-Meteo geocoding API (also free, no key)

Gives AVANT the ability to:
  • Report current weather anywhere on earth by city name
  • Give 7-day forecasts
  • Report UV index, air quality, precipitation, wind
  • Compare weather across multiple cities
  • Give clothing/activity recommendations based on conditions
"""

import os, requests, json
from datetime import datetime, timezone
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

OPENWEATHER_KEY = os.getenv("OPENWEATHER_API_KEY", "")
GROQ_KEY        = os.getenv("GROQ_API_KEY", "")
GEMINI_KEY      = os.getenv("GEMINI_API_KEY", "")
OPENAI_KEY      = os.getenv("OPENAI_API_KEY", "")

OPEN_METEO_GEO  = "https://geocoding-api.open-meteo.com/v1/search"
OPEN_METEO_FORE = "https://api.open-meteo.com/v1/forecast"
OWM_BASE        = "https://api.openweathermap.org/data/2.5"

# WMO weather code descriptions
WMO_CODES = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "icy fog", 51: "light drizzle", 53: "moderate drizzle",
    55: "heavy drizzle", 61: "light rain", 63: "moderate rain", 65: "heavy rain",
    71: "light snow", 73: "moderate snow", 75: "heavy snow", 77: "snow grains",
    80: "light rain showers", 81: "moderate rain showers", 82: "violent rain showers",
    85: "snow showers", 86: "heavy snow showers", 95: "thunderstorm",
    96: "thunderstorm with hail", 99: "thunderstorm with heavy hail"
}

WIND_DIRECTIONS = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                   "S","SSW","SW","WSW","W","WNW","NW","NNW"]


class WeatherManager:

    def __init__(self):
        logger.info("✅ Weather: Open-Meteo (free, no key) + OpenWeatherMap backup")

    def get_weather(self, location: str) -> str:
        """Get current weather and forecast for any location."""
        lat, lon, city_name = self._geocode(location)
        if lat is None:
            return f"I couldn't find the location '{location}'. Could you be more specific?"

        data = self._open_meteo_current(lat, lon)
        if data:
            return self._format_current_weather(data, city_name)

        # Fallback to OpenWeatherMap
        if OPENWEATHER_KEY:
            return self._owm_weather(location)

        return self._llm_weather(location)

    def get_forecast(self, location: str, days: int = 7) -> str:
        """Get multi-day weather forecast."""
        lat, lon, city_name = self._geocode(location)
        if lat is None:
            return f"Couldn't find '{location}'."

        try:
            params = {
                "latitude": lat, "longitude": lon,
                "daily": [
                    "weather_code", "temperature_2m_max", "temperature_2m_min",
                    "precipitation_sum", "wind_speed_10m_max", "uv_index_max"
                ],
                "temperature_unit": "fahrenheit",
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "timezone": "auto",
                "forecast_days": min(days, 16)
            }
            r = requests.get(OPEN_METEO_FORE, params=params, timeout=10)
            data = r.json()
            daily = data.get("daily", {})

            dates       = daily.get("time", [])
            codes       = daily.get("weather_code", [])
            temp_max    = daily.get("temperature_2m_max", [])
            temp_min    = daily.get("temperature_2m_min", [])
            precip      = daily.get("precipitation_sum", [])
            wind        = daily.get("wind_speed_10m_max", [])
            uv          = daily.get("uv_index_max", [])

            lines = [f"📅 {days}-Day Forecast for {city_name}:\n"]
            for i in range(min(days, len(dates))):
                day_name = datetime.strptime(dates[i], "%Y-%m-%d").strftime("%A %b %d")
                cond = WMO_CODES.get(codes[i] if codes else 0, "unknown")
                hi   = f"{temp_max[i]:.0f}°F" if temp_max else "?"
                lo   = f"{temp_min[i]:.0f}°F" if temp_min else "?"
                rain = f"{precip[i]:.2f}in rain" if precip else ""
                w    = f"{wind[i]:.0f}mph winds" if wind else ""
                uvi  = f"UV {uv[i]:.0f}" if uv else ""
                extras = ", ".join(filter(None, [rain, w, uvi]))
                lines.append(f"  {day_name}: {cond.title()}, {hi}/{lo}" + (f" — {extras}" if extras else ""))

            return "\n".join(lines)

        except Exception as e:
            logger.error(f"Forecast error: {e}")
            return f"Couldn't get the forecast for {location} right now."

    def compare_cities(self, cities: list) -> str:
        """Compare weather across multiple cities."""
        results = []
        for city in cities[:5]:
            lat, lon, name = self._geocode(city)
            if lat:
                data = self._open_meteo_current(lat, lon)
                if data:
                    current = data.get("current", {})
                    temp = current.get("temperature_2m", "?")
                    code = current.get("weather_code", 0)
                    cond = WMO_CODES.get(code, "unknown")
                    results.append(f"  {name}: {temp}°F, {cond}")

        if results:
            return "Weather comparison:\n" + "\n".join(results)
        return "Couldn't compare those cities right now."

    # ═══════════════════════════════
    # INTERNAL
    # ═══════════════════════════════

    def _geocode(self, location: str) -> tuple:
        """Convert city name to lat/lon using Open-Meteo geocoding (free)."""
        try:
            r = requests.get(OPEN_METEO_GEO,
                             params={"name": location, "count": 1, "language": "en"},
                             timeout=8)
            data = r.json()
            results = data.get("results", [])
            if results:
                res = results[0]
                name = f"{res.get('name','')}, {res.get('country','')}"
                return res["latitude"], res["longitude"], name
        except Exception as e:
            logger.debug(f"Geocoding error: {e}")
        return None, None, location

    def _open_meteo_current(self, lat: float, lon: float) -> dict:
        """Get current weather from Open-Meteo (no API key needed)."""
        try:
            params = {
                "latitude": lat, "longitude": lon,
                "current": [
                    "temperature_2m", "relative_humidity_2m", "apparent_temperature",
                    "weather_code", "wind_speed_10m", "wind_direction_10m",
                    "precipitation", "uv_index", "is_day"
                ],
                "hourly": ["precipitation_probability"],
                "temperature_unit": "fahrenheit",
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "timezone": "auto",
                "forecast_days": 1
            }
            r = requests.get(OPEN_METEO_FORE, params=params, timeout=10)
            return r.json()
        except Exception as e:
            logger.debug(f"Open-Meteo error: {e}")
            return None

    def _format_current_weather(self, data: dict, city: str) -> str:
        """Format weather data into natural spoken response."""
        try:
            current = data.get("current", {})
            temp        = current.get("temperature_2m", "?")
            feels_like  = current.get("apparent_temperature", "?")
            humidity    = current.get("relative_humidity_2m", "?")
            code        = current.get("weather_code", 0)
            wind_spd    = current.get("wind_speed_10m", 0)
            wind_dir    = current.get("wind_direction_10m", 0)
            precip      = current.get("precipitation", 0)
            uv          = current.get("uv_index", 0)
            is_day      = current.get("is_day", 1)

            condition   = WMO_CODES.get(code, "unknown conditions")
            wind_card   = WIND_DIRECTIONS[int(wind_dir / 22.5) % 16]

            # Rain probability from hourly
            hourly = data.get("hourly", {})
            rain_probs = hourly.get("precipitation_probability", [])
            rain_prob = rain_probs[0] if rain_probs else 0

            # Build response
            day_night = "right now" if is_day else "tonight"
            response = (
                f"In {city} {day_night} it's {temp}°F — feels like {feels_like}°F "
                f"with {condition}. "
                f"Humidity is {humidity}%, winds are {wind_spd:.0f}mph from the {wind_card}. "
            )

            if precip > 0:
                response += f"There's {precip:.2f} inches of precipitation. "
            if rain_prob > 30:
                response += f"{rain_prob:.0f}% chance of rain. "
            if uv >= 8:
                response += f"UV index is {uv:.0f} — very high, wear sunscreen. "
            elif uv >= 6:
                response += f"UV index is {uv:.0f} — high, sunscreen recommended. "

            # Add a practical tip
            if temp < 32:
                response += "Bundle up — it's freezing out there!"
            elif temp < 50:
                response += "It's chilly — grab a jacket."
            elif temp > 95:
                response += "It's seriously hot — stay hydrated!"
            elif condition in ["light rain", "moderate rain", "heavy rain", "thunderstorm"]:
                response += "Take an umbrella!"
            elif condition == "clear sky" and is_day:
                response += "Beautiful day out there."

            return response

        except Exception as e:
            logger.error(f"Weather formatting error: {e}")
            return f"Got the weather data for {city} but had trouble reading it. Try again!"

    def _owm_weather(self, location: str) -> str:
        """OpenWeatherMap fallback."""
        try:
            r = requests.get(f"{OWM_BASE}/weather",
                             params={"q": location, "appid": OPENWEATHER_KEY,
                                     "units": "imperial"},
                             timeout=8)
            d = r.json()
            temp = d["main"]["temp"]
            feels = d["main"]["feels_like"]
            desc = d["weather"][0]["description"]
            humidity = d["main"]["humidity"]
            wind = d["wind"]["speed"]
            city = d["name"]
            return (f"In {city}: {temp:.0f}°F (feels {feels:.0f}°F), "
                    f"{desc}, {humidity}% humidity, {wind:.0f}mph winds.")
        except Exception as e:
            logger.debug(f"OWM error: {e}")
            return self._llm_weather(location)

    def _llm_weather(self, location: str) -> str:
        prompt = f"Give a brief realistic current weather description for {location}. Note you don't have live data."
        if GROQ_KEY:
            try:
                r = requests.post("https://api.groq.com/openai/v1/chat/completions",
                    json={"model": "llama-3.3-70b-versatile",
                          "messages": [{"role":"user","content":prompt}], "max_tokens":150},
                    headers={"Authorization": f"Bearer {GROQ_KEY}"}, timeout=8)
                return r.json()["choices"][0]["message"]["content"].strip()
            except Exception: pass
        return f"I can't get live weather for {location} right now — my connections are down."
