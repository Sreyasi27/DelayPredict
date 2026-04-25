/**
 * RiskIndicator — displays delay probability as a color-coded badge + progress bar.
 */
export default function RiskIndicator({ probability, riskLevel, reasons = [], compact = false }) {
  const pct = Math.round((probability ?? 0) * 100);
  const level = riskLevel || (pct < 35 ? 'low' : pct < 65 ? 'medium' : 'high');

  const labels = { low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk' };
  const icons  = { low: '✓', medium: '⚠', high: '⛔' };

  if (compact) {
    return (
      <span className={`risk-badge ${level}`}>
        {icons[level]} {labels[level]}
      </span>
    );
  }

  return (
    <div className="card animate-fade" style={{ padding: '1rem' }}>
      <div className="card-header">
        <span className="card-title">Delay Risk Assessment</span>
        <span className={`risk-badge ${level}`}>{icons[level]} {labels[level]}</span>
      </div>

      {/* Probability bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Delay Probability</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${level}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Factors</p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {reasons.map((r, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                <span style={{ color: level === 'high' ? 'var(--risk-high)' : level === 'medium' ? 'var(--risk-medium)' : 'var(--risk-low)', fontSize: '0.7rem' }}>●</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
