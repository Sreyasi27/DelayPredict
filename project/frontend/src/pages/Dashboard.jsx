import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipments } from '../hooks/useShipments';
import { simulateShipments } from '../services/api';
import MapView from '../components/MapView';
import ShipmentCard from '../components/ShipmentCard';
import AnalyticsPanel from '../components/AnalyticsPanel';

export default function Dashboard() {
  const { shipments, loading, error } = useShipments();
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const navigate = useNavigate();

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await simulateShipments();
      setSelectedShipment(null);
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleSelectShipment = (s) => setSelectedShipment(s);

  const total = shipments.length;
  const atRisk = shipments.filter((s) => s.risk_level === 'high' || s.status === 'at_risk').length;
  const delivered = shipments.filter((s) => s.status === 'delivered').length;
  const avgRisk = total > 0
    ? Math.round(shipments.reduce((a, s) => a + (s.delay_probability || 0), 0) / total * 100)
    : 0;

  return (
    <div className="page-content">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ background: 'linear-gradient(135deg, #f0f4ff, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Supply Chain Command
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Real-time disruption prediction · AI-powered rerouting
          </p>
        </div>
        <button
          id="btn-simulate"
          className="btn btn-primary"
          onClick={handleSimulate}
          disabled={simulating}
        >
          {simulating ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Simulating…</> : '⚡ New Simulation'}
        </button>
      </div>

      {/* ── Stat strip ────────────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        <StatCard value={total} label="Total Shipments" accent="var(--accent-blue)" icon="📦" />
        <StatCard value={atRisk} label="High Risk" accent="var(--risk-high)" icon="⛔" />
        <StatCard value={delivered} label="Delivered" accent="var(--accent-green)" icon="✅" />
        <StatCard value={`${avgRisk}%`} label="Avg Delay Risk" accent={avgRisk > 65 ? 'var(--risk-high)' : avgRisk > 35 ? 'var(--risk-medium)' : 'var(--risk-low)'} icon="🧠" />
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="dashboard-grid">
        {/* Left — map + shipment list */}
        <div className="dashboard-left">
          <div className="map-container" style={{ flex: '1 1 0' }}>
            <MapView
              shipments={shipments}
              selectedId={selectedShipment?.id}
              onSelectShipment={handleSelectShipment}
            />
          </div>
        </div>

        {/* Right — cards + analytics */}
        <div className="dashboard-right">
          {/* Shipment list */}
          <div className="card" style={{ flex: 'none' }}>
            <div className="card-header">
              <span className="card-title">Live Shipments</span>
              {loading && <div className="spinner" style={{ width: 16, height: 16 }} />}
            </div>
            {error && <p style={{ color: 'var(--risk-high)', fontSize: '0.85rem', padding: '0.5rem 0' }}>⚠ {error}</p>}
            {!loading && shipments.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No shipments — click <strong>⚡ New Simulation</strong>
              </p>
            )}
            <div className="shipment-list">
              {shipments.map((s) => (
                <ShipmentCard
                  key={s.id}
                  shipment={s}
                  selected={selectedShipment?.id === s.id}
                  onClick={() => navigate(`/shipment/${s.id}`)}
                />
              ))}
            </div>
          </div>

          {/* Analytics */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Analytics</span>
            </div>
            <AnalyticsPanel shipments={shipments} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, accent, icon }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-value" style={{ color: accent }}>{value}</div>
          <div className="stat-label">{label}</div>
        </div>
        <span style={{ fontSize: '1.5rem', opacity: 0.6 }}>{icon}</span>
      </div>
    </div>
  );
}
