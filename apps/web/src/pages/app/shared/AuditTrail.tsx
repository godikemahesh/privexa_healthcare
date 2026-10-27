import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { api, type Page } from '../../../lib/api'
import type { Application, AuditEvent, Organization } from '../../../lib/types'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { DataTable, fmtTime, Mono, PageHeader, Pagination, Panel, Select, StatusBadge } from '../../../components/app/kit'
import { AuditEventDrawer, auditActionLabel } from '../../../components/app/AuditPanels'
import { Button } from '../../../components/ui'

export default function AuditTrail({ title = 'Audit trail', description }: { title?: string; description?: string }) {
  const [f, setF] = useState({ organization_id: '', application_id: '', action: '', outcome: '', anchor_status: '', since: '', until: '' })
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }))
    setPage(1)
  }
  const qs = new URLSearchParams({ page: String(page), page_size: '20' })
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, k === 'since' || k === 'until' ? new Date(v).toISOString() : v)

  const events = useQuery({ queryKey: ['audit-events', qs.toString()], queryFn: () => api<Page<AuditEvent>>(`/audit-events?${qs}`), refetchInterval: 8000 })
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') })
  const actions = useQuery({ queryKey: ['audit-actions'], queryFn: () => api<string[]>('/audit-events/actions') })
  const filtered = Object.values(f).some(Boolean)

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description ?? 'Every access decision, policy change and review — with blockchain anchor status and on-demand integrity verification.'} />
      <Panel padded>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div>
            <label className="label" htmlFor="since">From</label>
            <input id="since" type="datetime-local" className="input" value={f.since} onChange={(e) => set('since')(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="until">To</label>
            <input id="until" type="datetime-local" className="input" value={f.until} onChange={(e) => set('until')(e.target.value)} />
          </div>
          <Select label="Organization" value={f.organization_id} onChange={set('organization_id')} options={[{ value: '', label: 'All' }, ...(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }))]} />
          <Select label="Application" value={f.application_id} onChange={set('application_id')} options={[{ value: '', label: 'All' }, ...(apps.data ?? []).map((a) => ({ value: a.id, label: a.name }))]} />
          <Select label="Action" value={f.action} onChange={set('action')} options={[{ value: '', label: 'All' }, ...(actions.data ?? []).map((a) => ({ value: a, label: auditActionLabel(a) }))]} />
          <Select label="Outcome" value={f.outcome} onChange={set('outcome')} options={[{ value: '', label: 'All' }, { value: 'allow', label: 'Allowed' }, { value: 'deny', label: 'Denied' }, { value: 'error', label: 'Error' }, { value: 'success', label: 'Success' }, { value: 'failure', label: 'Failure' }]} />
          <Select label="Anchor" value={f.anchor_status} onChange={set('anchor_status')} options={[{ value: '', label: 'All' }, { value: 'anchored', label: 'Anchored' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }, { value: 'not_anchored', label: 'Not anchored' }]} />
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setF({ organization_id: '', application_id: '', action: '', outcome: '', anchor_status: '', since: '', until: '' }); setPage(1) }}>
            <RotateCcw className="size-3.5" /> Clear filters
          </Button>
        )}
      </Panel>
      <Panel padded={false}>
        {events.isLoading && <LoadingRows rows={6} />}
        {events.error && <ErrorState error={events.error} onRetry={() => events.refetch()} />}
        {events.data && (
          <>
            <DataTable
              rows={events.data.items}
              rowKey={(e) => e.id}
              onRowClick={(e) => setOpen(e.id)}
              empty={<EmptyState title={filtered ? 'No events match these filters' : 'No audit events yet'} />}
              columns={[
                { key: 't', header: 'Time', cell: (e) => <span className="whitespace-nowrap">{fmtTime(e.created_at)}</span> },
                { key: 'a', header: 'Action', cell: (e) => <span className="font-medium text-navy-900">{auditActionLabel(e.action)}</span> },
                { key: 'o', header: 'Outcome', cell: (e) => <StatusBadge status={e.outcome} /> },
                { key: 'org', header: 'Organization', cell: (e) => e.organization_name ?? '—' },
                { key: 'app', header: 'Application', cell: (e) => e.application_name ?? '—' },
                { key: 'r', header: 'Request', cell: (e) => <Mono>{e.request_id}</Mono> },
                {
                  key: 'anc',
                  header: 'Anchor',
                  cell: (e) => (
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={e.anchor_status} />
                      {e.verification && <StatusBadge status={e.verification} />}
                    </span>
                  ),
                },
              ]}
            />
            <Pagination page={page} pageSize={20} total={events.data.total} onPage={setPage} />
          </>
        )}
      </Panel>
      <AuditEventDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  )
}
