import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, X, ShieldCheck, Building2, Hospital } from 'lucide-react'
import clsx from 'clsx'

/* ---------- Trust: an access request moving through checks ---------- */

const checks = [
  { label: 'Application identity verified', detail: 'Registered client · active' },
  { label: 'Scope matches request', detail: 'Observation.read granted' },
  { label: 'Purpose permitted by policy', detail: 'Care coordination · policy v3' },
  { label: 'Provider approval in place', detail: 'Approved for this organization' },
]

export function TrustVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? checks.length + 1 : 0)

  useEffect(() => {
    if (!inView || reduce) return
    setN(0)
    const t = setInterval(() => setN((v) => (v > checks.length + 3 ? 0 : v + 1)), 700)
    return () => clearInterval(t)
  }, [inView, reduce])

  return (
    <div ref={ref} className="card p-5">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-navy-50/60 p-3">
        <div>
          <p className="font-mono text-[11px] text-navy-400">INCOMING REQUEST</p>
          <p className="mt-1 text-[14px] font-medium text-navy-900">Cardio Insights → Observation</p>
          <p className="text-[12.5px] text-muted">MetroCare Medical Center · purpose: care coordination</p>
        </div>
        <span className="rounded-md bg-white px-2 py-1 font-mono text-[11px] text-navy-500 shadow-sm">GET</span>
      </div>
      <ul className="mt-4 space-y-2">
        {checks.map((c, i) => {
          const done = n > i
          return (
            <li key={c.label} className={clsx('flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-300', done ? 'border-teal-100 bg-teal-50/50' : 'border-line')}>
              <span className={clsx('flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300', done ? 'bg-teal-600 text-white' : 'bg-navy-50 text-navy-300')}>
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-navy-900">{c.label}</span>
                <span className="block text-[12px] text-muted">{c.detail}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <motion.div
        animate={{ opacity: n > checks.length ? 1 : 0.25, y: n > checks.length ? 0 : 4 }}
        className="mt-4 flex items-center justify-between rounded-lg bg-navy-900 px-4 py-3 text-white"
      >
        <span className="flex items-center gap-2 text-[14px] font-medium">
          <ShieldCheck className="size-4 text-teal-300" /> Decision: allowed
        </span>
        <span className="font-mono text-[11px] text-navy-300">recorded to audit trail</span>
      </motion.div>
    </div>
  )
}

/* ---------- Connect: different source formats -> one normalized timeline ---------- */

const sourcesFmt = [
  { org: 'Hospital A', icon: Hospital, lines: ['"resourceType": "Observation"', '"code": "8867-4"', '"value": 72 /min'] },
  { org: 'Hospital B', icon: Building2, lines: ['"resourceType": "Encounter"', '"class": "AMB"', '"period.start": "2026-09-14"'] },
]
const timeline = [
  { date: '14 Sep 2026', title: 'Outpatient visit', src: 'Hospital B', kind: 'Encounter' },
  { date: '02 Oct 2026', title: 'Heart rate · 72 /min', src: 'Hospital A', kind: 'Observation' },
  { date: '02 Oct 2026', title: 'Metformin 500 mg', src: 'Hospital A', kind: 'Medication' },
]

export function ConnectVisual() {
  return (
    <div className="card grid gap-4 p-5 md:grid-cols-[1fr_auto_1.15fr] md:items-center">
      <div className="space-y-3">
        {sourcesFmt.map((s) => (
          <div key={s.org} className="rounded-lg border border-line bg-navy-50/50 p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-navy-800">
              <s.icon className="size-3.5 text-navy-400" /> {s.org}
              <span className="ml-auto font-mono text-[10px] text-navy-400">SIMULATED</span>
            </p>
            <div className="mt-2 space-y-0.5 font-mono text-[11px] text-navy-500">
              {s.lines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center md:flex-col" aria-hidden>
        <svg width="48" height="48" viewBox="0 0 48 48" className="rotate-90 md:rotate-0">
          <path d="M6 24 H38 M30 16 L38 24 L30 32" stroke="var(--teal-600)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="flow-dash" />
        </svg>
      </div>
      <div className="rounded-lg border border-teal-100 bg-white p-3">
        <p className="font-mono text-[11px] text-teal-700">NORMALIZED TIMELINE</p>
        <ol className="mt-3 space-y-3 border-l border-teal-200 pl-4">
          {timeline.map((t) => (
            <li key={t.title} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-teal-600" />
              <p className="text-[11.5px] text-muted">{t.date}</p>
              <p className="text-[13.5px] font-medium text-navy-900">{t.title}</p>
              <p className="mt-0.5 flex gap-1.5 text-[11px]">
                <span className="rounded bg-navy-50 px-1.5 text-navy-600">{t.kind}</span>
                <span className="rounded bg-teal-50 px-1.5 text-teal-800">Source: {t.src}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/* ---------- Studio: code + response ---------- */

export function StudioVisual() {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-800 bg-navy-950 shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-2 border-b border-navy-800 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-navy-700" />
        <span className="size-2.5 rounded-full bg-navy-700" />
        <span className="size-2.5 rounded-full bg-navy-700" />
        <span className="ml-3 font-mono text-[11.5px] text-navy-300">sandbox_request.py</span>
        <span className="ml-auto rounded bg-navy-800 px-1.5 py-px font-mono text-[10px] text-navy-300">SANDBOX</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12px] leading-[1.7] text-navy-200">
        <span className="text-[#7cd4c9]">import</span> httpx{'\n\n'}
        r = httpx.post({'\n'}
        {'    '}<span className="text-[#f6c87a]">"/api/v1/data-requests"</span>,{'\n'}
        {'    '}headers=CLIENT_HEADERS,{'\n'}
        {'    '}json={'{'}<span className="text-[#f6c87a]">"patient"</span>: {'{'}<span className="text-[#f6c87a]">"link_id"</span>: LINK_ID{'}'},{'\n'}
        {'          '}<span className="text-[#f6c87a]">"resource_types"</span>: [<span className="text-[#f6c87a]">"Observation"</span>],{'\n'}
        {'          '}<span className="text-[#f6c87a]">"purpose"</span>: <span className="text-[#f6c87a]">"care_coordination"</span>{'}'},{'\n'}
        ){'\n'}
      </pre>
      <div className="border-t border-navy-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
          <span className="rounded bg-[#064e3b] px-1.5 py-px text-[#6ee7b7]">200 OK</span>
          <span className="text-navy-400">req_8f2c41 · 184 ms</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[#6ee7b7]">
            <Check className="size-3" /> schema valid
          </span>
        </div>
        <pre className="mt-2 font-mono text-[11.5px] leading-[1.6] text-navy-300">{`{ "decision": "allow", "returned": 12,
  "audit_event": "evt_1042", "anchor": "pending" }`}</pre>
      </div>
    </div>
  )
}

/* ---------- Small denied example used on the security page ---------- */
export function DeniedRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#fee4e2] bg-[#fef3f2] px-3 py-2.5">
      <span className="flex size-6 items-center justify-center rounded-full bg-danger text-white">
        <X className="size-3.5" strokeWidth={3} />
      </span>
      <span className="text-[13px] text-navy-800">
        <span className="font-medium">Denied</span> — MedicationRequest is outside the application's approved scope
      </span>
    </div>
  )
}
