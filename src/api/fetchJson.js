/**
 * Fetch JSON - detects when API returns HTML (e.g. 404 page) and throws a helpful error.
 */
export async function fetchJson(url, options = {}) {
  const headers = { Accept: 'application/json', ...options.headers }
  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  const trimmed = text.trim()
  if (trimmed.startsWith('<')) {
    throw new Error('API server not responding. Is it running on port 3001? Run: npm run server')
  }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('API server not responding. Is it running on port 3001? Run: npm run server')
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}
