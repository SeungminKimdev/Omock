async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  get: req as <T>(url: string) => Promise<T>,
  post: async <T>(url: string, body?: unknown) =>
    req<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
}
