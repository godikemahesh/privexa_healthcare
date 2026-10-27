import { Check, Minus, X } from 'lucide-react'
import clsx from 'clsx'
import type { MatchCandidate, PatientRecord } from '../../lib/types'
import { Badge, Button } from '../ui'
import { fmtDate } from './kit'

function Record({ r }: { r: PatientRecord }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-bg/60 p-3">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-navy-400">{r.organization_name}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-navy-900">{r.name}</p>
      <dl className="mt-2 grid grid-cols-[64px_1fr] gap-y-0.5 text-[12.5px]">
        <dt className="text-muted">MRN</dt>
        <dd className="font-mono text-navy-700">{r.mrn ?? '—'}</dd>
        <dt className="text-muted">Born</dt>
        <dd className="text-navy-700">{fmtDate(r.birth_date)}</dd>
        <dt className="text-muted">Sex</dt>
        <dd className="capitalize text-navy-700">{r.gender ?? '—'}</dd>
        <dt className="text-muted">Phone</dt>
        <dd className="text-navy-700">{r.phone ?? '—'}</dd>
        <dt className="text-muted">City</dt>
        <dd className="text-navy-700">{r.city ?? '—'}</dd>
      </dl>
    </div>
  )
}

const icon = { match: Check, partial: Minus, mismatch: X, missing: Minus }
const tone = { match: 'text-success bg-[#ecfdf3]', partial: 'text-warning bg-[#fffaeb]', mismatch: 'text-danger bg-[#fef3f2]', missing: 'text-navy-400 bg-navy-50' }

export function MatchCard({ c, onDecide, busy, canReview = true }: { c: MatchCandidate; onDecide?: (d: 'confirm' | 'reject') => void; busy?: boolean; canReview?: boolean }) {
  const pct = Math.round(c.score * 100)
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative size-12">
            <svg viewBox="0 0 36 36" className="size-12 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={c.confidence === 'high' ? 'var(--teal-600)' : c.confidence === 'medium' ? '#dc6803' : 'var(--navy-300)'} strokeWidth="3" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-navy-900">{pct}</span>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-navy-900">Potential match</p>
            <p className="text-[12.5px] text-muted">Match score {pct}/100</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={c.confidence === 'high' ? 'teal' : c.confidence === 'medium' ? 'warning' : 'neutral'}>{c.confidence} confidence</Badge>
          {c.link_status && <Badge tone={c.link_status === 'confirmed' ? 'success' : 'danger'} dot>{c.link_status === 'confirmed' ? 'Confirmed by reviewer' : 'Rejected by reviewer'}</Badge>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Record r={c.a} />
        <Record r={c.b} />
      </div>
      <div className="mt-4">
        <p className="mb-2 text-[13px] font-medium text-navy-700">Why Privexa suggests this</p>
        <ul className="grid gap-1.5">
          {c.explanation.map((e) => {
            const I = icon[e.result]
            return (
              <li key={e.field} className="flex items-center gap-2 text-[13px]">
                <span className={clsx('flex size-5 shrink-0 items-center justify-center rounded-full', tone[e.result])}>
                  <I className="size-3" strokeWidth={3} />
                </span>
                <span className="text-navy-800">{e.field}</span>
                <span className="min-w-0 text-muted">— {e.note}</span>
                {e.weight > 0 && <span className="ml-auto font-mono text-[11px] text-navy-400">+{Math.round(e.weight * 100)}</span>}
              </li>
            )
          })}
        </ul>
      </div>
      {onDecide && canReview && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button onClick={() => onDecide('confirm')} loading={busy} disabled={c.link_status === 'confirmed'}>
            <Check className="size-4" /> {c.link_status === 'confirmed' ? 'Confirmed' : 'Confirm match'}
          </Button>
          <Button variant="secondary" onClick={() => onDecide('reject')} disabled={busy || c.link_status === 'rejected'}>
            <X className="size-4" /> Not the same person
          </Button>
        </div>
      )}
    </article>
  )
}
