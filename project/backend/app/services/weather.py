import os
import random
import httpx
from app.utils.logger import get_logger

logger = get_logger(__name__)

OWM_API_KEY: str = os.getenv("OPENWEATHERMAP_API_KEY", "")
WEATHER_MODE: str = os.getenv("WEATHER_MODE", "mock")

_ICON_MAP = {
    "thunderstorm": "⛈️",
    "drizzle": "🌦️",
    "rain": "🌧️",
    "snow": "❄️",
    "fog": "🌫️",
    "haze": "🌫️",
    "smoke": "🌫️",
    "mist": "🌫️",
    "clear": "☀️",
    "sunny": "☀️",
    "cloud": "☁️",
    "overcast": "☁️",
    "partly": "⛅",
}


def get_weather_icon(description: str) -> str:
    desc_lower = description.lower()
    for keyword, icon in _ICON_MAP.items():
        if keyword in desc_lower:
            return icon
    return "🌡️"

# OpenWeatherMap condition ID ranges → severity 0-10
_SEVERITY_MAP = {
    (200, 300): 9.0,  # Thunderstorm
    (300, 400): 5.0,  # Drizzle
    (500, 600): 6.5,  # Rain
    (600, 700): 7.0,  # Snow
    (700, 800): 4.0,  # Atmosphere (fog/haze/smoke)
    (800, 801): 0.5,  # Clear sky
    (801, 900): 2.0,  # Clouds
}

# Deterministic mock data per city for demo / no-key mode
_MOCK: dict = {
    "Delhi":     {"severity": 3.5, "description": "Hazy"},
    "Mumbai":    {"severity": 6.5, "description": "Heavy Rain"},
    "Kolkata":   {"severity": 5.0, "description": "Moderate Rain"},
    "Chennai":   {"severity": 4.2, "description": "Light Rain"},
    "Hyderabad": {"severity": 2.0, "description": "Partly Cloudy"},
    "Bengaluru": {"severity": 1.5, "description": "Clear Sky"},
    "Pune":      {"severity": 5.5, "description": "Rain"},
    "Ahmedabad": {"severity": 0.8, "description": "Sunny"},
    "Jaipur":    {"severity": 1.2, "description": "Clear"},
    "Lucknow":   {"severity": 3.0, "description": "Overcast"},
}


def _severity_from_id(weather_id: int) -> float:
    for (lo, hi), sev in _SEVERITY_MAP.items():
        if lo <= weather_id < hi:
            return sev
    return 3.0


async def get_weather_severity(city: str) -> dict:
    """
    Returns {"severity": float 0-10, "description": str}.
    Falls back to mock data if API key is missing or call fails.
    """
    if WEATHER_MODE == "mock" or not OWM_API_KEY:
        base = _MOCK.get(city, {"severity": 3.0, "description": "Unknown"})
        # Small random variance to make demo feel live
        jitter = random.uniform(-0.4, 0.4)
        desc = base["description"]
        return {
            "severity": round(max(0.0, min(10.0, base["severity"] + jitter)), 2),
            "description": desc,
            "icon": get_weather_icon(desc),
        }

    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": f"{city},IN", "appid": OWM_API_KEY, "units": "metric"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            wid = data["weather"][0]["id"]
            desc = data["weather"][0]["description"].title()
            sev = _severity_from_id(wid)
            logger.info(f"OWM {city}: {desc} (id={wid}, severity={sev})")
            return {"severity": sev, "description": desc, "icon": get_weather_icon(desc)}
    except Exception as exc:
        logger.warning(f"OWM failed for {city}: {exc} — using mock fallback")
        base = _MOCK.get(city, {"severity": 3.0, "description": "Unknown"})
        return {**base, "icon": get_weather_icon(base["description"])}


async def get_bulk_weather(cities: list) -> dict:
    """Fetch weather for multiple cities concurrently."""
    import asyncio
    results = await asyncio.gather(*[get_weather_severity(c) for c in cities])
    return {city: result for city, result in zip(cities, results)}
