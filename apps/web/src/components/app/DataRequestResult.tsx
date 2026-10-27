import { useState } from 'react'
import { AlertTriangle, Check, ShieldCheck, ShieldX, X } from 'lucide-react'
import clsx from 'clsx'
import type { DataRequestResult, Decision, TimelineItem } from '../../lib/types'
import { ORG_COLORS, StatusBadge, fmtDate, Mono } from './kit'
import { AnchorVerificationPanel, useAuditEvent } from './AuditPanels'

export function DecisionCard({ d }: { d: Decision & { returned?: number } }) {
  const allowed = d.outcome === 'allow'
  return (
    <div className={clsx('rounded-xl border p-4', d.outcome === 'allow' ? 'border-teal-200 bg-teal-50/40' : d.outcome === 'error' ? 'border-[#fef0c7] bg-[#fffaeb]' : 'border-[#fee4e2] bg-[#fef3f2]/60')}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-navy-900">
          {allowed ? <ShieldCheck className="size-4 text-teal-700" /> : d.outcome === 'error' ? <AlertTriangle className="size-4 text-warning" /> : <ShieldX className="size-4 text-danger" />}
          {d.organization_name}
        </p>
        <StatusBadge status={d.denied_resource_types.length && allowed ? 'partial' : d.outcome} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {d.allowed_resource_types.map((r) => (
          <span key={r} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-mono text-[11.5px] text-teal-800 ring-1 ring-teal-200">
            <Check className="size-3" /> {r}
          </span>
        ))}
        {d.denied_resource_types.map((r) => (
          <span key={r} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-mono text-[11.5px] text-danger ring-1 ring-[#fecdca]">
            <X className="size-3" /> {r}
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-[12.5px] text-navy-700">
        {d.reasons.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
      {typeof d.returned === 'number' && <p className="mt-2 text-[12px] text-muted">{d.returned} records returned</p>}
    </div>
  )
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const [filter, setFilter] = useState('')
  const types = [...new Set(items.map((i) => i.resource_type))]
  const shown = items.filter((i) => !filter || i.resource_type === filter).slice(0, 80)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {['', ...types].map((t) => (
          <button key={t || 'all'} onClick={() => setFilter(t)} className={clsx('rounded-md px-2.5 py-1 text-[12px] font-medium', filter === t ? 'bg-navy-900 text-white' : 'border border-line bg-white text-navy-600')}>
            {t || `All (${items.length})`}
          </button>
        ))}
      </div>
      <ol className="relative space-y-3 border-l border-line pl-5">
        {shown.map((t) => (
          <li key={`${t.source_organization_id}-${t.source_resource_id}`} className="relative">
            <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-white" style={{ background: t.source_organization_name.startsWith('MetroCare') ? ORG_COLORS.metrocare : ORG_COLORS.sunrise }} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13.5px] font-medium text-navy-900">
                {t.title}
                {t.detail && <span className="font-normal text-muted"> · {t.detail}</span>}
              </p>
              <p className="text-[12px] text-muted">{fmtDate(t.date)}</p>
            </div>
            <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded bg-navy-50 px-1.5 text-navy-600">{t.resource_type}</span>
              <span className="rounded bg-teal-50 px-1.5 text-teal-800">Source: {t.source_organization_name}</span>
            </p>
          </li>
        ))}
      </ol>
      {items.length > shown.length && <p className="mt-3 text-[12px] text-muted">Showing {shown.length} of {filter ? items.filter((i) => i.resource_type === filter).length : items.length} records.</p>}
      {!items.length && <p className="text-[13.5px] text-muted">No records were returned.</p>}
    </div>
  )
}

export function AnchorForEvent({ id }: { id: string }) {
  const { data } = useAuditEvent(id)
  return data ? <AnchorVerificationPanel event={data} compact /> : <p className="text-[13px] text-muted">Loading audit event…</p>
}

export function DataRequestResultView({ r }: { r: DataRequestResult }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <StatusBadge status={r.outcome} />
        <Mono>{r.request_id}</Mono>
        <span className="text-muted">{r.duration_ms} ms</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {r.decisions.map((d) => (
          <DecisionCard key={d.organization_id} d={d} />
        ))}
      </div>
      {r.errors.map((e) => (
        <p key={`${e.organization_id}-${(e as { resource_type?: string }).resource_type}`} className="flex items-center gap-2 rounded-lg bg-[#fef3f2] px-3 py-2 text-[13px] text-danger" role="alert">
          <AlertTriangle className="size-4" /> {(e as { organization_name?: string }).organization_name}: {e.message}
        </p>
      ))}
      {!!r.validation.length && (
        <div className="rounded-xl border border-line p-4">
          <p className="mb-2 text-[13px] font-medium text-navy-700">FHIR validation</p>
          <ul className="space-y-1 text-[12.5px]">
            {r.validation.map((v) => (
              <li key={`${v.organization_id}${v.resource_type}`} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono">{v.resource_type} · {r.decisions.find((d) => d.organization_id === v.organization_id)?.organization_name}</span>
                <span>
                  <span className="text-success">{v.valid} valid</span>
                  {v.invalid > 0 && <span className="text-danger"> · {v.invalid} rejected ({v.errors.join(', ')})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
