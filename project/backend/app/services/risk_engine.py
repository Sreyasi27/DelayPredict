import random
from app.services.weather import get_weather_severity
from app.services import firestore_service as db
from app.ml import model as ml
from app.models.schemas import RiskLevel, RiskResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Deterministic-ish traffic scores per city (refreshed each call with jitter)
_BASE_TRAFFIC = {
    "Delhi":     7.5,
    "Mumbai":    8.0,
    "Kolkata":   6.5,
    "Chennai":   5.5,
    "Hyderabad": 5.0,
    "Bengaluru": 7.0,
    "Pune":      6.0,
    "Ahmedabad": 4.5,
    "Jaipur":    4.0,
    "Lucknow":   5.0,
}


def _traffic_score(city: str) -> float:
    base = _BASE_TRAFFIC.get(city, 5.0)
    jitter = random.uniform(-1.0, 1.0)
    return round(max(0.0, min(10.0, base + jitter)), 2)


def _risk_label(prob: float) -> RiskLevel:
    if prob < 0.35:
        return RiskLevel.LOW
    if prob < 0.65:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


def _build_reasons(weather_sev: float, traffic: float, distance: float, historical: int) -> list:
    reasons = []
    if weather_sev >= 6.0:
        reasons.append(f"Severe weather (score {weather_sev:.1f}/10)")
    elif weather_sev >= 4.0:
        reasons.append(f"Moderate weather disruption (score {weather_sev:.1f}/10)")
    if traffic >= 7.0:
        reasons.append(f"High traffic congestion (score {traffic:.1f}/10)")
    elif traffic >= 5.0:
        reasons.append(f"Moderate traffic (score {traffic:.1f}/10)")
    if distance > 1000:
        reasons.append(f"Long-haul route ({distance:.0f} km)")
    if historical:
        reasons.append("Historical delay on this corridor")
    if not reasons:
        reasons.append("Conditions nominal — low disruption risk")
    return reasons


async def predict_risk(shipment_id: str) -> RiskResponse:
    """Fetch live conditions and return ML-predicted risk for a shipment."""
    shipment = db.get_shipment(shipment_id)
    if not shipment:
        raise ValueError(f"Shipment {shipment_id} not found")

    current_city = shipment["current_location"]
    distance = shipment["distance_km"]
    historical = 1 if shipment.get("status") == "delayed" else 0

    weather_data = await get_weather_severity(current_city)
    weather_sev = weather_data["severity"]
    traffic = _traffic_score(current_city)

    prob = ml.predict(
        distance=distance,
        weather_severity=weather_sev,
        traffic_congestion=traffic,
        historical_delay_flag=historical,
    )

    risk_level = _risk_label(prob)
    reasons = _build_reasons(weather_sev, traffic, distance, historical)

    # Update the shipment's risk fields in store
    db.update_shipment_fields(
        shipment_id,
        {
            "delay_probability": round(prob, 4),
            "risk_level": risk_level.value,
            "delay_reasons": reasons,
        },
    )

    logger.info(f"[{shipment_id}] Risk={risk_level} prob={prob:.2f} city={current_city}")

    return RiskResponse(
        shipment_id=shipment_id,
        delay_probability=round(prob, 4),
        risk_level=risk_level,
        reasons=reasons,
        weather_severity=weather_sev,
        traffic_congestion=traffic,
        distance_km=distance,
    )
