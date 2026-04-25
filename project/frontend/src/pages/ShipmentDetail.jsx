import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getShipment, optimizeRoute } from '../services/api';
import { subscribeToShipment } from '../services/firebase';
import { useRisk } from '../hooks/useRisk';
import RiskIndicator from '../components/RiskIndicator';
import RouteComparison from '../components/RouteComparison';
import MapView from '../components/MapView';

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loadingShipment, setLoadingShipment] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [optimizing, setOptimizing] = useState(false);

  const { risk, loading: riskLoading, refresh: refreshRisk } = useRisk(id);

  // ── Load & subscribe to shipment ────────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    getShipment(id)
      .then((data) => { setShipment(data); setLoadingShipment(false); })
      .catch(() => setLoadingShipment(false));

    unsub = subscribeToShipment(id, (data) => setShipment(data));
    return () => unsub();
  }, [id]);

  // ── Optimize route ───────────────────────────────────────────────────
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
          {optimizing ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Optimizing…</> : '🔀 Optimize Route'}
        </button>
      </div>

      {/* ── Main detail grid ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Map */}
        <div className="map-container" style={{ minHeight: 320 }}>
          <MapView shipments={[shipment]} selectedId={id} />
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Current location */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.75rem' }}>Shipment Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <InfoRow icon="📍" label="Current Location" value={shipment.current_location} />
              <InfoRow icon="🏁" label="Destination" value={shipment.destination} />
              <InfoRow icon="📏" label="Total Distance" value={`${shipment.distance_km} km`} />
              <InfoRow icon="⏱" label="Est. Duration" value={`${shipment.estimated_hours} hrs`} />
              <InfoRow icon="📅" label="Created" value={new Date(shipment.created_at).toLocaleString()} />
            </div>

            {/* Progress */}
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
