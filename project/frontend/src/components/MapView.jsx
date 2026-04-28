import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/* ── City coordinates (matches backend graph.py) ───────────────────────── */
const CITY_COORDS = {
  Delhi:     [28.6139, 77.2090],
  Mumbai:    [19.0760, 72.8777],
  Kolkata:   [22.5726, 88.3639],
  Chennai:   [13.0827, 80.2707],
  Hyderabad: [17.3850, 78.4867],
  Bengaluru: [12.9716, 77.5946],
  Pune:      [18.5204, 73.8567],
  Ahmedabad: [23.0225, 72.5714],
  Jaipur:    [26.9124, 75.7873],
  Lucknow:   [26.8467, 80.9462],
};

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

const WEATHER_ICONS = {
  'Heavy Rain': '🌧️', 'Moderate Rain': '🌦️', 'Light Rain': '🌦️',
  'Thunderstorm': '⛈️', 'Drizzle': '🌧️', 'Snow': '❄️',
  'Hazy': '🌫️', 'Foggy': '🌫️', 'Smoke': '🌫️',
  'Partly Cloudy': '⛅', 'Overcast': '☁️', 'Clouds': '☁️',
  'Clear Sky': '☀️', 'Clear': '☀️', 'Sunny': '☀️',
};

function weatherIcon(desc = '') {
  const key = Object.keys(WEATHER_ICONS).find((k) =>
    desc.toLowerCase().includes(k.toLowerCase())
  );
  return key ? WEATHER_ICONS[key] : '🌡️';
}

function severityColor(sev = 0) {
  if (sev >= 7) return '#ef4444';
  if (sev >= 4) return '#f59e0b';
  return '#10b981';
}

/* ── Static alternate demo route ──────────────────────────────────────────
   Shows a pre-computed alternate corridor to illustrate rerouting concept.
   Mumbai → Pune → Hyderabad → Bengaluru → Chennai (vs. direct Mumbai→Chennai)
─────────────────────────────────────────────────────────────────────────── */
const DEMO_ALT_ROUTE = ['Mumbai', 'Pune', 'Hyderabad', 'Bengaluru', 'Chennai'];
const DEMO_ALT_PATH  = DEMO_ALT_ROUTE.map((c) => CITY_COORDS[c]);

/* ── Auto-fit map to selected shipment ─────────────────────────────────── */
function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 7, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function MapView({
  shipments = [],
  selectedId = null,
  onSelectShipment,
  routeData = null,
  weatherData = {},
}) {
  const selected = shipments.find((s) => s.id === selectedId);
  const flyCenter = selected
    ? CITY_COORDS[selected.current_location] || [21.0, 78.0]
    : null;

  /* Build polyline paths for Dijkstra routes */
  const originalPath = useMemo(() => {
    if (!routeData?.original_route) return null;
    return routeData.original_route.map((city) => CITY_COORDS[city]).filter(Boolean);
  }, [routeData]);

  const optimizedPath = useMemo(() => {
    if (!routeData?.optimized_route) return null;
    return routeData.optimized_route.map((city) => CITY_COORDS[city]).filter(Boolean);
  }, [routeData]);

  /* Shipment route polylines for dashboard overview */
  const shipmentPaths = useMemo(() =>
    shipments
      .filter((s) => s.route && s.route.length > 1)
      .map((s) => ({
        id: s.id,
        path: s.route.map((c) => CITY_COORDS[c]).filter(Boolean),
        color: RISK_COLORS[s.risk_level || 'low'],
        selected: s.id === selectedId,
        delivered: s.status === 'delivered',
      })),
    [shipments, selectedId]
  );

  return (
    <MapContainer
      center={[21.0, 78.0]}
      zoom={5}
      style={{ width: '100%', height: '100%', minHeight: 360, borderRadius: 12 }}
      zoomControl={true}
      attributionControl={false}
    >
      {/* Dark CartoDB tiles */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />

      {/* Fly to selected shipment's city */}
      {flyCenter && <MapFlyTo center={flyCenter} zoom={7} />}

      {/* ── Static alternate demo route (always visible in dashboard mode) ── */}
      {!routeData && (
        <Polyline
          positions={DEMO_ALT_PATH}
          pathOptions={{
            color: '#f97316',     // orange — distinct from shipment routes
            weight: 2,
            opacity: 0.55,
            dashArray: '4 8',     // sparse dash = "alternate / prototype"
          }}
        />
      )}

      {/* ── Dashboard mode: live shipment route polylines ──────────────── */}
      {!routeData && shipmentPaths.map(({ id, path, color, selected, delivered }) => (
        <Polyline
          key={`route-${id}`}
          positions={path}
          pathOptions={{
            color: delivered ? '#6b7280' : color,
            weight: selected ? 3 : 1.5,
            opacity: delivered ? 0.2 : selected ? 0.9 : 0.4,
            dashArray: selected ? undefined : '6 4',
          }}
        />
      ))}

      {/* ── Dijkstra mode: original (dashed blue) + optimized (solid green) */}
      {routeData && originalPath && (
        <Polyline
          positions={originalPath}
          pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '10 6' }}
        />
      )}
      {routeData && optimizedPath && !routeData.is_same_route && (
        <Polyline
          positions={optimizedPath}
          pathOptions={{ color: '#10b981', weight: 4, opacity: 0.9 }}
        />
      )}
      {routeData && optimizedPath && routeData.is_same_route && (
        <Polyline
          positions={optimizedPath}
          pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.9 }}
        />
      )}

      {/* ── City markers (all 10 cities) ──────────────────────────────── */}
      {Object.entries(CITY_COORDS).map(([city, pos]) => {
        const weather = weatherData[city];
        const cityShipment = shipments.find(
          (s) => s.current_location === city && s.status !== 'delivered'
        );
        const riskColor = cityShipment
          ? RISK_COLORS[cityShipment.risk_level || 'low']
          : '#3b82f6';
        const sevColor = weather ? severityColor(weather.severity) : '#3b82f6';

        return (
          <CircleMarker
            key={city}
            center={pos}
            radius={cityShipment ? 10 : 6}
            pathOptions={{
              color: cityShipment ? riskColor : '#3b82f6',
              fillColor: cityShipment ? riskColor : '#1e3a5f',
              fillOpacity: cityShipment ? 0.85 : 0.5,
              weight: 2,
            }}
            eventHandlers={{
              click: () => {
                if (cityShipment) onSelectShipment?.(cityShipment);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              <div style={{ minWidth: 140, fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  📍 {city}
                </div>
                {weather && (
                  <div style={{ fontSize: 12, color: sevColor, marginBottom: 2 }}>
                    {weatherIcon(weather.description)} {weather.description}
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      sev {weather.severity?.toFixed(1)}/10
                    </span>
                  </div>
                )}
                {cityShipment && (
                  <div style={{ fontSize: 12, marginTop: 4, padding: '2px 6px', background: riskColor + '33', borderRadius: 4, color: riskColor, display: 'inline-block' }}>
                    {cityShipment.id} ·{' '}
                    {cityShipment.delay_probability != null
                      ? `${(cityShipment.delay_probability * 100).toFixed(0)}% risk`
                      : 'risk N/A'}
                  </div>
                )}
              </div>
            </Tooltip>

            {cityShipment && (
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>{city}</div>
                  <div style={{ marginBottom: 4 }}>🚛 <strong>{cityShipment.id}</strong></div>
                  <div style={{ color: '#555', marginBottom: 2 }}>
                    {cityShipment.origin} → {cityShipment.destination}
                  </div>
                  <div style={{ color: '#555', marginBottom: 4 }}>
                    📦 {cityShipment.cargo} · {cityShipment.weight_kg?.toLocaleString()} kg
                  </div>
                  <div style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: riskColor + '22', color: riskColor, fontWeight: 700, fontSize: 12,
                  }}>
                    {cityShipment.risk_level?.toUpperCase() || 'LOW'} RISK ·{' '}
                    {cityShipment.delay_probability != null
                      ? `${(cityShipment.delay_probability * 100).toFixed(0)}%`
                      : 'N/A'}
                  </div>
                  {weather && (
                    <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>
                      {weatherIcon(weather.description)} {weather.description}
                    </div>
                  )}
                </div>
              </Popup>
            )}
          </CircleMarker>
        );
      })}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 24, right: 12,
          zIndex: 1000,
          background: 'rgba(13,20,33,0.92)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 11,
          color: '#cdd5e0',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          minWidth: 148,
        }}
      >
        {routeData ? (
          <>
            <div style={{ marginBottom: 6, fontWeight: 700, fontSize: 12 }}>Route Legend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 20, height: 2, borderTop: '2px dashed #3b82f6' }} />
              Original Route
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 3, background: routeData.is_same_route ? '#3b82f6' : '#10b981', borderRadius: 2 }} />
              {routeData.is_same_route ? 'Same Route' : 'Dijkstra Optimized'}
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 6, fontWeight: 700, fontSize: 12 }}>Map Legend</div>

            {/* Risk marker dots */}
            {[['low', '#10b981', 'Low Risk'], ['medium', '#f59e0b', 'Medium Risk'], ['high', '#ef4444', 'High Risk']].map(([, color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {label}
              </div>
            ))}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0' }} />

            {/* Route lines */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width={20} height={8}>
                <line x1={0} y1={4} x2={20} y2={4} stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" />
              </svg>
              Active Route
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={20} height={8}>
                <line x1={0} y1={4} x2={20} y2={4} stroke="#f97316" strokeWidth={2} strokeDasharray="3 6" />
              </svg>
              Alt Demo Path
            </div>
          </>
        )}
      </div>
    </MapContainer>
  );
}
