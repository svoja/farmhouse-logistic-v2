const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function fetchJson(url, options = {}) {
  const path = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = url.startsWith('http') ? url : (BASE ? `${BASE}/api${path}` : `/api${path}`);
  const res = await fetch(fullUrl, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'Request failed');
    err.status = res.status;
    try { err.body = await res.json(); } catch (_) {}
    throw err;
  }
  return res.json();
}

export async function fetchRoutes() {
  const data = await fetchJson('/routes');
  return Array.isArray(data) ? data : [];
}

export async function fetchRouteStops(routeId) {
  if (!routeId) return [];
  const data = await fetchJson(`/route-stops/${routeId}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchCars(params = {}) {
  const qs = new URLSearchParams();
  if (params.available) qs.set('available', '1');
  if (params.type) qs.set('type', params.type);
  const url = qs.toString() ? `/cars?${qs}` : '/cars';
  const data = await fetchJson(url);
  return Array.isArray(data) ? data : [];
}

export async function fetchEmployees(params = {}) {
  const qs = new URLSearchParams();
  if (params.job_title) qs.set('job_title', params.job_title);
  const url = qs.toString() ? `/employees?${qs}` : '/employees';
  const data = await fetchJson(url);
  return Array.isArray(data) ? data : [];
}

export async function fetchProducts() {
  const data = await fetchJson('/products');
  return Array.isArray(data) ? data : [];
}

export async function fetchBranchCategories() {
  const data = await fetchJson('/branch-categories');
  return Array.isArray(data) ? data : [];
}

export async function fetchRetailersByDc(dcBranchId) {
  if (!dcBranchId) return [];
  const data = await fetchJson(`/branches/${dcBranchId}/retailers`);
  return Array.isArray(data) ? data : [];
}

export async function calculateAllocation(branchIds, productIds = [], carCapacityM3 = 12) {
  const body = { branch_ids: branchIds };
  if (Array.isArray(productIds) && productIds.length > 0) body.product_ids = productIds;
  if (carCapacityM3 > 0) body.car_capacity_m3 = carCapacityM3;
  const data = await fetchJson('/allocations/calculate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data?.allocations ?? [];
}

export async function createShipment(payload) {
  return fetchJson('/shipments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMapBranches() {
  const data = await fetchJson('/map/branches');
  return Array.isArray(data) ? data : [];
}

export async function fetchMapByCar() {
  const data = await fetchJson('/map/by-car');
  return data?.cars ?? [];
}
