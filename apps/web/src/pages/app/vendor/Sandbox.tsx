import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { apiRaw, api } from '../../../lib/api'
import type { Application, DataRequestResult } from '../../../lib/types'
import { Button, SimulatedTag } from '../../../components/ui'
import { ErrorState, LoadingRows } from '../../../components/states'
import { Chips, CLINICAL_TYPES, JsonView, PageHeader, Panel, PURPOSES, purposeLabel, Select } from '../../../components/app/kit'
import { AnchorForEvent, DataRequestResultView, Timeline } from '../../../components/app/DataRequestResult'

type SandboxPatients = {
  items: { organization_id: string; organization_name: string; patient_id: string; name: string; birth_date: string | null; mrn: string | null }[]
  links: { link_id: string; label: string; consent_status: string }[]
  errors: { organization_name: string; message: string }[]
}

export default function Sandbox() {
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') })
  const pats = useQuery({ queryKey: ['sandbox-patients'], queryFn: () => api<SandboxPatients>('/sandbox/patients') })
  const [appId, setAppId] = useState('')
  const [patient, setPatient] = useState('')
  const [types, setTypes] = useState<string[]>(['Observation', 'Encounter'])
  const [purpose, setPurpose] = useState('care_coordination')
  const [tab, setTab] = useState<'result' | 'timeline' | 'json'>('result')
  const app = apps.data?.find((a) => a.id === appId) ?? apps.data?.[0]

  const patientOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    for (const l of pats.data?.links ?? []) opts.push({ value: `link:${l.link_id}`, label: `${l.label} — both hospitals (linked)` })
    for (const p of pats.data?.items ?? []) opts.push({ value: `${p.organization_id}:${p.patient_id}`, label: `${p.name} · ${p.organization_name} · ${p.mrn ?? ''}` })
    return opts
  }, [pats.data])
  const sel = patient || patientOptions[0]?.value || ''

  const run = useMutation({
    mutationFn: () => {
      const [a, b] = sel.split(':')
      const ref = a === 'link' ? { link_id: b } : { organization_id: a, patient_id: b }
      return apiRaw<DataRequestResult>('/data-requests', { method: 'POST', json: { application_id: app!.id, patient: ref, resource_types: types, purpose } })
    },
    onSuccess: () => setTab('result'),
  })
  const r = run.data?.data

  return (
    <div className="space-y-6">
      <PageHeader title="Sandbox" description="Send a real request through Privexa's access checks to the simulated hospitals. Responses contain synthetic data only." actions={<SimulatedTag label="Synthetic data" />} />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel title="Request">
          {(apps.isLoading || pats.isLoading) && <LoadingRows rows={4} />}
          {pats.error && <ErrorState error={pats.error} compact onRetry={() => pats.refetch()} />}
          {pats.data?.errors.map((e) => <p key={e.organization_name} className="mb-3 rounded-lg bg-[#fef3f2] px-3 py-2 text-[12.5px] text-danger">{e.organization_name}: {e.message}</p>)}
          {apps.data && pats.data && (
            <div className="space-y-4">
              {!apps.data.length && <p className="text-[13px] text-muted">Register an application first.</p>}
              <Select label="Application" value={app?.id ?? ''} onChange={setAppId} options={apps.data.map((a) => ({ value: a.id, label: a.name }))} />
              <Select label="Synthetic patient & hospital" value={sel} onChange={setPatient} options={patientOptions} />
              <div>
                <p className="label">Resource types</p>
                <Chips options={CLINICAL_TYPES} value={types as (typeof CLINICAL_TYPES)[number][]} onChange={setTypes} />
              </div>
              <Select label="Purpose" value={purpose} onChange={setPurpose} options={PURPOSES.map((p) => ({ value: p, label: purposeLabel[p] }))} />
              <Button className="w-full" onClick={() => run.mutate()} loading={run.isPending} disabled={!app || !sel || !types.length}>
                <Play className="size-4" /> Submit request
              </Button>
              <p className="text-[12px] text-muted">Requests go through the Privexa API — the browser never contacts a hospital system directly.</p>
            </div>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel
            title="Response"
            actions={
              r && (
                <div className="flex rounded-lg bg-navy-50 p-0.5" role="tablist">
                  {(['result', 'timeline', 'json'] as const).map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1 text-[12.5px] font-medium ${tab === t ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500'}`}>
                      {t === 'result' ? 'Decision' : t === 'timeline' ? `Timeline (${r.timeline.length})` : 'Raw JSON'}
                    </button>
                  ))}
                </div>
              )
            }
          >
            {!r && !run.error && <p className="py-10 text-center text-[14px] text-muted">Configure a request and submit it to see the access decision, validation results and data.</p>}
            {run.error && <ErrorState error={run.error} compact />}
            {r && tab === 'result' && <DataRequestResultView r={r} />}
            {r && tab === 'timeline' && <Timeline items={r.timeline} />}
            {r && tab === 'json' && <JsonView data={r} maxHeight={520} />}
          </Panel>
          {r && (
            <Panel title="Audit events for this request" description="One event per hospital. Anchoring happens in the background — the status updates when the transaction is mined.">
              <div className="grid gap-4 lg:grid-cols-2">
                {r.decisions.map((d) => (
                  <div key={d.audit_event_id}>
                    <p className="mb-2 text-[13px] font-medium text-navy-700">{d.organization_name}</p>
                    <AnchorForEvent id={d.audit_event_id} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
