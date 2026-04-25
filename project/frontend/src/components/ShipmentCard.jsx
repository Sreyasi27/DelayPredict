import { useNavigate } from 'react-router-dom';
import RiskIndicator from './RiskIndicator';

const CARGO_ICONS = {
  Electronics: '💻', Pharmaceuticals: '💊', 'Automotive Parts': '🔧',
  Textiles: '🧵', 'Food & Beverage': '🍱', 'Industrial Machinery': '⚙️',
  'Consumer Goods': '📦', 'Chemical Supplies': '🧪',
};

export default function ShipmentCard({ shipment, selected, onClick }) {
  const { id, origin, destination, current_location, status, cargo,
    weight_kg, distance_km, delay_probability, risk_level, route, route_index } = shipment;

  const progress = route && route.length > 1 ? Math.round((route_index / (route.length - 1)) * 100) : 0;
  const icon = CARGO_ICONS[cargo] || '📦';

  return (
    <div
      id={`shipment-card-${id}`}
      className={`shipment-card risk-${risk_level || 'low'} ${selected ? 'selected' : ''} animate-slide`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span className="shipment-id">{id}</span>
            <span className={`status-badge ${status}`}>{status?.replace('_', ' ')}</span>
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
    </div>
  );
}
