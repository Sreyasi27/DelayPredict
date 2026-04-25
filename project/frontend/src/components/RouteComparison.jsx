/**
 * RouteComparison — side-by-side original vs optimized route panel.
 */
export default function RouteComparison({ data, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="loading-overlay"><div className="spinner" /><span>Optimizing route…</span></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
        <p>Click <strong>Optimize Route</strong> to compare routes</p>
      </div>
    );
  }

  const { original_route, optimized_route, original_hours, optimized_hours,
    time_saved_minutes, original_distance_km, optimized_distance_km, is_same_route } = data;

  return (
    <div className="card animate-fade">
      <div className="card-header">
        <span className="card-title">Route Comparison</span>
        {!is_same_route && time_saved_minutes > 0 && (
          <span className="risk-badge low">🚀 {time_saved_minutes} min saved</span>
        )}
        {is_same_route && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Optimal route unchanged</span>
        )}
      </div>

      <div className="route-comparison">
        {/* Original route */}
        <div className="route-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Original</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{original_hours.toFixed(1)}h · {original_distance_km} km</span>
          </div>
          <RouteSteps steps={original_route} color="var(--accent-blue)" />
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-green)', fontSize: '1.4rem', paddingTop: '1.5rem' }}>→</div>

        {/* Optimized route */}
        <div className={`route-panel ${!is_same_route ? 'optimized' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: is_same_route ? 'var(--text-secondary)' : 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {is_same_route ? 'Same Route' : 'Optimized ✓'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{optimized_hours.toFixed(1)}h · {optimized_distance_km} km</span>
          </div>
          <RouteSteps steps={optimized_route} color={is_same_route ? 'var(--accent-blue)' : 'var(--accent-green)'} />
        </div>
      </div>

      {/* Summary row */}
      {!is_same_route && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          <Metric label="Time Saved" value={`${time_saved_minutes} min`} positive />
          <Metric label="Distance Δ" value={`${(optimized_distance_km - original_distance_km).toFixed(0)} km`} />
          <Metric label="Efficiency" value={`${((1 - optimized_hours / original_hours) * 100).toFixed(1)}%`} positive />
        </div>
      )}
    </div>
  );
}

function RouteSteps({ steps, color }) {
  return (
    <div className="route-steps">
      {steps.map((city, i) => (
        <div key={i}>
          <div className="route-step">
            <div className="route-step-dot" style={{ background: i === 0 || i === steps.length - 1 ? color : 'var(--border-accent)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: i === 0 || i === steps.length - 1 ? 600 : 400, color: i === 0 || i === steps.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {city}
            </span>
          </div>
          {i < steps.length - 1 && <div className="route-step-line" />}
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, positive }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: positive ? 'var(--accent-green)' : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{label}</div>
    </div>
  );
}
