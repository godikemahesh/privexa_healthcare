import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Brain } from 'lucide-react'
import { api, errorMessage, patch, type Page } from '../../../lib/api'
import type { AccessRequest, Application } from '../../../lib/types'
import { useMe } from '../../../lib/auth'
import { Button, SimulatedTag } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { ConfirmDialog, fmtDate, PageHeader, purposeLabel, StatusBadge } from '../../../components/app/kit'

export default function ProviderApplications() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') })
  const grants = useQuery({ queryKey: ['access-requests', 'all-for-apps'], queryFn: () => api<Page<AccessRequest>>('/access-requests?page_size=100') })
  const [suspend, setSuspend] = useState<Application | null>(null)
  const m = useMutation({
    mutationFn: (a: Application) => patch<Application>(`/applications/${a.id}/status`, { status: a.status === 'active' ? 'suspended' : 'active' }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      setSuspend(null)
      toast({ kind: 'success', title: `${a.name} ${a.status === 'active' ? 'reactivated' : 'suspended'}` })
    },
    onError: (e) => toast({ kind: 'error', title: 'Could not change status', body: errorMessage(e) }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" description="Applications that have requested or hold access to your organizations, and exactly what they may access." />
      {(apps.isLoading || grants.isLoading) && <LoadingRows />}
      {apps.error && <ErrorState error={apps.error} onRetry={() => apps.refetch()} />}
      {apps.data && !apps.data.length && <EmptyState title="No applications yet" body="Applications appear here once a vendor submits an access request to your organization." />}
      <div className="grid gap-5 xl:grid-cols-2">
        {apps.data?.map((a) => {
          const rows = (grants.data?.items ?? []).filter((g) => g.application_id === a.id)
          return (
            <article key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Brain className="size-5" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h2 className="text-[16.5px] font-semibold">{a.name}</h2>
                    <p className="text-[13px] text-muted">{a.vendor_name} · registered {fmtDate(a.created_at)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={a.status} />
                  {a.simulated && <SimulatedTag label="Demo app" />}
                </div>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-muted">{a.description || a.use_case}</p>
              <p className="mt-3 text-[13px] text-navy-700">Stated purpose: <strong>{purposeLabel[a.purpose] ?? a.purpose}</strong></p>
              <div className="mt-4 space-y-2">
                {rows.length ? (
                  rows.map((g) => (
                    <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-[13px]">
                      <span className="font-medium text-navy-800">{g.organization_name}</span>
                      <span className="font-mono text-[11.5px] text-navy-500">{g.resource_types.join(', ')}</span>
                      <StatusBadge status={g.status} />
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-muted">No access requests to your organizations.</p>
                )}
              </div>
              {me?.role === 'demo_admin' && (
                <div className="mt-4">
                  <Button size="sm" variant={a.status === 'active' ? 'danger' : 'secondary'} onClick={() => setSuspend(a)}>
                    {a.status === 'active' ? 'Suspend application' : 'Reactivate application'}
                  </Button>
                </div>
              )}
            </article>
          )
        })}
      </div>
      <ConfirmDialog
        open={!!suspend}
        onClose={() => setSuspend(null)}
        onConfirm={() => suspend && m.mutate(suspend)}
        loading={m.isPending}
        danger={suspend?.status === 'active'}
        title={suspend?.status === 'active' ? 'Suspend application' : 'Reactivate application'}
        confirmLabel={suspend?.status === 'active' ? 'Suspend' : 'Reactivate'}
        body={suspend?.status === 'active' ? 'All data requests from this application will be denied while it is suspended, regardless of approvals.' : 'The application can request data again within its approved scopes.'}
      />
    </div>
  )
}
