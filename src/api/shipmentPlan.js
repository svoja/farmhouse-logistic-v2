import { fetchJson } from './fetchJson'

export async function fetchV2Routes() {
  const data = await fetchJson('/api/v2/routes')
  return Array.isArray(data) ? data : []
}

export async function fetchV2RouteStops(routeId) {
  if (!routeId) return []
  const data = await fetchJson(`/api/v2/route-stops/${routeId}`)
  return Array.isArray(data) ? data : []
}

/** Get retailers supplied by this DC (branch.parent_branch_id = dcBranchId, cat_id = 3). */
export async function fetchV2RetailersByDc(dcBranchId) {
  if (!dcBranchId) return []
  const data = await fetchJson(`/api/v2/branches/${dcBranchId}/retailers`)
  return Array.isArray(data) ? data : []
}

/** @param {string} typeFilter - e.g. '10' for main truck, '4' for local
 *  @param {boolean} availableOnly - if true, exclude cars assigned to PLANNING/LOADING/IN_TRANSIT */
export async function fetchV2Cars(typeFilter = '', availableOnly = true) {
  const qs = new URLSearchParams()
  if (typeFilter) qs.set('type', typeFilter)
  if (availableOnly) qs.set('available', '1')
  const url = qs.toString() ? `/api/v2/cars?${qs.toString()}` : '/api/v2/cars'
  const data = await fetchJson(url)
  return Array.isArray(data) ? data : []
}

export async function fetchV2Employees(params = {}) {
  const qs = new URLSearchParams()
  if (params.job_id != null) qs.set('job_id', params.job_id)
  if (params.job_title) qs.set('job_title', params.job_title)
  const url = qs.toString() ? `/api/v2/employees?${qs}` : '/api/v2/employees'
  const data = await fetchJson(url)
  return Array.isArray(data) ? data : []
}

export async function fetchV2Products() {
  const data = await fetchJson('/api/v2/products')
  return Array.isArray(data) ? data : []
}

export async function fetchV2BranchCategories() {
  const data = await fetchJson('/api/v2/branch-categories')
  return Array.isArray(data) ? data : []
}

export async function calculateAllocation(branchIds, productIds = [], carCapacityM3 = 12) {
  const body = { branch_ids: branchIds }
  if (Array.isArray(productIds) && productIds.length > 0) body.product_ids = productIds
  if (carCapacityM3 > 0) body.car_capacity_m3 = carCapacityM3
  const data = await fetchJson('/api/allocations/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return data?.allocations ?? []
}

export async function createShipment(payload) {
  const data = await fetchJson('/api/create-shipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return data
}
