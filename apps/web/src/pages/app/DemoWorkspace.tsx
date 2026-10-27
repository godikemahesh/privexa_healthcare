import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Hospital, Info, Lock, PlugZap, RotateCcw, Search, ShieldAlert, Zap } from 'lucide-react'
import clsx from 'clsx'
import { PrivexaLogo } from '../../brand/Logo'
import { api, apiRaw, errorMessage, post } from '../../lib/api'
import type { DataRequestResult, MatchCandidate, Organization, PatientLink, PatientRecord } from '../../lib/types'
import { Button, SimulatedTag } from '../../components/ui'
import { ErrorState } from '../../components/states'
import { fmtDate, Mono, ORG_COLORS, StatusBadge } from '../../components/app/kit'
import { MatchCard } from '../../components/app/MatchCard'
import { AnchorForEvent, DataRequestResultView, DecisionCard, Timeline } from '../../components/app/DataRequestResult'
import { useAuditEvent } from '../../components/app/AuditPanels'
import { Seo } from '../../components/Seo'

type Scenario = { organizations: { id: string; slug: string; name: string }[]; applications: { id: string; name: string; purpose: string; requested_resource_types: string[] }[]; patient_search: string }
type TestResult = { ok: boolean; status: string; error?: { code: string; message: string }; capabilities?: { fhir_version: string; resource_types: string[]; latency_ms: number }; request_id: string }

const STEPS = [
  { t: 'Two independent hospitals', why: 'Healthcare data lives in separate systems. Privexa connects to them where they are — nothing is copied into a central database.' },
  { t: 'Test both connections', why: 'Before anything else, Privexa confirms each system is reachable and reads what it can share.' },
  { t: 'Search for a patient', why: 'Searching both hospitals at once — through Privexa, never directly from your browser.' },
  { t: 'Same person, separate records', why: 'Each hospital assigned its own record number. There is no shared ID to rely on.' },
  { t: 'A suggested match', why: 'Privexa compares demographics and explains its reasoning — including a similar-looking person who is not a match.' },
  { t: 'A person confirms the match', why: 'Matching is a suggestion. An authorized reviewer makes the decision, and the review is recorded.' },
  { t: 'An application asks for data', why: 'A registered application requests specific information for a stated purpose. It never talks to the hospitals directly.' },
  { t: 'Privexa checks every rule', why: 'Identity, approved scope, purpose, consent and each hospital’s policies are checked — separately for each hospital.' },
  { t: 'Only permitted data returns', why: 'One hospital approved medication data for this application; the other did not. Each decision is respected exactly.' },
  { t: 'One timeline, clear sources', why: 'Records from both hospitals become one readable timeline — every item labeled with where it came from.' },
  { t: 'The access is recorded', why: 'Every decision — allowed or denied — creates an audit event linked to the request ID.' },
  { t: 'Anchored on a blockchain', why: 'A fingerprint of the audit event (never the data) is written to a local demonstration blockchain.' },
  { t: 'Verify integrity', why: 'Anyone with access can check the stored record still matches its anchored fingerprint. Try altering it.' },
  { t: 'A request that is denied', why: 'An application without provider approval asks for data. Privexa refuses — and records that too.' },
  { t: 'An outage, then recovery', why: 'Real systems fail. Watch a hospital time out, the error surface clearly, and the connection recover.' },
]

export default function DemoWorkspace() {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [link, setLink] = useState<PatientLink | null>(null)
  const [result, setResult] = useState<DataRequestResult | null>(null)
  const complete = (i: number) => setDone((d) => new Set(d).add(i))
  const scenario = useQuery({ queryKey: ['demo-scenario'], queryFn: () => api<Scenario>('/demo/scenario') })

  const s = STEPS[step]
  const ctx = { scenario: scenario.data, link, setLink, result, setResult, complete: () => complete(step) }

  return (
    <div className="min-h-screen bg-bg">
      <Seo title="Interactive demo" description="Guided Privexa demonstration with two simulated hospitals." />
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" aria-label="Privexa home"><PrivexaLogo size={24} /></Link>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="hidden text-[14px] font-medium text-navy-700 sm:block">Interactive demo</span>
            <SimulatedTag label="Simulated · synthetic data" />
          </div>
          <div className="flex items-center gap-2">
            <Link to="/app/provider" className="hidden text-[13.5px] font-medium text-navy-600 hover:text-navy-900 md:block">Provider workspace</Link>
            <Link to="/demo" className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-navy-700 hover:bg-navy-50">Exit demo</Link>
          </div>
        </div>
        <div className="h-1 bg-navy-50">
          <motion.div className="h-full bg-teal-600" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr]">
        <nav className="hidden lg:block" aria-label="Demo steps">
          <ol className="sticky top-24 space-y-0.5">
            {STEPS.map((x, i) => (
              <li key={x.t}>
                <button
                  onClick={() => setStep(i)}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] transition', i === step ? 'bg-white font-medium text-navy-900 shadow-sm ring-1 ring-line' : 'text-navy-500 hover:text-navy-800')}
                  aria-current={i === step ? 'step' : undefined}
                >
                  <span className={clsx('flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]', done.has(i) ? 'bg-teal-600 text-white' : i === step ? 'bg-navy-900 text-white' : 'bg-navy-100 text-navy-500')}>
                    {done.has(i) ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="truncate">{x.t}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <main>
          {scenario.error && <ErrorState error={scenario.error} onRetry={() => scenario.refetch()} />}
          <AnimatePresence mode="wait">
            <motion.section key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <div className="mb-6">
                <p className="font-mono text-[12px] text-teal-700">STEP {step + 1} OF {STEPS.length}</p>
                <h1 className="mt-2 text-[30px] font-semibold leading-tight sm:text-[34px]">{s.t}</h1>
                <p className="mt-3 max-w-3xl text-[16.5px] leading-relaxed text-muted">{s.why}</p>
              </div>
              {scenario.data && <StepBody i={step} ctx={ctx} />}
            </motion.section>
          </AnimatePresence>
          <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
            <Button variant="secondary" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0}><ArrowLeft className="size-4" /> Back</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((x) => x + 1)}>{done.has(step) ? 'Next step' : 'Skip to next'} <ArrowRight className="size-4" /></Button>
            ) : (
              <Link to="/contact" className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy-900 px-4 text-[14px] font-medium text-white hover:bg-navy-800">Talk to Privexa <ArrowRight className="size-4" /></Link>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

type Ctx = {
  scenario?: Scenario
  link: PatientLink | null
  setLink: (l: PatientLink) => void
  result: DataRequestResult | null
  setResult: (r: DataRequestResult) => void
  complete: () => void
}

/** Marks the current step complete once its condition holds. */
function useCompleteWhen(cond: boolean, ctx: Ctx) {
  const { complete } = ctx
  useEffect(() => {
    if (cond) complete()
  }, [cond]) // eslint-disable-line react-hooks/exhaustive-deps
}

function Explain({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-teal-100 bg-teal-50/50 p-4 text-[14px] leading-relaxed text-navy-700">
      <Info className="mt-0.5 size-4 shrink-0 text-teal-700" /> <span>{children}</span>
    </p>
  )
}

function Box({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('card p-5', className)}>{children}</div>
}

function NeedEarlier({ what }: { what: string }) {
  return <Box><p className="text-[14px] text-muted">Complete the earlier step first: <strong className="text-navy-800">{what}</strong>.</p></Box>
}

function StepBody({ i, ctx }: { i: number; ctx: Ctx }) {
  switch (i) {
    case 0: return <S1 ctx={ctx} />
    case 1: return <S2 ctx={ctx} />
    case 2: return <S3 ctx={ctx} />
    case 3: return <S4 ctx={ctx} />
    case 4: return <S5 ctx={ctx} />
    case 5: return <S6 ctx={ctx} />
    case 6: return <S7 ctx={ctx} />
    case 7: return <S8 ctx={ctx} />
    case 8: return ctx.result ? <S9 ctx={ctx} /> : <NeedEarlier what="Privexa checks every rule" />
    case 9: return ctx.result ? <S10 ctx={ctx} /> : <NeedEarlier what="Privexa checks every rule" />
    case 10: return ctx.result ? <S11 ctx={ctx} /> : <NeedEarlier what="Privexa checks every rule" />
    case 11: return ctx.result ? <S12 ctx={ctx} /> : <NeedEarlier what="Privexa checks every rule" />
    case 12: return ctx.result ? <S13 ctx={ctx} /> : <NeedEarlier what="Privexa checks every rule" />
    case 13: return <S14 ctx={ctx} />
    default: return <S15 ctx={ctx} />
  }
}

/* 1 */
function S1({ ctx }: { ctx: Ctx }) {
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  useCompleteWhen(!!orgs.data, ctx)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {orgs.data?.map((o) => (
          <Box key={o.id}>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl text-white" style={{ background: ORG_COLORS[o.slug] }}><Hospital className="size-5" /></span>
              <div>
                <p className="text-[17px] font-semibold text-navy-900">{o.name}</p>
                <p className="text-[13px] text-muted">{o.system_type}</p>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] text-navy-700">Own server, own database, own patient records. Speaks HL7® FHIR® {o.fhir_version}.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{o.resource_types.slice(0, 6).map((r) => <span key={r} className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] text-navy-600">{r}</span>)}</div>
          </Box>
        ))}
      </div>
      {orgs.error && <ErrorState error={orgs.error} />}
      <Explain>Both organizations are fictional. Their records were generated synthetically — no real person's information exists anywhere in this demo.</Explain>
    </div>
  )
}

/* 2 */
function S2({ ctx }: { ctx: Ctx }) {
  const qc = useQueryClient()
  const [res, setRes] = useState<Record<string, TestResult>>({})
  const m = useMutation({
    mutationFn: async () => {
      const out: Record<string, TestResult> = {}
      for (const o of ctx.scenario!.organizations) out[o.id] = await post<TestResult>(`/organizations/${o.id}/test-connection`)
      return out
    },
    onSuccess: (r) => { setRes(r); qc.invalidateQueries({ queryKey: ['organizations'] }); if (Object.values(r).every((x) => x.ok)) ctx.complete() },
  })
  return (
    <div className="space-y-5">
      <Button size="lg" onClick={() => m.mutate()} loading={m.isPending}><PlugZap className="size-4" /> Test both connections</Button>
      {m.error && <ErrorState error={m.error} compact />}
      <div className="grid gap-4 md:grid-cols-2">
        {ctx.scenario!.organizations.map((o) => {
          const r = res[o.id]
          return (
            <Box key={o.id}>
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold">{o.name}</p>
                {r ? <StatusBadge status={r.ok ? r.status : 'down'} /> : <StatusBadge status="configured" />}
              </div>
              {r?.ok && r.capabilities && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                  <dt className="text-muted">FHIR version</dt><dd>{r.capabilities.fhir_version}</dd>
                  <dt className="text-muted">Response time</dt><dd>{r.capabilities.latency_ms} ms</dd>
                  <dt className="text-muted">Resource types</dt><dd>{r.capabilities.resource_types.length}</dd>
                  <dt className="text-muted">Request ID</dt><dd><Mono>{r.request_id}</Mono></dd>
                </dl>
              )}
              {r && !r.ok && <p className="mt-3 text-[13px] text-danger">{r.error?.message}</p>}
            </Box>
          )
        })}
      </div>
      <Explain>Privexa read each server's capability statement — the standard way a FHIR system describes what it supports. The endpoint addresses stay on the server; your browser never sees them.</Explain>
    </div>
  )
}

/* 3 + 4 share the search */
function useScenarioSearch(ctx: Ctx) {
  return useQuery({
    queryKey: ['demo-search', ctx.scenario?.patient_search],
    queryFn: () => api<{ items: PatientRecord[]; errors: { organization_name: string; message: string }[] }>(`/patients/search?q=${ctx.scenario!.patient_search}`),
    enabled: false,
  })
}

function S3({ ctx }: { ctx: Ctx }) {
  const q = useScenarioSearch(ctx)
  return (
    <div className="space-y-5">
      <div className="flex max-w-lg gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-300" />
          <input className="input pl-9" value={ctx.scenario!.patient_search} readOnly aria-label="Search term" />
        </div>
        <Button onClick={() => q.refetch().then((r) => r.data && ctx.complete())} loading={q.isFetching}>Search both hospitals</Button>
      </div>
      {q.error && <ErrorState error={q.error} compact />}
      {q.data && (
        <Box>
          <p className="mb-3 text-[14px] font-medium">{q.data.items.length} synthetic records found</p>
          <ul className="divide-y divide-line">
            {q.data.items.map((p) => (
              <li key={p.patient_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]">
                <span className="font-medium text-navy-900">{p.name}</span>
                <span className="text-muted">born {fmtDate(p.birth_date)}</span>
                <span className="rounded px-2 py-0.5 text-[12px] font-medium text-white" style={{ background: ORG_COLORS[p.organization_name.startsWith('MetroCare') ? 'metrocare' : 'sunrise'] }}>{p.organization_name}</span>
              </li>
            ))}
          </ul>
        </Box>
      )}
      <Explain>This search returns demographics only. Clinical records are not retrieved until an authorized application asks — and is allowed.</Explain>
    </div>
  )
}

function S4({ ctx }: { ctx: Ctx }) {
  const q = useScenarioSearch(ctx)
  const data = q.data
  useCompleteWhen(!!data, ctx)
  if (!data) {
    return (
      <div className="space-y-4">
        <Button onClick={() => q.refetch().then(() => ctx.complete())} loading={q.isFetching}>Load the search results</Button>
      </div>
    )
  }
  const byOrg = ctx.scenario!.organizations.map((o) => ({ o, items: data.items.filter((p) => p.organization_id === o.id) }))
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {byOrg.map(({ o, items }) => (
          <Box key={o.id}>
            <p className="text-[12px] font-medium uppercase tracking-wide" style={{ color: ORG_COLORS[o.slug] }}>{o.name}</p>
            {items.map((p) => (
              <div key={p.patient_id} className="mt-3 rounded-lg border border-line p-3">
                <p className="text-[15px] font-semibold">{p.name}</p>
                <p className="mt-1 text-[13px] text-muted">MRN <Mono className="text-navy-900">{p.mrn}</Mono> · born {fmtDate(p.birth_date)} · {p.city}</p>
              </div>
            ))}
          </Box>
        ))}
      </div>
      <Explain>Notice the record numbers: <Mono>MC-…</Mono> at MetroCare and <Mono>SG-…</Mono> at Sunrise. Names are written slightly differently, too. This is why connecting records across organizations needs care.</Explain>
    </div>
  )
}

/* 5 + 6 */
function useMatches(ctx: Ctx) {
  return useQuery({ queryKey: ['demo-matches'], queryFn: () => api<{ items: MatchCandidate[] }>(`/patients/matches?q=${ctx.scenario!.patient_search}`) })
}

function S5({ ctx }: { ctx: Ctx }) {
  const q = useMatches(ctx)
  useCompleteWhen(!!q.data, ctx)
  return (
    <div className="space-y-5">
      {q.isLoading && <p className="text-muted">Comparing records…</p>}
      {q.error && <ErrorState error={q.error} compact />}
      <div className="grid gap-5 xl:grid-cols-2">{q.data?.items.slice(0, 2).map((c) => <MatchCard key={c.b.patient_id} c={c} canReview={false} />)}</div>
      <Explain>The top suggestion matches on name, date of birth, sex and phone. The second candidate shares a family name but has a different birth date and phone — Privexa scores it low and does not treat it as the same person.</Explain>
    </div>
  )
}

function S6({ ctx }: { ctx: Ctx }) {
  const q = useMatches(ctx)
  const qc = useQueryClient()
  const top = q.data?.items[0]
  // A reviewer may already have confirmed this match (the demo environment is shared); reuse that link.
  const existing = useQuery({
    queryKey: ['patient-links'],
    queryFn: () => api<PatientLink[]>('/patient-links'),
    enabled: top?.link_status === 'confirmed' && !ctx.link,
  })
  const { setLink, complete } = ctx
  useEffect(() => {
    const l = existing.data?.find((x) => x.id === top?.link_id)
    if (l && !ctx.link) {
      setLink(l)
      complete()
    }
  }, [existing.data, top?.link_id]) // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation({
    mutationFn: (c: MatchCandidate) => post<PatientLink>('/patient-links', { members: [{ organization_id: c.a.organization_id, patient_id: c.a.patient_id, mrn: c.a.mrn }, { organization_id: c.b.organization_id, patient_id: c.b.patient_id, mrn: c.b.mrn }], decision: 'confirm', score: c.score, label: `${c.a.name} (synthetic)` }),
    onSuccess: (l) => { ctx.setLink(l); ctx.complete(); qc.invalidateQueries({ queryKey: ['demo-matches'] }) },
  })
  return (
    <div className="space-y-5">
      {top && <MatchCard c={top} onDecide={(d) => d === 'confirm' && m.mutate(top)} busy={m.isPending} />}
      {m.error && <ErrorState error={m.error} compact />}
      {ctx.link && <Explain>Confirmed by the demo reviewer{top?.link_status === 'confirmed' && !m.data ? ' (earlier in this shared demo)' : ''} and recorded in the audit trail. The two hospital records are now linked by reference only — the records themselves stay at each hospital.</Explain>}
    </div>
  )
}

/* 7 + 8 */
function cardio(ctx: Ctx) {
  return ctx.scenario!.applications.find((a) => a.name === 'Cardio Insights') ?? ctx.scenario!.applications[0]
}
const DEMO_TYPES = ['Observation', 'Encounter', 'Condition', 'MedicationRequest']

function S7({ ctx }: { ctx: Ctx }) {
  const app = cardio(ctx)
  useCompleteWhen(true, ctx)
  return (
    <div className="space-y-5">
      <Box className="max-w-2xl">
        <p className="font-mono text-[11px] text-navy-400">DATA REQUEST</p>
        <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2.5 text-[14px]">
          <dt className="text-muted">Application</dt><dd className="font-medium">{app.name} <span className="font-normal text-muted">(fictional vendor app)</span></dd>
          <dt className="text-muted">Patient</dt><dd>{ctx.link ? ctx.link.label : <span className="text-warning">Confirm the match in step 6 first</span>}</dd>
          <dt className="text-muted">Hospitals</dt><dd>Both (via the confirmed link)</dd>
          <dt className="text-muted">Asking for</dt><dd className="font-mono text-[13px]">{DEMO_TYPES.join(', ')}</dd>
          <dt className="text-muted">Purpose</dt><dd>Care coordination</dd>
        </dl>
      </Box>
      <Explain>The application asks Privexa — not the hospitals. In production it authenticates with its own credentials; here the demo administrator sends it on the application's behalf.</Explain>
    </div>
  )
}

function S8({ ctx }: { ctx: Ctx }) {
  const app = cardio(ctx)
  const m = useMutation({
    mutationFn: () => apiRaw<DataRequestResult>('/data-requests', { method: 'POST', json: { application_id: app.id, patient: { link_id: ctx.link!.id }, resource_types: DEMO_TYPES, purpose: 'care_coordination' } }),
    onSuccess: (r) => { ctx.setResult(r.data); ctx.complete() },
  })
  if (!ctx.link) return <NeedEarlier what="A person confirms the match" />
  const r = ctx.result
  return (
    <div className="space-y-5">
      <Button size="lg" onClick={() => m.mutate()} loading={m.isPending}><Lock className="size-4" /> Send the request through Privexa</Button>
      {m.error && <ErrorState error={m.error} compact />}
      {r && (
        <div className="grid gap-4 md:grid-cols-2">
          {r.decisions.map((d) => (
            <div key={d.organization_id} className="space-y-3">
              <DecisionCard d={d} />
              <div className="rounded-lg border border-line bg-white p-3">
                {d.policy_results.map((p) => (
                  <p key={p.policy} className="flex justify-between text-[12.5px]"><span className="text-navy-700">{p.policy} v{p.version}</span><span className={p.matched ? 'text-danger' : 'text-success'}>{p.matched ? 'blocked' : 'passed'}</span></p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Explain>Each hospital's decision is made independently, using that hospital's approval for this application and that hospital's policies.</Explain>
    </div>
  )
}

function S9({ ctx }: { ctx: Ctx }) {
  useCompleteWhen(true, ctx)
  return (
    <div className="space-y-5">
      <DataRequestResultView r={ctx.result!} />
      <Explain>Sunrise General Hospital approved this application for observations, encounters and conditions — but not medications. Privexa never asked Sunrise for medication data. Responses were also checked against the FHIR standard before being used.</Explain>
    </div>
  )
}

function S10({ ctx }: { ctx: Ctx }) {
  useCompleteWhen(true, ctx)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-[13px]">
        {ctx.scenario!.organizations.map((o) => <span key={o.id} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: ORG_COLORS[o.slug] }} /> {o.name}</span>)}
      </div>
      <Box><Timeline items={ctx.result!.timeline} /></Box>
      <Explain>Different systems, one consistent view. Every entry keeps its source hospital and original record reference.</Explain>
    </div>
  )
}

function S11({ ctx }: { ctx: Ctx }) {
  useCompleteWhen(true, ctx)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">{ctx.result!.decisions.map((d) => <AuditSummary key={d.audit_event_id} id={d.audit_event_id} />)}</div>
      <Explain>The request ID <Mono>{ctx.result!.request_id}</Mono> ties the audit events to every connector call made for this request. Audit events contain who, what, why and the decision — not clinical content.</Explain>
    </div>
  )
}

function AuditSummary({ id }: { id: string }) {
  const { data } = useAuditEvent(id)
  if (!data) return <Box><p className="text-muted">Loading…</p></Box>
  return (
    <Box>
      <div className="flex items-center justify-between"><p className="text-[15px] font-semibold">{data.organization_name}</p><StatusBadge status={data.outcome} /></div>
      <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
        <dt className="text-muted">Event</dt><dd><Mono>{data.id.slice(0, 8)}…</Mono></dd>
        <dt className="text-muted">Request</dt><dd><Mono>{data.request_id}</Mono></dd>
        <dt className="text-muted">Application</dt><dd>{data.application_name}</dd>
        <dt className="text-muted">Resources</dt><dd className="font-mono text-[12px]">{data.resource_types.join(', ')}</dd>
        <dt className="text-muted">Reason</dt><dd>{data.reason}</dd>
      </dl>
    </Box>
  )
}

function S12({ ctx }: { ctx: Ctx }) {
  const first = ctx.result!.decisions[0].audit_event_id
  const { data } = useAuditEvent(first)
  useCompleteWhen(data?.anchor_status === 'anchored', ctx)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">{ctx.result!.decisions.map((d) => <div key={d.audit_event_id}><p className="mb-2 text-[13px] font-medium text-navy-700">{d.organization_name}</p><AnchorForEvent id={d.audit_event_id} /></div>)}</div>
      <Explain>The status above reflects the real transaction on the local chain: "pending" until the receipt arrives, then "anchored" with its block number — or "failed" if the chain is unavailable. It is never shown as verified unless it has been verified.</Explain>
    </div>
  )
}

function S13({ ctx }: { ctx: Ctx }) {
  useCompleteWhen(true, ctx)
  return (
    <div className="space-y-5">
      <div className="max-w-2xl"><AnchorForEvent id={ctx.result!.decisions[0].audit_event_id} /></div>
      <Explain>Click <strong>Verify integrity</strong>. Then click <strong>Simulate tampering</strong> — this edits the stored audit record as an attacker might — and verify again. The recomputed fingerprint no longer matches the chain. Restore it afterwards.</Explain>
    </div>
  )
}

function S14({ ctx }: { ctx: Ctx }) {
  const app = ctx.scenario!.applications.find((a) => a.name === 'Trial Finder')
  const m = useMutation({
    mutationFn: () => apiRaw<DataRequestResult>('/data-requests', { method: 'POST', json: { application_id: app!.id, patient: ctx.link ? { link_id: ctx.link.id } : { organization_id: ctx.scenario!.organizations[0].id, patient_id: 'unknown' }, resource_types: ['Condition', 'Observation'], purpose: 'research' } }),
    onSuccess: () => ctx.complete(),
  })
  if (!app) return <Box><p className="text-muted">Demo application not found.</p></Box>
  return (
    <div className="space-y-5">
      <Box className="max-w-2xl">
        <p className="text-[15px] font-semibold">Trial Finder <span className="font-normal text-muted">— Bluebird Research (fictional)</span></p>
        <p className="mt-1 text-[13.5px] text-muted">Registered, but its access request is still awaiting provider review. It asks for conditions and observations for research.</p>
        <Button className="mt-4" variant="danger" onClick={() => m.mutate()} loading={m.isPending}><ShieldAlert className="size-4" /> Send the request</Button>
      </Box>
      {m.error && <ErrorState error={m.error} compact />}
      {m.data && (
        <>
          <DataRequestResultView r={m.data.data} />
          <Explain>Denied at both hospitals, with nothing retrieved. The denial is recorded and anchored just like an allowed request — so refused attempts are visible too.</Explain>
        </>
      )}
    </div>
  )
}

function S15({ ctx }: { ctx: Ctx }) {
  const qc = useQueryClient()
  const sunrise = ctx.scenario!.organizations.find((o) => o.slug === 'sunrise')!
  const [phase, setPhase] = useState<'idle' | 'failing' | 'failed' | 'recovered'>('idle')
  const [fail, setFail] = useState<TestResult | null>(null)
  const [ok, setOk] = useState<TestResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function breakIt() {
    setErr(null)
    setPhase('failing')
    try {
      await post(`/organizations/${sunrise.id}/simulate`, { mode: 'timeout' })
      setFail(await post<TestResult>(`/organizations/${sunrise.id}/test-connection`))
      setPhase('failed')
    } catch (e) {
      setErr(errorMessage(e))
      setPhase('idle')
    }
  }
  async function recover() {
    setErr(null)
    try {
      await post(`/organizations/${sunrise.id}/simulate`, { mode: 'none' })
      setOk(await post<TestResult>(`/organizations/${sunrise.id}/test-connection`))
      setPhase('recovered')
      qc.invalidateQueries({ queryKey: ['organizations'] })
      ctx.complete()
    } catch (e) {
      setErr(errorMessage(e))
    }
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Box>
          <p className="text-[15px] font-semibold">1 · Simulate an outage</p>
          <p className="mt-1 text-[13.5px] text-muted">Sunrise General Hospital stops responding.</p>
          <Button className="mt-4" variant="danger" onClick={breakIt} loading={phase === 'failing'} disabled={phase === 'failed'}><Zap className="size-4" /> Make Sunrise time out</Button>
          {fail && (
            <div className="mt-4 rounded-lg bg-[#fef3f2] p-3 text-[13px]">
              <p className="font-medium text-danger">{fail.error?.message}</p>
              <p className="mt-1 text-navy-600">Privexa retried, then reported the failure. Status: <StatusBadge status={fail.status} /></p>
              <p className="mt-1 font-mono text-[11.5px] text-navy-500">{fail.request_id}</p>
            </div>
          )}
        </Box>
        <Box>
          <p className="text-[15px] font-semibold">2 · Recover</p>
          <p className="mt-1 text-[13.5px] text-muted">The hospital comes back online.</p>
          <Button className="mt-4" onClick={recover} disabled={phase !== 'failed'}><RotateCcw className="size-4" /> Restore and retest</Button>
          {ok && (
            <div className="mt-4 rounded-lg bg-[#ecfdf3] p-3 text-[13px]">
              <p className="font-medium text-success">Connection restored</p>
              <p className="mt-1 text-navy-600">Status: <StatusBadge status={ok.status} /> · {ok.capabilities?.latency_ms} ms</p>
            </div>
          )}
        </Box>
      </div>
      {err && <p className="text-[13px] text-danger">{err}</p>}
      <Explain>Every attempt, retry and error is recorded in Integration Health — without exposing credentials, endpoints or clinical content. Explore it in the <Link to="/app/provider/health" className="font-medium text-teal-700 underline-offset-2 hover:underline">provider workspace</Link>.</Explain>
      {phase === 'recovered' && (
        <div className="card flex flex-col items-start justify-between gap-4 bg-navy-950 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[18px] font-semibold text-white">You've seen the full flow.</p>
            <p className="mt-1 text-[14px] text-navy-300">Connect → authorize → exchange → verify, across two independent systems.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/app/provider" className="rounded-lg border border-navy-700 px-4 py-2 text-[14px] font-medium text-white hover:bg-navy-800">Provider workspace</Link>
            <Link to="/contact" className="rounded-lg bg-teal-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-teal-700">Talk to Privexa</Link>
          </div>
        </div>
      )}
    </div>
  )
}
