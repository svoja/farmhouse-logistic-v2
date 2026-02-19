import { useState, useCallback, useMemo } from 'react'
import SearchableCombobox from './SearchableCombobox'

const DEFAULT_VOLUME_M3 = 0.02
const CAPACITY_WARN_PCT = 70
const CAPACITY_DANGER_PCT = 90
const CAPACITY_BLOCK_PCT = 120

function formatNumber(n) {
  const v = Number(n) || 0
  return v.toLocaleString('th-TH')
}

function formatMoney(n) {
  const v = Number(n) || 0
  return v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatVolume(n) {
  const v = Number(n) || 0
  return v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Progress bar: used m³ vs capacity. Green < 70%, amber 70–90%, red > 90%. */
function CapacityBar({ usedM3, capacityM3 }) {
  const capacity = Number(capacityM3) || 1
  const used = Number(usedM3) || 0
  const pct = Math.min(100, (used / capacity) * 100)

  let barColor = 'bg-emerald-500'
  if (pct >= CAPACITY_DANGER_PCT) barColor = 'bg-red-500'
  else if (pct >= CAPACITY_WARN_PCT) barColor = 'bg-amber-500'

  return (
    <div className="mt-3 space-y-1">
      <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="text-xs text-slate-600">
        Used {formatVolume(used)} / {formatVolume(capacity)} m³
      </p>
    </div>
  )
}

/** Single editable row: qty input, line total, line volume, delete. */
function EditableRow({
  index,
  item,
  onQtyChange,
  onDelete,
}) {
  const qty = Number(item?.quantity) || 0
  const price = Number(item?.unit_price) || 0
  const volPerUnit = Number(item?.volume_per_unit_m3) ?? DEFAULT_VOLUME_M3
  const lineTotal = qty * price
  const lineVolume = qty * volPerUnit

  return (
    <tr className="border-b border-slate-100 even:bg-slate-50/50">
      <td className="px-3 py-2 text-slate-700">{index + 1}</td>
      <td className="px-3 py-2 text-slate-800">{item?.product_code ?? '—'}</td>
      <td className="px-3 py-2 text-slate-800">{item?.product_name ?? '—'}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => onQtyChange(Number(e.target.value) || 0)}
          className="w-20 px-2 py-1.5 rounded border border-slate-200 text-slate-800 text-right focus:ring-2 focus:ring-sky-500/50 focus:border-sky-400"
        />
      </td>
      <td className="px-3 py-2 text-right text-slate-700">{formatMoney(price)}</td>
      <td className="px-3 py-2 text-right font-medium text-slate-800">{formatMoney(lineTotal)}</td>
      <td className="px-3 py-2 text-right text-slate-700">{formatVolume(lineVolume)}</td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Delete row"
          aria-label="Delete row"
        >
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </td>
    </tr>
  )
}

/** Single shipment card: header, editable table, summary, capacity bar, add product. */
function ShipmentCard({
  shipmentIndex,
  shipment,
  products = [],
  onChange,
  onAddItem,
}) {
  const [addProductId, setAddProductId] = useState('')
  const [addProductText, setAddProductText] = useState('')

  const items = Array.isArray(shipment?.items) ? shipment.items : []
  const capacityM3 = Number(shipment?.car_capacity_m3) || 12

  const totalQty = items.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0)
  const totalPrice = items.reduce(
    (sum, it) => sum + (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0),
    0
  )
  const totalVolume = items.reduce(
    (sum, it) =>
      sum + (Number(it?.quantity) || 0) * (Number(it?.volume_per_unit_m3) ?? DEFAULT_VOLUME_M3),
    0
  )

  const usagePercent = capacityM3 > 0 ? (totalVolume / capacityM3) * 100 : 0
  const overCapacity = usagePercent > 100
  const canAddMore = usagePercent < CAPACITY_BLOCK_PCT

  const handleQtyChange = useCallback(
    (itemIndex, newQty) => {
      const next = items.map((it, i) =>
        i === itemIndex ? { ...it, quantity: Math.max(0, newQty) } : it
      )
      onChange({ ...shipment, items: next })
    },
    [shipment, items, onChange]
  )

  const handleDelete = useCallback(
    (itemIndex) => {
      const next = items.filter((_, i) => i !== itemIndex)
      onChange({ ...shipment, items: next })
    },
    [shipment, items, onChange]
  )

  const handleAddProduct = useCallback(
    (product) => {
      if (!product) return
      const vol = (typeof product.volume_m3 === 'number' && product.volume_m3 > 0) ? product.volume_m3 : (Number(product.volume_per_unit_m3) || DEFAULT_VOLUME_M3)
      const extraVolume = 1 * vol
      const newTotalVolume = totalVolume + extraVolume
      const newPct = capacityM3 > 0 ? (newTotalVolume / capacityM3) * 100 : 0
      if (newPct > CAPACITY_BLOCK_PCT) return

      onAddItem(shipmentIndex, {
        product_id: Number(product.product_id),
        product_code: product.barcode ?? String(product.product_id),
        product_name: product.name ?? '',
        quantity: 1,
        unit_price: Number(product.unit_price) || 0,
        volume_per_unit_m3: vol,
      })
    },
    [shipmentIndex, totalVolume, capacityM3, onAddItem]
  )

  const alreadyAddedIds = useMemo(
    () =>
      new Set(
        items.map((it) => Number(it.product_id)).filter((n) => !Number.isNaN(n))
      ),
    [items]
  )
  const availableProducts = products.filter(
    (p) => !alreadyAddedIds.has(Number(p.product_id))
  )
  const productById = useMemo(() => {
    const map = new Map()
    products.forEach((p) => {
      const id = Number(p.product_id)
      if (!Number.isNaN(id)) {
        map.set(id, p)
        map.set(String(id), p)
      }
    })
    return map
  }, [products])

  return (
    <div className="mb-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-800">
          สาขา {shipment?.branch_name ?? '—'}
        </span>
        <span className="text-sm text-slate-500">Capacity: {formatVolume(capacityM3)} m³</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">ลำดับที่</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">รหัสสินค้า</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">ชื่อสินค้า</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">จำนวน</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">ราคา</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">ราคารวม</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Volume (m³)</th>
              <th className="w-10 px-3 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-slate-500 py-6">
                  ไม่มีรายการ — เลือกสินค้าด้านล่างเพื่อเพิ่ม
                </td>
              </tr>
            ) : (
              items.map((it, i) => (
                <EditableRow
                  key={`${it?.product_id ?? it?.product_code}-${i}`}
                  index={i}
                  item={it}
                  onQtyChange={(q) => handleQtyChange(i, q)}
                  onDelete={() => handleDelete(i)}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-sky-50/80">
              <td colSpan={3} className="px-3 py-3 text-right font-semibold text-sky-700">
                รวมจำนวน
              </td>
              <td className="px-3 py-3 font-semibold text-sky-700">{formatNumber(totalQty)}</td>
              <td className="px-3 py-3 text-right font-semibold text-sky-700">รวมราคา</td>
              <td className="px-3 py-3 text-right font-semibold text-sky-700">{formatMoney(totalPrice)}</td>
              <td className="px-3 py-3 text-right font-semibold text-sky-700">
                รวม Volume: {formatVolume(totalVolume)} m³
              </td>
              <td className="px-3 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-4 pb-4 pt-1">
        <CapacityBar usedM3={totalVolume} capacityM3={capacityM3} />

        {overCapacity && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <span className="material-symbols-outlined text-lg">warning</span>
            รถเกินความจุ!
          </div>
        )}

        {availableProducts.length > 0 && (
          <div className="mt-3">
            <div className={!canAddMore ? 'opacity-60 pointer-events-none' : ''}>
              <SearchableCombobox
                label="เพิ่มสินค้า"
                placeholder="เลือกสินค้า..."
                options={availableProducts}
                value={addProductId}
                displayText={addProductText}
                onSelect={(id) => {
                  const p =
                    productById.get(Number(id)) ??
                    productById.get(String(id)) ??
                    products.find((x) => Number(x.product_id) === Number(id))
                  if (p) handleAddProduct(p)
                  setAddProductId('')
                  setAddProductText('')
                }}
                getOptionId={(o) => o.product_id ?? ''}
                getOptionLabel={(o) => o.name ?? o.product_name ?? `Product ${o.product_id ?? ''}`}
                id={`add-product-${shipment?.branch_id ?? shipmentIndex}`}
              />
            </div>
            {!canAddMore && (
              <p className="mt-1.5 text-xs text-amber-600">ความจุเกิน 120% — ไม่สามารถเพิ่มได้</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Read-only render (no onChange): same layout but no inputs. */
export function renderShipmentCards(shipments) {
  const list = Array.isArray(shipments) ? shipments : []
  if (list.length === 0) {
    return <div className="text-slate-500 text-sm">ยังไม่มีรายการสินค้า</div>
  }

  return list.map((s, idx) => {
    const items = Array.isArray(s?.items) ? s.items : []
    const totalQty = items.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0)
    const totalPrice = items.reduce(
      (sum, it) => sum + (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0),
      0
    )
    const totalVolume = items.reduce(
      (sum, it) =>
        sum + (Number(it?.quantity) || 0) * (Number(it?.volume_per_unit_m3) ?? DEFAULT_VOLUME_M3),
      0
    )
    const capacityM3 = Number(s?.car_capacity_m3) || 12

    return (
      <div
        key={`${s?.branch_name ?? 'branch'}-${idx}`}
        className="mb-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible"
      >
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-800">สาขา {s?.branch_name ?? '—'}</span>
          <span className="text-sm text-slate-500">Capacity: {formatVolume(capacityM3)} m³</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">ลำดับที่</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">รหัสสินค้า</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">ชื่อสินค้า</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">จำนวน</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">ราคา</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">ราคารวม</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Volume (m³)</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-4">
                    ไม่มีรายการ
                  </td>
                </tr>
              ) : (
                items.map((it, i) => {
                  const qty = Number(it?.quantity) || 0
                  const price = Number(it?.unit_price) || 0
                  const vol = (Number(it?.volume_per_unit_m3) ?? DEFAULT_VOLUME_M3) * qty
                  return (
                    <tr key={`${it?.product_code ?? i}`} className="border-b border-slate-100 even:bg-slate-50/50">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">{it?.product_code ?? '—'}</td>
                      <td className="px-3 py-2">{it?.product_name ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(qty)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(price)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(qty * price)}</td>
                      <td className="px-3 py-2 text-right">{formatVolume(vol)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-sky-50/80">
                <td colSpan={3} className="px-3 py-3 text-right font-semibold text-sky-700">รวมจำนวน</td>
                <td className="px-3 py-3 font-semibold text-sky-700">{formatNumber(totalQty)}</td>
                <td className="px-3 py-3 text-right font-semibold text-sky-700">รวมราคา</td>
                <td className="px-3 py-3 text-right font-semibold text-sky-700">{formatMoney(totalPrice)}</td>
                <td className="px-3 py-3 text-right font-semibold text-sky-700">{formatVolume(totalVolume)} m³</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 pb-4 pt-1">
          <CapacityBar usedM3={totalVolume} capacityM3={capacityM3} />
        </div>
      </div>
    )
  })
}

export default function ShipmentCards({ shipments = [], onShipmentsChange, products = [] }) {
  const list = Array.isArray(shipments) ? shipments : []

  const handleCardChange = useCallback(
    (index, nextShipment) => {
      if (typeof onShipmentsChange !== 'function') return
      const next = list.map((s, i) => (i === index ? nextShipment : s))
      onShipmentsChange(next)
    },
    [list, onShipmentsChange]
  )

  const handleAddItem = useCallback(
    (shipmentIndex, newItem) => {
      if (typeof onShipmentsChange !== 'function') return
      const s = list[shipmentIndex]
      if (!s) return
      const items = [...(Array.isArray(s.items) ? s.items : []), newItem]
      const next = list.map((ship, i) =>
        i === shipmentIndex ? { ...ship, items } : ship
      )
      onShipmentsChange(next)
    },
    [list, onShipmentsChange]
  )

  if (list.length === 0) {
    return <div className="text-slate-500 text-sm">ยังไม่มีรายการสินค้า</div>
  }

  if (typeof onShipmentsChange !== 'function') {
    return <>{renderShipmentCards(shipments)}</>
  }

  return (
    <>
      {list.map((shipment, idx) => (
        <ShipmentCard
          key={`${shipment?.branch_id ?? shipment?.branch_name ?? idx}-${idx}`}
          shipmentIndex={idx}
          shipment={shipment}
          products={products}
          onChange={(next) => handleCardChange(idx, next)}
          onAddItem={handleAddItem}
        />
      ))}
    </>
  )
}
