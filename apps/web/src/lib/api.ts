// Thin client for the Privexa API. All hospital data flows through the backend; the browser never calls FHIR servers.

export class ApiError extends Error {
  status: number
  code: string
  requestId?: string
  details?: unknown
  constructor(status: number, code: string, message: string, requestId?: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

function csrfToken() {
  return document.cookie.split('; ').find((c) => c.startsWith('privexa_csrf='))?.split('=')[1] ?? ''
}

export type ApiMeta = { requestId?: string; durationMs: number; status: number }

export async function apiRaw<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ data: T; meta: ApiMeta }> {
  const headers = new Headers(init.headers)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  const method = (init.method ?? 'GET').toUpperCase()
  if (method !== 'GET') headers.set('X-CSRF-Token', csrfToken())
  const started = performance.now()
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, { ...init, method, headers, body, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'network_error', 'The Privexa API is not reachable. Make sure the backend is running.')
  }
  const durationMs = Math.round(performance.now() - started)
  const requestId = res.headers.get('X-Request-ID') ?? undefined
  const text = await res.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error
    const msg = err?.message ?? (res.status === 502 || res.status === 504 ? 'The Privexa API is not reachable.' : `Request failed (${res.status})`)
    throw new ApiError(res.status, err?.code ?? 'error', msg, requestId, err?.details)
  }
  return { data: payload as T, meta: { requestId, durationMs, status: res.status } }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  return (await apiRaw<T>(path, init)).data
}

export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} })
export const patch = <T>(path: string, json?: unknown) => api<T>(path, { method: 'PATCH', json: json ?? {} })

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}

export type Page<T> = { items: T[]; total: number; page: number; page_size: number }
