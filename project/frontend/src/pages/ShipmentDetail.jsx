import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getShipment, optimizeRoute, getWeather } from '../services/api';
import { subscribeToShipment, firebaseAvailable } from '../services/firebase';
import { useRisk } from '../hooks/useRisk';
import RiskIndicator from '../components/RiskIndicator';
import RouteComparison from '../components/RouteComparison';
import MapView from '../components/MapView';

const WEATHER_COLOR = (sev) => {
  if (sev >= 7) return '#ef4444';
  if (sev >= 4) return '#f59e0b';
  return '#10b981';
};

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loadingShipment, setLoadingShipment] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [weatherData, setWeatherData] = useState({});

  const { risk, loading: riskLoading, refresh: refreshRisk } = useRisk(id);

  // ── Load & subscribe to shipment ────────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    let pollInterval = null;

    const fetchOnce = () =>
      getShipment(id)
        .then((data) => { setShipment(data); setLoadingShipment(false); })
        .catch(() => setLoadingShipment(false));

    fetchOnce();

    if (firebaseAvailable) {
      // Real-time Firestore listener
      unsub = subscribeToShipment(id, (data) => setShipment(data));
    } else {
      // REST polling every 10s as fallback
      pollInterval = setInterval(fetchOnce, 10_000);
    }

    return () => { unsub(); if (pollInterval) clearInterval(pollInterval); };
  }, [id]);

  // ── Fetch weather ───────────────────────────────────────────────────
  useEffect(() => {
    getWeather()
      .then((data) => setWeatherData(data || {}))
      .catch(() => {});
  }, []);

  // ── Optimize route (Dijkstra) ────────────────────────────────────────
  const handleOptimize = async () => {
    if (!shipment) return;
    setOptimizing(true);
    setRouteData(null);
    try {
      const result = await optimizeRoute({
        shipment_id: id,
        origin: shipment.current_location || shipment.origin,
        destination: shipment.destination,
      });
      setRouteData(result);
      refreshRisk();
    } catch (err) {
      alert(`Optimization failed: ${err.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  if (loadingShipment) {
    return (
      <div className="page-content">
        <div className="loading-overlay" style={{ height: '60vh' }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <span>Loading shipment…</span>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="page-content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '3rem' }}>📭</div>
        <h2 style={{ marginTop: '1rem' }}>Shipment not found</h2>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>← Back to Dashboard</button>
      </div>
    );
  }

  const progress = shipment.route && shipment.route.length > 1
    ? Math.round((shipment.route_index / (shipment.route.length - 1)) * 100)
    : 0;

  const currentWeather = weatherData[shipment.current_location];

  return (
    <div className="page-content animate-fade">
      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>← Dashboard</button>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{id}</span>
      </div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>{shipment.origin} → {shipment.destination}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
            <span className="mono" style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{id}</span>
            <span className={`status-badge ${shipment.status}`}>{shipment.status?.replace('_', ' ')}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{shipment.cargo} · {shipment.weight_kg?.toLocaleString()} kg</span>
          </div>
        </div>
        <button
          id="btn-optimize"
          className="btn btn-primary"
          onClick={handleOptimize}
          disabled={optimizing || shipment.status === 'delivered'}
        >
          {optimizing ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Optimizing…</> : '🔀 Optimize Route (Dijkstra)'}
        </button>
      </div>

      {/* ── Dijkstra info banner ─────────────────────────────────────── */}
      {routeData && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.6rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: routeData.is_same_route ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${routeData.is_same_route ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.1rem' }}>{routeData.is_same_route ? '✅' : '🚀'}</span>
          <div>
            {routeData.is_same_route
              ? 'Dijkstra confirmed: current route is already optimal given live conditions.'
              : `Dijkstra found a faster route — saving ${routeData.time_saved_minutes} min. Blue dashed = original · Green = optimized.`}
          </div>
        </div>
      )}

      {/* ── Main detail grid ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Map — shows Dijkstra routes when routeData is available */}
        <div className="map-container" style={{ minHeight: 360 }}>
          <MapView
            shipments={[shipment]}
            selectedId={id}
            weatherData={weatherData}
            routeData={routeData}
          />
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Current location + weather */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.75rem' }}>Shipment Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <InfoRow icon="📍" label="Current Location" value={shipment.current_location} />
              <InfoRow icon="🏁" label="Destination" value={shipment.destination} />
              <InfoRow icon="📏" label="Total Distance" value={`${shipment.distance_km} km`} />
              <InfoRow icon="⏱" label="Est. Duration" value={`${shipment.estimated_hours} hrs`} />
              <InfoRow icon="📅" label="Created" value={new Date(shipment.created_at).toLocaleString()} />
            </div>

            {/* Live weather at current city */}
            {currentWeather && (
              <div style={{
                marginTop: '1rem',
                padding: '0.6rem 0.75rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${WEATHER_COLOR(currentWeather.severity)}44`,
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Weather at {shipment.current_location}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{currentWeather.icon || '🌡️'}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: WEATHER_COLOR(currentWeather.severity), fontSize: '0.9rem' }}>
                      {currentWeather.description}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Severity: {currentWeather.severity?.toFixed(1)} / 10
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                <span>{shipment.origin}</span>
                <span>{progress}%</span>
                <span>{shipment.destination}</span>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${shipment.risk_level || 'low'}`} style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* Route waypoints */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.75rem' }}>Route Waypoints</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {(shipment.route || []).map((city, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === shipment.route_index ? 'var(--accent-blue)' : i < shipment.route_index ? 'var(--accent-green)' : 'var(--text-muted)',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: '0.85rem',
                    color: i === shipment.route_index ? 'var(--text-primary)' : i < shipment.route_index ? 'var(--accent-green)' : 'var(--text-muted)',
                    fontWeight: i === shipment.route_index ? 600 : 400,
                  }}>
                    {city} {i === shipment.route_index && '← current'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Risk + Route comparison ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <div>
          {riskLoading && !risk && (
            <div className="card"><div className="loading-overlay"><div className="spinner" /><span>Analysing risk…</span></div></div>
          )}
          {risk && (
            <RiskIndicator
              probability={risk.delay_probability}
              riskLevel={risk.risk_level}
              reasons={risk.reasons}
            />
          )}
          {!risk && !riskLoading && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Risk analysis loading…
            </div>
          )}
        </div>
        <RouteComparison data={routeData} loading={optimizing} />
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{icon} {label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
