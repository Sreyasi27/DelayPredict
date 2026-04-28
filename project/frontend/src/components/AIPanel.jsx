/**
 * AIPanel.jsx
 * ============
 * Hybrid Intelligence Decision Panel
 *
 * Accepts a `result` object from POST /analyze-shipment and renders:
 *   • Risk gauge + status badge
 *   • Gemini AI explanation
 *   • Weather snapshot
 *   • Decision action banner
 *   • Route comparison (original vs optimised) when rerouting occurs
 */

import { useState } from 'react';
import { analyzeShipment } from '../services/api';

// ── helpers ────────────────────────────────────────────────────────────────

const ACTION_META = {
  continue: { label: 'Safe to Continue', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '✅' },
  monitor:  { label: 'Monitor Closely',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⚠️' },
  reroute:  { label: 'Reroute Required', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '🔁' },
};

const riskColor = (pct) => {
  if (pct < 40) return '#22c55e';
  if (pct < 70) return '#f59e0b';
  return '#ef4444';
};

// ── sub-components ─────────────────────────────────────────────────────────

function RiskGauge({ percent }) {
  const color = riskColor(percent);
  const radius = 48;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
        <circle
          cx={60} cy={60} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
        <text x={60} y={56} textAnchor="middle" fill={color} fontSize={22} fontWeight={700}>{percent.toFixed(0)}%</text>
        <text x={60} y={74} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10}>Delay Risk</text>
      </svg>
    </div>
  );
}

function RoutePath({ cities, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 6 }}>
      {cities.map((city, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${color}44`,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 12,
            color: '#e2e8f0',
          }}>{city}</span>
          {i < cities.length - 1 && <span style={{ color, fontSize: 14 }}>→</span>}
        </span>
      ))}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

/**
 * Props:
 *   result  — the response from analyzeShipment() API call (or null)
 *   loading — boolean
 *   error   — string | null
 */
export function AIResultPanel({ result, loading, error }) {
  if (loading) {
    return (
      <div style={styles.card}>
        <div style={styles.spinner}>
          <div style={styles.spinnerRing} />
          <p style={{ color: '#94a3b8', marginTop: 12, fontSize: 14 }}>Running AI pipeline…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...styles.card, borderColor: '#ef4444' }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>⚠️ {error}</p>
      </div>
    );
  }

  if (!result) return null;

  const action = ACTION_META[result.action] || ACTION_META.monitor;

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🤖 AI Analysis — {result.shipment_id}</h3>
          <p style={styles.sub}>{result.input?.origin} → {result.input?.destination} · {result.input?.distance_km} km</p>
        </div>
        <span style={{ ...styles.badge, background: result.status === 'Delayed' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: result.status === 'Delayed' ? '#ef4444' : '#22c55e' }}>
          {result.status}
        </span>
      </div>

      {/* Risk + Action */}
      <div style={styles.row}>
        <RiskGauge percent={result.risk_percent} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Action Banner */}
          <div style={{ ...styles.actionBanner, background: action.bg, borderColor: action.color }}>
            <span style={{ fontSize: 20 }}>{action.icon}</span>
            <div>
              <p style={{ color: action.color, fontWeight: 700, fontSize: 14, margin: 0 }}>{action.label}</p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }}>{result.action_reason}</p>
            </div>
          </div>

          {/* Weather */}
          <div style={styles.weatherChip}>
            <span style={{ fontSize: 20 }}>{result.weather?.icon}</span>
            <span style={{ color: '#cbd5e1', fontSize: 13 }}>
              <strong style={{ color: '#e2e8f0' }}>{result.weather?.description}</strong>
              {' '}· Severity {result.weather?.severity?.toFixed(1)}/10 at {result.weather?.city}
            </span>
          </div>
        </div>
      </div>

      {/* Gemini Explanation */}
      <div style={styles.aiBox}>
        <p style={styles.aiLabel}>✨ Gemini AI Explanation</p>
        <p style={styles.aiText}>{result.ai_explanation}</p>
        <p style={{ ...styles.aiLabel, marginTop: 10 }}>📋 Recommended Action</p>
        <p style={styles.aiText}>{result.ai_recommendation}</p>
      </div>

      {/* Route Comparison */}
      {result.action === 'reroute' && result.original_route?.length > 0 && (
        <div style={styles.routeSection}>
          <p style={styles.routeTitle}>🗺️ Route Comparison</p>
          <div style={styles.routeRow}>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 4px' }}>ORIGINAL  ({result.original_hours?.toFixed(1)}h)</p>
              <RoutePath cities={result.original_route} color="#ef4444" />
            </div>
            <div style={styles.routeDivider} />
            <div style={{ flex: 1 }}>
              <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 4px' }}>
                OPTIMISED  ({result.optimized_hours?.toFixed(1)}h)
                {result.time_saved_minutes > 0 && (
                  <span style={{ color: '#22c55e', marginLeft: 6 }}>−{result.time_saved_minutes?.toFixed(0)} min</span>
                )}
              </p>
              <RoutePath cities={result.optimized_route} color="#22c55e" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * Standalone demo form — lets you fill in shipment details and hit "Analyse".
 * Drop this anywhere in your dashboard to test the pipeline interactively.
 */
export function AIAnalyzeForm() {
  const VALID_CITIES = [
    'Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Hyderabad',
    'Bengaluru', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
  ];

  const [form, setForm] = useState({
    shipment_id:    'SHP-DEMO',
    origin:         'Mumbai',
    destination:    'Delhi',
    distance:       1400,
    traffic_score:  7.5,
    weight:         1500,
    carrier_rating: 3.8,
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleClear = () => {
    setResult(null);
    setError(null);
  };

  const handleChange = (e) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [e.target.name]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyzeShipment(form);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Form */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <h3 style={{ ...styles.title, marginBottom: 12 }}>🚀 Analyse Shipment</h3>
        <div style={styles.formGrid}>
          {[
            { name: 'shipment_id',    label: 'Shipment ID',     type: 'text'   },
            { name: 'origin',         label: 'Origin City',     type: 'text',   placeholder: 'e.g. Mumbai' },
            { name: 'destination',    label: 'Destination',     type: 'text',   placeholder: 'e.g. Delhi' },
            { name: 'distance',       label: 'Distance (km)',   type: 'number' },
            { name: 'traffic_score',  label: 'Traffic (0–10)',  type: 'number', step: 0.1, min: 0, max: 10 },
            { name: 'weight',         label: 'Weight (kg)',     type: 'number' },
            { name: 'carrier_rating', label: 'Carrier Rating',  type: 'number', step: 0.1, min: 1, max: 5 },
          ].map(({ name, label, placeholder, ...rest }) => (
            <label key={name} style={styles.fieldLabel}>
              <span style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4, display: 'block' }}>{label.toUpperCase()}</span>
              <input
                name={name}
                value={form[name]}
                onChange={handleChange}
                required
                placeholder={placeholder || ''}
                style={styles.input}
                {...rest}
              />
            </label>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginBottom: 12 }}>
          💡 Valid cities: {VALID_CITIES.join(' · ')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading} style={{ ...styles.submitBtn, flex: 1, opacity: loading ? 0.65 : 1 }}>
            {loading ? '⏳ Analysing…' : '⚡ Run AI Pipeline'}
          </button>
          {(result || error) && (
            <button type="button" onClick={handleClear} style={{ ...styles.submitBtn, background: 'rgba(255,255,255,0.07)', flex: '0 0 auto', width: 'auto', padding: '10px 16px' }}>
              ✕ Clear
            </button>
          )}
        </div>
      </form>

      {/* Results */}
      <AIResultPanel result={result} loading={loading} error={error} />
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────

const styles = {
  card: {
    background:   'rgba(15, 23, 42, 0.85)',
    border:       '1px solid rgba(148, 163, 184, 0.12)',
    borderRadius: 16,
    padding:      '20px 24px',
    display:      'flex',
    flexDirection:'column',
    gap:          16,
    backdropFilter: 'blur(12px)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title:  { color: '#f1f5f9', fontWeight: 700, fontSize: 16, margin: 0 },
  sub:    { color: '#64748b', fontSize: 12, marginTop: 4 },
  badge:  { borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 },
  row:    { display: 'flex', gap: 20, alignItems: 'flex-start' },
  actionBanner: {
    display: 'flex', alignItems: 'center', gap: 12,
    border: '1px solid', borderRadius: 10, padding: '10px 14px',
  },
  weatherChip: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: '10px 14px',
  },
  aiBox: {
    background:   'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
    border:       '1px solid rgba(99,102,241,0.2)',
    borderRadius: 12,
    padding:      '14px 18px',
  },
  aiLabel: { color: '#818cf8', fontSize: 11, fontWeight: 600, letterSpacing: 1, margin: 0 },
  aiText:  { color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginTop: 6 },
  routeSection: {
    background:   'rgba(255,255,255,0.03)',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding:      '14px 18px',
  },
  routeTitle: { color: '#94a3b8', fontSize: 12, fontWeight: 600, margin: '0 0 10px' },
  routeRow:   { display: 'flex', gap: 16, flexWrap: 'wrap' },
  routeDivider: { width: 1, background: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' },
  form: {
    background:   'rgba(15, 23, 42, 0.85)',
    border:       '1px solid rgba(148,163,184,0.12)',
    borderRadius: 16,
    padding:      '20px 24px',
    backdropFilter: 'blur(12px)',
  },
  formGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap:                 12,
    marginBottom:        16,
  },
  fieldLabel: { display: 'flex', flexDirection: 'column' },
  input: {
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(148,163,184,0.15)',
    borderRadius: 8,
    color:        '#f1f5f9',
    padding:      '8px 12px',
    fontSize:     13,
    outline:      'none',
  },
  submitBtn: {
    background:   'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border:       'none',
    borderRadius: 10,
    color:        '#fff',
    cursor:       'pointer',
    fontSize:     14,
    fontWeight:   600,
    padding:      '10px 24px',
    transition:   'opacity 0.2s',
    width:        '100%',
  },
  spinner: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' },
  spinnerRing: {
    width:  40,
    height: 40,
    border: '3px solid rgba(99,102,241,0.2)',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
};
