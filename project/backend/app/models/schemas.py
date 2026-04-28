from pydantic import BaseModel, Field
from typing import List, Optional, Any
from enum import Enum


class ShipmentStatus(str, Enum):
    IN_TRANSIT = "in_transit"
    DELAYED = "delayed"
    DELIVERED = "delivered"
    AT_RISK = "at_risk"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Shipment(BaseModel):
    id: str
    origin: str
    destination: str
    current_location: str
    route: List[str]
    route_index: int
    status: ShipmentStatus
    cargo: str
    weight_kg: float
    distance_km: float
    estimated_hours: float
    delay_probability: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    delay_reasons: Optional[List[str]] = None
    created_at: str
    updated_at: str


class RiskResponse(BaseModel):
    shipment_id: str
    delay_probability: float
    risk_level: RiskLevel
    reasons: List[str]
    weather_severity: float
    traffic_congestion: float
    distance_km: float


class RouteOptimizeRequest(BaseModel):
    shipment_id: str
    origin: str
    destination: str
    weather_scores: Optional[dict] = None
    traffic_scores: Optional[dict] = None


class RouteResponse(BaseModel):
    shipment_id: str
    original_route: List[str]
    optimized_route: List[str]
    original_hours: float
    optimized_hours: float
    time_saved_minutes: float
    original_distance_km: float
    optimized_distance_km: float
    is_same_route: bool


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    firestore_connected: bool
    shipment_count: int


# ── Hybrid Intelligence Pipeline ───────────────────────────────────────────

class AnalyzeShipmentRequest(BaseModel):
    shipment_id: str = Field(..., example="SHP-001")
    origin: str = Field(..., example="Mumbai")
    destination: str = Field(..., example="Delhi")
    distance: float = Field(..., gt=0, example=1400.0)
    traffic_score: float = Field(..., ge=0, le=10, example=7.5)
    weight: float = Field(..., gt=0, example=1500.0)
    carrier_rating: float = Field(..., ge=1, le=5, example=3.8)


class WeatherInfo(BaseModel):
    city: str
    description: str
    severity: float
    icon: str


class AnalyzeShipmentResponse(BaseModel):
    shipment_id: str
    risk_percent: float
    status: str                      # "Delayed" | "On-Time"
    action: str                      # "continue" | "monitor" | "reroute"
    action_reason: str
    weather: WeatherInfo
    ai_explanation: str
    ai_recommendation: str
    original_route: List[str]
    optimized_route: List[str]
    original_hours: Optional[float] = None
    optimized_hours: Optional[float] = None
    time_saved_minutes: float
    rerouted: bool
    input: dict
