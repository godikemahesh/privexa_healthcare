import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, KeyRound, Plus } from 'lucide-react'
import { ApiError, api, errorMessage, post } from '../../../lib/api'
import type { Application } from '../../../lib/types'
import { Button, SimulatedTag } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { Chips, CLINICAL_TYPES, ConfirmDialog, CopyButton, fmtDate, Modal, Mono, PageHeader, PURPOSES, purposeLabel, Select, StatusBadge } from '../../../components/app/kit'

type Secret = { client_id: string; client_secret: string; secret_notice: string }

export default function VendorApplications() {
  const qc = useQueryClient()
  const toast = useToast()
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/applications') })
  const [registering, setRegistering] = useState(false)
  const [secret, setSecret] = useState<Secret | null>(null)
  const [rotate, setRotate] = useState<Application | null>(null)
  const rot = useMutation({
    mutationFn: (a: Application) => post<Secret>(`/applications/${a.id}/rotate-secret`),
    onSuccess: (s) => { setRotate(null); setSecret(s) },
    onError: (e) => toast({ kind: 'error', title: 'Could not rotate credentials', body: errorMessage(e) }),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="My applications" description="Register fictional healthcare or AI applications and manage their development credentials." actions={<Button onClick={() => setRegistering(true)}><Plus className="size-4" /> Register application</Button>} />
      {apps.isLoading && <LoadingRows />}
      {apps.error && <ErrorState error={apps.error} onRetry={() => apps.refetch()} />}
      {apps.data && !apps.data.length && <div className="card"><EmptyState title="No applications yet" body="Register an application to receive a development client ID." action={<Button size="sm" onClick={() => setRegistering(true)}>Register application</Button>} /></div>}
      <div className="grid gap-5 xl:grid-cols-2">
        {apps.data?.map((a) => (
          <article key={a.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold">{a.name}</h2>
                <p className="text-[13px] text-muted">{a.use_case}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={a.status} />
                <SimulatedTag label="Demo app" />
              </div>
            </div>
            {a.description && <p className="mt-3 text-[14px] leading-relaxed text-muted">{a.description}</p>}
            <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-2 text-[13px]">
              <dt className="text-muted">Client ID</dt>
              <dd className="flex items-center"><Mono>{a.client_id}</Mono><CopyButton value={a.client_id} /></dd>
              <dt className="text-muted">Purpose</dt>
              <dd>{purposeLabel[a.purpose] ?? a.purpose}</dd>
              <dt className="text-muted">Requested types</dt>
              <dd className="font-mono text-[12px]">{a.requested_resource_types.join(', ')}</dd>
              <dt className="text-muted">Callback URL</dt>
              <dd className="truncate">{a.callback_url ?? '—'}</dd>
              <dt className="text-muted">Registered</dt>
              <dd>{fmtDate(a.created_at)}</dd>
            </dl>
            <div className="mt-4 border-t border-line pt-4">
              <Button size="sm" variant="secondary" onClick={() => setRotate(a)}><KeyRound className="size-3.5" /> Rotate client secret</Button>
            </div>
          </article>
        ))}
      </div>
      <RegisterModal open={registering} onClose={() => setRegistering(false)} onCreated={(s) => { setRegistering(false); setSecret(s); qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['stats'] }) }} />
      <ConfirmDialog open={!!rotate} onClose={() => setRotate(null)} onConfirm={() => rotate && rot.mutate(rotate)} loading={rot.isPending} danger title="Rotate client secret" confirmLabel="Rotate" body="The current secret stops working immediately. The new secret is shown once." />
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Development credentials" footer={<Button onClick={() => setSecret(null)}>I've stored it</Button>}>
        {secret && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg bg-[#fffaeb] p-3 text-[13px] text-[#93370d]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {secret.secret_notice}
            </p>
            <div>
              <p className="label">Client ID</p>
              <div className="flex items-center rounded-lg border border-line bg-bg px-3 py-2"><Mono className="flex-1 break-all">{secret.client_id}</Mono><CopyButton value={secret.client_id} /></div>
            </div>
            <div>
              <p className="label">Client secret</p>
              <div className="flex items-center rounded-lg border border-line bg-bg px-3 py-2"><Mono className="flex-1 break-all">{secret.client_secret}</Mono><CopyButton value={secret.client_secret} /></div>
            </div>
            <p className="text-[12.5px] text-muted">Use these from server-side code only, via the X-Client-Id and X-Client-Secret headers. Privexa stores only a hash of the secret.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function RegisterModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: Secret) => void }) {
  const [types, setTypes] = useState<string[]>(['Observation'])
  const [purpose, setPurpose] = useState('care_coordination')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const m = useMutation({
    mutationFn: (body: object) => post<Secret & Application>('/applications', body),
    onSuccess: (r) => onCreated({ client_id: r.client_id, client_secret: r.client_secret, secret_notice: r.secret_notice }),
    onError: (e) => {
      if (e instanceof ApiError && Array.isArray(e.details)) setErrors(Object.fromEntries((e.details as { field: string; message: string }[]).map((d) => [d.field, d.message])))
    },
  })
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = { name: String(fd.get('name')).trim(), description: String(fd.get('description')).trim(), use_case: String(fd.get('use_case')).trim(), callback_url: String(fd.get('callback_url')).trim() || null, requested_resource_types: types, purpose }
    const errs: Record<string, string> = {}
    if (body.name.length < 3) errs.name = 'At least 3 characters'
    if (body.use_case.length < 3) errs.use_case = 'Describe the use case'
    if (!types.length) errs.requested_resource_types = 'Choose at least one resource type'
    setErrors(errs)
    if (!Object.keys(errs).length) m.mutate(body)
  }
  return (
    <Modal open={open} onClose={onClose} title="Register an application" width={600}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="name">Application name</label>
          <input id="name" name="name" className="input" maxLength={120} />
          {errors.name && <p className="mt-1 text-[12.5px] text-danger">{errors.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="use_case">Use case</label>
          <input id="use_case" name="use_case" className="input" maxLength={200} placeholder="e.g. Medication adherence reminders" />
          {errors.use_case && <p className="mt-1 text-[12.5px] text-danger">{errors.use_case}</p>}
        </div>
        <div>
          <label className="label" htmlFor="description">Description <span className="font-normal text-navy-400">(optional)</span></label>
          <textarea id="description" name="description" className="input" rows={2} maxLength={1000} />
        </div>
        <div>
          <p className="label">Requested resource types</p>
          <Chips options={CLINICAL_TYPES} value={types as (typeof CLINICAL_TYPES)[number][]} onChange={setTypes} />
          {errors.requested_resource_types && <p className="mt-1 text-[12.5px] text-danger">{errors.requested_resource_types}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Purpose" value={purpose} onChange={setPurpose} options={PURPOSES.map((p) => ({ value: p, label: purposeLabel[p] }))} />
          <div>
            <label className="label" htmlFor="callback_url">Callback URL <span className="font-normal text-navy-400">(optional)</span></label>
            <input id="callback_url" name="callback_url" className="input" placeholder="https://" />
            {errors.callback_url && <p className="mt-1 text-[12.5px] text-danger">{errors.callback_url}</p>}
          </div>
        </div>
        {m.error && !Object.keys(errors).length && <p className="text-[13px] text-danger">{errorMessage(m.error)}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={m.isPending}>Register</Button>
        </div>
      </form>
    </Modal>
  )
}
