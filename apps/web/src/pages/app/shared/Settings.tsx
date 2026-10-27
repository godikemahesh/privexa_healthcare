import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { api, errorMessage, post } from '../../../lib/api'
import type { Organization } from '../../../lib/types'
import { roleLabel, useAuthActions, useMe } from '../../../lib/auth'
import { Button } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ConfirmDialog, KV, PageHeader, Panel } from '../../../components/app/kit'

export default function Settings() {
  const { data: me } = useMe()
  const { logout } = useAuthActions()
  const qc = useQueryClient()
  const toast = useToast()
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  const [confirm, setConfirm] = useState(false)
  const reset = useMutation({
    mutationFn: () => post('/demo/reset'),
    onSuccess: () => {
      qc.invalidateQueries()
      setConfirm(false)
      toast({ kind: 'success', title: 'Demo reset', body: 'Simulated failures cleared, consent restored and demo tampering undone. Audit history is kept.' })
    },
    onError: (e) => toast({ kind: 'error', title: 'Reset failed', body: errorMessage(e) }),
  })
  if (!me) return null
  const memberOf = me.role === 'vendor_dev' ? [] : (orgs.data ?? []).filter((o) => me.organization_ids.includes(o.id))

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your demo account and workspace configuration." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Account">
          <KV
            items={[
              ['Name', me.name],
              ['Email', me.email],
              ['Role', roleLabel[me.role]],
              ...(me.vendor_name ? [['Vendor', me.vendor_name] as [string, string]] : []),
              ...(me.role !== 'vendor_dev' ? [['Organizations', memberOf.map((o) => o.name).join(', ') || '—'] as [string, string]] : []),
            ]}
          />
          <Button variant="secondary" className="mt-4" onClick={logout}>Sign out</Button>
        </Panel>
        <Panel title="Authentication model">
          <div className="space-y-3 text-[14px] leading-relaxed text-navy-700">
            <p>This demonstration uses local accounts with Argon2-hashed passwords, an HttpOnly session cookie and CSRF protection. Every permission is enforced on the server by role and organization membership.</p>
            <p>A production deployment would connect an enterprise identity provider (OIDC/SAML) with multi-factor authentication. Applications authenticate with their own client credentials, which are never exposed in browser code.</p>
          </div>
        </Panel>
        {me.role === 'demo_admin' && (
          <Panel title="Demo controls">
            <p className="text-[14px] text-muted">Return the shared demo to a clean state: clears simulated failures, restores demo consent and undoes simulated tampering. Audit history is preserved.</p>
            <Button variant="danger" className="mt-4" onClick={() => setConfirm(true)}>
              <RotateCcw className="size-4" /> Reset demo state
            </Button>
          </Panel>
        )}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => reset.mutate()} loading={reset.isPending} danger title="Reset demo state" confirmLabel="Reset" body="This affects everyone using the shared demo environment." />
    </div>
  )
}
