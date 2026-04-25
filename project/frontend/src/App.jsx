import { NavLink, Outlet } from 'react-router-dom';
import { useShipments } from './hooks/useShipments';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ShipmentDetail from './pages/ShipmentDetail';

function Navbar() {
  const { shipments } = useShipments();
  const highRisk = shipments.filter((s) => s.risk_level === 'high').length;

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">
        <div className="logo-dot" />
        SupplyAI
      </NavLink>
      <ul className="navbar-links">
        <li><NavLink to="/" end>Dashboard</NavLink></li>
      </ul>
      <div className="navbar-status">
        <div className="status-dot" />
        <span>Live</span>
        {highRisk > 0 && (
          <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '999px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>
            {highRisk} HIGH RISK
          </span>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/shipment/:id" element={<ShipmentDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
