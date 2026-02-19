import { fetchJson } from './fetchJson'

export async function fetchOrders() {
  const data = await fetchJson('/api/v2/orders')
  return Array.isArray(data) ? data : []
}
