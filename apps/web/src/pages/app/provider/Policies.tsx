import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, History, Plus } from 'lucide-react'
import { api, errorMessage, patch, post } from '../../../lib/api'
import type { Application, Organization, Policy } from '../../../lib/types'
import { Button } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { Chips, CLINICAL_TYPES, ConfirmDialog, Drawer, fmtTime, Modal, PageHeader, Panel, PURPOSES, purposeLabel, Select, StatusBadge } from '../../../components/app/kit'

type Decision = {
  outcome: string
  allowed_resource_types: string[]
  denied_resource_types: string[]
  reasons: string[]
  policy_results: { policy: string; version: number; enabled: boolean; matched: boolean }[]
}

function describeRule(p: Policy) {
  const r = p.rule
  if (r.require_active_consent) return 'Deny when the patient’s demo consent is withdrawn'
  const parts = [`Deny ${r.resource_types?.length ? r.resource_types.join(', ') : 'all resources'}`]
  if (r.purposes?.length) parts.push(`for ${r.purposes.map((x) => purposeLabel[x]).join(', ')}`)
  if (r.application_ids?.length) parts.push(`for ${r.application_ids.length} selected application(s)`)
  return parts.join(' ')
}

export default function Policies() {
  const qc = useQueryClient()
  const toast = useToast()
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  const [orgId, setOrgId] = useState('')
  const org = orgId || orgs.data?.[0]?.id || ''
  const pols = useQuery({ queryKey: ['policies', org], queryFn: () => api<Policy[]>(`/policies?organization_id=${org}`), enabled: !!org })
  const [toggle, setToggle] = useState<Policy | null>(null)
  const [versions, setVersions] = useState<Policy | null>(null)
  const [creating, setCreating] = useState(false)

  const update = useMutation({
    mutationFn: (p: Policy) => patch<Policy>(`/policies/${p.id}`, { enabled: !p.enabled }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['policies'] })
      setToggle(null)
      toast({ kind: 'success', title: `${p.name} ${p.enabled ? 'enabled' : 'disabled'}`, body: `Now version ${p.version}. Change recorded in the audit trail.` })
    },
    onError: (e) => toast({ kind: 'error', title: 'Policy not updated', body: errorMessage(e) }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policies"
        description="Organization rules applied to every data request after scope checks. Changes are versioned and logged."
        actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> New policy</Button>}
      />
      <Select className="w-72" label="Organization" value={org} onChange={setOrgId} options={(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }))} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Active demo policies" padded={false}>
          {pols.isLoading && <LoadingRows />}
          {pols.error && <ErrorState error={pols.error} onRetry={() => pols.refetch()} />}
          {pols.data && !pols.data.length && <EmptyState title="No policies for this organization" />}
          <ul className="divide-y divide-line">
            {pols.data?.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-navy-900">
                    {p.name} <StatusBadge status={p.enabled ? 'active' : 'draft'} label={p.enabled ? 'Enabled' : 'Disabled'} />
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">{p.description}</p>
                  <p className="mt-1 text-[12.5px] text-navy-600">{describeRule(p)}</p>
                  <p className="mt-1 font-mono text-[11.5px] text-navy-400">v{p.version} · updated {fmtTime(p.updated_at)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setVersions(p)}><History className="size-3.5" /> History</Button>
                  <Button size="sm" variant={p.enabled ? 'danger' : 'primary'} onClick={() => setToggle(p)}>{p.enabled ? 'Disable' : 'Enable'}</Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <PolicyTester orgId={org} />
      </div>

      <ConfirmDialog
        open={!!toggle}
        onClose={() => setToggle(null)}
        onConfirm={() => toggle && update.mutate(toggle)}
        loading={update.isPending}
        danger={toggle?.enabled}
        title={toggle?.enabled ? 'Disable policy' : 'Enable policy'}
        confirmLabel={toggle?.enabled ? 'Disable' : 'Enable'}
        body={toggle && <>This creates version {toggle.version + 1} of <strong>{toggle.name}</strong> and applies to all new requests immediately.</>}
      />
      <VersionsDrawer policy={versions} onClose={() => setVersions(null)} />
      <CreatePolicy open={creating} orgId={org} onClose={() => setCreating(false)} />
    </div>
  )
}

function PolicyTester({ orgId }: { orgId: string }) {
  const apps = useQuery({ queryKey: ['demo-scenario'], queryFn: () => api<{ applications: { id: string; name: string }[] }>('/demo/scenario') })
  const myApps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') })
  const options = [...new Map([...(apps.data?.applications ?? []), ...(myApps.data ?? [])].map((a) => [a.id, { value: a.id, label: a.name }])).values()]
  const [appId, setAppId] = useState('')
  const [types, setTypes] = useState<string[]>(['Observation'])
  const [purpose, setPurpose] = useState('care_coordination')
  const [consent, setConsent] = useState('active')
  const m = useMutation({ mutationFn: () => post<Decision>('/policies/evaluate', { organization_id: orgId, application_id: appId || options[0]?.value, resource_types: types, purpose, consent_status: consent }) })

  return (
    <Panel title="Test a policy" description="Dry run: would this request be allowed? No data is retrieved." actions={<FlaskConical className="size-4 text-teal-600" />}>
      <div className="space-y-4">
        <Select label="Application" value={appId || options[0]?.value || ''} onChange={setAppId} options={options} />
        <div>
          <p className="label">Resource types</p>
          <Chips options={CLINICAL_TYPES} value={types as (typeof CLINICAL_TYPES)[number][]} onChange={setTypes} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Purpose" value={purpose} onChange={setPurpose} options={PURPOSES.map((p) => ({ value: p, label: purposeLabel[p] }))} />
          <Select label="Consent state" value={consent} onChange={setConsent} options={[{ value: 'active', label: 'Active' }, { value: 'withdrawn', label: 'Withdrawn' }]} />
        </div>
        <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!types.length || !orgId}>Evaluate</Button>
        {m.error && <p className="text-[13px] text-danger">{errorMessage(m.error)}</p>}
        {m.data && (
          <div className="space-y-3 rounded-lg border border-line p-4" role="status">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold">Result</span>
              <StatusBadge status={m.data.outcome} />
            </div>
            {!!m.data.allowed_resource_types.length && <p className="text-[13px]"><span className="text-success">Allowed:</span> {m.data.allowed_resource_types.join(', ')}</p>}
            {!!m.data.denied_resource_types.length && <p className="text-[13px]"><span className="text-danger">Denied:</span> {m.data.denied_resource_types.join(', ')}</p>}
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-navy-700">
              {m.data.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
            {!!m.data.policy_results.length && (
              <div className="border-t border-line pt-3">
                {m.data.policy_results.map((p) => (
                  <p key={p.policy} className="flex justify-between text-[12.5px] text-muted">
                    <span>{p.policy} v{p.version}{!p.enabled && ' (disabled)'}</span>
                    <span className={p.matched ? 'font-medium text-danger' : ''}>{p.matched ? 'matched → deny' : 'not matched'}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}

function VersionsDrawer({ policy, onClose }: { policy: Policy | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['policy-versions', policy?.id, policy?.version],
    queryFn: () => api<{ version: number; enabled: boolean; rule: object; changed_by: string; created_at: string }[]>(`/policies/${policy!.id}/versions`),
    enabled: !!policy,
  })
  return (
    <Drawer open={!!policy} onClose={onClose} title={`Version history · ${policy?.name ?? ''}`}>
      {q.isLoading && <LoadingRows />}
      {q.error && <ErrorState error={q.error} />}
      <ol className="space-y-3">
        {q.data?.map((v) => (
          <li key={v.version} className="rounded-lg border border-line p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold">Version {v.version}</p>
              <StatusBadge status={v.enabled ? 'active' : 'draft'} label={v.enabled ? 'Enabled' : 'Disabled'} />
            </div>
            <p className="mt-1 text-[12.5px] text-muted">{v.changed_by} · {fmtTime(v.created_at)}</p>
            <pre className="mt-2 overflow-x-auto rounded bg-bg p-2 font-mono text-[11.5px] text-navy-600">{JSON.stringify(v.rule)}</pre>
          </li>
        ))}
      </ol>
    </Drawer>
  )
}

function CreatePolicy({ open, orgId, onClose }: { open: boolean; orgId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [purposes, setPurposes] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const m = useMutation({
    mutationFn: () => post<Policy>('/policies', { organization_id: orgId, name, description, enabled: true, rule: { effect: 'deny', resource_types: types, purposes, application_ids: [], require_active_consent: consent } }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['policies'] })
      toast({ kind: 'success', title: `Policy "${p.name}" created`, body: 'Version 1 is active and logged.' })
      setName(''); setDescription(''); setTypes([]); setPurposes([]); setConsent(false)
      onClose()
    },
  })
  const valid = name.trim().length >= 3 && (consent || types.length > 0)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New policy"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => m.mutate()} loading={m.isPending} disabled={!valid}>Create policy</Button></>}
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="pname">Name</label>
          <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="pdesc">Description</label>
          <input id="pdesc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>
        <label className="flex items-center gap-2 text-[14px] text-navy-800">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-4 accent-[var(--teal-600)]" />
          Deny when demo consent is withdrawn
        </label>
        <div>
          <p className="label">Deny these resource types {consent && '(optional — limits the consent rule)'}</p>
          <Chips options={CLINICAL_TYPES} value={types as (typeof CLINICAL_TYPES)[number][]} onChange={setTypes} />
        </div>
        <div>
          <p className="label">Only for these purposes (empty = all)</p>
          <Chips options={PURPOSES} value={purposes as (typeof PURPOSES)[number][]} onChange={setPurposes} />
        </div>
        {m.error && <p className="text-[13px] text-danger">{errorMessage(m.error)}</p>}
      </div>
    </Modal>
  )
}
