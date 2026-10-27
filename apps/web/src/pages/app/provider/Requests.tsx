import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, post, type Page } from '../../../lib/api'
import type { AccessRequest } from '../../../lib/types'
import { useMe } from '../../../lib/auth'
import { Button } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { ConfirmDialog, DataTable, Drawer, fmtTime, KV, PageHeader, Pagination, Panel, purposeLabel, StatusBadge } from '../../../components/app/kit'

type Action = 'start_review' | 'approve' | 'reject' | 'revoke'
const actionText: Record<Action, string> = { start_review: 'Start review', approve: 'Approve for demo', reject: 'Reject', revoke: 'Revoke access' }
const STATUS_TABS = [
  { v: '', l: 'All' },
  { v: 'submitted', l: 'Submitted' },
  { v: 'under_review', l: 'Under review' },
  { v: 'approved', l: 'Approved' },
  { v: 'rejected', l: 'Rejected' },
  { v: 'revoked', l: 'Revoked' },
]

export default function ProviderRequests() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<AccessRequest | null>(null)
  const [pending, setPending] = useState<{ req: AccessRequest; action: Action } | null>(null)
  const [reason, setReason] = useState('')

  const q = useQuery({ queryKey: ['access-requests', status, page], queryFn: () => api<Page<AccessRequest & { justification: string }>>(`/access-requests?page=${page}&page_size=20${status ? `&status=${status}` : ''}`) })
  const review = useMutation({
    mutationFn: ({ req, action }: { req: AccessRequest; action: Action }) => post<AccessRequest>(`/access-requests/${req.id}/review`, { action, reason: reason.trim() || undefined }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['access-requests'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setPending(null)
      setReason('')
      setSel(r)
      toast({ kind: 'success', title: `Request ${r.status.replace('_', ' ')}`, body: `${r.application_name} · ${r.organization_name}. Recorded in the audit trail.` })
    },
    onError: (e) => toast({ kind: 'error', title: 'Action failed', body: errorMessage(e) }),
  })

  const actionsFor = (r: AccessRequest): Action[] =>
    r.status === 'submitted' ? ['start_review', 'approve', 'reject'] : r.status === 'under_review' ? ['approve', 'reject'] : r.status === 'approved' ? ['revoke'] : []
  const needsReason = pending && (pending.action === 'reject' || pending.action === 'revoke')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access requests"
        description={me?.role === 'demo_admin' ? 'Review vendor requests as the demo administrator. Decisions here are demonstration approvals, not real hospital approvals.' : 'Review which applications want access to your organizations, what they need and why.'}
      />
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => { setStatus(t.v); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${status === t.v ? 'bg-navy-900 text-white' : 'border border-line bg-white text-navy-600 hover:border-navy-200'}`}
          >
            {t.l}
          </button>
        ))}
      </div>
      <Panel padded={false}>
        {q.isLoading && <LoadingRows />}
        {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data && (
          <>
            <DataTable
              rows={q.data.items}
              rowKey={(r) => r.id}
              onRowClick={setSel}
              empty={<EmptyState title="No access requests" body="Requests submitted by vendors appear here." />}
              columns={[
                { key: 'app', header: 'Application', cell: (r) => <div><p className="font-medium text-navy-900">{r.application_name}</p><p className="text-[12px] text-muted">{r.vendor_name}</p></div> },
                { key: 'org', header: 'Organization', cell: (r) => r.organization_name },
                { key: 'rt', header: 'Requested resources', cell: (r) => <span className="font-mono text-[12px]">{r.resource_types.join(', ')}</span> },
                { key: 'p', header: 'Purpose', cell: (r) => purposeLabel[r.purpose] ?? r.purpose },
                { key: 't', header: 'Requested', cell: (r) => <span className="whitespace-nowrap">{fmtTime(r.created_at)}</span> },
                { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
              ]}
            />
            <Pagination page={page} pageSize={20} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Panel>

      <Drawer open={!!sel} onClose={() => setSel(null)} title="Access request">
        {sel && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-semibold">{sel.application_name}</h3>
              <StatusBadge status={sel.status} />
            </div>
            <KV
              items={[
                ['Vendor', sel.vendor_name],
                ['Organization', sel.organization_name],
                ['Resource types', <span className="font-mono text-[12.5px]">{sel.resource_types.join(', ')}</span>],
                ['Stated purpose', purposeLabel[sel.purpose] ?? sel.purpose],
                ['Justification', (sel as AccessRequest & { justification?: string }).justification || null],
                ['Requested', fmtTime(sel.created_at)],
                ['Last updated', fmtTime(sel.updated_at)],
                ['Decision reason', sel.decision_reason],
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {actionsFor(sel).map((a) => (
                <Button key={a} variant={a === 'approve' ? 'primary' : a === 'start_review' ? 'secondary' : 'danger'} onClick={() => setPending({ req: sel, action: a })}>
                  {actionText[a]}
                </Button>
              ))}
              {!actionsFor(sel).length && <p className="text-[13px] text-muted">No further actions for a request that is {sel.status.replace('_', ' ')}.</p>}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!pending}
        onClose={() => { setPending(null); setReason('') }}
        onConfirm={() => pending && review.mutate(pending)}
        loading={review.isPending}
        danger={pending?.action === 'reject' || pending?.action === 'revoke'}
        title={pending ? actionText[pending.action] : ''}
        confirmLabel={pending ? actionText[pending.action] : ''}
        body={
          pending && (
            <>
              <strong>{pending.req.application_name}</strong> · {pending.req.organization_name}
              <br />
              {pending.action === 'approve' && `Grants ${pending.req.resource_types.join(', ')} for ${purposeLabel[pending.req.purpose]}. Every request will still be checked against policies.`}
              {pending.action === 'revoke' && 'The application immediately loses access. Future requests will be denied.'}
            </>
          )
        }
      >
        {pending && (
          <div className="mt-4">
            <label className="label" htmlFor="reason">Reason {needsReason ? '' : '(optional)'}</label>
            <textarea id="reason" className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={needsReason ? 'Required — shown to the vendor and recorded in the audit trail' : ''} />
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
