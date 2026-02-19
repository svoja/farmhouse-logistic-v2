import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getAiStatus } from '../api/chat'

export default function Navbar() {
  const location = useLocation()
  const [status, setStatus] = useState({ database: 'unknown', gateway: 'unknown' })

  useEffect(() => {
    getAiStatus()
      .then((s) => setStatus({ database: s.database, gateway: s.gateway }))
      .catch(() => setStatus({ database: 'unreachable', gateway: 'unreachable' }))
  }, [])

  const isActive = (path) => location.pathname === path

  return (
    <nav className="border-b border-slate-200 bg-white shadow-sm flex-shrink-0">
      <div className="max-w-6xl mx-auto w-full px-6 py-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold text-slate-800 flex items-center gap-2 hover:text-slate-900"
          >
            <span className="material-symbols-outlined">local_shipping</span>
            Farmhouse Logistic
            <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 ml-1">
              2.0.0 work in progress
            </span>
          </Link>
          <div className="flex gap-1">
            <Link
              to="/orders"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors ${
                isActive('/orders')
                  ? 'text-sky-600 bg-sky-50'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined">inventory_2</span>
              Orders
            </Link>
            <Link
              to="/return-order"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors ${
                isActive('/return-order')
                  ? 'text-sky-600 bg-sky-50'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined">assignment_return</span>
              Return Order
            </Link>
            <Link
              to="/radar-legacy"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors ${
                isActive('/radar-legacy')
                  ? 'text-sky-600 bg-sky-50'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
              title="Route Radar แบบ legacy"
            >
              <span className="material-symbols-outlined">map</span>
              Route (legacy)
            </Link>
            <Link
              to="/chat"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors ${
                isActive('/chat')
                  ? 'text-sky-600 bg-sky-50'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined">smart_toy</span>
              AI
            </Link>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">database</span>
            Database:{' '}
            <span
              className={`font-medium ${
                status.database === 'connected'
                  ? 'text-emerald-600'
                  : status.database === 'disconnected'
                    ? 'text-red-600'
                    : 'text-amber-600'
              }`}
            >
              {status.database}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">psychology</span>
            AI:{' '}
            <span
              className={`font-medium ${
                status.gateway === 'reachable'
                  ? 'text-emerald-600'
                  : status.gateway === 'unreachable'
                    ? 'text-amber-600'
                    : 'text-slate-500'
              }`}
            >
              {status.gateway}
            </span>
          </span>
        </div>
      </div>
    </nav>
  )
}
