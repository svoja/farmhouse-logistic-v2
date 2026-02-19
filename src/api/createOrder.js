import { fetchJson } from './fetchJson'

export async function fetchRoutes(routesType = 1) {
  const data = await fetchJson(`/api/routes?routes_type=${routesType}`)
  return Array.isArray(data) ? data : []
}

export async function fetchEmployees(jobDescriptionId) {
  const data = await fetchJson(`/api/employees?job_description_id=${jobDescriptionId}`)
  return Array.isArray(data) ? data : []
}

export async function fetchCars() {
  const data = await fetchJson('/api/cars')
  return Array.isArray(data) ? data : []
}

export async function fetchBranchesByRoute(routesId) {
  if (!routesId) return []
  const data = await fetchJson(`/api/routes/${routesId}/branches`)
  return Array.isArray(data) ? data : []
}

export async function fetchProducts() {
  const data = await fetchJson('/api/products')
  return Array.isArray(data) ? data : []
}

export async function fetchBoxSizes() {
  const data = await fetchJson('/api/box-sizes')
  return Array.isArray(data) ? data : []
}

export async function fetchLots(params = {}) {
  const qs = new URLSearchParams()
  if (params.product_id != null) qs.set('product_id', params.product_id)
  if (params.latest) qs.set('latest', '1')
  const data = await fetchJson(`/api/lots?${qs.toString()}`)
  return Array.isArray(data) ? data : []
}

export async function fetchInventoryStocks(locationId) {
  const qs = locationId != null ? `?location_id=${locationId}` : ''
  const data = await fetchJson(`/api/inventory-stocks${qs}`)
  return Array.isArray(data) ? data : []
}

export async function updateOrderDeliveryStatus(orderId, deliveryStatus) {
  const data = await fetchJson(`/api/orders/${orderId}/delivery-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivery_status: deliveryStatus }),
  })
  return data
}

export async function fetchLocalBranches(branchId) {
  if (!branchId) return []
  const data = await fetchJson(`/api/branches/${branchId}/local-branches`)
  return Array.isArray(data) ? data : []
}

export async function fetchBranchInsights(branchIds) {
  const ids = Array.isArray(branchIds) ? branchIds.filter((n) => n != null) : []
  if (ids.length === 0) return {}
  try {
    const qs = ids.join(',')
    const data = await fetchJson(`/api/branches/insights?branch_ids=${encodeURIComponent(qs)}`)
    return data && typeof data === 'object' ? data : {}
  } catch {
    return getBranchInsightMock(ids)
  }
}

export async function requestOrderSuggest(body) {
  const data = await fetchJson('/api/order-suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return data
}

export async function createOrder(body) {
  const data = await fetchJson('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return data
}
