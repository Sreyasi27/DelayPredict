"""
decision_engine.py
==================
Hybrid Intelligence Decision Pipeline

Flow:
  1. Fetch real-time weather for origin city  (weather.py)
  2. Run ML delay prediction                  (ml/model.py)
  3. Apply decision rules (low / monitor / reroute)
  4. Generate AI explanation via Gemini API
  5. If reroute required → call Dijkstra      (route_optimizer.py)
  6. Return structured JSON response
"""

import os
import json
import httpx
from app.services.weather import get_weather_severity
from app.services.route_optimizer import optimize_route
from app.ml.model import predict as ml_predict
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ── Gemini configuration ───────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)


# ── Decision thresholds ────────────────────────────────────────────────────
THRESHOLD_MONITOR = 0.40   # 40 %
THRESHOLD_REROUTE = 0.70   # 70 %


# ── Decision layer ─────────────────────────────────────────────────────────

def _decide_action(risk_prob: float) -> tuple[str, str]:
    """
    Returns (action, reason_tag) based on risk probability.
    action: "continue" | "monitor" | "reroute"
    """
    if risk_prob < THRESHOLD_MONITOR:
        return "continue", "Risk below 40% — route is safe to proceed."
    if risk_prob < THRESHOLD_REROUTE:
        return "monitor", "Risk between 40–70% — elevated monitoring advised."
    return "reroute", "Risk exceeds 70% — immediate rerouting required."


# ── Gemini AI explanation ─────────────────────────────────────────────────

async def _gemini_explain(
    shipment_id: str,
    origin: str,
    destination: str,
    distance: float,
    weight: float,
    carrier_rating: float,
    traffic_score: float,
    weather_desc: str,
    weather_sev: float,
    risk_percent: float,
    status: str,
    action: str,
) -> dict:
    """
    Calls Gemini 1.5 Flash to generate a human-readable explanation
    and recommended action. Returns {explanation, recommended_action}.
    Falls back gracefully if Gemini is unavailable.
    """
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — skipping AI explanation")
        return {
            "explanation": f"ML model predicts a {risk_percent:.1f}% delay risk for shipment {shipment_id}.",
            "recommended_action": action.capitalize() + " as per decision rules.",
        }

    prompt = f"""
You are a senior logistics intelligence analyst AI.

A shipment analysis has just been completed. Here are the details:

Shipment ID     : {shipment_id}
Route           : {origin} -> {destination}
Distance        : {distance} km
Cargo Weight    : {weight} kg
Carrier Rating  : {carrier_rating} / 5.0
Traffic Score   : {traffic_score:.1f} / 10.0
Weather         : {weather_desc} (severity {weather_sev:.1f} / 10.0)
ML Delay Risk   : {risk_percent:.1f}%
Predicted Status: {status}
Recommended     : {action.upper()}

Based on the above data, provide:
1. A SHORT explanation (1–2 sentences) of WHY the risk is at this level.
2. A SPECIFIC recommended action for the logistics team.

Respond ONLY with a JSON object in this exact format (no markdown, no extra keys):
{{
  "explanation": "...",
  "recommended_action": "..."
}}
""".strip()

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 300,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": GEMINI_API_KEY},
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            raw = resp.json()
            text = raw["candidates"][0]["content"]["parts"][0]["text"].strip()

            # Strip markdown fences if Gemini wraps in ```json ... ```
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            result = json.loads(text)
            return {
                "explanation": result.get("explanation", ""),
                "recommended_action": result.get("recommended_action", ""),
            }

    except Exception as exc:
        logger.error(f"Gemini API error for {shipment_id}: {exc}")
        return {
            "explanation": (
                f"ML analysis indicates a {risk_percent:.1f}% delay risk on the "
                f"{origin}->{destination} corridor due to "
                f"{weather_desc.lower()} conditions and traffic score {traffic_score:.1f}/10."
            ),
            "recommended_action": f"{action.capitalize()} as per automated decision rules.",
        }


# ── Main pipeline ──────────────────────────────────────────────────────────

async def run_analysis(
    shipment_id: str,
    origin: str,
    destination: str,
    distance: float,
    traffic_score: float,
    weight: float,
    carrier_rating: float,
) -> dict:
    """
    Execute the full Hybrid Intelligence Decision Pipeline and return
    a structured response ready for the frontend.
    """
    logger.info(f"[{shipment_id}] Pipeline START  {origin} -> {destination}")

    # ── STEP 1: Weather ────────────────────────────────────────────────────
    weather_data = await get_weather_severity(origin)
    weather_sev  = weather_data["severity"]
    weather_desc = weather_data["description"]
    weather_icon = weather_data.get("icon", "🌡️")
    logger.info(f"[{shipment_id}] Weather: {weather_desc}  severity={weather_sev}")

    # ── STEP 2: ML Prediction ──────────────────────────────────────────────
    # ml/model.predict() expects (distance, weather_severity, traffic_congestion, historical_delay_flag)
    # We normalise traffic_score from 0-10 scale used internally
    historical_flag = 1 if carrier_rating < 3.0 else 0   # rough proxy
    risk_prob = ml_predict(
        distance=distance,
        weather_severity=weather_sev,
        traffic_congestion=traffic_score,
        historical_delay_flag=historical_flag,
    )
    risk_percent = round(risk_prob * 100, 2)
    status       = "Delayed" if risk_prob >= 0.5 else "On-Time"
    logger.info(f"[{shipment_id}] ML risk={risk_percent}%  status={status}")

    # ── STEP 3: Decision layer ─────────────────────────────────────────────
    action, action_reason = _decide_action(risk_prob)
    logger.info(f"[{shipment_id}] Decision: {action.upper()}")

    # ── STEP 4: Gemini explanation ─────────────────────────────────────────
    ai_result = await _gemini_explain(
        shipment_id=shipment_id,
        origin=origin,
        destination=destination,
        distance=distance,
        weight=weight,
        carrier_rating=carrier_rating,
        traffic_score=traffic_score,
        weather_desc=weather_desc,
        weather_sev=weather_sev,
        risk_percent=risk_percent,
        status=status,
        action=action,
    )
    logger.info(f"[{shipment_id}] Gemini explanation received")

    # ── STEP 5: Route optimization (only if reroute required) ──────────────
    original_route    = []
    optimized_route   = []
    original_hours    = None
    optimized_hours   = None
    time_saved_minutes = 0.0
    rerouted          = False

    if action == "reroute":
        try:
            weather_scores = {origin: weather_sev, destination: weather_sev * 0.7}
            traffic_scores = {origin: traffic_score, destination: traffic_score * 0.8}

            route_resp = optimize_route(
                shipment_id=shipment_id,
                origin=origin,
                destination=destination,
                weather_scores=weather_scores,
                traffic_scores=traffic_scores,
            )
            original_route     = route_resp.original_route
            optimized_route    = route_resp.optimized_route
            original_hours     = route_resp.original_hours
            optimized_hours    = route_resp.optimized_hours
            time_saved_minutes = route_resp.time_saved_minutes
            rerouted           = not route_resp.is_same_route
            logger.info(
                f"[{shipment_id}] Dijkstra: saved {time_saved_minutes:.0f} min  "
                f"rerouted={rerouted}"
            )
        except Exception as exc:
            logger.warning(f"[{shipment_id}] Route optimization skipped (city not in graph or error): {exc}")
            original_route  = [origin, destination]
            optimized_route = [origin, destination]

    # ── STEP 6: Assemble response ──────────────────────────────────────────
    response = {
        "shipment_id":       shipment_id,
        "risk_percent":      risk_percent,
        "status":            status,
        "action":            action,
        "action_reason":     action_reason,
        # Weather
        "weather": {
            "city":        origin,
            "description": weather_desc,
            "severity":    weather_sev,
            "icon":        weather_icon,
        },
        # AI
        "ai_explanation":    ai_result["explanation"],
        "ai_recommendation": ai_result["recommended_action"],
        # Routes
        "original_route":       original_route,
        "optimized_route":      optimized_route,
        "original_hours":       original_hours,
        "optimized_hours":      optimized_hours,
        "time_saved_minutes":   time_saved_minutes,
        "rerouted":             rerouted,
        # Input echo (useful for frontend display)
        "input": {
            "origin":         origin,
            "destination":    destination,
            "distance_km":    distance,
            "traffic_score":  traffic_score,
            "weight_kg":      weight,
            "carrier_rating": carrier_rating,
        },
    }

    logger.info(f"[{shipment_id}] ◄ Pipeline COMPLETE  action={action}")
    return response
