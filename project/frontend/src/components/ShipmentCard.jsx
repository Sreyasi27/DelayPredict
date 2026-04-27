import RiskIndicator from './RiskIndicator';

const CARGO_ICONS = {
  Electronics: '💻', Pharmaceuticals: '💊', 'Automotive Parts': '🔧',
  Textiles: '🧵', 'Food & Beverage': '🍱', 'Industrial Machinery': '⚙️',
  'Consumer Goods': '📦', 'Chemical Supplies': '🧪',
};

const STATUS_COLORS = {
  in_transit: '#3b82f6',
  at_risk: '#f59e0b',
  delivered: '#10b981',
  delayed: '#ef4444',
};

export default function ShipmentCard({ shipment, selected, onClick, onViewDetail }) {
  const { id, origin, destination, current_location, status, cargo,
    weight_kg, distance_km, delay_probability, risk_level, route, route_index } = shipment;

  const progress = route && route.length > 1 ? Math.round((route_index / (route.length - 1)) * 100) : 0;
  const icon = CARGO_ICONS[cargo] || '📦';
  const statusColor = STATUS_COLORS[status] || 'var(--text-muted)';

  return (
    <div
      id={`shipment-card-${id}`}
      className={`shipment-card risk-${risk_level || 'low'} ${selected ? 'selected' : ''} animate-slide`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
            <span className="shipment-id">{id}</span>
            <span
              className={`status-badge ${status}`}
              style={{ borderColor: `${statusColor}44`, color: statusColor }}
            >
              {status?.replace('_', ' ')}
            </span>
          </div>
          <div className="shipment-route">
            {icon} {origin} → {destination}
          </div>
          <div className="shipment-meta">
            📍 {current_location} &nbsp;·&nbsp; {distance_km} km &nbsp;·&nbsp; {weight_kg?.toLocaleString()} kg
          </div>
        </div>
        {delay_probability != null && (
          <RiskIndicator
            probability={delay_probability}
            riskLevel={risk_level}
            compact
          />
        )}
      </div>

      {/* Route progress bar */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          <span>{origin}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{progress}% complete</span>
          <span>{destination}</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${risk_level || 'low'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* View Details button */}
      <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          id={`btn-detail-${id}`}
          className="btn btn-ghost"
          style={{
            fontSize: '0.78rem',
            padding: '3px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-cyan)',
            background: 'rgba(6,182,212,0.06)',
          }}
          onClick={(e) => {
            e.stopPropagation(); // don't trigger card select
            onViewDetail?.();
          }}
        >
          View Details →
        </button>
      </div>
    </div>
  );
}
