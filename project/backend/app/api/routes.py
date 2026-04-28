from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    RouteOptimizeRequest,
    RouteResponse,
    RiskResponse,
    HealthResponse,
    Shipment,
    AnalyzeShipmentRequest,
    AnalyzeShipmentResponse,
)
from app.services import simulation, firestore_service as db
from app.services.risk_engine import predict_risk
from app.services.route_optimizer import optimize_route
from app.ml.model import get_model
from app.utils.logger import get_logger
import asyncio

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
async def simulate_shipments():
    """Generate 5 fresh shipments and (re)start the simulation loop."""
    # Stop any previous loop (cancels the task immediately)
    simulation.stop_simulation()
    await asyncio.sleep(0)            # yield to event loop so cancellation propagates

    shipments = simulation.generate_shipments()
    simulation.start_simulation_loop(interval=15)  # restart loop

    logger.info(f"Simulated {len(shipments)} shipments — loop restarted")
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


@router.patch("/shipments/{shipment_id}/deliver", tags=["shipments"])
def mark_delivered(shipment_id: str):
    """Mark a shipment as delivered immediately (prototype/demo action)."""
    from datetime import datetime, timezone
    data = db.get_shipment(shipment_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found")

    now = datetime.now(timezone.utc).isoformat()
    fields = {
        "status": "delivered",
        "route_index": len(data.get("route", [])) - 1,  # jump to end of route
        "current_location": data.get("destination", data.get("current_location")),
        "updated_at": now,
    }
    db.update_shipment_fields(shipment_id, fields)

    # Also update in-memory simulation store so map updates instantly
    simulation.mark_shipment_delivered(shipment_id, fields)

    logger.info(f"Shipment {shipment_id} manually marked as delivered")
    return {"message": f"{shipment_id} marked as delivered", "shipment_id": shipment_id}



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


# ── Hybrid Intelligence Decision Pipeline ──────────────────────────────────

@router.post(
    "/analyze-shipment",
    response_model=AnalyzeShipmentResponse,
    tags=["intelligence"],
    summary="Full hybrid pipeline: Weather → ML → Gemini AI → Dijkstra",
)
async def analyze_shipment(req: AnalyzeShipmentRequest):
    """
    Runs the complete Hybrid Intelligence Decision Pipeline:
    1. Fetches real-time weather for the origin city
    2. Runs ML delay prediction
    3. Applies decision rules (continue / monitor / reroute)
    4. Generates a Gemini AI explanation
    5. If reroute required, runs Dijkstra route optimization
    6. Returns a unified structured response
    """
    from app.services.decision_engine import run_analysis

    try:
        result = await run_analysis(
            shipment_id=req.shipment_id,
            origin=req.origin,
            destination=req.destination,
            distance=req.distance,
            traffic_score=req.traffic_score,
            weight=req.weight,
            carrier_rating=req.carrier_rating,
        )
        return result
    except Exception as exc:
        logger.error(f"Pipeline error [{req.shipment_id}]: {exc}")
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(exc)}")
