import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  fetchRoutes,
  fetchEmployees,
  fetchCars,
  fetchBranchesByRoute,
  fetchProducts,
  fetchBoxSizes,
  fetchBranchInsights,
  fetchLocalBranches,
  requestOrderSuggest,
  createOrder,
} from '../api/createOrder'
import SearchableCombobox from '../components/SearchableCombobox'

const STEPS = [
  { id: 'route', label: 'Route', icon: 'route' },
  { id: 'local_load', label: 'Local road', icon: 'local_shipping' },
  { id: 'branches', label: 'Branches', icon: 'store' },
  { id: 'order_per_branch', label: 'Order per branch', icon: 'shopping_cart' },
]

export default function CreateOrderPage() {
  const [routes, setRoutes] = useState([])
  const [drivers, setDrivers] = useState([])
  const [sales, setSales] = useState([])
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [currentStep, setCurrentStep] = useState('route')
  const routeCardRef = useRef(null)
  const localLoadCardRef = useRef(null)
  const branchesCardRef = useRef(null)
  const orderPerBranchCardRef = useRef(null)

  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [boxSizes, setBoxSizes] = useState([])
  const [boxSizeId, setBoxSizeId] = useState('')
  const [boxSizeText, setBoxSizeText] = useState('')
  const [insights, setInsights] = useState({})
  const [selectedRoutebranchIds, setSelectedRoutebranchIds] = useState(new Set())
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [branchChecked, setBranchChecked] = useState({})
  const [editedItems, setEditedItems] = useState({})
  const [factorChecked, setFactorChecked] = useState({})
  const [branchComments, setBranchComments] = useState({})
  const [localBranchMap, setLocalBranchMap] = useState({})

  const [routeId, setRouteId] = useState('')
  const [routeText, setRouteText] = useState('')
  const [driverId, setDriverId] = useState('')
  const [driverText, setDriverText] = useState('')
  const [salesId, setSalesId] = useState('')
  const [salesText, setSalesText] = useState('')
  const [carId, setCarId] = useState('')
  const [carText, setCarText] = useState('')

  const [localDriverId, setLocalDriverId] = useState('')
  const [localDriverText, setLocalDriverText] = useState('')
  const [localSalesId, setLocalSalesId] = useState('')
  const [localSalesText, setLocalSalesText] = useState('')
  const [localCarId, setLocalCarId] = useState('')
  const [localCarText, setLocalCarText] = useState('')

  const availableCars = useMemo(
    () => cars.filter((c) => (c.cars_type_id ?? c.carsTypeId) === 2 && (c.status ?? '').toLowerCase() === 'available'),
    [cars]
  )

  const availableSmallCars = useMemo(
    () => cars.filter((c) => (c.cars_type_id ?? c.carsTypeId) === 1 && (c.status ?? '').toLowerCase() === 'available'),
    [cars]
  )

  const localDriverOptions = useMemo(
    () => drivers.filter((d) => String(d.employees_id ?? d.employeesId) !== driverId),
    [drivers, driverId]
  )

  const localSalesOptions = useMemo(
    () => sales.filter((s) => String(s.employees_id ?? s.employeesId) !== salesId),
    [sales, salesId]
  )

  const maxBoxesByStacking = useCallback((truckW, truckL, truckH, boxW, boxL, boxH) => {
    const tw = truckW > 0 ? truckW : 1
    const tl = truckL > 0 ? truckL : 1
    const th = truckH > 0 ? truckH : 1
    const bw = boxW > 0 ? boxW : 1
    const bl = boxL > 0 ? boxL : 1
    const bh = boxH > 0 ? boxH : 1
    let max = 0
    const perms = [
      [bl, bw, bh], [bl, bh, bw], [bw, bl, bh], [bw, bh, bl], [bh, bl, bw], [bh, bw, bl],
    ]
    perms.forEach(([p1, p2, p3]) => {
      const n1 = Math.floor(tl / p1)
      const n2 = Math.floor(tw / p2)
      const n3 = Math.floor(th / p3)
      max = Math.max(max, n1 * n2 * n3)
    })
    return max
  }, [])

  const branchCapacity = useCallback((rbId, items, vehicle) => {
    const selectedBox = boxSizes.find((b) => String(b.box_size_id ?? b.boxSizeId) === String(boxSizeId))
    const car = vehicle === 'local'
      ? cars.find((c) => String(c.car_id ?? c.carId) === String(localCarId))
      : cars.find((c) => String(c.car_id ?? c.carId) === String(carId))
    if (!selectedBox) return null
    const boxW = (parseFloat(selectedBox.box_size_width ?? selectedBox.boxSizeWidth) || 40) / 100
    const boxL = (parseFloat(selectedBox.box_size_length ?? selectedBox.boxSizeLength) || 60) / 100
    const boxH = (parseFloat(selectedBox.box_size_high ?? selectedBox.boxSizeHigh) || 15) / 100
    if (boxW * boxL * boxH <= 0) return null
    const PACKING_FACTOR = 0.8
    const getProductVol = (pid) => {
      const p = products.find((x) => String(x.product_id ?? x.productId) === String(pid))
      if (!p) return 0
      const w = parseFloat(p.product_size_width ?? p.productSizeWidth) || 5
      const l = parseFloat(p.product_size_length ?? p.productSizeLength) || 5
      const h = parseFloat(p.product_size_high ?? p.productSizeHigh) || 5
      return (w / 100) * (l / 100) * (h / 100)
    }
    const vol = items.reduce((s, i) => s + (i.qty ?? 0) * getProductVol(i.product_id ?? i.productId), 0)
    const boxes = Math.ceil(vol / (boxW * boxL * boxH * PACKING_FACTOR)) || 0
    let maxBoxes = 0
    let pct = 0
    if (car) {
      const cw = parseFloat(car.cars_size_width ?? car.carsSizeWidth) || 2
      const cl = parseFloat(car.cars_size_length ?? car.carsSizeLength) || 5
      const ch = parseFloat(car.cars_size_high ?? car.carsSizeHigh) || 2
      maxBoxes = maxBoxesByStacking(cw, cl, ch, boxW, boxL, boxH)
      pct = maxBoxes > 0 ? Math.min(100, (boxes / maxBoxes) * 100) : 0
    }
    return { boxes, maxBoxes, pct, vol }
  }, [boxSizes, boxSizeId, products, cars, carId, localCarId, maxBoxesByStacking])

  useEffect(() => {
    Promise.all([fetchRoutes(1), fetchEmployees(1), fetchEmployees(2), fetchCars(), fetchProducts(), fetchBoxSizes()])
      .then(([r, d, s, c, p, bs]) => {
        setRoutes(r)
        setDrivers(d)
        setSales(s)
        setCars(c)
        setProducts(Array.isArray(p) ? p : [])
        const bsList = Array.isArray(bs) ? bs : []
        setBoxSizes(bsList)
        const defaultM = bsList.find((b) => (b.box_size_name ?? b.boxSizeName ?? '').includes('M') || (b.box_size_id ?? b.boxSizeId) === 2)
        if (defaultM) {
          setBoxSizeId(String(defaultM.box_size_id ?? defaultM.boxSizeId ?? ''))
          setBoxSizeText(defaultM.box_size_name ?? defaultM.boxSizeName ?? '')
        }
      })
      .catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!routeId) {
      setBranches([])
      setSelectedRoutebranchIds(new Set())
      setInsights({})
      return
    }
    fetchBranchesByRoute(routeId)
      .then((list) => setBranches(Array.isArray(list) ? list : []))
      .catch(() => setBranches([]))
    setSelectedRoutebranchIds(new Set())
    setAiResult(null)
  }, [routeId])

  const allSelectedBranches = useMemo(() => {
    const fromMain = [...selectedRoutebranchIds].reduce((acc, rbId) => {
      const b = branches.find((br) => Number(br.routebranch_id ?? br.routebranchId) === rbId)
      if (b) acc.push(b)
      return acc
    }, [])
    const fromLocal = Object.values(localBranchMap).flat().filter((sub) => {
      const subRbId = Number(sub.routebranch_id ?? sub.routebranchId)
      return selectedRoutebranchIds.has(subRbId)
    })
    return [...fromMain, ...fromLocal]
  }, [selectedRoutebranchIds, branches, localBranchMap])

  useEffect(() => {
    const branchIds = allSelectedBranches.map((b) => b.branch_id ?? b.branchId).filter(Boolean)
    if (branchIds.length === 0) {
      setInsights({})
      return
    }
    fetchBranchInsights(branchIds)
      .then((data) => setInsights(data || {}))
      .catch(() => setInsights({}))
  }, [allSelectedBranches])

  useEffect(() => {
    const tickedDistributors = [...selectedRoutebranchIds].reduce((acc, rbId) => {
      const b = branches.find((br) => Number(br.routebranch_id ?? br.routebranchId) === rbId)
      if (!b) return acc
      const cat = Number(b.branch_category_id ?? b.branchCategoryId ?? 0)
      if (cat !== 3) acc.push(b.branch_id ?? b.branchId)
      return acc
    }, [])
    const currentKeys = Object.keys(localBranchMap).map(Number)
    const toRemove = currentKeys.filter((bid) => !tickedDistributors.includes(bid))
    if (toRemove.length > 0) {
      setLocalBranchMap((prev) => {
        const next = { ...prev }
        toRemove.forEach((bid) => delete next[bid])
        return next
      })
    }
    const toFetch = tickedDistributors.filter((bid) => !(bid in localBranchMap))
    toFetch.forEach((bid) => {
      fetchLocalBranches(bid)
        .then((list) => setLocalBranchMap((prev) => ({ ...prev, [bid]: list })))
        .catch(() => setLocalBranchMap((prev) => ({ ...prev, [bid]: [] })))
    })
  }, [selectedRoutebranchIds, branches])

  useEffect(() => {
    if (localDriverId && String(localDriverId) === String(driverId)) {
      setLocalDriverId('')
      setLocalDriverText('')
    }
  }, [driverId, localDriverId])

  useEffect(() => {
    if (localSalesId && String(localSalesId) === String(salesId)) {
      setLocalSalesId('')
      setLocalSalesText('')
    }
  }, [salesId, localSalesId])

  const normRbId = useCallback((id) => (id != null ? Number(id) : null), [])
  const toggleRoutebranch = useCallback((rbId) => {
    const n = normRbId(rbId)
    if (n == null) return
    setSelectedRoutebranchIds((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }, [normRbId])

  const getFactorKey = (branchId, type, index) => `${branchId}-${type}-${index}`

  const toggleFactor = useCallback((branchId, type, index) => {
    const key = getFactorKey(branchId, type, index)
    setFactorChecked((prev) => ({ ...prev, [key]: !(prev[key] !== false) }))
  }, [])

  const isFactorChecked = useCallback(
    (branchId, type, index) => factorChecked[getFactorKey(branchId, type, index)] !== false,
    [factorChecked]
  )

  const setBranchComment = useCallback((branchId, text) => {
    setBranchComments((prev) => ({ ...prev, [branchId]: text }))
  }, [])

  const handleAskAI = useCallback(async () => {
    const rbIds = [...selectedRoutebranchIds].map((n) => (typeof n === 'string' ? parseInt(n, 10) : n)).filter((n) => !isNaN(n))
    if (rbIds.length === 0) {
      setAiError('Select at least one branch')
      return
    }
    setAiError('')
    setAiLoading(true)
    setAiResult(null)
    try {
      const branchIds = rbIds
        .map((rbId) => {
          const b = branches.find((br) => (br.routebranch_id ?? br.routebranchId) === rbId)
          return b?.branch_id ?? b?.branchId
        })
        .filter(Boolean)
      const filteredInsights = {}
      branchIds.forEach((branchId) => {
        const ins = insights[branchId] || {}
        filteredInsights[branchId] = {
          customer: (ins.customer ?? []).filter((_, i) => factorChecked[getFactorKey(branchId, 'customer', i)] !== false),
          peak_time: (ins.peak_time ?? []).filter((_, i) => factorChecked[getFactorKey(branchId, 'peak_time', i)] !== false),
          product: (ins.product ?? []).filter((_, i) => factorChecked[getFactorKey(branchId, 'product', i)] !== false),
        }
      })
      const commentsForBranches = {}
      branchIds.forEach((bid) => {
        const c = branchComments[bid]
        if (c && String(c).trim()) commentsForBranches[bid] = String(c).trim()
      })
      const selectedBox = boxSizes.find((b) => String(b.box_size_id ?? b.boxSizeId) === String(boxSizeId))
      const mainTruckCar = cars.find((c) => String(c.car_id ?? c.carId) === String(carId))
      const localRoadCar = cars.find((c) => String(c.car_id ?? c.carId) === String(localCarId))
      const boxSizePayload = selectedBox
        ? {
            box_size_width: selectedBox.box_size_width ?? selectedBox.boxSizeWidth ?? 0,
            box_size_length: selectedBox.box_size_length ?? selectedBox.boxSizeLength ?? 0,
            box_size_high: selectedBox.box_size_high ?? selectedBox.boxSizeHigh ?? 0,
          }
        : null
      const mainTruckPayload = mainTruckCar
        ? {
            cars_size_width: mainTruckCar.cars_size_width ?? mainTruckCar.carsSizeWidth ?? 0,
            cars_size_length: mainTruckCar.cars_size_length ?? mainTruckCar.carsSizeLength ?? 0,
            cars_size_high: mainTruckCar.cars_size_high ?? mainTruckCar.carsSizeHigh ?? 0,
          }
        : null
      const localCarPayload = localRoadCar
        ? {
            cars_size_width: localRoadCar.cars_size_width ?? localRoadCar.carsSizeWidth ?? 0,
            cars_size_length: localRoadCar.cars_size_length ?? localRoadCar.carsSizeLength ?? 0,
            cars_size_high: localRoadCar.cars_size_high ?? localRoadCar.carsSizeHigh ?? 0,
          }
        : null
      const data = await requestOrderSuggest({
        routebranch_ids: rbIds,
        branch_ids: branchIds,
        insights: filteredInsights,
        branch_comments: commentsForBranches,
        products,
        box_size: boxSizePayload,
        main_truck: mainTruckPayload,
        local_car: localCarPayload,
      })
      const brs = data?.branches ?? []
      setAiResult({ branches: brs })
      const initChecked = {}
      const initItems = {}
      brs.forEach((b) => {
        const rid = b.routebranch_id ?? b.routebranchId
        initChecked[rid] = true
        initItems[rid] = (b.items ?? []).map((i) => ({
          product_id: i.product_id ?? i.productId,
          product_name: i.product_name ?? i.productName ?? '',
          qty: i.qty ?? 1,
          unit_price: i.unit_price ?? i.unitPrice ?? 0,
          total: (i.qty ?? 1) * (i.unit_price ?? i.unitPrice ?? 0),
        }))
      })
      setBranchChecked(initChecked)
      setEditedItems(initItems)
    } catch (err) {
      setAiError(err.message || 'Failed to get AI suggestion')
    } finally {
      setAiLoading(false)
    }
  }, [selectedRoutebranchIds, branches, insights, products, factorChecked, branchComments, boxSizes, boxSizeId, cars, carId, localCarId])

  const setBranchItemQty = useCallback((routebranchId, itemIndex, qty) => {
    const q = Math.max(0, parseInt(qty, 10) || 0)
    setEditedItems((prev) => {
      const list = prev[routebranchId] ? [...prev[routebranchId]] : []
      if (list[itemIndex]) {
        const it = { ...list[itemIndex], qty: q }
        it.total = it.qty * (it.unit_price || 0)
        list[itemIndex] = it
      }
      return { ...prev, [routebranchId]: list }
    })
  }, [])

  const addProductToBranch = useCallback((routebranchId, product) => {
    const prod = products.find((p) => (p.product_id ?? p.productId) === (product.product_id ?? product.productId))
    if (!prod) return
    const pid = prod.product_id ?? prod.productId
    const pname = prod.product_name ?? prod.productName ?? ''
    const up = parseFloat(prod.unit_price ?? prod.unitPrice) || 0
    setEditedItems((prev) => {
      const list = prev[routebranchId] ? [...prev[routebranchId]] : []
      const existing = list.findIndex((i) => (i.product_id ?? i.productId) === pid)
      if (existing >= 0) {
        list[existing] = { ...list[existing], qty: (list[existing].qty ?? 0) + 1, total: ((list[existing].qty ?? 0) + 1) * (list[existing].unit_price || 0) }
        return { ...prev, [routebranchId]: list }
      }
      list.push({ product_id: pid, product_name: pname, qty: 1, unit_price: up, total: up })
      return { ...prev, [routebranchId]: list }
    })
  }, [products])

  const removeBranchItem = useCallback((routebranchId, itemIndex) => {
    setEditedItems((prev) => {
      const list = prev[routebranchId] ? [...prev[routebranchId]] : []
      list.splice(itemIndex, 1)
      return { ...prev, [routebranchId]: list }
    })
  }, [])

  const toggleBranchChecked = useCallback((routebranchId) => {
    setBranchChecked((prev) => ({ ...prev, [routebranchId]: !prev[routebranchId] }))
  }, [])

  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSave = useCallback(async () => {
    const empId = driverId || localDriverId
    if (!empId) {
      setSaveMessage('Please select a driver')
      return
    }
    const checked = Object.entries(branchChecked).filter(([, v]) => v)
    if (checked.length === 0) {
      setSaveMessage('Select at least one branch to save')
      return
    }
    setSaveMessage('')
    setSaveLoading(true)
    try {
      let success = 0
      let fail = 0
      for (const [routebranchId, _] of checked) {
        const items = editedItems[routebranchId] || []
        const valid = items.filter((i) => (i.qty ?? 0) > 0).map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: i.unit_price }))
        if (valid.length === 0) continue
        try {
          const branch = branches.find((b) => Number(b.routebranch_id ?? b.routebranchId) === parseInt(routebranchId, 10))
          const isLocal = Object.values(localBranchMap).flat().some((sub) => Number(sub.routebranch_id ?? sub.routebranchId) === parseInt(routebranchId, 10))
          const selectedCarId = isLocal ? localCarId : carId
          await createOrder({
            employees_id: parseInt(empId, 10),
            routebranch_id: parseInt(routebranchId, 10),
            car_id: selectedCarId ? parseInt(selectedCarId, 10) : null,
            items: valid,
          })
          success++
        } catch {
          fail++
        }
      }
      if (success > 0) setSaveMessage(`Saved ${success} order(s)${fail ? `, ${fail} failed` : ''}.`)
      else setSaveMessage('Failed to save orders.')
    } catch (err) {
      setSaveMessage(err.message || 'Save failed')
    } finally {
      setSaveLoading(false)
    }
  }, [driverId, localDriverId, branchChecked, editedItems, branches, localBranchMap, carId, localCarId])

  useEffect(() => {
    const els = [routeCardRef.current, localLoadCardRef.current, branchesCardRef.current, orderPerBranchCardRef.current].filter(Boolean)
    if (els.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          let id = 'route'
          if (e.target === routeCardRef.current) id = 'route'
          else if (e.target === localLoadCardRef.current) id = 'local_load'
          else if (e.target === branchesCardRef.current) id = 'branches'
          else if (e.target === orderPerBranchCardRef.current) id = 'order_per_branch'
          setCurrentStep(id)
        })
      },
      { threshold: 0.3, rootMargin: '-20% 0px -60% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [loading, aiResult])

  const scrollToCard = (stepId) => {
    setCurrentStep(stepId)
    const map = { route: routeCardRef, local_load: localLoadCardRef, branches: branchesCardRef, order_per_branch: orderPerBranchCardRef }
    const el = map[stepId]?.current
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800 mb-6">
        <span className="material-symbols-outlined">add_circle</span>
        Create Order
      </h1>

      <nav
        className="flex items-center gap-1 mb-6 text-sm flex-wrap"
        aria-label="Create order steps"
      >
        {STEPS.map((step, i) => {
          const isActive = currentStep === step.id
          const isDisabled = step.id === 'order_per_branch' && !aiResult?.branches?.length
          return (
            <span key={step.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => !isDisabled && scrollToCard(step.id)}
                disabled={isDisabled}
                className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                  isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : isActive
                    ? 'bg-sky-100 text-sky-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <span className="text-slate-300" aria-hidden>
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        <div className="flex flex-col gap-6 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-2">
          <div ref={routeCardRef} className="scroll-mt-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-700 mb-4">Route, driver and vehicle</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SearchableCombobox
                  label="Route"
                  placeholder="Search route…"
                  options={routes}
                  value={routeId}
                  displayText={routeText}
                  onSelect={(id, text) => { setRouteId(String(id)); setRouteText(text) }}
                  getOptionId={(o) => o.routes_id ?? o.routesId ?? ''}
                  getOptionLabel={(o) => o.routes_name ?? o.routesName ?? ''}
                  required
                />
                <SearchableCombobox
                  label="Car"
                  placeholder="Search car…"
                  options={availableCars}
                  value={carId}
                  displayText={carText}
                  onSelect={(id, text) => { setCarId(String(id)); setCarText(text) }}
                  getOptionId={(o) => o.car_id ?? o.carId ?? ''}
                  getOptionLabel={(o) => `${o.license_plate ?? ''} (${o.cars_type_name ?? o.carsTypeName ?? ''})`.trim()}
                />
                <SearchableCombobox
                  label="Driver"
                  placeholder="Search driver…"
                  options={drivers}
                  value={driverId}
                  displayText={driverText}
                  onSelect={(id, text) => { setDriverId(String(id)); setDriverText(text) }}
                  getOptionId={(o) => o.employees_id ?? o.employeesId ?? ''}
                  getOptionLabel={(o) => o.full_name ?? `${o.emp_firstname ?? ''} ${o.emp_lastname ?? ''}`.trim()}
                  required
                />
                <SearchableCombobox
                  label="Sales"
                  placeholder="Search sales…"
                  options={sales}
                  value={salesId}
                  displayText={salesText}
                  onSelect={(id, text) => { setSalesId(String(id)); setSalesText(text) }}
                  getOptionId={(o) => o.employees_id ?? o.employeesId ?? ''}
                  getOptionLabel={(o) => o.full_name ?? `${o.emp_firstname ?? ''} ${o.emp_lastname ?? ''}`.trim()}
                />
              </div>
            </div>
          </div>

          <div ref={localLoadCardRef} className="scroll-mt-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-700 mb-4">Local road</h2>
              <div className="flex flex-col gap-6">
                <div className="w-full">
                  <SearchableCombobox
                    label="Car"
                    placeholder="Search car…"
                    options={availableSmallCars}
                    value={localCarId}
                    displayText={localCarText}
                    onSelect={(id, text) => { setLocalCarId(String(id)); setLocalCarText(text) }}
                    getOptionId={(o) => o.car_id ?? o.carId ?? ''}
                    getOptionLabel={(o) => `${o.license_plate ?? ''} (${o.cars_type_name ?? o.carsTypeName ?? ''})`.trim()}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SearchableCombobox
                    label="Driver"
                    placeholder="Search driver…"
                    options={localDriverOptions}
                    value={localDriverId}
                    displayText={localDriverText}
                    onSelect={(id, text) => { setLocalDriverId(String(id)); setLocalDriverText(text) }}
                    getOptionId={(o) => o.employees_id ?? o.employeesId ?? ''}
                    getOptionLabel={(o) => o.full_name ?? `${o.emp_firstname ?? ''} ${o.emp_lastname ?? ''}`.trim()}
                    required
                  />
                  <SearchableCombobox
                    label="Sales"
                    placeholder="Search sales…"
                    options={localSalesOptions}
                    value={localSalesId}
                    displayText={localSalesText}
                    onSelect={(id, text) => { setLocalSalesId(String(id)); setLocalSalesText(text) }}
                    getOptionId={(o) => o.employees_id ?? o.employeesId ?? ''}
                    getOptionLabel={(o) => o.full_name ?? `${o.emp_firstname ?? ''} ${o.emp_lastname ?? ''}`.trim()}
                  />
                </div>
              </div>
            </div>
          </div>

          <div ref={branchesCardRef} className="scroll-mt-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-700 mb-4">Branches + Factors + AI</h2>
              {!routeId ? (
                <p className="text-slate-500 text-sm">Select a route first.</p>
              ) : (
                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-600 mb-2">Branches</h3>
                    {(() => {
                      const getRbId = (b) => Number(b.routebranch_id ?? b.routebranchId)
                      const catId = (b) => Number(b.branch_category_id ?? b.branchCategoryId ?? 0)
                      const seq = (b) => Number(b.stop_sequence ?? b.stopSequence ?? 999)
                      const sorted = [...branches].sort((a, b) => seq(a) - seq(b))
                      const nonRetail = sorted.filter((b) => catId(b) !== 3)
                      const origin = nonRetail.length > 1 ? nonRetail[0] : null
                      const visible = origin
                        ? sorted.filter((b) => getRbId(b) !== getRbId(origin))
                        : sorted
                      const distributors = visible.filter((b) => catId(b) !== 3)
                      if (distributors.length === 0) {
                        return (
                          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                            {visible.map((b) => {
                              const rbId = getRbId(b)
                              const label = (b.branch_name ?? b.branchName ?? `Branch ${b.branch_id ?? b.branchId}`).trim()
                              const checked = selectedRoutebranchIds.has(rbId)
                              return (
                                <label key={rbId} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                                  <input type="checkbox" checked={checked} onChange={() => toggleRoutebranch(rbId)} className="rounded border-slate-300" />
                                  <span className="text-sm text-slate-700">{label}</span>
                                </label>
                              )
                            })}
                          </div>
                        )
                      }
                      return (
                        <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                          {distributors.map((dist) => {
                            const distRbId = getRbId(dist)
                            const distBranchId = dist.branch_id ?? dist.branchId
                            const subs = localBranchMap[distBranchId] || []
                            const distChecked = selectedRoutebranchIds.has(distRbId)
                            const distLabel = (dist.branch_name ?? dist.branchName ?? `Branch ${distBranchId}`).trim()
                            return (
                              <div key={distRbId}>
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                                  <input type="checkbox" checked={distChecked} onChange={() => toggleRoutebranch(distRbId)} className="rounded border-slate-300" />
                                  <span className="text-sm font-medium text-slate-700">{distLabel}</span>
                                </label>
                                {distChecked && subs.length > 0 && (
                                  <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-slate-200 pl-3">
                                    {subs.map((sub) => {
                                      const subRbId = getRbId(sub)
                                      const subLabel = (sub.branch_name ?? sub.branchName ?? `Branch ${sub.branch_id ?? sub.branchId}`).trim()
                                      const subChecked = selectedRoutebranchIds.has(subRbId)
                                      return (
                                        <label key={subRbId} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-2 py-0.5">
                                          <input type="checkbox" checked={subChecked} onChange={() => toggleRoutebranch(subRbId)} className="rounded border-slate-300" />
                                          <span className="text-sm text-slate-600">{subLabel}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                  {selectedRoutebranchIds.size > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-600 mb-2">Factors</h3>
                      <div className="border border-slate-200 rounded-lg p-3 space-y-4 max-h-80 overflow-y-auto">
                        {allSelectedBranches.map((b) => {
                            const branchId = b.branch_id ?? b.branchId
                            const ins = insights[branchId] || {}
                            const hasFactors = ((ins.customer ?? []).length + (ins.peak_time ?? []).length + (ins.product ?? []).length) > 0
                            return (
                              <div key={branchId} className="text-sm border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                                <div className="font-medium text-slate-700 mb-2">{b.branch_name ?? `Branch ${branchId}`}</div>
                                {!hasFactors ? (
                                  <span className="text-slate-500">No insights</span>
                                ) : (
                                  <div className="space-y-1.5 mb-3">
                                    {(ins.customer ?? []).map((c, i) => (
                                      <label key={`c-${i}`} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 py-0.5">
                                        <input
                                          type="checkbox"
                                          checked={isFactorChecked(branchId, 'customer', i)}
                                          onChange={() => toggleFactor(branchId, 'customer', i)}
                                          className="mt-0.5 rounded border-slate-300"
                                        />
                                        <span className="text-slate-600">Customer: {c.customer_type} — {c.description}</span>
                                      </label>
                                    ))}
                                    {(ins.peak_time ?? []).map((p, i) => (
                                      <label key={`p-${i}`} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 py-0.5">
                                        <input
                                          type="checkbox"
                                          checked={isFactorChecked(branchId, 'peak_time', i)}
                                          onChange={() => toggleFactor(branchId, 'peak_time', i)}
                                          className="mt-0.5 rounded border-slate-300"
                                        />
                                        <span className="text-slate-600">Peak: {p.start_time}–{p.end_time} {p.note}</span>
                                      </label>
                                    ))}
                                    {(ins.product ?? []).map((p, i) => (
                                      <label key={`pr-${i}`} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 py-0.5">
                                        <input
                                          type="checkbox"
                                          checked={isFactorChecked(branchId, 'product', i)}
                                          onChange={() => toggleFactor(branchId, 'product', i)}
                                          className="mt-0.5 rounded border-slate-300"
                                        />
                                        <span className="text-slate-600">Product: {p.product_name} — {p.note}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                                <div>
                                  <textarea
                                    placeholder="สำหรับเผื่อพิมพ์สถานการณ์เจาะจง"
                                    value={branchComments[branchId] ?? ''}
                                    onChange={(e) => setBranchComment(branchId, e.target.value)}
                                    rows={2}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                  />
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <SearchableCombobox
                      label="ขนาดกล่อง (Box size)"
                      placeholder="Search box size…"
                      options={boxSizes}
                      value={boxSizeId}
                      displayText={boxSizeText}
                      onSelect={(id, text) => { setBoxSizeId(String(id)); setBoxSizeText(text) }}
                      getOptionId={(o) => o.box_size_id ?? o.boxSizeId ?? ''}
                      getOptionLabel={(o) => o.box_size_name ?? o.boxSizeName ?? `Box ${o.box_size_id}`}
                    />
                    <p className="text-xs text-slate-500">
                      เลือกรถหลัก (10 ล้อ) และรถท้องถิ่น (4 ล้อ) ในขั้น Route และ Local road เพื่อคำนวณความจุ
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAskAI}
                      disabled={aiLoading || selectedRoutebranchIds.size === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {aiLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin">progress_activity</span>
                          Loading…
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">psychology</span>
                          จัดตระกร้าโดย AI
                        </>
                      )}
                    </button>
                    {aiError && <p className="mt-2 text-sm text-red-600">{aiError}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div ref={orderPerBranchCardRef} className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            {aiResult?.branches?.length > 0 ? (
              <>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-slate-700 mb-4">Order per branch</h2>
                  <div className="space-y-4">
                  {aiResult.branches.map((b) => {
                    const rbId = b.routebranch_id ?? b.routebranchId
                    const name = b.branch_name ?? b.branchName ?? `Branch ${rbId}`
                    const sim = b.similarity_pct ?? b.similarityPct
                    const vehicle = b.vehicle || 'main'
                    const checked = branchChecked[rbId] !== false
                    const items = (editedItems[rbId] ?? b.items ?? []).filter((i) => (i.qty ?? 0) > 0)
                    const totalQty = items.reduce((s, i) => s + (i.qty ?? 0), 0)
                    const totalPrice = items.reduce((s, i) => s + (i.total ?? (i.qty ?? 0) * (i.unit_price ?? 0)), 0)
                    return (
                      <div key={rbId} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-50">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-slate-800">{name}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${
                                vehicle === 'local' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {vehicle === 'local' ? 'รถท้องถิ่น' : 'รถหลัก'}
                            </span>
                            {sim != null && <span className="text-sm text-slate-500">{sim}% similarity</span>}
                          </div>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBranchChecked(rbId)}
                              className="rounded border-slate-300"
                            />
                          </label>
                        </div>
                        <div className="p-4 border-t border-slate-200">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-2">ลำดับที่</th>
                                    <th className="text-left py-2 px-2">รหัสสินค้า</th>
                                    <th className="text-left py-2 px-2">ชื่อสินค้า</th>
                                    <th className="text-left py-2 px-2">จำนวน</th>
                                    <th className="text-left py-2 px-2">ราคา</th>
                                    <th className="text-left py-2 px-2">ราคารวม</th>
                                    <th className="w-8" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100">
                                      <td className="py-2 px-2">{idx + 1}</td>
                                      <td className="py-2 px-2">{item.product_id}</td>
                                      <td className="py-2 px-2">{item.product_name}</td>
                                      <td className="py-2 px-2">
                                        <input
                                          type="number"
                                          min={0}
                                          value={item.qty ?? 0}
                                          onChange={(e) => setBranchItemQty(rbId, idx, e.target.value)}
                                          className="w-16 border border-slate-300 rounded px-2 py-1"
                                        />
                                      </td>
                                      <td className="py-2 px-2">{(item.unit_price ?? 0).toFixed(2)}</td>
                                      <td className="py-2 px-2">{(item.total ?? 0).toFixed(2)}</td>
                                      <td>
                                        <button
                                          type="button"
                                          onClick={() => removeBranchItem(rbId, idx)}
                                          className="text-red-500 hover:text-red-700 p-1"
                                          title="Remove"
                                        >
                                          <span className="material-symbols-outlined text-lg">close</span>
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex gap-4 mt-3">
                              <select
                                onChange={(e) => {
                                  const p = products.find((x) => String(x.product_id ?? x.productId) === e.target.value)
                                  if (p) addProductToBranch(rbId, p)
                                  e.target.value = ''
                                }}
                                className="border border-slate-300 rounded px-2 py-1 text-sm"
                              >
                                <option value="">+ Add product</option>
                                {products.map((p) => (
                                  <option key={p.product_id ?? p.productId} value={p.product_id ?? p.productId}>
                                    {p.product_name ?? p.productName} ({(p.unit_price ?? p.unitPrice ?? 0).toFixed(2)})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm font-medium">
                              <span>รวมจำนวน: {totalQty}</span>
                              <span>รวมราคา: {totalPrice.toFixed(2)}</span>
                            </div>
                          </div>
                      </div>
                    )
                  })}
                </div>
                  <div className="mt-6 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saveLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saveLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin">progress_activity</span>
                          บันทึก…
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">save</span>
                          บันทึก
                        </>
                      )}
                    </button>
                    {saveMessage && <span className="text-sm text-slate-600">{saveMessage}</span>}
                  </div>
                </div>
                {aiResult?.branches?.length > 0 && (
                  <div className="space-y-4 shrink-0">
                    {aiResult.branches.map((b) => {
                      const rbId = b.routebranch_id ?? b.routebranchId
                      const name = b.branch_name ?? b.branchName ?? `Branch ${rbId}`
                      const vehicle = b.vehicle || 'main'
                      const items = (editedItems[rbId] ?? b.items ?? []).filter((i) => (i.qty ?? 0) > 0)
                      const cap = branchCapacity(rbId, items, vehicle)
                      if (!cap) return null
                      const isLocal = vehicle === 'local'
                      return (
                        <div key={`cap-${rbId}`} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`material-symbols-outlined text-2xl ${isLocal ? 'text-amber-600' : 'text-sky-600'}`}>
                              {isLocal ? 'directions_car' : 'local_shipping'}
                            </span>
                            <span className="font-semibold text-slate-700 text-sm">
                              {isLocal ? 'รถท้องถิ่น' : 'รถหลัก (10 ล้อ)'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mb-2 ml-8">{name}</p>
                          <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                                cap.pct > 100 ? 'bg-red-500' : cap.pct > 80 ? 'bg-amber-500' : isLocal ? 'bg-amber-400' : 'bg-sky-500'
                              }`}
                              style={{ width: `${Math.min(cap.pct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-600">
                            {cap.boxes} / {cap.maxBoxes || '?'} กล่อง ({cap.pct.toFixed(1)}%)
                            {cap.pct > 100 && <span className="text-red-600 font-medium ml-1">เกินความจุ</span>}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h2 className="text-base font-semibold text-slate-700 mb-4">Order per branch</h2>
                <p className="text-slate-500 text-sm">Use &quot;จัดตระกร้าโดย AI&quot; in Branches to generate order suggestions, then edit and save here.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
