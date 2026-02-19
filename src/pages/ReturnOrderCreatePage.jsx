import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchJson } from '../api/fetchJson'
import { fetchV2Products } from '../api/shipmentPlan'
import { fetchReturns, createReturn } from '../api/returns'

const STATUS_OPTIONS = [
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'REFUNDED', label: 'Refunded' },
]

function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? val : d.toLocaleDateString()
}

export default function ReturnOrderCreatePage() {
  const [searchParams] = useSearchParams()
  const orderIdFromUrl = searchParams.get('order_id') ? parseInt(searchParams.get('order_id'), 10) : null

  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(orderIdFromUrl || '')
  const [orderDetail, setOrderDetail] = useState(null)
  const [existingReturns, setExistingReturns] = useState([])
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('REQUESTED')
  const [lineItems, setLineItems] = useState([{ product_id: '', qty: 0, condition_note: '' }])
  const [loading, setLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    Promise.all([fetchJson('/api/v2/orders'), fetchV2Products()])
      .then(([ordersData, productsData]) => {
        setOrders(Array.isArray(ordersData) ? ordersData : [])
        setProducts(Array.isArray(productsData) ? productsData : [])
        if (orderIdFromUrl && !selectedOrderId) setSelectedOrderId(String(orderIdFromUrl))
      })
      .catch((err) => setError(err.message || 'Failed to load options'))
      .finally(() => setOptionsLoading(false))
  }, [orderIdFromUrl])

  const loadOrderDetail = useCallback(async (orderId) => {
    if (!orderId) {
      setOrderDetail(null)
      setExistingReturns([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const [detail, returnsData] = await Promise.all([
        fetchJson(`/api/v2/orders/${orderId}`),
        fetchReturns({ original_order_id: orderId }),
      ])
      setOrderDetail(detail)
      setExistingReturns(returnsData || [])
    } catch (err) {
      setOrderDetail(null)
      setExistingReturns([])
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetail(parseInt(selectedOrderId, 10))
    } else {
      setOrderDetail(null)
      setExistingReturns([])
    }
  }, [selectedOrderId, loadOrderDetail])

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { product_id: '', qty: 0, condition_note: '' }])
  }

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLineItem = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const orderId = selectedOrderId ? parseInt(selectedOrderId, 10) : null
    if (!orderId || isNaN(orderId)) {
      setError('Please select an order.')
      return
    }
    const validItems = lineItems
      .filter((item) => item.product_id && (parseInt(item.qty, 10) || 0) > 0)
      .map((item) => ({
        product_id: parseInt(item.product_id, 10),
        qty: parseInt(item.qty, 10) || 0,
        condition_note: item.condition_note != null ? String(item.condition_note).trim() : null,
      }))
    if (validItems.length === 0) {
      setError('Add at least one line item with qty > 0.')
      return
    }
    setSubmitLoading(true)
    try {
      const result = await createReturn({
        original_order_id: orderId,
        return_date: returnDate || null,
        reason: reason.trim() || null,
        status: status || 'REQUESTED',
        items: validItems,
      })
      setSuccess(`Return #${result.return_id} saved. Redirecting...`)
      setTimeout(() => {
        window.location.href = '/return-order'
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to create return')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (optionsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
      <h2 className="text-xl font-semibold text-slate-800 mb-8 flex items-center gap-2">
        <span className="material-symbols-outlined">keyboard_return</span>
        Create Return
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Return Details</h3>
          </div>
          <div className="px-6 py-5 grid sm:grid-cols-2 gap-x-6 gap-y-5">
            <div className="sm:col-span-2">
              <label htmlFor="order" className="block text-sm font-medium text-slate-700 mb-1.5">
                Order *
              </label>
              <select
                id="order"
                required
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
              >
                <option value="">Select order</option>
                {orders.map((o) => (
                  <option key={o.order_id} value={o.order_id}>
                    Order #{o.order_id} — {o.branch_name ?? ''} — {o.route_name ?? ''}{' '}
                    {o.order_date ? `(${formatDate(o.order_date)})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {orderDetail && (
              <div className="sm:col-span-2 flex gap-4 text-sm text-slate-600">
                <span>Branch: {orderDetail.branch_name ?? '—'}</span>
                <span>Route: {orderDetail.route_name ?? '—'}</span>
              </div>
            )}
            <div>
              <label htmlFor="return-date" className="block text-sm font-medium text-slate-700 mb-1.5">
                Return date *
              </label>
              <input
                id="return-date"
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1.5">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1.5">
                Reason
              </label>
              <textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Expired (หมดอายุ)"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-sky-600 hover:bg-sky-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Add item
            </button>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="hidden sm:grid sm:grid-cols-[1fr_80px_1fr_40px] gap-3 mb-2 px-1">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Product</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Qty</span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Condition note</span>
              <span />
            </div>
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="grid sm:grid-cols-[1fr_80px_1fr_40px] gap-3 items-center"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 sm:hidden">Product</label>
                  <select
                    value={item.product_id}
                    onChange={(e) => updateLineItem(index, 'product_id', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name ?? ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 sm:hidden">Qty</label>
                  <input
                    type="number"
                    min={0}
                    value={item.qty}
                    onChange={(e) => updateLineItem(index, 'qty', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 sm:hidden">Condition note</label>
                  <input
                    type="text"
                    value={item.condition_note}
                    onChange={(e) => updateLineItem(index, 'condition_note', e.target.value)}
                    placeholder="e.g. Expired"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length <= 1}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    title="Remove"
                    aria-label="Remove row"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {existingReturns.length > 0 && (
          <div className="border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Existing returns for this order</h3>
            </div>
            <div className="overflow-auto max-h-[200px]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Return ID</th>
                    <th className="px-4 py-3 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Date</th>
                    <th className="px-4 py-3 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Branch</th>
                    <th className="px-4 py-3 text-right bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Total qty</th>
                    <th className="px-4 py-3 text-left bg-slate-50 font-semibold text-slate-500 border-b border-slate-200">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {existingReturns.map((r) => (
                    <tr key={r.return_id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-sky-600">#{r.return_id}</td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(r.return_date)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.branch_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.total_qty ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
            {success}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitLoading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm bg-sky-600 text-white hover:bg-sky-700 shadow-sm transition-colors disabled:opacity-70"
          >
            {submitLoading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                Saving…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Save Return
              </>
            )}
          </button>
          <Link
            to="/return-order"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
