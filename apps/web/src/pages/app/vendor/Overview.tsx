import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppWindow, FlaskConical, ListChecks, Network } from 'lucide-react'
import { api } from '../../../lib/api'
import type { AuditEvent } from '../../../lib/types'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { fmtTime, PageHeader, Panel, StatCard, StatusBadge } from '../../../components/app/kit'
import { AuditEventDrawer } from '../../../components/app/AuditPanels'
import { LinkButton } from '../../../components/ui'

type Stats = {
  applications: number
  sandbox_requests: number
  allowed: number
  denied: number
  validation_passed: number
  validation_failed: number
  requests_by_status: Record<string, number>
  recent_tests: AuditEvent[]
  available_integrations: number
}

const ORDER = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'revoked']

export default function VendorOverview() {
  const q = useQuery({ queryKey: ['stats', 'vendor'], queryFn: () => api<Stats>('/stats/vendor'), refetchInterval: 10_000 })
  const [open, setOpen] = useState<string | null>(null)
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const s = q.data
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Your applications, sandbox activity and access requests — all from live records." actions={<LinkButton to="/app/vendor/sandbox" arrow>Open Sandbox</LinkButton>} />
      {!s ? (
        <LoadingRows rows={6} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Registered applications" value={s.applications} icon={<AppWindow className="size-4" />} sub={<Link to="/app/vendor/applications" className="text-teal-700 hover:underline">Manage applications</Link>} />
            <StatCard label="Sandbox requests" value={s.sandbox_requests} sub={`${s.allowed} allowed · ${s.denied} denied`} icon={<FlaskConical className="size-4" />} />
            <StatCard label="Validation pass / fail" value={<>{s.validation_passed}<span className="text-navy-300"> / </span><span className={s.validation_failed ? 'text-danger' : ''}>{s.validation_failed}</span></>} sub="Requests with all responses valid" icon={<ListChecks className="size-4" />} />
            <StatCard label="Available demo integrations" value={s.available_integrations} sub="Simulated hospital systems" icon={<Network className="size-4" />} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <Panel title="Access request status" actions={<Link to="/app/vendor/requests" className="text-[13px] font-medium text-teal-700 hover:underline">View all</Link>}>
              <ul className="space-y-2">
                {ORDER.map((k) => (
                  <li key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <StatusBadge status={k} />
                    <span className="text-[15px] font-semibold text-navy-900">{s.requests_by_status[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Recent tests" padded={false}>
              {s.recent_tests.length ? (
                <ul className="divide-y divide-line">
                  {s.recent_tests.map((e) => (
                    <li key={e.id}>
                      <button onClick={() => setOpen(e.id)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-teal-50/40">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-navy-900">{e.application_name} → {e.organization_name}</p>
                          <p className="truncate text-[12px] text-muted">{e.resource_types.join(', ')} · {fmtTime(e.created_at)}</p>
                        </div>
                        <StatusBadge status={e.outcome} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No sandbox requests yet" body="Send your first request from the Sandbox or API Explorer." action={<LinkButton to="/app/vendor/sandbox" size="sm">Open Sandbox</LinkButton>} />
              )}
            </Panel>
          </div>
        </>
      )}
      <AuditEventDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  )
}
