import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserRoundCheck } from 'lucide-react'
import { api, errorMessage, patch, post } from '../../../lib/api'
import type { MatchCandidate, PatientLink } from '../../../lib/types'
import { Button, SimulatedTag } from '../../../components/ui'
import { useToast } from '../../../components/Toast'
import { ErrorState, LoadingRows, EmptyState } from '../../../components/states'
import { fmtTime, PageHeader, Panel, StatusBadge } from '../../../components/app/kit'
import { MatchCard } from '../../../components/app/MatchCard'

type Matches = { items: MatchCandidate[]; errors: { organization_name: string; message: string }[]; request_id: string }

export default function Patients() {
  const qc = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('Krishnan')
  const [term, setTerm] = useState<string | null>(null)
  const matches = useQuery({ queryKey: ['matches', term], queryFn: () => api<Matches>(`/patients/matches?q=${encodeURIComponent(term!)}`), enabled: !!term })
  const links = useQuery({ queryKey: ['patient-links'], queryFn: () => api<PatientLink[]>('/patient-links') })

  const decide = useMutation({
    mutationFn: ({ c, d }: { c: MatchCandidate; d: 'confirm' | 'reject' }) =>
      post<PatientLink>('/patient-links', {
        members: [{ organization_id: c.a.organization_id, patient_id: c.a.patient_id, mrn: c.a.mrn }, { organization_id: c.b.organization_id, patient_id: c.b.patient_id, mrn: c.b.mrn }],
        decision: d,
        score: c.score,
        label: `${c.a.name} (synthetic)`,
      }),
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      qc.invalidateQueries({ queryKey: ['patient-links'] })
      toast({ kind: 'success', title: l.status === 'confirmed' ? 'Match confirmed' : 'Match rejected', body: 'Your review is recorded in the audit trail.' })
    },
    onError: (e) => toast({ kind: 'error', title: 'Review not saved', body: errorMessage(e) }),
  })
  const consent = useMutation({
    mutationFn: (l: PatientLink) => patch<PatientLink>(`/patient-links/${l.id}/consent`, { consent_status: l.consent_status === 'active' ? 'withdrawn' : 'active' }),
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ['patient-links'] })
      toast({ kind: 'info', title: `Demo consent ${l.consent_status}`, body: 'Policies requiring active consent now apply accordingly.' })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (q.trim().length >= 2) setTerm(q.trim())
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient matching"
        description="Find the same synthetic patient across hospitals. Each hospital uses its own MRN, so Privexa suggests matches from demographics and explains the score — an authorized reviewer decides."
        actions={<SimulatedTag label="Synthetic patients" />}
      />
      <form onSubmit={submit} className="flex max-w-xl gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Family or given name</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-300" />
          <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name across both hospitals" maxLength={60} />
        </label>
        <Button type="submit" loading={matches.isFetching}>Find matches</Button>
      </form>

      {matches.error && <ErrorState error={matches.error} onRetry={() => matches.refetch()} />}
      {matches.data?.errors.map((e) => (
        <p key={e.organization_name} className="rounded-lg bg-[#fef3f2] px-4 py-2.5 text-[13.5px] text-danger" role="alert">
          {e.organization_name} could not be searched: {e.message}
        </p>
      ))}
      {matches.data && !matches.data.items.length && <div className="card"><EmptyState title="No cross-hospital candidates" body="Try another name. Candidates need a minimum similarity score." /></div>}
      <div className="grid gap-5 xl:grid-cols-2">
        {matches.data?.items.map((c) => (
          <MatchCard key={`${c.a.patient_id}-${c.b.patient_id}`} c={c} busy={decide.isPending} onDecide={(d) => decide.mutate({ c, d })} />
        ))}
      </div>

      <Panel title="Reviewed links" description="Confirmed links can be used for cross-hospital data requests. The demo consent state is checked by policy." padded={false}>
        {links.isLoading && <LoadingRows rows={2} />}
        {links.error && <ErrorState error={links.error} />}
        {links.data && !links.data.length && <EmptyState title="No reviewed matches yet" icon={<UserRoundCheck className="size-5" />} />}
        <ul className="divide-y divide-line">
          {links.data?.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-[14.5px] font-semibold text-navy-900">{l.label} <StatusBadge status={l.status} /></p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {l.members.map((m) => `${m.organization_name} · ${m.mrn ?? m.patient_id.slice(0, 8)}`).join('  ↔  ')}
                </p>
                <p className="text-[12px] text-muted">Reviewed by {l.reviewed_by ?? '—'} · {fmtTime(l.created_at)} · score {Math.round(l.score * 100)}</p>
              </div>
              {l.status === 'confirmed' && (
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] text-muted">Demo consent</span>
                  <StatusBadge status={l.consent_status} />
                  <Button size="sm" variant="secondary" onClick={() => consent.mutate(l)} loading={consent.isPending && consent.variables?.id === l.id}>
                    {l.consent_status === 'active' ? 'Withdraw' : 'Restore'}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
