import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Fingerprint, RotateCcw, ShieldAlert, ShieldCheck, ShieldQuestion, Loader2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { api, errorMessage, post } from '../../lib/api'
import type { AuditEvent, Verification } from '../../lib/types'
import { useMe } from '../../lib/auth'
import { Button } from '../ui'
import { useToast } from '../Toast'
import { CopyButton, Drawer, fmtTime, JsonView, KV, Mono, purposeLabel, shortHash, StatusBadge } from './kit'

const actionLabel: Record<string, string> = {
  data_access: 'Data access',
  connection_test: 'Connection test',
  policy_created: 'Policy created',
  policy_updated: 'Policy updated',
  access_request_submitted: 'Access request submitted',
  access_request_draft: 'Access request drafted',
  access_request_under_review: 'Access request in review',
  access_request_approved: 'Access approved',
  access_request_rejected: 'Access rejected',
  access_request_revoked: 'Access revoked',
  application_registered: 'Application registered',
  credentials_rotated: 'Credentials rotated',
  application_status_changed: 'Application status changed',
  patient_match_reviewed: 'Patient match reviewed',
  consent_state_changed: 'Consent state changed',
  failure_simulation: 'Failure simulation',
  demo_reset: 'Demo reset',
}
export const auditActionLabel = (a: string) => actionLabel[a] ?? a.replace(/_/g, ' ')

/** Polls while an anchor is pending so the UI reflects the real transaction outcome. */
export function useAuditEvent(id: string | null) {
  return useQuery({
    queryKey: ['audit-event', id],
    queryFn: () => api<AuditEvent>(`/audit-events/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.anchor_status === 'pending' ? 1200 : false),
  })
}

export function AnchorVerificationPanel({ event, compact }: { event: AuditEvent; compact?: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const verify = useMutation({
    mutationFn: () => post<Verification>(`/audit-events/${event.id}/verify`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-event', event.id] }),
    onError: (e) => toast({ kind: 'error', title: 'Verification failed to run', body: errorMessage(e) }),
  })
  const retry = useMutation({
    mutationFn: () => post(`/audit-events/${event.id}/anchor`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-event', event.id] }),
    onError: (e) => toast({ kind: 'error', title: 'Could not retry anchoring', body: errorMessage(e) }),
  })
  const tamper = useMutation({
    mutationFn: (restore: boolean) => post<{ tampered: boolean }>(`/audit-events/${event.id}/demo-tamper`, { restore }),
    onSuccess: (r) => {
      verify.reset()
      qc.invalidateQueries({ queryKey: ['audit-event', event.id] })
      qc.invalidateQueries({ queryKey: ['audit-events'] })
      toast({ kind: 'info', title: r.tampered ? 'Stored record altered (demo)' : 'Original record restored', body: 'Run verification to see the result.' })
    },
  })
  const v = verify.data
  const tampered = '_original_outcome' in (event.details ?? {})
  const status = event.anchor_status

  return (
    <div className={clsx('rounded-xl border border-line', compact ? 'p-4' : 'p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-navy-900">
          <Boxes className="size-4 text-teal-600" /> Blockchain audit anchor
        </p>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1 text-[12.5px] text-muted">Local demonstration network. Only the fingerprint below is written on-chain — no patient or clinical data.</p>

      <div className="mt-4 space-y-2 text-[13px]">
        <div className="flex items-center gap-2">
          <Fingerprint className="size-3.5 shrink-0 text-navy-400" />
          <Mono className="truncate">{event.fingerprint}</Mono>
          <CopyButton value={event.fingerprint} />
        </div>
        {status === 'anchored' && (
          <p className="text-navy-600">
            Block <Mono>#{event.anchor_block}</Mono> · tx <Mono>{shortHash(event.anchor_tx_hash)}</Mono>
            {event.anchor_tx_hash && <CopyButton value={event.anchor_tx_hash} />}
          </p>
        )}
        {status === 'pending' && (
          <p className="flex items-center gap-2 text-warning">
            <Loader2 className="size-3.5 animate-spin" /> Waiting for the transaction receipt…
          </p>
        )}
        {status === 'failed' && <p className="text-danger">Anchoring failed: {event.anchor_error}</p>}
        {status === 'not_anchored' && <p className="text-muted">This event type is recorded without an on-chain anchor.</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => verify.mutate()} loading={verify.isPending} disabled={status !== 'anchored'}>
          <ShieldCheck className="size-3.5" /> Verify integrity
        </Button>
        {(status === 'failed' || status === 'not_anchored') && (
          <Button size="sm" variant="secondary" onClick={() => retry.mutate()} loading={retry.isPending}>
            <RefreshCw className="size-3.5" /> {status === 'failed' ? 'Retry anchoring' : 'Anchor now'}
          </Button>
        )}
        {me?.role === 'demo_admin' && status === 'anchored' && (
          <Button size="sm" variant={tampered ? 'secondary' : 'danger'} onClick={() => tamper.mutate(tampered)} loading={tamper.isPending}>
            {tampered ? <RotateCcw className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
            {tampered ? 'Restore record' : 'Simulate tampering'}
          </Button>
        )}
      </div>

      {v && (
        <div
          role="status"
          className={clsx(
            'mt-4 rounded-lg border p-3.5',
            v.status === 'verified' ? 'border-[#d1fadf] bg-[#ecfdf3]' : v.status === 'mismatch' ? 'border-[#fee4e2] bg-[#fef3f2]' : 'border-[#fef0c7] bg-[#fffaeb]',
          )}
        >
          <p className={clsx('flex items-center gap-2 text-[14px] font-semibold', v.status === 'verified' ? 'text-success' : v.status === 'mismatch' ? 'text-danger' : 'text-warning')}>
            {v.status === 'verified' ? <ShieldCheck className="size-4" /> : v.status === 'mismatch' ? <ShieldAlert className="size-4" /> : <ShieldQuestion className="size-4" />}
            {v.status === 'verified' ? 'Verified' : v.status === 'mismatch' ? 'Mismatch detected' : v.status === 'not_anchored' ? 'Cannot verify yet' : 'Verification incomplete'}
          </p>
          <p className="mt-1 text-[13px] text-navy-700">{v.message}</p>
          <div className="mt-2 grid gap-1 font-mono text-[11px] text-navy-500">
            <span>anchored  {shortHash(v.stored_fingerprint, 14)}</span>
            <span className={v.recomputed_fingerprint !== v.stored_fingerprint ? 'text-danger' : ''}>recomputed {shortHash(v.recomputed_fingerprint, 14)}</span>
            {v.contract_address && <span>contract {shortHash(v.contract_address, 8)} · chain {v.chain_id}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function AuditEventDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: ev, isLoading, error } = useAuditEvent(id)
  return (
    <Drawer open={!!id} onClose={onClose} title="Audit event">
      {isLoading && <p className="text-[14px] text-muted">Loading…</p>}
      {error && <p className="text-[14px] text-danger">{errorMessage(error)}</p>}
      {ev && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold">{auditActionLabel(ev.action)}</h3>
            <StatusBadge status={ev.outcome} />
          </div>
          <KV
            items={[
              ['Time', fmtTime(ev.created_at)],
              ['Request ID', <span className="flex items-center"><Mono>{ev.request_id}</Mono><CopyButton value={ev.request_id} /></span>],
              ['Organization', ev.organization_name],
              ['Application', ev.application_name],
              ['Actor', ev.actor ?? (ev.application_name ? 'Application (client credentials)' : 'System')],
              ['Resource types', ev.resource_types.length ? ev.resource_types.join(', ') : null],
              ['Purpose', ev.purpose ? purposeLabel[ev.purpose] ?? ev.purpose : null],
              ['Reason', ev.reason],
            ]}
          />
          <AnchorVerificationPanel event={ev} />
          <div>
            <p className="mb-2 text-[13px] font-medium text-navy-700">Event metadata</p>
            <JsonView data={Object.fromEntries(Object.entries(ev.details ?? {}).filter(([k]) => !k.startsWith('_')))} maxHeight={260} />
            <p className="mt-2 text-[12px] text-muted">Metadata is stored by Privexa for audit. It is not part of the on-chain fingerprint and contains no clinical content.</p>
          </div>
        </div>
      )}
    </Drawer>
  )
}
