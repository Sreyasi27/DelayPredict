from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    RouteOptimizeRequest,
    RouteResponse,
    RiskResponse,
    HealthResponse,
    Shipment,
)
from app.services import simulation, firestore_service as db
from app.services.risk_engine import predict_risk
from app.services.route_optimizer import optimize_route
from app.ml.model import get_model
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── Health ─────────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse, tags=["system"])
def health():
    return HealthResponse(
        status="ok",
        model_loaded=get_model() is not None,
        firestore_connected=db.is_connected(),
        shipment_count=db.shipment_count(),
    )


# ── Shipments ──────────────────────────────────────────────────────────────

@router.post("/simulate-shipments", tags=["shipments"])
def simulate_shipments():
    """Generate 5 fresh shipments and start the simulation loop."""
    shipments = simulation.generate_shipments()
    logger.info(f"Simulated {len(shipments)} shipments")
    return {"message": f"{len(shipments)} shipments created", "shipments": shipments}


@router.get("/shipments", tags=["shipments"])
def get_shipments():
    """Return all current shipments from store."""
    data = db.get_all_shipments()
    # Fallback to in-memory active shipments if store is empty
    if not data:
        data = simulation.get_active_shipments()
    return {"shipments": data, "count": len(data)}


@router.get("/shipments/{shipment_id}", tags=["shipments"])
def get_shipment(shipment_id: str):
    """Return a single shipment by ID."""
    data = db.get_shipment(shipment_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found")
    return data


# ── Risk Prediction ────────────────────────────────────────────────────────

@router.get("/predict-risk/{shipment_id}", response_model=RiskResponse, tags=["ml"])
async def predict_risk_endpoint(shipment_id: str):
    """Run ML risk prediction for a specific shipment."""
    try:
        return await predict_risk(shipment_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(f"Risk prediction error: {exc}")
        raise HTTPException(status_code=500, detail="Risk prediction failed")


# ── Weather ────────────────────────────────────────────────────────────────

@router.get("/weather", tags=["weather"])
async def get_all_weather():
    """Return live weather conditions for all cities in the routing graph."""
    from app.services.weather import get_bulk_weather
    from app.utils.graph import get_city_names
    cities = get_city_names()
    data = await get_bulk_weather(cities)
    return {"weather": data}


# ── Route Optimization ─────────────────────────────────────────────────────

@router.post("/optimize-route", response_model=RouteResponse, tags=["routing"])
async def optimize_route_endpoint(req: RouteOptimizeRequest):
    """Run Dijkstra with disruption weights and return optimized route."""
    from app.services.weather import get_bulk_weather
    from app.utils.graph import get_city_names

    # If caller didn't provide scores, fetch live weather for all cities
    weather_scores = req.weather_scores or {}
    traffic_scores = req.traffic_scores or {}

    if not weather_scores:
        cities = get_city_names()
        bulk = await get_bulk_weather(cities)
        weather_scores = {c: v["severity"] for c, v in bulk.items()}

    if not traffic_scores:
        from app.services.risk_engine import _traffic_score
        traffic_scores = {c: _traffic_score(c) for c in get_city_names()}

    try:
        return optimize_route(
            shipment_id=req.shipment_id,
            origin=req.origin,
            destination=req.destination,
            weather_scores=weather_scores,
            traffic_scores=traffic_scores,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error(f"Route optimization error: {exc}")
        raise HTTPException(status_code=500, detail="Route optimization failed")
