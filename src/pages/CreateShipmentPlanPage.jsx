import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchV2Routes,
  fetchV2RouteStops,
  fetchV2Cars,
  fetchV2Employees,
  fetchV2Products,
  fetchV2BranchCategories,
  fetchV2RetailersByDc,
  calculateAllocation,
  createShipment,
} from '../api/shipmentPlan'
import SearchableCombobox from '../components/SearchableCombobox'
import ShipmentCards from '../components/ShipmentCards'

const STEPS = [
  { id: 'linehaul', label: 'Line Haul', icon: 'local_shipping' },
  { id: 'lastmile', label: 'Last Mile', icon: 'warehouse' },
  { id: 'allocation', label: 'AI Allocation', icon: 'psychology' },
]

// Resolve DC / Retailer cat_id from category name (v2 branch_category)
function getCategoryIds(categories) {
  let dcCatId = null
  let retailerCatId = null
  ;(categories || []).forEach((c) => {
    const name = (c.name || '').toLowerCase()
    if (name.includes('dc') || name.includes('distribution')) dcCatId = c.cat_id
    if (name.includes('retail') || name.includes('store')) retailerCatId = c.cat_id
  })
  if (dcCatId == null) dcCatId = 2
  if (retailerCatId == null) retailerCatId = 3
  return { dcCatId, retailerCatId }
}

export default function CreateShipmentPlanPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [routes, setRoutes] = useState([])
  const [cars, setCars] = useState([])
  const [drivers, setDrivers] = useState([])
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])

  const [routeId, setRouteId] = useState('')
  const [routeText, setRouteText] = useState('')
  const [mainCarId, setMainCarId] = useState('')
  const [mainCarText, setMainCarText] = useState('')
  const [mainDriverId, setMainDriverId] = useState('')
  const [mainDriverText, setMainDriverText] = useState('')
  const [mainSalesId, setMainSalesId] = useState('')
  const [mainSalesText, setMainSalesText] = useState('')

  const [routeStops, setRouteStops] = useState([])
  const [dcAssignments, setDcAssignments] = useState({}) // { [dc_branch_id]: { included, local_car_id, local_car_text, local_driver_emp_id, local_driver_text, local_sales_emp_id, local_sales_text } }
  const [selectedRetailerIds, setSelectedRetailerIds] = useState(new Set()) // branch_id (retailer)
  const [orderQuantities, setOrderQuantities] = useState({}) // { [branch_id]: { [product_id]: number } }
  const [aiSuggestedQuantities, setAiSuggestedQuantities] = useState({}) // { [branch_id]: { [product_id]: number } }

  const [allocating, setAllocating] = useState(false)
  const [allocError, setAllocError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const navigate = useNavigate()

  const { dcCatId, retailerCatId } = useMemo(() => getCategoryIds(categories), [categories])

  const dcsOnRoute = useMemo(() => routeStops.filter((s) => s.cat_id === dcCatId), [routeStops, dcCatId])

  const [retailersForCard3, setRetailersForCard3] = useState([])
  const [retailersLoading, setRetailersLoading] = useState(false)
  const includedDcIds = useMemo(
    () => dcsOnRoute.filter((d) => dcAssignments[d.branch_id]?.included).map((d) => d.branch_id),
    [dcsOnRoute, dcAssignments]
  )
  useEffect(() => {
    if (includedDcIds.length === 0) {
      setRetailersForCard3([])
      return
    }
    setRetailersLoading(true)
    Promise.all(includedDcIds.map((dcId) => fetchV2RetailersByDc(dcId)))
      .then((results) => {
        const byId = new Map()
        results.flat().forEach((r) => byId.set(r.branch_id, { ...r, branch_name: r.branch_name ?? r.name ?? '' }))
        setRetailersForCard3(Array.from(byId.values()))
      })
      .catch(() => setRetailersForCard3([]))
      .finally(() => setRetailersLoading(false))
  }, [includedDcIds.join(',')])

  const mainTrucks = useMemo(
    () => cars.filter((c) => (c.status || '').toUpperCase() === 'AVAILABLE' && (c.type_name || '').toLowerCase().includes('10')),
    [cars]
  )
  const localVehicles = useMemo(
    // Last mile vehicles: 4-Wheel Pickup only (per requirement: type_id = 2)
    () => cars.filter((c) => (c.status || '').toUpperCase() === 'AVAILABLE' && Number(c.type_id) === 2),
    [cars]
  )

  const usedLocalVehicleIds = useMemo(() => {
    const used = new Set()
    Object.values(dcAssignments || {}).forEach((a) => {
      if (!a?.included) return
      const id = a.local_car_id ? Number(a.local_car_id) : null
      if (id) used.add(id)
    })
    return used
  }, [dcAssignments])

  /** All driver_emp_id and sales_emp_id currently assigned (Line Haul + all Last Mile rows). */
  const usedEmployeeIds = useMemo(() => {
    const used = new Set()
    if (mainDriverId) used.add(Number(mainDriverId))
    if (mainSalesId) used.add(Number(mainSalesId))
    dcsOnRoute.forEach((d) => {
      const a = dcAssignments[d.branch_id] || {}
      if (!a.included) return
      if (a.local_driver_emp_id) used.add(Number(a.local_driver_emp_id))
      if (a.local_sales_emp_id) used.add(Number(a.local_sales_emp_id))
    })
    return used
  }, [mainDriverId, mainSalesId, dcsOnRoute, dcAssignments])

  const getEmployeeLabel = useCallback((o) => {
    const name = (o.full_name || '').trim()
    if (name) return name
    return `${o.firstname ?? ''} ${o.lastname ?? ''}`.trim() || '—'
  }, [])

  /** Line Haul: drivers available for main truck (exclude used elsewhere + buddy rule: exclude main sales). */
  const mainDriverOptions = useMemo(() => {
    return (drivers || []).filter((d) => {
      const id = Number(d.emp_id)
      if (id === Number(mainDriverId)) return true
      if (usedEmployeeIds.has(id)) return false
      if (id === Number(mainSalesId)) return false
      return true
    })
  }, [drivers, mainDriverId, mainSalesId, usedEmployeeIds])

  /** Line Haul: sales available (exclude used elsewhere + buddy rule: exclude main driver). */
  const mainSalesOptions = useMemo(() => {
    return (sales || []).filter((s) => {
      const id = Number(s.emp_id)
      if (id === Number(mainSalesId)) return true
      if (usedEmployeeIds.has(id)) return false
      if (id === Number(mainDriverId)) return false
      return true
    })
  }, [sales, mainSalesId, mainDriverId, usedEmployeeIds])

  useEffect(() => {
    Promise.all([
      fetchV2Routes(),
      fetchV2Cars(),
      fetchV2Employees({ job_title: 'Driver' }),
      fetchV2Employees({ job_title: 'Sales' }),
      fetchV2Products(),
      fetchV2BranchCategories(),
    ])
      .then(([r, c, d, s, p, cat]) => {
        setRoutes(Array.isArray(r) ? r : [])
        setCars(Array.isArray(c) ? c : [])
        setDrivers(Array.isArray(d) ? d : [])
        setSales(Array.isArray(s) ? s : [])
        setProducts(Array.isArray(p) ? p : [])
        setCategories(Array.isArray(cat) ? cat : [])
      })
      .catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!routeId) {
      setRouteStops([])
      setDcAssignments({})
      setSelectedRetailerIds(new Set())
      setOrderQuantities({})
      setAiSuggestedQuantities({})
      return
    }
    fetchV2RouteStops(routeId)
      .then((stops) => {
        setRouteStops(Array.isArray(stops) ? stops : [])
        const dcIds = (Array.isArray(stops) ? stops : []).filter((s) => s.cat_id === dcCatId).map((s) => s.branch_id)
        setDcAssignments((prev) => {
          const next = { ...prev }
          dcIds.forEach((bid) => {
            if (!next[bid]) next[bid] = { included: false, local_car_id: '', local_car_text: '', local_driver_emp_id: '', local_driver_text: '', local_sales_emp_id: '', local_sales_text: '' }
          })
          return next
        })
      })
      .catch(() => setRouteStops([]))
  }, [routeId, dcCatId])

  const toggleDcIncluded = useCallback((dcBranchId) => {
    setDcAssignments((prev) => {
      const cur = prev[dcBranchId] || {}
      const nextIncluded = !cur.included
      // When disabling a DC, clear vehicle and staff so they become available elsewhere.
      const cleared = nextIncluded
        ? cur
        : {
            ...cur,
            local_car_id: '',
            local_car_text: '',
            local_driver_emp_id: '',
            local_driver_text: '',
            local_sales_emp_id: '',
            local_sales_text: '',
          }
      return { ...prev, [dcBranchId]: { ...cleared, included: nextIncluded } }
    })
  }, [])

  const setDcLocalCar = useCallback((dcBranchId, id, text) => {
    setDcAssignments((prev) => ({
      ...prev,
      [dcBranchId]: { ...prev[dcBranchId], local_car_id: String(id), local_car_text: text },
    }))
  }, [])

  const clearDcLocalCar = useCallback((dcBranchId) => {
    setDcAssignments((prev) => ({
      ...prev,
      [dcBranchId]: { ...prev[dcBranchId], local_car_id: '', local_car_text: '' },
    }))
  }, [])

  const setDcLocalDriver = useCallback((dcBranchId, id, text) => {
    setDcAssignments((prev) => ({
      ...prev,
      [dcBranchId]: { ...prev[dcBranchId], local_driver_emp_id: String(id), local_driver_text: text },
    }))
  }, [])

  const setDcLocalSales = useCallback((dcBranchId, id, text) => {
    setDcAssignments((prev) => ({
      ...prev,
      [dcBranchId]: { ...prev[dcBranchId], local_sales_emp_id: String(id), local_sales_text: text },
    }))
  }, [])

  const toggleRetailer = useCallback((branchId) => {
    const id = Number(branchId)
    setSelectedRetailerIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setQty = useCallback((branchId, productId, qty) => {
    const v = Math.max(0, parseInt(qty, 10) || 0)
    setOrderQuantities((prev) => ({
      ...prev,
      [branchId]: {
        ...(prev[branchId] || {}),
        [productId]: v,
      },
    }))
  }, [])

  const getQty = useCallback(
    (branchId, productId) => orderQuantities[branchId]?.[productId] ?? 0,
    [orderQuantities]
  )

  const CAR_CAPACITY_M3_FOR_ALLOC = 12 // 70% of this used by OpenClaw auto-allocate
  const handleAutoAllocate = useCallback(async () => {
    const branchIds = [...selectedRetailerIds].filter(Boolean)
    if (branchIds.length === 0) {
      setAllocError('Select at least one retailer')
      return
    }
    setAllocError('')
    setAllocating(true)
    try {
      const productIds = (products || []).map((p) => p.product_id).filter(Boolean)
      const allocations = await calculateAllocation(branchIds, productIds, CAR_CAPACITY_M3_FOR_ALLOC)
      setAiSuggestedQuantities((prev) => {
        const next = { ...prev }
        allocations.forEach((a) => {
          const bid = a.branch_id
          const pid = a.product_id
          if (!next[bid]) next[bid] = {}
          next[bid][pid] = a.suggested_qty ?? 0
        })
        return next
      })
      setOrderQuantities((prev) => {
        const next = { ...prev }
        allocations.forEach((a) => {
          const bid = a.branch_id
          const pid = a.product_id
          if (!next[bid]) next[bid] = {}
          next[bid][pid] = a.suggested_qty ?? 0
        })
        return next
      })
    } catch (err) {
      setAllocError(err.message || 'Allocation failed')
    } finally {
      setAllocating(false)
    }
  }, [selectedRetailerIds, products])

  const handleCreateShipment = useCallback(async () => {
    if (!routeId || !mainCarId || !mainDriverId || !mainSalesId) {
      setSaveMessage('Please complete Line Haul: route, vehicle, driver, and salesperson (Buddy System).')
      return
    }
    if (Number(mainDriverId) === Number(mainSalesId)) {
      setSaveMessage('Driver and Sales must be different people.')
      return
    }
    const includedDcs = dcsOnRoute.filter((d) => dcAssignments[d.branch_id]?.included)
    for (const d of includedDcs) {
      const a = dcAssignments[d.branch_id] || {}
      if (!a.local_driver_emp_id || !a.local_sales_emp_id) {
        setSaveMessage(`DC "${d.branch_name ?? d.branch_id}": assign both Local Driver and Local Sales (Buddy System).`)
        return
      }
      if (Number(a.local_driver_emp_id) === Number(a.local_sales_emp_id)) {
        setSaveMessage(`DC "${d.branch_name ?? d.branch_id}": Driver and Sales must be different people.`)
        return
      }
    }

    const selectedIds = [...selectedRetailerIds].map(Number).filter(Boolean)
    if (selectedIds.length === 0) {
      setSaveMessage('Select at least one retailer in Card 3 before creating shipment.')
      return
    }

    const retailersById = new Map((retailersForCard3 || []).map((r) => [Number(r.branch_id), r]))

    const orders = []
    for (const branchId of selectedIds) {
      const r = retailersById.get(branchId)
      const branchName = r?.branch_name ?? r?.name ?? `Branch ${branchId}`
      const items = (products || [])
        .map((p) => {
          const pid = Number(p.product_id)
          const requested = getQty(branchId, pid)
          return {
            product_id: pid,
            requested_qty: requested,
          }
        })
        .filter((i) => (i.requested_qty ?? 0) > 0)

      if (items.length === 0) {
        setSaveMessage(`Retailer "${branchName}": add at least one product quantity.`)
        return
      }

      orders.push({ customer_branch_id: branchId, items })
    }

    const dc_assignments = includedDcs.map((d) => {
      const a = dcAssignments[d.branch_id] || {}
      return {
        dc_branch_id: d.branch_id,
        local_car_id: a.local_car_id || null,
        driver_emp_id: a.local_driver_emp_id ? parseInt(a.local_driver_emp_id, 10) : null,
        sales_emp_id: a.local_sales_emp_id ? parseInt(a.local_sales_emp_id, 10) : null,
      }
    })

    setSaveMessage('')
    setSaving(true)
    try {
      await createShipment({
        route_id: parseInt(routeId, 10),
        main_car_id: parseInt(mainCarId, 10),
        main_driver_emp_id: parseInt(mainDriverId, 10),
        main_sales_emp_id: parseInt(mainSalesId, 10),
        status: 'PLANNING',
        dc_assignments,
        orders,
      })
      setSaveMessage('Shipment created successfully.')
      setRouteId('')
      setRouteText('')
      setMainCarId('')
      setMainCarText('')
      setMainDriverId('')
      setMainDriverText('')
      setMainSalesId('')
      setMainSalesText('')
      setOrderQuantities({})
      setAiSuggestedQuantities({})
      navigate('/orders')
    } catch (err) {
      setSaveMessage(err.message || 'Failed to create shipment')
    } finally {
      setSaving(false)
    }
  }, [
    routeId,
    mainCarId,
    mainDriverId,
    mainSalesId,
    selectedRetailerIds,
    retailersForCard3,
    products,
    getQty,
    aiSuggestedQuantities,
    dcsOnRoute,
    dcAssignments,
  ])

  const DEFAULT_CAR_CAPACITY_M3 = 12
  // Use product volume from API (m³); default 0.02 m³ (20 L) if missing — was 0.2 which made "used" huge vs 12 m³ capacity
  const DEFAULT_VOLUME_PER_UNIT_M3 = 0.02

  // Card 3: editable shipment cards (branch, car capacity, volume, totals).
  const shipmentsPreview = useMemo(() => {
    const selectedIds = [...selectedRetailerIds].map(Number).filter(Boolean)
    const retailersById = new Map((retailersForCard3 || []).map((r) => [Number(r.branch_id), r]))

    return selectedIds.map((branchId) => {
      const r = retailersById.get(branchId)
      const branchName = r?.branch_name ?? r?.name ?? `Branch ${branchId}`
      const items = (products || [])
        .map((p) => {
          const pid = Number(p.product_id)
          const qty = orderQuantities?.[branchId]?.[pid] ?? 0
          const volM3 = typeof p.volume_m3 === 'number' && p.volume_m3 > 0 ? p.volume_m3 : DEFAULT_VOLUME_PER_UNIT_M3
          return {
            product_id: pid,
            product_code: p.barcode ?? String(pid),
            product_name: p.name ?? '',
            quantity: Number(qty) || 0,
            unit_price: Number(p.unit_price) || 0,
            volume_per_unit_m3: volM3,
          }
        })
        .filter((it) => it.quantity > 0)

      return {
        branch_id: branchId,
        branch_name: branchName,
        car_capacity_m3: DEFAULT_CAR_CAPACITY_M3,
        items,
      }
    })
  }, [selectedRetailerIds, retailersForCard3, products, orderQuantities])

  const handleShipmentsChange = useCallback((nextShipments) => {
    const next = {}
    ;(nextShipments || []).forEach((s) => {
      const bid = Number(s.branch_id)
      if (Number.isNaN(bid)) return
      next[bid] = {}
      ;(s.items || []).forEach((it) => {
        const pid = Number(it.product_id)
        if (!Number.isNaN(pid)) next[bid][pid] = Math.max(0, Number(it.quantity) || 0)
      })
    })
    setOrderQuantities(next)
  }, [])

  if (loading) {
    return (
      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800 mb-6">
        <span className="material-symbols-outlined">add_road</span>
        Create Shipment Plan
      </h1>

      <nav className="flex items-center gap-1 mb-6 text-sm flex-wrap" aria-label="Shipment plan steps">
        {STEPS.map((step, i) => (
          <span key={step.id} className="flex items-center gap-1">
            <span className="px-3 py-2 rounded-lg font-medium text-slate-600">{step.label}</span>
            {i < STEPS.length - 1 && <span className="text-slate-300 material-symbols-outlined text-lg">chevron_right</span>}
          </span>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        <div className="flex flex-col gap-6">
          {/* Card 1: Line Haul */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-700 mb-4">1. Line Haul (Factory → DC)</h2>
            <div className="grid grid-cols-1 gap-4">
              <SearchableCombobox
                label="Route"
                placeholder="Select route…"
                options={routes}
                value={routeId}
                displayText={routeText}
                onSelect={(id, text) => {
                  setRouteId(String(id))
                  setRouteText(text)
                }}
                getOptionId={(o) => o.route_id ?? ''}
                getOptionLabel={(o) => o.name ?? ''}
                required
              />
              <SearchableCombobox
                label="Main Truck (10-Wheel)"
                placeholder="Select truck…"
                options={mainTrucks}
                value={mainCarId}
                displayText={mainCarText}
                onSelect={(id, text) => {
                  setMainCarId(String(id))
                  setMainCarText(text)
                }}
                getOptionId={(o) => o.car_id ?? ''}
                getOptionLabel={(o) => `${o.license_plate ?? ''} (${o.type_name ?? ''})`}
              />
              {mainTrucks.length === 0 && <p className="text-amber-600 text-sm">No 10-wheel trucks available.</p>}
              <SearchableCombobox
                label="Driver"
                placeholder="Select driver…"
                options={mainDriverOptions}
                value={mainDriverId}
                displayText={mainDriverText}
                onSelect={(id, text) => {
                  setMainDriverId(String(id))
                  setMainDriverText(text)
                }}
                getOptionId={(o) => o.emp_id ?? ''}
                getOptionLabel={getEmployeeLabel}
                required
              />
              <SearchableCombobox
                label="Salesperson"
                placeholder="Select salesperson…"
                options={mainSalesOptions}
                value={mainSalesId}
                displayText={mainSalesText}
                onSelect={(id, text) => {
                  setMainSalesId(String(id))
                  setMainSalesText(text)
                }}
                getOptionId={(o) => o.emp_id ?? ''}
                getOptionLabel={getEmployeeLabel}
                required
              />
              <p className="text-xs text-slate-500">Buddy System: every vehicle must have 1 Driver + 1 Salesperson.</p>
            </div>
          </div>

          {/* Card 2: Last Mile */}
          <div className={`bg-white border rounded-xl shadow-sm p-6 ${routeId ? 'border-slate-200' : 'border-slate-100 opacity-75'}`}>
            <h2 className="text-base font-semibold text-slate-700 mb-4">2. Last Mile (DC → Retailers)</h2>
            {!routeId ? (
              <p className="text-slate-500 text-sm">Select a route in Card 1 first.</p>
            ) : dcsOnRoute.length === 0 ? (
              <p className="text-slate-500 text-sm">No DCs on this route (or branch categories not set).</p>
            ) : (
              <div className="space-y-4">
                {dcsOnRoute.map((stop) => {
                  const bid = stop.branch_id
                  const a = dcAssignments[bid] || {}
                  return (
                    <div key={bid} className="border border-slate-200 rounded-lg p-4 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!a.included}
                          onChange={() => toggleDcIncluded(bid)}
                          className="rounded border-slate-300"
                        />
                        <span className="font-medium text-slate-700">{stop.branch_name ?? `Branch ${bid}`}</span>
                      </label>
                      {a.included && (
                        <div className="grid grid-cols-1 gap-3 pl-6">
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                            <SearchableCombobox
                              label="Local Vehicle (4-Wheel Pickup)"
                              placeholder="Select 4-wheel…"
                              options={localVehicles.filter((c) => {
                                const id = Number(c.car_id)
                                const current = a.local_car_id ? Number(a.local_car_id) : null
                                if (current && id === current) return true
                                return !usedLocalVehicleIds.has(id)
                              })}
                              value={a.local_car_id}
                              displayText={a.local_car_text}
                              onSelect={(id, text) => setDcLocalCar(bid, id, text)}
                              getOptionId={(o) => o.car_id ?? ''}
                              getOptionLabel={(o) => `${o.license_plate ?? ''} (${o.type_name ?? ''})`}
                            />
                            <button
                              type="button"
                              onClick={() => clearDcLocalCar(bid)}
                              disabled={!a.local_car_id}
                              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <SearchableCombobox
                              label="Local Driver"
                              placeholder="Select driver…"
                              options={(drivers || []).filter((d) => {
                                const id = Number(d.emp_id)
                                if (id === Number(a.local_driver_emp_id)) return true
                                if (usedEmployeeIds.has(id)) return false
                                if (id === Number(a.local_sales_emp_id)) return false
                                return true
                              })}
                              value={a.local_driver_emp_id}
                              displayText={a.local_driver_text}
                              onSelect={(id, text) => setDcLocalDriver(bid, id, text)}
                              getOptionId={(o) => o.emp_id ?? ''}
                              getOptionLabel={getEmployeeLabel}
                            />
                            <SearchableCombobox
                              label="Local Sales"
                              placeholder="Select sales…"
                              options={(sales || []).filter((s) => {
                                const id = Number(s.emp_id)
                                if (id === Number(a.local_sales_emp_id)) return true
                                if (usedEmployeeIds.has(id)) return false
                                if (id === Number(a.local_driver_emp_id)) return false
                                return true
                              })}
                              value={a.local_sales_emp_id}
                              displayText={a.local_sales_text}
                              onSelect={(id, text) => setDcLocalSales(bid, id, text)}
                              getOptionId={(o) => o.emp_id ?? ''}
                              getOptionLabel={getEmployeeLabel}
                            />
                          </div>
                          <p className="text-xs text-slate-500">Assign a Driver + Sales pair for this DC vehicle.</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: AI Allocation */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">3. AI Allocation & Order Generation</h2>
          {!routeId ? (
            <p className="text-slate-500 text-sm">Select a route first.</p>
          ) : retailersLoading ? (
            <p className="text-slate-500 text-sm">Loading retailers…</p>
          ) : retailersForCard3.length === 0 ? (
            <p className="text-slate-500 text-sm">No retailers found. Include at least one DC in Card 2; retailers are linked to DCs via parent_branch_id.</p>
          ) : (
            <>
              <div className="mb-4">
                <div className="text-sm font-semibold text-slate-700 mb-2">เลือกสาขา</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {retailersForCard3.map((stop) => {
                    const bid = stop.branch_id
                    const selected = selectedRetailerIds.has(bid)
                    return (
                      <label key={bid} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRetailer(bid)}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{stop.branch_name ?? `Branch ${bid}`}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleAutoAllocate}
                  disabled={allocating || selectedRetailerIds.size === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {allocating ? 'Calculating…' : 'Auto-Allocate Quantities'}
                </button>
              </div>
              {allocError && <p className="text-red-600 text-sm mb-3">{allocError}</p>}

              <ShipmentCards
                shipments={shipmentsPreview}
                onShipmentsChange={handleShipmentsChange}
                products={products}
              />

              <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCreateShipment}
                  disabled={saving || !routeId || !mainCarId || !mainDriverId || !mainSalesId}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating…' : 'Create Shipment'}
                </button>
                {saveMessage && (
                  <p className={`mt-2 text-sm ${saveMessage.startsWith('Shipment created') ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {saveMessage}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
