import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, Boxes, CheckCircle2, Clock, ShieldX, Activity } from 'lucide-react'
import { api } from '../../../lib/api'
import type { AuditEvent, Organization } from '../../../lib/types'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { fmtTime, PageHeader, Panel, StatCard, StatusBadge, shortHash } from '../../../components/app/kit'
import { AuditEventDrawer, auditActionLabel } from '../../../components/app/AuditPanels'
import { OrgSeriesChart } from '../../../components/app/OrgSeriesChart'
import { SimulatedTag } from '../../../components/ui'

type Stats = {
  connections: { organization_id: string; organization_name: string; status: string; fault_mode: string; last_health_check: string | null }[]
  active_applications: number
  pending_requests: number
  allowed: number
  denied: number
  errored: number
  success_rate_24h: number | null
  connector_calls_24h: number
  recent_activity: AuditEvent[]
  integration_errors: { id: string; organization_name: string; operation: string; error_code: string; error_message: string; attempts: number; created_at: string; request_id: string }[]
  anchors: { anchored: number; pending: number; failed: number; last_block: number | null; last_tx_hash: string | null; last_anchored_at: string | null }
  series: { bucket: string; organization_id: string; requests: number; failures: number; avg_latency_ms: number | null }[]
}

export default function ProviderOverview() {
  const [eventId, setEventId] = useState<string | null>(null)
  const stats = useQuery({ queryKey: ['stats', 'provider'], queryFn: () => api<Stats>('/stats/provider'), refetchInterval: 10_000 })
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })

  if (stats.error) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
  const s = stats.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Live figures from connector activity, access decisions and audit records across your organizations."
        actions={<SimulatedTag label="Simulated hospitals" />}
      />
      {!s ? (
        <LoadingRows rows={6} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {s.connections.map((c) => (
              <Link key={c.organization_id} to="/app/provider/systems" className="card flex items-center justify-between p-4 transition hover:border-teal-200">
                <div>
                  <p className="text-[14.5px] font-semibold text-navy-900">{c.organization_name}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">Last health check {fmtTime(c.last_health_check)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.fault_mode !== 'none' && <SimulatedTag label={`Simulating ${c.fault_mode}`} />}
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active applications" value={s.active_applications} sub="With approved access" icon={<CheckCircle2 className="size-4" />} />
            <StatCard label="Pending access requests" value={s.pending_requests} sub={<Link to="/app/provider/requests" className="text-teal-700 hover:underline">Review requests</Link>} tone={s.pending_requests ? 'warning' : undefined} icon={<Clock className="size-4" />} />
            <StatCard label="Data requests allowed / denied" value={<>{s.allowed}<span className="text-navy-300"> / </span><span className={s.denied ? 'text-danger' : ''}>{s.denied}</span></>} sub={s.errored ? `${s.errored} ended with a hospital error` : 'All-time, from audit records'} icon={<ShieldX className="size-4" />} />
            <StatCard
              label="Connector success rate (24h)"
              value={s.success_rate_24h == null ? '—' : `${(s.success_rate_24h * 100).toFixed(1)}%`}
              sub={`${s.connector_calls_24h} connector calls`}
              tone={s.success_rate_24h != null && s.success_rate_24h < 0.95 ? 'warning' : undefined}
              icon={<Activity className="size-4" />}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Connector requests" description="Calls from Privexa to each hospital system, last 24 hours">
              {orgs.data ? <OrgSeriesChart series={s.series} orgs={orgs.data} metric="requests" /> : <LoadingRows rows={3} />}
            </Panel>
            <Panel title="Audit anchoring" description="Fingerprints written to the local demonstration chain" actions={<Boxes className="size-4 text-teal-600" />}>
              <div className="grid grid-cols-3 gap-3 text-center">
                {(
                  [
                    ['Anchored', s.anchors.anchored, 'text-success'],
                    ['Pending', s.anchors.pending, 'text-warning'],
                    ['Failed', s.anchors.failed, 'text-danger'],
                  ] as const
                ).map(([k, v, c]) => (
                  <div key={k} className="rounded-lg border border-line py-3">
                    <p className={`text-[22px] font-semibold ${v ? c : 'text-navy-300'}`}>{v}</p>
                    <p className="text-[12px] text-muted">{k}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-bg p-3 text-[13px]">
                {s.anchors.last_block ? (
                  <>
                    <p className="text-navy-700">
                      Latest anchor in block <span className="font-mono">#{s.anchors.last_block}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-muted">{shortHash(s.anchors.last_tx_hash)} · {fmtTime(s.anchors.last_anchored_at)}</p>
                  </>
                ) : (
                  <p className="text-muted">No anchors yet. They appear after the first data request.</p>
                )}
              </div>
              <Link to="/app/provider/audit" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-teal-700 hover:underline">
                Open audit trail <ArrowUpRight className="size-3.5" />
              </Link>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Recent activity" padded={false}>
              {s.recent_activity.length ? (
                <ul className="divide-y divide-line">
                  {s.recent_activity.map((e) => (
                    <li key={e.id}>
                      <button onClick={() => setEventId(e.id)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-teal-50/40">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-navy-900">
                            {auditActionLabel(e.action)}
                            {e.application_name && <span className="font-normal text-muted"> · {e.application_name}</span>}
                          </p>
                          <p className="truncate text-[12px] text-muted">{e.organization_name ?? '—'} · {fmtTime(e.created_at)}</p>
                        </div>
                        <StatusBadge status={e.outcome} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No activity yet" body="Test a connection or run the guided demo to generate activity." />
              )}
            </Panel>
            <Panel title="Integration errors" padded={false} actions={<Link to="/app/provider/health" className="text-[13px] font-medium text-teal-700 hover:underline">Integration health</Link>}>
              {s.integration_errors.length ? (
                <ul className="divide-y divide-line">
                  {s.integration_errors.map((j) => (
                    <li key={j.id} className="flex items-start gap-3 px-5 py-3">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-navy-900">{j.organization_name} · {j.error_message}</p>
                        <p className="text-[12px] text-muted">
                          {j.operation} · {j.attempts} attempts · {fmtTime(j.created_at)} · <span className="font-mono">{j.request_id}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No integration errors" body="Failed connector calls will appear here." icon={<CheckCircle2 className="size-5" />} />
              )}
            </Panel>
          </div>
        </>
      )}
      <AuditEventDrawer id={eventId} onClose={() => setEventId(null)} />
    </div>
  )
}
