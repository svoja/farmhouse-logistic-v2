import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchOrders } from '../api/orders'
import { fetchJson } from '../api/fetchJson'

const SORT_COLUMNS = [
  { key: 'order_id', label: 'Order ID' },
  { key: 'order_code', label: 'Order Code' },
  { key: 'order_date', label: 'Order Date' },
  { key: 'status', label: 'Status' },
  { key: 'driver_name', label: 'Driver' },
  { key: 'sales_name', label: 'Sales' },
  { key: 'branch_name', label: 'Branch' },
  { key: 'route_name', label: 'Route' },
  { key: 'shipment_code', label: 'Shipment' },
  { key: 'driver_name', label: 'Driver' },
]

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'LOADED', label: 'Loaded' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'DELIVERED', label: 'Delivered' },
]

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? val : d.toLocaleString()
}

function formatStatus(val) {
  if (!val) return '—'
  return String(val)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('order_id')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchOrders()
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((r) => {
      if (statusFilter && String(r.status ?? '') !== statusFilter) return false
      if (!q) return true
      const id = String(r.order_id ?? '').toLowerCase()
      const code = String(r.order_code ?? '').toLowerCase()
      const driver = String(r.driver_name ?? '').toLowerCase()
      const sales = String(r.sales_name ?? '').toLowerCase()
      const branch = String(r.branch_name ?? '').toLowerCase()
      const route = String(r.route_name ?? '').toLowerCase()
      const shipment = String(r.shipment_code ?? '').toLowerCase()
      const st = formatStatus(r.status).toLowerCase()
      const date = formatDate(r.order_date).toLowerCase()
      return (
        id.includes(q) ||
        code.includes(q) ||
        driver.includes(q) ||
        sales.includes(q) ||
        branch.includes(q) ||
        route.includes(q) ||
        shipment.includes(q) ||
        st.includes(q) ||
        date.includes(q)
      )
    })
  }, [orders, search, statusFilter])

  const sortedOrders = useMemo(() => {
    if (!filteredOrders.length) return []
    const key = sortBy
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filteredOrders].sort((a, b) => {
      let va = a[key]
      let vb = b[key]
      if (key === 'order_id') {
        va = va != null ? Number(va) : 0
        vb = vb != null ? Number(vb) : 0
      } else if (key === 'order_date') {
        va = va ? new Date(va).getTime() : 0
        vb = vb ? new Date(vb).getTime() : 0
      } else {
        va = (va != null ? String(va) : '').toLowerCase()
        vb = (vb != null ? String(vb) : '').toLowerCase()
      }
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [filteredOrders, sortBy, sortDir])

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const stats = useMemo(() => {
    return {
      total: orders.length,
      planned: orders.filter((r) => r.status === 'PLANNED').length,
      pending: orders.filter((r) => r.status === 'PENDING').length,
      delivered: orders.filter((r) => r.status === 'DELIVERED').length,
    }
  }, [orders])

  const hasFilter = filteredOrders.length !== orders.length || search.trim() || statusFilter

  const handleRowClick = async (orderId) => {
    setSelectedOrder(null)
    setDetailLoading(true)
    try {
      const data = await fetchJson(`/api/v2/orders/${orderId}`)
      setSelectedOrder(data)
    } catch (err) {
      setSelectedOrder({ error: err.message })
    } finally {
      setDetailLoading(false)
    }
  }

  const doExport = () => {
    window.location.href = '/api/v2/orders/export?format=xlsx'
  }

  const SortIcon = ({ columnKey }) => {
    if (sortBy !== columnKey) return <span className="material-symbols-outlined text-base opacity-0">arrow_downward</span>
    return (
      <span className="material-symbols-outlined text-base text-sky-500">
        {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">progress_activity</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-6 py-6">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-6 py-6 gap-6">
      <section>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">Dashboard</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow hover:shadow-md transition-shadow">
            <div className="flex justify-center mb-2 text-sky-500">
              <span className="material-symbols-outlined text-[28px]">inventory</span>
            </div>
            <span className="block text-2xl font-bold text-slate-800">{stats.total}</span>
            <span className="text-sm text-slate-500">Total</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow hover:shadow-md transition-shadow">
            <div className="flex justify-center mb-2 text-sky-500">
              <span className="material-symbols-outlined text-[28px]">schedule</span>
            </div>
              <span className="block text-2xl font-bold text-slate-800">{stats.planned}</span>
              <span className="text-sm text-slate-500">Planned</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow hover:shadow-md transition-shadow">
            <div className="flex justify-center mb-2 text-sky-500">
              <span className="material-symbols-outlined text-[28px]">local_shipping</span>
            </div>
            <span className="block text-2xl font-bold text-slate-800">{stats.delivered}</span>
            <span className="text-sm text-slate-500">Delivered</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow hover:shadow-md transition-shadow">
            <div className="flex justify-center mb-2 text-sky-500">
              <span className="material-symbols-outlined text-[28px]">route</span>
            </div>
              <span className="block text-2xl font-bold text-slate-800">{stats.pending}</span>
              <span className="text-sm text-slate-500">Pending</span>
          </div>
        </div>
      </section>

      <section className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow overflow-hidden">
        <div className="flex flex-col gap-4 p-5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-base font-semibold text-slate-700">Order List</h2>
            <div className="flex gap-2">
              <Link
                to="/create-shipment-plan"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Create Order
              </Link>
              <button
                type="button"
                onClick={doExport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                Export
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">print</span>
                Print
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders by ID, driver, branch, route, status…"
                className="w-full pl-11 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400 placeholder:text-slate-400 shadow-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide self-center">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map(({ value, label }) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === value
                        ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-200/60'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasFilter && (
            <div className="flex items-center gap-2 min-h-[24px]">
              <span className="text-sm text-slate-600">
                Showing {filteredOrders.length} of {orders.length} orders
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                }}
                className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto min-h-[200px]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {SORT_COLUMNS.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-4 py-3 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSort(key)
                      }
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      <SortIcon columnKey={key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={SORT_COLUMNS.length} className="px-4 py-8 text-center text-slate-500">
                    {orders.length === 0
                      ? 'No orders found.'
                      : 'No orders match your search. Try different filters.'}
                  </td>
                </tr>
              ) : (
                sortedOrders.map((r) => (
                  <tr
                    key={r.order_id}
                    onClick={() => handleRowClick(r.order_id)}
                    className="cursor-pointer hover:bg-sky-50 border-b border-slate-200"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleRowClick(r.order_id)
                      }
                    }}
                  >
                    <td className="px-4 py-3">{r.order_id ?? '—'}</td>
                    <td className="px-4 py-3">{formatDate(r.order_date)}</td>
                    <td className="px-4 py-3">{formatStatus(r.status)}</td>
                    <td className="px-4 py-3">{r.branch_name ?? '—'}</td>
                    <td className="px-4 py-3">{r.route_name ?? '—'}</td>
                    <td className="px-4 py-3">{r.driver_name ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrder !== null && (
        <OrderDetailModal
          order={selectedOrder}
          loading={detailLoading}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

function OrderDetailModal({ order, loading, onClose }) {
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Loading…
          </div>
        </div>
      </div>
    )
  }

  if (order.error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Order Details</h3>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-red-500 py-4">{order.error}</p>
        </div>
      </div>
    )
  }

  const items = order.items || []
  const total =
    order.total != null
      ? order.total
      : items.reduce(
          (s, i) => s + (parseInt(i.requested_qty, 10) || 0) * (parseFloat(i.unit_price_at_order || 0) || 0),
          0
        )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="relative bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold">Order Details</h3>
          <div className="flex items-center gap-2">
            <Link
              to={`/return-order/create?order_id=${order.order_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              title="Create return for this order"
            >
              <span className="material-symbols-outlined">keyboard_return</span>
              Return order
            </Link>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order ID</span>
              <p className="text-slate-800">#{order.order_id}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order Code</span>
              <p className="text-slate-800">{order.order_code ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <p className="text-slate-800">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <p className="text-slate-800">{formatStatus(order.status)}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Driver</span>
              <p className="text-slate-800">{order.driver_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales</span>
              <p className="text-slate-800">{order.sales_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</span>
              <p className="text-slate-800">{order.branch_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Route</span>
              <p className="text-slate-800">{order.route_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipment</span>
              <p className="text-slate-800">{order.shipment_code ?? '—'}</p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Line Items</h4>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Product</th>
                  <th className="px-3 py-2 text-right bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Qty</th>
                  <th className="px-3 py-2 text-right bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Unit Price</th>
                  <th className="px-3 py-2 text-right bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500">
                      No items
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="px-3 py-2">{item.product_name ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{item.requested_qty ?? 0}</td>
                      <td className="px-3 py-2 text-right">฿{parseFloat(item.unit_price_at_order || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        ฿{((parseInt(item.requested_qty, 10) || 0) * parseFloat(item.unit_price_at_order || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-right font-semibold border-t-2 border-slate-200">Total</td>
                  <td className="px-3 py-3 text-right font-semibold border-t-2 border-slate-200">฿{total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
