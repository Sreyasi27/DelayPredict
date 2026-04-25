import { useCallback, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0d1421' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8899bb' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1421' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1a2332' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e2d45' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080c14' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const CENTER = { lat: 21.0, lng: 78.0 }; // Centre of India

const CITY_COORDS = {
  Delhi:     { lat: 28.6139, lng: 77.2090 },
  Mumbai:    { lat: 19.0760, lng: 72.8777 },
  Kolkata:   { lat: 22.5726, lng: 88.3639 },
  Chennai:   { lat: 13.0827, lng: 80.2707 },
  Hyderabad: { lat: 17.3850, lng: 78.4867 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Pune:      { lat: 18.5204, lng: 73.8567 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Jaipur:    { lat: 26.9124, lng: 75.7873 },
  Lucknow:   { lat: 26.8467, lng: 80.9462 },
};

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

function markerIcon(riskLevel) {
  const color = RISK_COLORS[riskLevel || 'low'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="10" fill="${color}" opacity="0.25"/>
    <circle cx="16" cy="16" r="6" fill="${color}"/>
    <circle cx="16" cy="16" r="3" fill="white"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  };
}

export default function MapView({ shipments, selectedId, onSelectShipment }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [activeInfo, setActiveInfo] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    id: 'supply-chain-map',
  });

  const onMapLoad = useCallback(() => {}, []);

  if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
    return <MapPlaceholder shipments={shipments} selectedId={selectedId} onSelect={onSelectShipment} />;
  }

  if (loadError) {
    return <MapPlaceholder shipments={shipments} selectedId={selectedId} onSelect={onSelectShipment} error="Google Maps failed to load" />;
  }

  if (!isLoaded) {
    return (
      <div className="map-placeholder">
        <div className="spinner" style={{ width: 36, height: 36 }} />
        <span>Loading map…</span>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={CENTER}
      zoom={5}
      options={{ styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true, mapTypeControl: false, streetViewControl: false }}
      onLoad={onMapLoad}
    >
      {shipments.map((s) => {
        const coords = CITY_COORDS[s.current_location];
        if (!coords) return null;
        return (
          <Marker
            key={s.id}
            position={coords}
            icon={markerIcon(s.risk_level)}
            onClick={() => { setActiveInfo(s.id); onSelectShipment?.(s); }}
          >
            {activeInfo === s.id && (
              <InfoWindow onCloseClick={() => setActiveInfo(null)}>
                <div style={{ color: '#111', fontSize: 13, minWidth: 160 }}>
                  <strong>{s.id}</strong>
                  <div style={{ marginTop: 4 }}>{s.origin} → {s.destination}</div>
                  <div style={{ color: '#555' }}>📍 {s.current_location}</div>
                  <div style={{ marginTop: 4 }}>
                    Risk: <strong style={{ color: RISK_COLORS[s.risk_level || 'low'] }}>
                      {Math.round((s.delay_probability || 0) * 100)}%
                    </strong>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Marker>
        );
      })}

      {/* Draw route polylines */}
      {shipments.map((s) => {
        if (!s.route) return null;
        const path = s.route
          .map((city) => CITY_COORDS[city])
          .filter(Boolean);
        return (
          <Polyline
            key={`route-${s.id}`}
            path={path}
            options={{
              strokeColor: RISK_COLORS[s.risk_level || 'low'],
              strokeOpacity: s.id === selectedId ? 0.9 : 0.3,
              strokeWeight: s.id === selectedId ? 3 : 1.5,
            }}
          />
        );
      })}
    </GoogleMap>
  );
}

/* ── Fallback map (no API key) ─────────────────────────────────────────── */
function MapPlaceholder({ shipments, selectedId, onSelect, error }) {
  const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

  // Simple SVG-based map of India (rough positions)
  const viewBox = { minLat: 8, maxLat: 35, minLng: 68, maxLng: 97 };
  const toSVG = (lat, lng) => ({
    x: ((lng - viewBox.minLng) / (viewBox.maxLng - viewBox.minLng)) * 700,
    y: ((viewBox.maxLat - lat) / (viewBox.maxLat - viewBox.minLat)) * 480,
  });

  const cityDots = Object.entries(CITY_COORDS).map(([name, { lat, lng }]) => ({
    name, ...toSVG(lat, lng),
  }));

  return (
    <div style={{ height: '100%', minHeight: 400, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden' }}>
      {/* Header note */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'rgba(8,12,20,0.9)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
        {error ? `⚠️ ${error}` : '🗺️ Add VITE_GOOGLE_MAPS_API_KEY to .env for interactive map'}
      </div>

      {/* SVG mock map */}
      <svg viewBox="0 0 700 480" width="100%" height="100%" style={{ opacity: 0.9 }}>
        {/* Route lines */}
        {shipments.map((s) => {
          if (!s.route || s.route.length < 2) return null;
          const color = RISK_COLORS[s.risk_level || 'low'];
          return s.route.slice(0, -1).map((city, i) => {
            const a = CITY_COORDS[city] ? toSVG(CITY_COORDS[city].lat, CITY_COORDS[city].lng) : null;
            const b = CITY_COORDS[s.route[i + 1]] ? toSVG(CITY_COORDS[s.route[i + 1]].lat, CITY_COORDS[s.route[i + 1]].lng) : null;
            if (!a || !b) return null;
            return <line key={`${s.id}-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={s.id === selectedId ? 2.5 : 1.2} strokeOpacity={s.id === selectedId ? 0.9 : 0.4} strokeDasharray={s.id === selectedId ? '' : '6,4'} />;
          });
        })}

        {/* City dots */}
        {cityDots.map(({ name, x, y }) => (
          <g key={name}>
            <circle cx={x} cy={y} r={5} fill="#1e2d45" stroke="#3b82f6" strokeWidth={1} />
            <text x={x + 8} y={y + 4} fontSize={9} fill="#8899bb">{name}</text>
          </g>
        ))}

        {/* Shipment markers */}
        {shipments.map((s) => {
          const coords = CITY_COORDS[s.current_location];
          if (!coords) return null;
          const { x, y } = toSVG(coords.lat, coords.lng);
          const color = RISK_COLORS[s.risk_level || 'low'];
          return (
            <g key={s.id} onClick={() => onSelect?.(s)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={10} fill={color} opacity={0.2} />
              <circle cx={x} cy={y} r={6} fill={color} />
              <circle cx={x} cy={y} r={3} fill="white" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
