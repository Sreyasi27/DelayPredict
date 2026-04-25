from app.utils.graph import build_graph, dijkstra, get_base_route
from app.models.schemas import RouteResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)


def optimize_route(
    shipment_id: str,
    origin: str,
    destination: str,
    weather_scores: dict = None,
    traffic_scores: dict = None,
) -> RouteResponse:
    """
    Run Dijkstra twice:
      1. Base graph (no disruption) → original route
      2. Weighted graph (real conditions) → optimized route
    Return comparison with time saved.
    """
    weather_scores = weather_scores or {}
    traffic_scores = traffic_scores or {}

    # Original route — no disruption weights
    orig_path, orig_hours, orig_km = get_base_route(origin, destination)
    if orig_path is None:
        raise ValueError(f"No route found between {origin} and {destination}")

    # Optimized route — apply live disruption weights
    weighted_graph = build_graph(weather_scores, traffic_scores)
    opt_path, opt_hours, opt_km = dijkstra(weighted_graph, origin, destination)
    if opt_path is None:
        opt_path, opt_hours, opt_km = orig_path, orig_hours, orig_km

    time_saved_min = max(0.0, (orig_hours - opt_hours) * 60)

    logger.info(
        f"[{shipment_id}] Original: {' → '.join(orig_path)} ({orig_hours:.1f}h) | "
        f"Optimized: {' → '.join(opt_path)} ({opt_hours:.1f}h) | "
        f"Saved: {time_saved_min:.0f} min"
    )

    return RouteResponse(
        shipment_id=shipment_id,
        original_route=orig_path,
        optimized_route=opt_path,
        original_hours=round(orig_hours, 2),
        optimized_hours=round(opt_hours, 2),
        time_saved_minutes=round(time_saved_min, 1),
        original_distance_km=round(orig_km, 1),
        optimized_distance_km=round(opt_km, 1),
        is_same_route=(orig_path == opt_path),
    )
