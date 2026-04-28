import asyncio
import random
import uuid
from datetime import datetime, timezone
from typing import List

from app.utils.graph import get_base_route, CITIES, get_city_names
from app.utils.logger import get_logger
from app.services import firestore_service as db
from app.models.schemas import ShipmentStatus

logger = get_logger(__name__)

_CARGOES = [
    "Electronics", "Pharmaceuticals", "Automotive Parts",
    "Textiles", "Food & Beverage", "Industrial Machinery",
    "Consumer Goods", "Chemical Supplies",
]

# Fixed shipment pairs for demo consistency
_SHIPMENT_PAIRS = [
    ("Delhi",     "Chennai"),
    ("Mumbai",    "Kolkata"),
    ("Ahmedabad", "Bengaluru"),
    ("Jaipur",    "Hyderabad"),
    ("Lucknow",   "Pune"),
]

# Live simulation state: id -> shipment dict
_active_shipments: dict = {}
_simulation_task: asyncio.Task = None
_stop_event: asyncio.Event = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_shipment(origin: str, destination: str) -> dict:
    sid = f"SHP-{uuid.uuid4().hex[:6].upper()}"
    route, est_hours, distance = get_base_route(origin, destination)
    if route is None:
        route = [origin, destination]
        est_hours = 10.0
        distance = 500.0

    return {
        "id": sid,
        "origin": origin,
        "destination": destination,
        "current_location": origin,
        "route": route,
        "route_index": 0,
        "status": ShipmentStatus.IN_TRANSIT.value,
        "cargo": random.choice(_CARGOES),
        "weight_kg": round(random.uniform(500, 20000), 1),
        "distance_km": round(distance, 1),
        "estimated_hours": round(est_hours, 1),
        "delay_probability": None,
        "risk_level": None,
        "delay_reasons": None,
        "created_at": _now(),
        "updated_at": _now(),
    }


def generate_shipments() -> List[dict]:
    """Create 5 shipments and persist them."""
    db.delete_all_shipments()
    _active_shipments.clear()

    shipments = []
    for origin, dest in _SHIPMENT_PAIRS:
        s = _create_shipment(origin, dest)
        _active_shipments[s["id"]] = s
        db.write_shipment(s)
        shipments.append(s)
        logger.info(f"Created shipment {s['id']}: {origin} -> {dest}")

    return shipments


def _advance_shipment(shipment: dict) -> dict:
    """Move shipment one step along its route."""
    route = shipment["route"]
    idx = shipment["route_index"]

    if idx >= len(route) - 1:
        shipment["status"] = ShipmentStatus.DELIVERED.value
        return shipment

    next_idx = idx + 1
    shipment["route_index"] = next_idx
    shipment["current_location"] = route[next_idx]
    shipment["updated_at"] = _now()

    if next_idx >= len(route) - 1:
        shipment["status"] = ShipmentStatus.DELIVERED.value
    elif shipment.get("delay_probability", 0) and shipment["delay_probability"] > 0.65:
        shipment["status"] = ShipmentStatus.AT_RISK.value
    else:
        shipment["status"] = ShipmentStatus.IN_TRANSIT.value

    return shipment


async def _simulation_loop(interval_seconds: int = 15):
    """Background loop: advances all active shipments every interval."""
    global _stop_event
    logger.info(f"Simulation loop started (interval={interval_seconds}s)")

    while True:
        # Wait for interval OR stop signal — whichever comes first
        try:
            await asyncio.wait_for(
                asyncio.shield(_stop_event.wait()),
                timeout=interval_seconds,
            )
            # stop_event was set — exit cleanly
            logger.info("Simulation loop received stop signal — exiting.")
            return
        except asyncio.TimeoutError:
            pass  # Normal tick — proceed with update

        if _stop_event.is_set():
            logger.info("Simulation loop stop event detected — exiting.")
            return

        if not _active_shipments:
            logger.info("No active shipments - regenerating ...")
            generate_shipments()
            continue

        all_delivered = True
        for sid, shipment in list(_active_shipments.items()):
            if shipment["status"] == ShipmentStatus.DELIVERED.value:
                continue
            all_delivered = False
            updated = _advance_shipment(shipment)
            _active_shipments[sid] = updated
            db.update_shipment_fields(
                sid,
                {
                    "current_location": updated["current_location"],
                    "route_index": updated["route_index"],
                    "status": updated["status"],
                    "updated_at": updated["updated_at"],
                },
            )
            logger.info(
                f"[{sid}] -> {updated['current_location']} (step {updated['route_index']}/{len(updated['route'])-1})"
            )

        if all_delivered:
            logger.info("All shipments delivered — restarting simulation …")
            try:
                await asyncio.wait_for(
                    asyncio.shield(_stop_event.wait()),
                    timeout=5,
                )
                return  # stopped during restart delay
            except asyncio.TimeoutError:
                pass
            if not _stop_event.is_set():
                generate_shipments()


def start_simulation_loop(interval: int = 15):
    """Schedule the background simulation coroutine (cancels any existing loop first)."""
    global _simulation_task, _stop_event
    # Create a fresh stop event for this new loop
    _stop_event = asyncio.Event()
    loop = asyncio.get_event_loop()
    _simulation_task = loop.create_task(_simulation_loop(interval))
    logger.info("New simulation task created.")


def get_active_shipments() -> list:
    return list(_active_shipments.values())


def stop_simulation():
    """Signal the running loop to stop and cancel its task."""
    global _simulation_task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _simulation_task is not None and not _simulation_task.done():
        _simulation_task.cancel()
        _simulation_task = None
    logger.info("Simulation stopped.")


def mark_shipment_delivered(shipment_id: str, fields: dict) -> None:
    """Immediately update a shipment in the in-memory store as delivered."""
    if shipment_id in _active_shipments:
        _active_shipments[shipment_id].update(fields)
        logger.info(f"[{shipment_id}] marked as delivered in active store")

