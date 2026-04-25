import heapq
from typing import Dict, List, Tuple, Optional

# ── City definitions ────────────────────────────────────────────────────────
CITIES: Dict[str, Dict] = {
    "Delhi":     {"lat": 28.6139, "lng": 77.2090, "state": "Delhi"},
    "Mumbai":    {"lat": 19.0760, "lng": 72.8777, "state": "Maharashtra"},
    "Kolkata":   {"lat": 22.5726, "lng": 88.3639, "state": "West Bengal"},
    "Chennai":   {"lat": 13.0827, "lng": 80.2707, "state": "Tamil Nadu"},
    "Hyderabad": {"lat": 17.3850, "lng": 78.4867, "state": "Telangana"},
    "Bengaluru": {"lat": 12.9716, "lng": 77.5946, "state": "Karnataka"},
    "Pune":      {"lat": 18.5204, "lng": 73.8567, "state": "Maharashtra"},
    "Ahmedabad": {"lat": 23.0225, "lng": 72.5714, "state": "Gujarat"},
    "Jaipur":    {"lat": 26.9124, "lng": 75.7873, "state": "Rajasthan"},
    "Lucknow":   {"lat": 26.8467, "lng": 80.9462, "state": "Uttar Pradesh"},
}

# (city_a, city_b, distance_km, base_travel_hours)
BASE_ROUTES: List[Tuple[str, str, float, float]] = [
    ("Delhi",     "Jaipur",    280,  4.5),
    ("Delhi",     "Lucknow",   555,  8.0),
    ("Delhi",     "Ahmedabad", 950, 14.0),
    ("Delhi",     "Kolkata",  1480, 22.0),
    ("Jaipur",    "Ahmedabad", 660, 10.0),
    ("Jaipur",    "Mumbai",   1150, 17.0),
    ("Ahmedabad", "Mumbai",    530,  8.0),
    ("Mumbai",    "Pune",      150,  3.0),
    ("Mumbai",    "Hyderabad", 710, 11.0),
    ("Pune",      "Hyderabad", 560,  9.0),
    ("Pune",      "Bengaluru", 840, 13.0),
    ("Hyderabad", "Bengaluru", 570,  9.0),
    ("Hyderabad", "Chennai",   630, 10.0),
    ("Bengaluru", "Chennai",   345,  6.0),
    ("Lucknow",   "Kolkata",   980, 15.0),
    ("Kolkata",   "Chennai",  1670, 26.0),
    ("Lucknow",   "Hyderabad",1290, 19.0),
]


def build_graph(
    weather_scores: Dict[str, float] = None,
    traffic_scores: Dict[str, float] = None,
) -> Dict[str, List[Tuple[str, float, float]]]:
    """
    Build weighted adjacency list.
    Edge weight = base_hours * (1 + weather_factor + traffic_factor).
    weather/traffic scores: city -> 0-10 scale.
    """
    weather_scores = weather_scores or {}
    traffic_scores = traffic_scores or {}
    graph: Dict[str, List[Tuple[str, float, float]]] = {c: [] for c in CITIES}

    for city1, city2, distance, base_hours in BASE_ROUTES:
        # Normalize scores to penalty factors (0.0 – 0.5)
        w_factor = ((weather_scores.get(city1, 0) + weather_scores.get(city2, 0)) / 2) / 20
        t_factor = ((traffic_scores.get(city1, 0) + traffic_scores.get(city2, 0)) / 2) / 20
        weighted_hours = base_hours * (1 + w_factor + t_factor)

        graph[city1].append((city2, weighted_hours, distance))
        graph[city2].append((city1, weighted_hours, distance))

    return graph


def dijkstra(
    graph: Dict[str, List[Tuple[str, float, float]]],
    start: str,
    end: str,
) -> Tuple[Optional[List[str]], float, float]:
    """
    Returns (path, total_hours, total_distance_km).
    Returns (None, inf, inf) if no path exists.
    """
    dist = {city: float("inf") for city in graph}
    km_dist = {city: 0.0 for city in graph}
    prev: Dict[str, Optional[str]] = {city: None for city in graph}
    dist[start] = 0.0
    pq = [(0.0, start)]

    while pq:
        cur_time, cur = heapq.heappop(pq)
        if cur == end:
            break
        if cur_time > dist[cur]:
            continue
        for neighbor, hours, km in graph[cur]:
            new_time = dist[cur] + hours
            if new_time < dist[neighbor]:
                dist[neighbor] = new_time
                km_dist[neighbor] = km_dist[cur] + km
                prev[neighbor] = cur
                heapq.heappush(pq, (new_time, neighbor))

    if dist[end] == float("inf"):
        return None, float("inf"), float("inf")

    # Reconstruct path
    path, node = [], end
    while node is not None:
        path.append(node)
        node = prev[node]
    path.reverse()

    return path, dist[end], km_dist[end]


def get_base_route(origin: str, destination: str) -> Tuple[Optional[List[str]], float, float]:
    """Shortest route with no disruption penalties."""
    return dijkstra(build_graph(), origin, destination)


def get_city_names() -> List[str]:
    return list(CITIES.keys())


def get_city_coords(city: str) -> Dict[str, float]:
    return {"lat": CITIES[city]["lat"], "lng": CITIES[city]["lng"]}
