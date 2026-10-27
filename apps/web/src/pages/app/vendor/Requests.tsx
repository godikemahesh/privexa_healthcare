import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Send } from 'lucide-react'
import { api, errorMessage, post, type Page } from '../../../lib/api'
import type { AccessRequest, Application, Organization } from '../../../lib/types'
import { Button } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { Chips, CLINICAL_TYPES, DataTable, fmtTime, Modal, PageHeader, Pagination, Panel, PURPOSES, purposeLabel, Select, StatusBadge } from '../../../components/app/kit'

export default function VendorRequests() {
  const qc = useQueryClient()
  const toast = useToast()
  const [params] = useSearchParams()
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const reqs = useQuery({ queryKey: ['access-requests', 'vendor', page], queryFn: () => api<Page<AccessRequest>>(`/access-requests?page=${page}&page_size=20`) })
  useEffect(() => {
    if (params.get('org')) setOpen(true)
  }, [params])
  const submit = useMutation({
    mutationFn: (r: AccessRequest) => post<AccessRequest>(`/access-requests/${r.id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access-requests'] }); toast({ kind: 'success', title: 'Request submitted for review' }) },
    onError: (e) => toast({ kind: 'error', title: 'Not submitted', body: errorMessage(e) }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access requests"
        description="Request access to a simulated organization and follow it from draft to decision. Approvals in the demo are made by a demo administrator, not a real hospital."
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> New request</Button>}
      />
      <Panel padded={false}>
        {reqs.isLoading && <LoadingRows />}
        {reqs.error && <ErrorState error={reqs.error} onRetry={() => reqs.refetch()} />}
        {reqs.data && (
          <>
            <DataTable
              rows={reqs.data.items}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No access requests yet" action={<Button size="sm" onClick={() => setOpen(true)}>Create a request</Button>} />}
              columns={[
                { key: 'a', header: 'Application', cell: (r) => <span className="font-medium text-navy-900">{r.application_name}</span> },
                { key: 'o', header: 'Organization', cell: (r) => r.organization_name },
                { key: 'rt', header: 'Resources', cell: (r) => <span className="font-mono text-[12px]">{r.resource_types.join(', ')}</span> },
                { key: 'p', header: 'Purpose', cell: (r) => purposeLabel[r.purpose] ?? r.purpose },
                { key: 's', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
                { key: 'reason', header: 'Decision note', cell: (r) => <span className="text-muted">{r.decision_reason ?? '—'}</span> },
                { key: 'u', header: 'Updated', cell: (r) => <span className="whitespace-nowrap">{fmtTime(r.updated_at)}</span> },
                { key: 'x', header: '', cell: (r) => r.status === 'draft' && <Button size="sm" onClick={() => submit.mutate(r)} loading={submit.isPending && submit.variables?.id === r.id}><Send className="size-3.5" /> Submit</Button> },
              ]}
            />
            <Pagination page={page} pageSize={20} total={reqs.data.total} onPage={setPage} />
          </>
        )}
      </Panel>
      <NewRequest open={open} onClose={() => setOpen(false)} initialOrg={params.get('org') ?? ''} />
    </div>
  )
}

function NewRequest({ open, onClose, initialOrg }: { open: boolean; onClose: () => void; initialOrg: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') })
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  const [appId, setAppId] = useState('')
  const [orgId, setOrgId] = useState(initialOrg)
  const [types, setTypes] = useState<string[]>([])
  const [purpose, setPurpose] = useState('')
  const [justification, setJustification] = useState('')
  const app = apps.data?.find((a) => a.id === (appId || apps.data?.[0]?.id))
  useEffect(() => {
    if (app) {
      setTypes(app.requested_resource_types)
      setPurpose(app.purpose)
    }
  }, [app?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setOrgId(initialOrg)
  }, [initialOrg])
  const m = useMutation({
    mutationFn: (submit: boolean) => post<AccessRequest>('/access-requests', { application_id: app!.id, organization_id: orgId || orgs.data![0].id, resource_types: types, purpose, justification, submit }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['access-requests'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast({ kind: 'success', title: r.status === 'draft' ? 'Draft saved' : 'Request submitted', body: `${r.application_name} → ${r.organization_name}` })
      onClose()
    },
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request access"
      width={580}
      footer={
        <>
          <Button variant="secondary" onClick={() => m.mutate(false)} disabled={!app || !types.length} loading={m.isPending && m.variables === false}>Save draft</Button>
          <Button onClick={() => m.mutate(true)} disabled={!app || !types.length} loading={m.isPending && m.variables === true}>Submit request</Button>
        </>
      }
    >
      {!apps.data?.length ? (
        <p className="text-[14px] text-muted">Register an application first.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Application" value={app?.id ?? ''} onChange={setAppId} options={apps.data.map((a) => ({ value: a.id, label: a.name }))} />
            <Select label="Organization" value={orgId || orgs.data?.[0]?.id || ''} onChange={setOrgId} options={(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }))} />
          </div>
          <div>
            <p className="label">Resource types (least privilege — request only what you need)</p>
            <Chips options={CLINICAL_TYPES} value={types as (typeof CLINICAL_TYPES)[number][]} onChange={setTypes} />
          </div>
          <Select label="Purpose" value={purpose} onChange={setPurpose} options={PURPOSES.map((p) => ({ value: p, label: purposeLabel[p] }))} />
          <div>
            <label className="label" htmlFor="just">Justification</label>
            <textarea id="just" className="input" rows={3} maxLength={1000} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Why your application needs this information" />
          </div>
          {m.error && <p className="text-[13px] text-danger">{errorMessage(m.error)}</p>}
        </div>
      )}
    </Modal>
  )
}
