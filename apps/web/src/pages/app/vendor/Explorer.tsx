import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Play, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { ApiError, apiRaw, api, type ApiMeta } from '../../../lib/api'
import type { Application } from '../../../lib/types'
import { useStudioEndpoints, schemaFields, type Endpoint } from '../../../lib/openapi'
import { Button } from '../../../components/ui'
import { ErrorState, LoadingRows } from '../../../components/states'
import { JsonView, Mono, PageHeader, Panel } from '../../../components/app/kit'

type Sent = { endpoint: Endpoint; meta: ApiMeta; data: unknown; ok: boolean; error?: ApiError }

const methodTone: Record<string, string> = { GET: 'bg-[#eff8ff] text-[#175cd3]', POST: 'bg-teal-50 text-teal-800', PATCH: 'bg-[#fffaeb] text-warning' }

export function MethodTag({ m }: { m: string }) {
  return <span className={clsx('rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold', methodTone[m])}>{m}</span>
}

function validationSummary(s: Sent): { ok: boolean; text: string }[] {
  const out = [{ ok: s.ok, text: s.ok ? `HTTP ${s.meta.status} — request accepted` : `HTTP ${s.meta.status} — ${s.error?.message}` }]
  const d = s.data as { validation?: { resource_type: string; valid: number; invalid: number; errors: string[] }[] } | null
  for (const v of d?.validation ?? []) out.push({ ok: v.invalid === 0, text: `${v.resource_type}: ${v.valid} valid FHIR resources${v.invalid ? `, ${v.invalid} rejected (${v.errors.join(', ')})` : ''}` })
  return out
}

export default function Explorer() {
  const eps = useStudioEndpoints()
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') })
  const links = useQuery({ queryKey: ['sandbox-patients'], queryFn: () => api<{ links: { link_id: string }[] }>('/sandbox/patients') })
  const [id, setId] = useState('')
  const ep = eps.data?.endpoints.find((e) => e.id === id) ?? eps.data?.endpoints[0]
  const [pathVals, setPathVals] = useState<Record<string, string>>({})
  const [query, setQuery] = useState<Record<string, string>>({})
  const [body, setBody] = useState('')
  const [bodyErr, setBodyErr] = useState<string | null>(null)
  const [history, setHistory] = useState<Sent[]>([])

  useEffect(() => {
    if (!ep) return
    setPathVals({})
    setQuery({})
    let sample = ep.sampleBody ? JSON.stringify(ep.sampleBody, null, 2) : ''
    const app = apps.data?.[0]
    if (app) sample = sample.replace('<application id>', app.id)
    const link = links.data?.links[0]
    if (link) sample = sample.replace('<patient link id>', link.link_id)
    setBody(sample)
    setBodyErr(null)
  }, [ep?.id, apps.data, links.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = useMutation({
    mutationFn: async (): Promise<Sent> => {
      let path = ep!.path.replace('/api/v1', '')
      for (const p of ep!.params.filter((x) => x.in === 'path')) path = path.replace(`{${p.name}}`, encodeURIComponent(pathVals[p.name] ?? ''))
      const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v))
      if (qs.toString()) path += `?${qs}`
      let json: unknown
      if (ep!.method !== 'GET' && body.trim()) {
        try {
          json = JSON.parse(body)
        } catch {
          setBodyErr('Body is not valid JSON')
          throw new Error('Body is not valid JSON')
        }
      }
      setBodyErr(null)
      const started = performance.now()
      try {
        const { data, meta } = await apiRaw(path, { method: ep!.method, json: ep!.method === 'GET' ? undefined : json ?? {} })
        return { endpoint: ep!, meta, data, ok: true }
      } catch (e) {
        if (!(e instanceof ApiError)) throw e
        return { endpoint: ep!, meta: { status: e.status, requestId: e.requestId, durationMs: Math.round(performance.now() - started) }, data: { error: { code: e.code, message: e.message, details: e.details } }, ok: false, error: e }
      }
    },
    onSuccess: (s) => setHistory((h) => [s, ...h].slice(0, 10)),
  })
  const last = history[0]

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Privexa Studio" title="API Explorer" description="Try the supported endpoints against the sandbox. Calls go through the Privexa backend and its access checks, signed in as your vendor account." />
      {eps.isLoading && <LoadingRows />}
      {eps.error && <ErrorState error={eps.error} onRetry={() => eps.refetch()} />}
      {eps.data && ep && (
        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <nav className="card h-fit p-2" aria-label="Endpoints">
            {eps.data.endpoints.map((e) => (
              <button key={e.id} onClick={() => setId(e.id)} className={clsx('flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition', e.id === ep.id ? 'bg-teal-50' : 'hover:bg-navy-50')}>
                <span className="flex items-center gap-2"><MethodTag m={e.method} /><span className="text-[13.5px] font-medium text-navy-900">{e.title}</span></span>
                <Mono className="text-[11px] text-navy-400">{e.path.replace('/api/v1', '')}</Mono>
              </button>
            ))}
          </nav>
          <div className="space-y-6">
            <Panel title={<span className="flex items-center gap-2"><MethodTag m={ep.method} /> <Mono className="text-[13px]">{ep.path}</Mono></span>} description={ep.description}>
              <div className="space-y-4">
                {ep.params.length > 0 && (
                  <div>
                    <p className="label">Parameters</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ep.params.map((p) => (
                        <div key={p.name}>
                          <label className="mb-1 flex items-center gap-1.5 text-[12.5px] text-navy-700" htmlFor={`p-${p.name}`}>
                            <Mono>{p.name}</Mono> <span className="text-navy-400">{p.in}{p.required ? ' · required' : ''}</span>
                          </label>
                          <input
                            id={`p-${p.name}`}
                            className="input font-mono text-[12.5px]"
                            value={(p.in === 'path' ? pathVals : query)[p.name] ?? ''}
                            onChange={(e) => (p.in === 'path' ? setPathVals : setQuery)((x) => ({ ...x, [p.name]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ep.method !== 'GET' && (
                  <div>
                    <label className="label" htmlFor="body">Request body (JSON)</label>
                    <textarea id="body" className="input min-h-[180px] font-mono text-[12.5px]" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
                    {bodyErr && <p className="mt-1 text-[12.5px] text-danger">{bodyErr}</p>}
                    {ep.body && eps.data && (
                      <details className="mt-2 text-[12.5px]">
                        <summary className="cursor-pointer text-teal-700">Body fields</summary>
                        <ul className="mt-2 space-y-1">
                          {schemaFields(eps.data.spec, ep.body).map((f) => (
                            <li key={f.name}><Mono>{f.name}</Mono> <span className="text-muted">{f.type}{f.required ? ' · required' : ''}</span></li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                <Button onClick={() => send.mutate()} loading={send.isPending}><Play className="size-4" /> Send request</Button>
              </div>
            </Panel>
            {last && (
              <Panel title="Response" actions={<span className="flex items-center gap-3 text-[12.5px]"><span className={last.ok ? 'font-semibold text-success' : 'font-semibold text-danger'}>{last.meta.status}</span><Mono>{last.meta.requestId ?? 'no request id'}</Mono><span className="text-muted">{last.meta.durationMs} ms</span></span>}>
                <div className="mb-4 space-y-1.5">
                  {validationSummary(last).map((v, i) => (
                    <p key={i} className={clsx('flex items-center gap-2 text-[13px]', v.ok ? 'text-success' : 'text-danger')}>
                      {v.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {v.text}
                    </p>
                  ))}
                </div>
                <JsonView data={last.data} maxHeight={480} />
              </Panel>
            )}
            {history.length > 1 && (
              <Panel title="Recent calls (this session)" padded={false}>
                <ul className="divide-y divide-line">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                      <span className="flex items-center gap-2"><MethodTag m={h.endpoint.method} /><Mono>{h.endpoint.path.replace('/api/v1', '')}</Mono></span>
                      <span className="flex items-center gap-3"><span className={h.ok ? 'text-success' : 'text-danger'}>{h.meta.status}</span><Mono>{h.meta.requestId}</Mono><span className="text-muted">{h.meta.durationMs} ms</span></span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
