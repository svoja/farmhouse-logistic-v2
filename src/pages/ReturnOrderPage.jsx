import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchReturns, fetchReturnById } from '../api/returns'

const SORT_COLUMNS = [
  { key: 'return_id', label: 'Return ID' },
  { key: 'return_date', label: 'Date' },
  { key: 'order_id', label: 'Order #' },
  { key: 'branch_name', label: 'Branch' },
  { key: 'route_name', label: 'Route' },
  { key: 'total_qty', label: 'Total qty' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status' },
]

const DATE_PRESETS = [
  { days: '1', label: 'Last 1 day' },
  { days: '7', label: 'Last 7 days' },
  { days: '15', label: 'Last 15 days' },
  { days: '', label: 'Custom' },
]

function formatReturnDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? val : d.toLocaleDateString()
}

function formatStatus(val) {
  if (!val) return '—'
  return String(val)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildReturnsParams(activeDays, customFrom, customTo) {
  if (activeDays === '' && customFrom && customTo) {
    return { from: customFrom, to: customTo }
  }
  if (activeDays !== '') return { days: activeDays }
  return { days: '7' }
}

export default function ReturnOrderPage() {
  const [returnsList, setReturnsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeDays, setActiveDays] = useState('7')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sortBy, setSortBy] = useState('return_id')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedReturn, setSelectedReturn] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadReturns = useCallback(() => {
    const params = buildReturnsParams(activeDays, customFrom, customTo)
    setLoading(true)
    setError('')
    fetchReturns(params)
      .then(setReturnsList)
      .catch((err) => {
        setError(err.message)
        setReturnsList([])
      })
      .finally(() => setLoading(false))
  }, [activeDays, customFrom, customTo])

  useEffect(() => {
    loadReturns()
  }, [loadReturns])

  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return returnsList
    return returnsList.filter((r) => {
      const id = String(r.return_id ?? '').toLowerCase()
      const orderId = String(r.order_id ?? '').toLowerCase()
      const date = formatReturnDate(r.return_date).toLowerCase()
      const branch = String(r.branch_name ?? '').toLowerCase()
      const route = String(r.route_name ?? '').toLowerCase()
      const reason = String(r.reason ?? '').toLowerCase()
      const status = formatStatus(r.status).toLowerCase()
      const qty = String(r.total_qty ?? '').toLowerCase()
      return (
        id.includes(q) ||
        orderId.includes(q) ||
        date.includes(q) ||
        branch.includes(q) ||
        route.includes(q) ||
        reason.includes(q) ||
        status.includes(q) ||
        qty.includes(q)
      )
    })
  }, [returnsList, search])

  const sortedReturns = useMemo(() => {
    if (!filteredReturns.length) return []
    const key = sortBy
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filteredReturns].sort((a, b) => {
      let va = a[key]
      let vb = b[key]
      if (key === 'return_id' || key === 'order_id' || key === 'total_qty') {
        va = va != null ? Number(va) : 0
        vb = vb != null ? Number(vb) : 0
      } else if (key === 'return_date') {
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
  }, [filteredReturns, sortBy, sortDir])

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const handleDatePreset = (days) => {
    setActiveDays(days)
    if (days !== '') {
      setCustomFrom('')
      setCustomTo('')
    }
  }

  const dateFromRef = useRef(null)
  const dateToRef = useRef(null)

  const handleApplyCustom = () => {
    if (dateFromRef.current?.value && dateToRef.current?.value) {
      setCustomFrom(dateFromRef.current.value)
      setCustomTo(dateToRef.current.value)
      setActiveDays('')
    }
  }

  const handleRowClick = async (returnId) => {
    setSelectedReturn(null)
    setDetailLoading(true)
    try {
      const data = await fetchReturnById(returnId)
      setSelectedReturn(data)
    } catch (err) {
      setSelectedReturn({ error: err.message })
    } finally {
      setDetailLoading(false)
    }
  }

  const hasSearch = search.trim().length > 0

  const SortIcon = ({ columnKey }) => {
    if (sortBy !== columnKey) return <span className="material-symbols-outlined text-base opacity-0">arrow_downward</span>
    return (
      <span className="material-symbols-outlined text-base text-sky-500">
        {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    )
  }

  if (loading && returnsList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-6 py-6 gap-6">
      <section className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow overflow-hidden">
        <div className="flex flex-col gap-4 p-5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-base font-semibold text-slate-700">Return List</h2>
            <Link
              to="/return-order/create"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-sky-600 text-white hover:bg-sky-700 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              Create return
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by return ID, order #, branch, route, reason…"
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
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide self-center">Date range</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by date">
                {DATE_PRESETS.map(({ days, label }) => (
                  <button
                    key={days || 'custom'}
                    type="button"
                    onClick={() => handleDatePreset(days)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      (days === '' ? activeDays === '' && customFrom && customTo : activeDays === days)
                        ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-200/60'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    data-days={days}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {activeDays === '' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-600">From</label>
              <input
                ref={dateFromRef}
                type="date"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <label className="text-sm text-slate-600">To</label>
              <input
                ref={dateToRef}
                type="date"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={handleApplyCustom}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-600 text-white hover:bg-sky-700"
              >
                Apply
              </button>
            </div>
          )}
          {hasSearch && (
            <div className="flex items-center gap-2 min-h-[24px]">
              <span className="text-sm text-slate-600">
                Showing {filteredReturns.length} of {returnsList.length} returns
              </span>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="px-5 py-3 text-red-500 text-sm border-b border-slate-200">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto min-h-[200px]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {SORT_COLUMNS.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => (key === 'return_id' || key === 'return_date' ? handleSort(key) : null)}
                    className={`px-4 py-3 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200 ${
                      key === 'return_id' || key === 'return_date' ? 'cursor-pointer select-none hover:bg-slate-100' : ''
                    }`}
                    role={key === 'return_id' || key === 'return_date' ? 'button' : undefined}
                    tabIndex={key === 'return_id' || key === 'return_date' ? 0 : undefined}
                    onKeyDown={
                      key === 'return_id' || key === 'return_date'
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleSort(key)
                            }
                          }
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {(key === 'return_id' || key === 'return_date') && <SortIcon columnKey={key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={SORT_COLUMNS.length} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : sortedReturns.length === 0 ? (
                <tr>
                  <td colSpan={SORT_COLUMNS.length} className="px-4 py-8 text-center text-slate-500">
                    {returnsList.length === 0
                      ? 'No returns in this date range.'
                      : 'No returns match your search.'}
                  </td>
                </tr>
              ) : (
                sortedReturns.map((r) => (
                  <tr
                    key={r.return_id}
                    onClick={() => handleRowClick(r.return_id)}
                    className="cursor-pointer hover:bg-sky-50 border-b border-slate-200"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleRowClick(r.return_id)
                      }
                    }}
                  >
                    <td className="px-4 py-3">{r.return_id ?? '—'}</td>
                    <td className="px-4 py-3">{formatReturnDate(r.return_date)}</td>
                    <td className="px-4 py-3">{r.order_id ?? '—'}</td>
                    <td className="px-4 py-3">{r.branch_name ?? '—'}</td>
                    <td className="px-4 py-3">{r.route_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{r.total_qty ?? 0}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={r.reason ?? ''}>
                      {(r.reason ?? '').slice(0, 50)}
                      {(r.reason ?? '').length > 50 ? '…' : ''}
                    </td>
                    <td className="px-4 py-3">{formatStatus(r.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedReturn !== null && (
        <ReturnDetailModal
          returnData={selectedReturn}
          loading={detailLoading}
          onClose={() => setSelectedReturn(null)}
        />
      )}
    </div>
  )
}

function ReturnDetailModal({ returnData, loading, onClose }) {
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

  if (returnData?.error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Return Details</h3>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-red-500 py-4">{returnData.error}</p>
        </div>
      </div>
    )
  }

  const ret = returnData || {}
  const items = ret.items || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="relative bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold">Return Details</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Return ID</span>
              <p className="text-slate-800">#{ret.return_id}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</span>
              <p className="text-slate-800">{formatReturnDate(ret.return_date)}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order #</span>
              <p className="text-slate-800">{ret.order_id ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</span>
              <p className="text-slate-800">{ret.branch_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Route</span>
              <p className="text-slate-800">{ret.route_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <p className="text-slate-800">{formatStatus(ret.status)}</p>
            </div>
            <div className="col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason</span>
              <p className="text-slate-800">{ret.reason ?? '—'}</p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Line Items</h4>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Product</th>
                  <th className="px-3 py-2 text-right bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Qty</th>
                  <th className="px-3 py-2 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Condition note</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-slate-500">
                      No items
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="px-3 py-2">{item.product_name ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{item.qty ?? 0}</td>
                      <td className="px-3 py-2">{item.condition_note ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
