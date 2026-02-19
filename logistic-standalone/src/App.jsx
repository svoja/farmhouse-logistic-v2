import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import CreateOrderPage from './pages/CreateOrderPage';
import MapPage from './pages/MapPage';

function NavLinkStyle({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg font-medium transition-colors ${
          isActive
            ? 'bg-white/20 text-white'
            : 'text-white/90 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <nav className="bg-sky-600 text-white shadow-sm">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
            <span className="font-semibold text-slate-100 mr-4">Logistic</span>
            <NavLinkStyle to="/">Create Order</NavLinkStyle>
            <NavLinkStyle to="/map">Map</NavLinkStyle>
          </div>
        </nav>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<CreateOrderPage />} />
            <Route path="/map" element={<MapPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
