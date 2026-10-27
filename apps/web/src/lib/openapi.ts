import { useQuery } from '@tanstack/react-query'

// Minimal OpenAPI types for the parts Studio renders.
type Schema = { type?: string; $ref?: string; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; anyOf?: Schema[]; required?: string[]; title?: string; description?: string; pattern?: string; default?: unknown }
type Param = { name: string; in: 'query' | 'path' | 'header'; required?: boolean; schema?: Schema; description?: string }
type Operation = { summary?: string; description?: string; tags?: string[]; parameters?: Param[]; requestBody?: { content: Record<string, { schema: Schema }> } }
export type OpenApi = { info: { title: string; version: string; description: string }; paths: Record<string, Record<string, Operation>>; components?: { schemas?: Record<string, Schema> } }

export type Endpoint = {
  id: string
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  title: string
  description: string
  params: Param[]
  body?: Schema
  sampleBody?: unknown
}

/** The vendor-facing subset of the API documented in Studio. */
export const STUDIO_ENDPOINTS: { method: Endpoint['method']; path: string; title: string; description: string }[] = [
  { method: 'POST', path: '/api/v1/data-requests', title: 'Request patient data', description: 'Evaluates the application’s approved scopes and the organization’s policies, then returns only permitted resources as a source-attributed timeline. Authenticate with client credentials (server-side) or a workspace session.' },
  { method: 'GET', path: '/api/v1/sandbox/patients', title: 'List sandbox patients', description: 'Synthetic test patients (demographics only) and confirmed cross-hospital links available for sandbox requests.' },
  { method: 'GET', path: '/api/v1/public/directory', title: 'Integration directory', description: 'Supported simulated systems, their FHIR version and resource types, plus example applications.' },
  { method: 'GET', path: '/api/v1/applications', title: 'List your applications', description: 'Applications registered by your vendor account.' },
  { method: 'POST', path: '/api/v1/access-requests', title: 'Request access to an organization', description: 'Create (and optionally submit) an access request for an application.' },
  { method: 'GET', path: '/api/v1/access-requests', title: 'List access requests', description: 'Access requests for your applications with their current status.' },
  { method: 'GET', path: '/api/v1/audit-events', title: 'List audit events', description: 'Audit events for your applications, filterable by request ID, outcome and anchor status.' },
  { method: 'POST', path: '/api/v1/audit-events/{event_id}/verify', title: 'Verify an audit anchor', description: 'Recomputes the event fingerprint and checks it against the demonstration chain.' },
]

export function resolve(spec: OpenApi, s?: Schema): Schema | undefined {
  if (!s) return s
  if (s.$ref) return resolve(spec, spec.components?.schemas?.[s.$ref.split('/').pop()!])
  return s
}

const SAMPLE_BODIES: Record<string, unknown> = {
  '/api/v1/data-requests': { application_id: '<application id>', patient: { link_id: '<patient link id>' }, resource_types: ['Observation', 'Encounter'], purpose: 'care_coordination' },
  '/api/v1/access-requests': { application_id: '<application id>', organization_id: '<organization id>', resource_types: ['Observation'], purpose: 'care_coordination', justification: 'Why access is needed', submit: true },
}

export function useStudioEndpoints() {
  return useQuery({
    queryKey: ['openapi'],
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch('/api/v1/openapi.json')
      if (!res.ok) throw new Error('Could not load the API contract')
      const spec = (await res.json()) as OpenApi
      const endpoints: Endpoint[] = STUDIO_ENDPOINTS.flatMap((e) => {
        const op = spec.paths[e.path]?.[e.method.toLowerCase()]
        if (!op) return [] // never document an endpoint that is not in the live contract
        const body = resolve(spec, op.requestBody?.content['application/json']?.schema)
        return [{ id: `${e.method} ${e.path}`, method: e.method, path: e.path, title: e.title, description: e.description, params: (op.parameters ?? []).filter((p) => p.in !== 'header'), body, sampleBody: SAMPLE_BODIES[e.path] }]
      })
      return { spec, endpoints }
    },
  })
}

export function schemaFields(spec: OpenApi, s?: Schema): { name: string; type: string; required: boolean; note?: string }[] {
  const r = resolve(spec, s)
  if (!r?.properties) return []
  return Object.entries(r.properties).map(([name, p]) => {
    const pr = resolve(spec, p) ?? p
    const opts = pr.anyOf?.map((x) => resolve(spec, x)) ?? []
    const type = pr.enum ? pr.enum.join(' | ') : pr.type === 'array' ? `${resolve(spec, pr.items)?.type ?? resolve(spec, pr.items)?.title ?? 'item'}[]` : pr.type ?? opts.map((o) => o?.type ?? o?.title).filter(Boolean).join(' | ') ?? pr.title ?? 'object'
    return { name, type: type || pr.title || 'object', required: !!r.required?.includes(name), note: pr.description }
  })
}

export function pythonExample(e: Endpoint) {
  const url = `BASE_URL + "${e.path}"`
  const body = e.sampleBody ? `,\n    json=${JSON.stringify(e.sampleBody, null, 4).replace(/\n/g, '\n    ')}` : ''
  return `import os
import httpx

BASE_URL = "http://127.0.0.1:8000"
HEADERS = {
    # Development credentials from "My applications". Keep them server-side.
    "X-Client-Id": os.environ["PRIVEXA_CLIENT_ID"],
    "X-Client-Secret": os.environ["PRIVEXA_CLIENT_SECRET"],
}

r = httpx.${e.method.toLowerCase()}(
    ${url},
    headers=HEADERS${body},
    timeout=30,
)
print(r.status_code, r.headers.get("X-Request-ID"))
print(r.json())`
}

export function jsExample(e: Endpoint) {
  const body = e.sampleBody ? `,\n  body: JSON.stringify(${JSON.stringify(e.sampleBody, null, 2).replace(/\n/g, '\n  ')})` : ''
  return `// Node.js 18+ (server-side). Never ship client secrets to the browser.
const res = await fetch('http://127.0.0.1:8000${e.path}', {
  method: '${e.method}',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': process.env.PRIVEXA_CLIENT_ID,
    'X-Client-Secret': process.env.PRIVEXA_CLIENT_SECRET,
  }${body},
})
console.log(res.status, res.headers.get('x-request-id'))
console.log(await res.json())`
}
