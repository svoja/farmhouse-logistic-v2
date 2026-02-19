import { fetchJson } from './fetchJson'

export async function fetchConfig() {
  const data = await fetchJson('/api/config')
  return data
}

export async function fetchRadarBranches() {
  const data = await fetchJson('/api/v2/radar/branches')
  return Array.isArray(data) ? data : []
}

export async function fetchRadarCars() {
  const data = await fetchJson('/api/v2/radar/cars')
  return data?.cars ?? []
}

export async function updateShipmentStatus(shipmentId, status) {
  return fetchJson(`/api/v2/shipments/${shipmentId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export async function debugAdvanceShipment(shipmentId, mode = 'to_in_transit') {
  return fetchJson(`/api/v2/shipments/${shipmentId}/debug/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
}
