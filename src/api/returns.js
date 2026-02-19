import { fetchJson } from './fetchJson'

/**
 * @param {{ days?: number | string, from?: string, to?: string, original_order_id?: number | string }} params
 */
export async function fetchReturns(params = {}) {
  const qs = new URLSearchParams()
  if (params.days != null && params.days !== '') qs.set('days', String(params.days))
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.original_order_id != null && params.original_order_id !== '') qs.set('original_order_id', String(params.original_order_id))
  const url = `/api/returns${qs.toString() ? `?${qs.toString()}` : ''}`
  const data = await fetchJson(url)
  return Array.isArray(data) ? data : []
}

export async function fetchReturnById(id) {
  const data = await fetchJson(`/api/returns/${id}`)
  return data
}

export async function createReturn(body) {
  const data = await fetchJson('/api/returns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return data
}
