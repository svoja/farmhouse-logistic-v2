import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full text-center mb-10">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-3xl">local_shipping</span>
          Farmhouse Logistic
        </h1>
        <p className="text-slate-500 text-sm">Choose version to continue</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link
          to="/orders"
          className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-sky-200 bg-sky-50 hover:bg-sky-100 hover:border-sky-300 transition-all shadow-sm group"
        >
          <span className="material-symbols-outlined text-5xl text-sky-600 mb-4 group-hover:scale-110 transition-transform">
            inventory_2
          </span>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Logistic OS 2.0</h2>
          <p className="text-sm text-slate-500">Orders, Return Order, Create Order, Route (legacy), AI</p>
          <span className="mt-4 text-sky-600 text-sm font-medium">Open 2.0 →</span>
        </Link>
        <Link
          to="/radar-legacy"
          className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm group"
        >
          <span className="material-symbols-outlined text-5xl text-slate-500 mb-4 group-hover:scale-110 transition-transform">
            map
          </span>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Legacy version</h2>
          <p className="text-sm text-slate-500">Route Radar (classic map)</p>
          <span className="mt-4 text-slate-600 text-sm font-medium">Open Legacy →</span>
        </Link>
      </div>
      <p className="mt-8 text-xs text-slate-400">
        Database: import <code className="bg-slate-100 px-1 rounded">bread_logistics_v2</code> from the <code className="bg-slate-100 px-1 rounded">database/</code> folder. See DEPLOY.md for setup.
      </p>
    </div>
  )
}
