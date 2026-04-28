import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipments } from '../hooks/useShipments';
import { simulateShipments, getWeather, markDelivered } from '../services/api';
import MapView from '../components/MapView';
import ShipmentCard from '../components/ShipmentCard';
import AnalyticsPanel from '../components/AnalyticsPanel';
import { AIAnalyzeForm } from '../components/AIPanel';

const WEATHER_BG = (sev) => {
  if (sev >= 7) return 'rgba(239,68,68,0.12)';
  if (sev >= 4) return 'rgba(245,158,11,0.12)';
  return 'rgba(16,185,129,0.12)';
};
const WEATHER_COLOR = (sev) => {
  if (sev >= 7) return '#ef4444';
  if (sev >= 4) return '#f59e0b';
  return '#10b981';
};

export default function Dashboard() {
  const { shipments, loading, error, refetch } = useShipments();
  const [localShipments, setLocalShipments] = useState(null); // optimistic overrides
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simToast, setSimToast] = useState(null);   // success/error message
  const [weatherData, setWeatherData] = useState({});
  const [weatherLoading, setWeatherLoading] = useState(true);
  const navigate = useNavigate();

  /* Fetch weather on mount and every 60s */
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await getWeather();
        setWeatherData(data || {});
      } catch {
        /* silently fail — map still works */
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 60_000);
    return () => clearInterval(interval);
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    setSimToast({ msg, type });
    setTimeout(() => setSimToast(null), 3500);
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    setSelectedShipment(null);
    setLocalShipments(null); // clear overrides on new simulation
    try {
      const result = await simulateShipments();
      // Immediately refresh the shipment list — don't wait for next poll
      await refetch();
      showToast(`✅ ${result?.message || '5 shipments created'} — simulation running!`);
    } catch (err) {
      showToast(`⛔ Simulation failed: ${err.message}`, 'error');
    } finally {
      setSimulating(false);
    }
  };

  // Clicking a card selects it on the map; double-click / View button navigates
  const handleCardClick = (s) => { setSelectedShipment(s); };

  const handleSelectShipment = (s) => setSelectedShipment(s);
  const handleViewDetail     = (s) => navigate(`/shipment/${s.id}`);

  // ── Mark Delivered (optimistic + backend) ───────────────────────────────
  const handleMarkDelivered = async (shipmentId) => {
    // Optimistically update local state immediately so charts + counter reflect it
    setLocalShipments((prev) => {
      const base = prev ?? shipments;
      return base.map((s) =>
        s.id === shipmentId
          ? { ...s, status: 'delivered', route_index: (s.route?.length ?? 1) - 1, current_location: s.destination }
          : s
      );
    });
    try {
      await markDelivered(shipmentId);
      await refetch(); // sync with backend
      setLocalShipments(null); // drop overrides once backend is in sync
    } catch (err) {
      showToast(`⛔ Could not mark delivered: ${err.message}`, 'error');
      setLocalShipments(null); // revert
    }
  };

  // Use locally overridden list when available (optimistic updates)
  const displayShipments = localShipments ?? shipments;

  const total     = displayShipments.length;
  const atRisk    = displayShipments.filter((s) => s.risk_level === 'high' || s.status === 'at_risk').length;
  const delivered = displayShipments.filter((s) => s.status === 'delivered').length;
  const avgRisk   = total > 0
    ? Math.round(displayShipments.reduce((a, s) => a + (s.delay_probability || 0), 0) / total * 100)
    : 0;

  const weatherEntries = Object.entries(weatherData);

  return (
    <div className="page-content">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ background: 'linear-gradient(135deg, #f0f4ff, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Supply Chain Command
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Real-time disruption prediction · AI-powered rerouting · Live weather
          </p>
        </div>
        <button
          id="btn-simulate"
          className="btn btn-primary"
          onClick={handleSimulate}
          disabled={simulating}
          style={{ position: 'relative', minWidth: 160 }}
        >
          {simulating
            ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Simulating…</>
            : '⚡ New Simulation'}
        </button>
      </div>

      {/* ── Toast notification ──────────────────────────────────────────────── */}
      {simToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: simToast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
          border: `1px solid ${simToast.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
          color: simToast.type === 'error' ? '#ef4444' : '#10b981',
          borderRadius: 'var(--radius-lg)',
          padding: '0.75rem 1.25rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.3s ease',
          maxWidth: 380,
        }}>
          {simToast.msg}
        </div>
      )}

      {/* ── Stat strip ───────────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <StatCard value={total} label="Total Shipments" accent="var(--accent-blue)" icon="📦" />
        <StatCard value={atRisk} label="High Risk" accent="var(--risk-high)" icon="⛔" />
        <StatCard value={delivered} label="Delivered" accent="var(--accent-green)" icon="✅" />
        <StatCard value={`${avgRisk}%`} label="Avg Delay Risk" accent={avgRisk > 65 ? 'var(--risk-high)' : avgRisk > 35 ? 'var(--risk-medium)' : 'var(--risk-low)'} icon="🧠" />
      </div>

      {/* ── Weather strip ─────────────────────────────────────────────── */}
      {!weatherLoading && weatherEntries.length > 0 && (
        <div style={{
          marginBottom: '1.25rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.75rem 1rem',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
            🌤 Live City Weather
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {weatherEntries.map(([city, w]) => (
              <div
                key={city}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: WEATHER_BG(w.severity),
                  border: `1px solid ${WEATHER_COLOR(w.severity)}44`,
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{w.icon || '🌡️'}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{city}</span>
                <span style={{ color: WEATHER_COLOR(w.severity), fontWeight: 600 }}>
                  {w.description}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  {w.severity?.toFixed(1)}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main grid ──────────────────────────────────────────────────── */}
      <div className="dashboard-grid">
        {/* Left — map */}
        <div className="dashboard-left">
          <div className="map-container" style={{ flex: '1 1 0' }}>
            <MapView
              shipments={displayShipments}
              selectedId={selectedShipment?.id}
              onSelectShipment={handleSelectShipment}
              weatherData={weatherData}
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
            {!loading && displayShipments.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No shipments — click <strong>⚡ New Simulation</strong>
              </p>
            )}
            <div className="shipment-list">
              {displayShipments.map((s) => (
                <ShipmentCard
                  key={s.id}
                  shipment={s}
                  selected={selectedShipment?.id === s.id}
                  onClick={() => handleCardClick(s)}
                  onViewDetail={() => handleViewDetail(s)}
                  onMarkDelivered={handleMarkDelivered}
                />
              ))}
            </div>
          </div>

          {/* Analytics */}
          <AnalyticsPanel shipments={displayShipments} />

          {/* AI Intelligence Panel */}
          <AIPipelineSection />
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

function AIPipelineSection() {
  const [open, setOpen] = useState(true);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          width:          '100%',
          background:     'transparent',
          border:         'none',
          cursor:         'pointer',
          padding:        0,
          marginBottom:   open ? '1rem' : 0,
        }}
      >
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background:   'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 8,
            padding:      '3px 8px',
            fontSize:     11,
            fontWeight:   700,
            color:        '#fff',
            letterSpacing: 0.5,
          }}>AI</span>
          Hybrid Intelligence Pipeline
        </span>
        <span style={{
          color:      'var(--text-secondary)',
          fontSize:   18,
          transition: 'transform 0.25s',
          transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </button>

      {/* Expandable body */}
      {open && <AIAnalyzeForm />}
    </div>
  );
}

