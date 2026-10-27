import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Hospital, ListTree, PlugZap, Zap, Lock } from 'lucide-react'
import { api, errorMessage, post } from '../../../lib/api'
import type { IntegrationJob, Organization } from '../../../lib/types'
import { Button, SimulatedTag } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { DataTable, Drawer, fmtTime, KV, Modal, Mono, PageHeader, Select, StatusBadge } from '../../../components/app/kit'

const FAULTS = [
  { value: 'none', label: 'Normal operation' },
  { value: 'timeout', label: 'Endpoint timeout' },
  { value: 'error', label: 'Service unavailable (HTTP 503)' },
  { value: 'malformed', label: 'Malformed FHIR responses' },
  { value: 'flaky', label: 'Intermittent (fails once, recovers on retry)' },
]

export default function Systems() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  const [caps, setCaps] = useState<Organization | null>(null)
  const [activity, setActivity] = useState<Organization | null>(null)
  const [faultOrg, setFaultOrg] = useState<Organization | null>(null)
  const [fault, setFault] = useState('none')

  const test = useMutation({
    mutationFn: (org: Organization) => post<{ ok: boolean; status: string; error?: { message: string }; request_id: string }>(`/organizations/${org.id}/test-connection`),
    onSuccess: (r, org) => {
      qc.invalidateQueries({ queryKey: ['organizations'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast(r.ok ? { kind: 'success', title: `${org.name} is reachable`, body: `Status: ${r.status} · ${r.request_id}` } : { kind: 'error', title: `${org.name} connection failed`, body: `${r.error?.message} · ${r.request_id}` })
    },
    onError: (e) => toast({ kind: 'error', title: 'Test could not run', body: errorMessage(e) }),
  })
  const simulate = useMutation({
    mutationFn: ({ org, mode }: { org: Organization; mode: string }) => post<Organization>(`/organizations/${org.id}/simulate`, { mode }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ['organizations'] })
      setFaultOrg(null)
      toast({ kind: 'info', title: `${o.name}: ${FAULTS.find((f) => f.value === o.connection?.fault_mode)?.label}`, body: 'Run a connection test or data request to see the effect.' })
    },
    onError: (e) => toast({ kind: 'error', title: 'Could not change simulation', body: errorMessage(e) }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Connected systems" description="Hospital systems connected through Privexa Connect. Both are fictional organizations running independent FHIR R4 simulators." />
      {isLoading && <LoadingRows />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && !data.length && <EmptyState title="No connected systems" />}
      <div className="grid gap-5 xl:grid-cols-2">
        {data?.map((org) => {
          const c = org.connection
          return (
            <article key={org.id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-line p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
                    <Hospital className="size-5" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h2 className="text-[17px] font-semibold">{org.name}</h2>
                    <p className="text-[13px] text-muted">{org.system_type}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={c?.status} />
                  <SimulatedTag label="Fictional" />
                </div>
              </div>
              <div className="p-5">
                <KV
                  items={[
                    ['FHIR version', `HL7® FHIR® ${org.fhir_version}${c?.capabilities?.fhir_version ? ` (server reports ${c.capabilities.fhir_version})` : ''}`],
                    ['Configured status', c?.status === 'configured' ? 'Configured · not yet tested' : c?.status],
                    ['Last health check', fmtTime(c?.last_health_check)],
                    ['Last latency', c?.last_latency_ms != null ? `${c.last_latency_ms} ms` : null],
                    ['Requests', <span><span className="text-success">{c?.success_count ?? 0} succeeded</span> · <span className={c?.failure_count ? 'text-danger' : ''}>{c?.failure_count ?? 0} failed</span></span>],
                    ['Endpoint', <span className="inline-flex items-center gap-1.5 text-muted"><Lock className="size-3.5" /> Held server-side · never sent to browsers</span>],
                    ['Simulated condition', c?.fault_mode === 'none' ? 'None' : <span className="font-medium text-warning">{FAULTS.find((f) => f.value === c?.fault_mode)?.label}</span>],
                  ]}
                />
                {c?.last_error && <p className="mt-3 rounded-lg bg-[#fef3f2] px-3 py-2 text-[13px] text-danger">Last error: {c.last_error}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => test.mutate(org)} loading={test.isPending && test.variables?.id === org.id}>
                    <PlugZap className="size-3.5" /> Test connection
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setCaps(org)}>
                    <ListTree className="size-3.5" /> View capabilities
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setActivity(org)}>
                    <Activity className="size-3.5" /> Recent activity
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setFault(c?.fault_mode ?? 'none'); setFaultOrg(org) }}>
                    <Zap className="size-3.5" /> Simulate failure
                  </Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <CapabilitiesModal org={caps} onClose={() => setCaps(null)} />
      <ActivityDrawer org={activity} onClose={() => setActivity(null)} />
      <Modal
        open={!!faultOrg}
        onClose={() => setFaultOrg(null)}
        title={`Simulate a condition · ${faultOrg?.name ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFaultOrg(null)}>Cancel</Button>
            <Button onClick={() => faultOrg && simulate.mutate({ org: faultOrg, mode: fault })} loading={simulate.isPending}>Apply</Button>
          </>
        }
      >
        <p className="mb-4 text-[14px] text-muted">
          Injects a failure between Privexa and this simulated hospital so you can watch timeouts, retries, validation and recovery. This is a demonstration control only.
        </p>
        <Select label="Condition" value={fault} onChange={setFault} options={FAULTS} />
      </Modal>
    </div>
  )
}

function CapabilitiesModal({ org, onClose }: { org: Organization | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['capabilities', org?.id],
    queryFn: () => api<{ fhir_version: string; software: string; resource_types: string[]; checked_at: string; latency_ms: number }>(`/organizations/${org!.id}/capabilities`),
    enabled: !!org,
    retry: false,
  })
  return (
    <Modal open={!!org} onClose={onClose} title={`Capabilities · ${org?.name ?? ''}`}>
      {q.isLoading && <LoadingRows rows={3} />}
      {q.error && <ErrorState error={q.error} compact onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="space-y-4">
          <KV items={[['Software', q.data.software], ['FHIR version', q.data.fhir_version], ['Read at', fmtTime(q.data.checked_at)]]} />
          <div>
            <p className="mb-2 text-[13px] font-medium text-navy-700">Supported resource types</p>
            <div className="flex flex-wrap gap-1.5">
              {q.data.resource_types.map((r) => (
                <span key={r} className="rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[12px] text-navy-700">{r}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ActivityDrawer({ org, onClose }: { org: Organization | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['org-activity', org?.id], queryFn: () => api<IntegrationJob[]>(`/organizations/${org!.id}/activity`), enabled: !!org })
  return (
    <Drawer open={!!org} onClose={onClose} title={`Recent activity · ${org?.name ?? ''}`} width={680}>
      {q.isLoading && <LoadingRows />}
      {q.error && <ErrorState error={q.error} />}
      {q.data && (
        <div className="card overflow-hidden">
          <DataTable
            rows={q.data}
            rowKey={(j) => j.id}
            empty={<EmptyState title="No connector activity yet" />}
            columns={[
              { key: 't', header: 'Time', cell: (j) => fmtTime(j.created_at) },
              { key: 'op', header: 'Operation', cell: (j) => <Mono>{j.operation}</Mono> },
              { key: 's', header: 'Result', cell: (j) => <StatusBadge status={j.status} /> },
              { key: 'a', header: 'Attempts', cell: (j) => j.attempts },
              { key: 'l', header: 'Latency', cell: (j) => (j.latency_ms != null ? `${j.latency_ms} ms` : '—') },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}
