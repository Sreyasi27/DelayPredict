import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const RISK_COLORS = {
  low:    '#10b981',
  medium: '#f59e0b',
  high:   '#ef4444',
};

const STATUS_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

export default function AnalyticsPanel({ shipments }) {
  if (!shipments || shipments.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
        <div style={{ fontSize: '2rem' }}>📊</div>
        <p style={{ marginTop: '0.5rem' }}>No shipment data yet</p>
      </div>
    );
  }

  // ── Derived stats ────────────────────────────────────────────────────
  const total = shipments.length;
  const delayed = shipments.filter((s) => s.status === 'delayed' || s.status === 'at_risk').length;
  const delivered = shipments.filter((s) => s.status === 'delivered').length;
  const avgRisk = shipments.reduce((sum, s) => sum + (s.delay_probability || 0), 0) / total;

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
      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <StatCard value={total} label="Total Shipments" color="var(--accent-blue)" />
        <StatCard value={delayed} label="At Risk / Delayed" color="var(--accent-amber)" />
        <StatCard value={`${Math.round(avgRisk * 100)}%`} label="Avg Delay Risk" color={avgRisk > 0.65 ? 'var(--risk-high)' : avgRisk > 0.35 ? 'var(--risk-medium)' : 'var(--risk-low)'} />
      </div>

      {/* Risk bar chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Delay Risk per Shipment</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={barData} barSize={28} margin={{ top: 4, right: 8, bottom: 4, left: -24 }}>
            <XAxis dataKey="name" tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`${v}%`, 'Risk']}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status pie */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Status Distribution</span>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={3}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
            />
            <Legend
              formatter={(v) => <span style={{ color: '#8899bb', fontSize: 11 }}>{v.replace('_', ' ')}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
