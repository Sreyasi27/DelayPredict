import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';

const RISK_COLORS = {
  low:    '#10b981',
  medium: '#f59e0b',
  high:   '#ef4444',
};

const STATUS_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

// ── Pure-CSS bar chart — renders correctly regardless of container type ──────
function CSSBarChart({ data }) {
  const BAR_H = 110; // px — total drawable height for bars

  return (
    <div style={{ width: '100%' }}>
      {/* Bar area */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        height: BAR_H,
        padding: '0 4px',
      }}>
        {data.map((entry, i) => {
          const pct = Math.max(entry.risk, 0);           // 0–100
          const barH = pct === 0
            ? 4                                           // minimum 4px so bar is always visible
            : Math.round((pct / 100) * BAR_H);

          return (
            <div
              key={i}
              title={`${entry.name}: ${pct}% risk`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                gap: 4,
                cursor: 'default',
              }}
            >
              {/* Risk % label above bar */}
              <span style={{
                fontSize: 10,
                color: pct === 0 ? 'var(--text-muted)' : entry.fill,
                fontWeight: 600,
                lineHeight: 1,
                opacity: pct === 0 ? 0.5 : 1,
              }}>
                {pct}%
              </span>

              {/* The bar itself */}
              <div
                style={{
                  width: '100%',
                  height: barH,
                  background: pct === 0
                    ? 'rgba(136,153,187,0.25)'          // grey ghost bar for 0%
                    : `linear-gradient(to top, ${entry.fill}dd, ${entry.fill}88)`,
                  borderRadius: '4px 4px 0 0',
                  boxShadow: pct > 0 ? `0 0 8px ${entry.fill}55` : 'none',
                  transition: 'height 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis divider */}
      <div style={{
        height: 1,
        background: 'rgba(136,153,187,0.15)',
        margin: '0 4px',
      }} />

      {/* X-axis labels */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '4px 4px 0',
      }}>
        {data.map((entry, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 10,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entry.name.length > 6 ? entry.name.slice(0, 6) : entry.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPanel({ shipments }) {
  if (!shipments || shipments.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
        <div style={{ fontSize: '2rem' }}>📊</div>
        <p style={{ marginTop: '0.5rem' }}>No shipment data yet</p>
      </div>
    );
  }

  // Bar chart data — risk per shipment
  const barData = shipments.map((s) => ({
    name: s.id.replace('SHP-', ''),
    risk: Math.round((s.delay_probability || 0) * 100),
    fill: RISK_COLORS[s.risk_level || 'low'],
  }));

  // Pie chart — status distribution
  const statusCounts = shipments.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Risk bar chart (CSS-based, always visible) ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Delay Risk per Shipment</span>
        </div>
        <CSSBarChart data={barData} />
      </div>

      {/* ── Status pie (Recharts) ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Status Distribution</span>
        </div>
        <div style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={3}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12, color: '#f0f4ff' }}
                labelStyle={{ color: '#8899bb' }}
                itemStyle={{ color: '#f0f4ff' }}
              />
              <Legend
                wrapperStyle={{ color: '#f0f4ff' }}
                formatter={(v) => <span style={{ color: '#f0f4ff', fontSize: 11 }}>{v.replace(/_/g, ' ')}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
