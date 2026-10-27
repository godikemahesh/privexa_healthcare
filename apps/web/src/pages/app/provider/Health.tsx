import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Page } from '../../../lib/api'
import type { Metrics, Organization } from '../../../lib/types'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { DataTable, Drawer, fmtTime, JsonView, KV, Mono, PageHeader, Pagination, Panel, Select, StatCard, StatusBadge } from '../../../components/app/kit'
import { OrgSeriesChart } from '../../../components/app/OrgSeriesChart'

type Job = {
  id: string
  request_id: string
  organization_name: string
  operation: string
  status: string
  attempts: number
  attempt_log: { attempt: number; outcome: string; ms: number; error?: string }[]
  latency_ms: number | null
  error_code: string | null
  error_message: string | null
  created_at: string
}

export default function Health() {
  const [hours, setHours] = useState('24')
  const [org, setOrg] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [job, setJob] = useState<Job | null>(null)
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  const metrics = useQuery({ queryKey: ['metrics', hours, org], queryFn: () => api<Metrics & { bucket_minutes: number }>(`/monitoring/metrics?hours=${hours}${org ? `&organization_id=${org}` : ''}`), refetchInterval: 10_000 })
  const jobs = useQuery({
    queryKey: ['jobs', org, status, page],
    queryFn: () => api<Page<Job>>(`/monitoring/jobs?page=${page}&page_size=15${org ? `&organization_id=${org}` : ''}${status ? `&status=${status}` : ''}`),
    refetchInterval: 10_000,
  })
  const shownOrgs = (orgs.data ?? []).filter((o) => !org || o.id === org)

  return (
    <div className="space-y-6">
      <PageHeader title="Integration health" description="Request volume, latency, failures and retries for each connected system — computed from recorded connector calls." />
      <div className="flex flex-wrap gap-3">
        <Select className="w-44" label="Window" value={hours} onChange={setHours} options={[{ value: '1', label: 'Last hour' }, { value: '6', label: 'Last 6 hours' }, { value: '24', label: 'Last 24 hours' }, { value: '168', label: 'Last 7 days' }]} />
        <Select className="w-64" label="Organization" value={org} onChange={(v) => { setOrg(v); setPage(1) }} options={[{ value: '', label: 'All organizations' }, ...(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }))]} />
      </div>

      {metrics.error && <ErrorState error={metrics.error} onRetry={() => metrics.refetch()} />}
      {metrics.data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {metrics.data.per_organization.map((m) => {
              const conn = orgs.data?.find((o) => o.id === m.organization_id)?.connection
              return (
                <Panel key={m.organization_id} title={m.organization_name} actions={<StatusBadge status={conn?.status} />}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Requests" value={m.requests} />
                    <StatCard label="Failed" value={m.failures} tone={m.failures ? 'danger' : undefined} />
                    <StatCard label="Retries" value={m.retries} tone={m.retries ? 'warning' : undefined} />
                    <StatCard label="Avg latency" value={m.avg_latency_ms != null ? `${Math.round(m.avg_latency_ms)}` : '—'} sub={m.p95_latency_ms != null ? `ms · p95 ${Math.round(m.p95_latency_ms)} ms` : 'ms'} />
                  </div>
                </Panel>
              )
            })}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Average latency" description={`Successful calls, ${metrics.data.bucket_minutes}-minute buckets`}>
              <OrgSeriesChart series={metrics.data.series} orgs={shownOrgs} metric="avg_latency_ms" unit="ms" />
            </Panel>
            <Panel title="Failed requests" description="Connector calls that failed after all retries">
              <OrgSeriesChart series={metrics.data.series} orgs={shownOrgs} metric="failures" />
            </Panel>
          </div>
        </>
      )}

      <Panel
        title="Connector calls & retry history"
        padded={false}
        actions={<Select className="w-40" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ value: '', label: 'All results' }, { value: 'success', label: 'Succeeded' }, { value: 'failure', label: 'Failed' }]} />}
      >
        {jobs.isLoading && <LoadingRows />}
        {jobs.error && <ErrorState error={jobs.error} />}
        {jobs.data && (
          <>
            <DataTable
              rows={jobs.data.items}
              rowKey={(j) => j.id}
              onRowClick={setJob}
              empty={<EmptyState title="No connector calls match" />}
              columns={[
                { key: 't', header: 'Time', cell: (j) => fmtTime(j.created_at) },
                { key: 'o', header: 'Organization', cell: (j) => j.organization_name },
                { key: 'op', header: 'Operation', cell: (j) => <Mono>{j.operation}</Mono> },
                { key: 's', header: 'Result', cell: (j) => <StatusBadge status={j.status} /> },
                { key: 'a', header: 'Attempts', cell: (j) => <span className={j.attempts > 1 ? 'font-medium text-warning' : ''}>{j.attempts}</span> },
                { key: 'l', header: 'Latency', cell: (j) => (j.latency_ms != null ? `${j.latency_ms} ms` : '—') },
                { key: 'e', header: 'Error', cell: (j) => <span className="text-danger">{j.error_message ?? ''}</span> },
              ]}
            />
            <Pagination page={page} pageSize={15} total={jobs.data.total} onPage={setPage} />
          </>
        )}
      </Panel>

      <Drawer open={!!job} onClose={() => setJob(null)} title="Connector call">
        {job && (
          <div className="space-y-5">
            <KV
              items={[
                ['Request ID', <Mono>{job.request_id}</Mono>],
                ['Organization', job.organization_name],
                ['Operation', <Mono>{job.operation}</Mono>],
                ['Result', <StatusBadge status={job.status} />],
                ['Total latency', job.latency_ms != null ? `${job.latency_ms} ms` : null],
                ['Error', job.error_message ? `${job.error_message} (${job.error_code})` : null],
              ]}
            />
            <div>
              <p className="mb-2 text-[13px] font-medium text-navy-700">Attempts</p>
              <ol className="space-y-2">
                {job.attempt_log.map((a) => (
                  <li key={a.attempt} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[13px]">
                    <span>Attempt {a.attempt}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted">{a.ms} ms</span>
                      <StatusBadge status={a.outcome === 'success' ? 'success' : 'failure'} label={a.outcome} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-[12px] text-muted">Error details exclude credentials, endpoints and clinical content.</p>
            <JsonView data={job.attempt_log} maxHeight={200} />
          </div>
        )}
      </Drawer>
    </div>
  )
}
