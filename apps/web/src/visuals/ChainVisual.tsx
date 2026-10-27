import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Fingerprint, Boxes, ShieldCheck, ShieldAlert, RotateCcw } from 'lucide-react'
import clsx from 'clsx'

/** Approved audit metadata only — no names, identifiers or clinical content. */
const original = {
  event: 'data_access',
  application: 'app_cardio_insights',
  organization: 'org_metrocare',
  resources: ['Observation', 'Encounter'],
  decision: 'allow',
  policy_version: 3,
  at: '2026-10-27T09:41:12Z',
}

function canonical(o: Record<string, unknown>) {
  return JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])))
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return '0x' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const short = (h: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '…')

export function ChainVisual({ dark }: { dark?: boolean }) {
  const [tampered, setTampered] = useState(false)
  const [anchored, setAnchored] = useState('')
  const [current, setCurrent] = useState('')
  const record = useMemo(() => (tampered ? { ...original, decision: 'deny' as const } : original), [tampered])

  useEffect(() => {
    sha256(canonical(original)).then(setAnchored)
  }, [])
  useEffect(() => {
    sha256(canonical(record)).then(setCurrent)
  }, [record])

  const ok = anchored && current === anchored
  const panel = dark ? 'border-navy-700 bg-navy-900' : 'border-line bg-white'
  const sub = dark ? 'text-navy-300' : 'text-muted'
  const head = dark ? 'text-white' : 'text-navy-900'

  const Step = ({ n, icon: Icon, title, children }: { n: number; icon: typeof FileText; title: string; children: React.ReactNode }) => (
    <div className={clsx('rounded-xl border p-4', panel)}>
      <div className="flex items-center gap-2">
        <span className={clsx('flex size-7 items-center justify-center rounded-md', dark ? 'bg-navy-800 text-teal-300' : 'bg-teal-50 text-teal-700')}>
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <span className={clsx('font-mono text-[11px]', sub)}>0{n}</span>
        <span className={clsx('text-[14px] font-medium', head)}>{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Step n={1} icon={FileText} title="Audit event">
          <dl className={clsx('space-y-1 font-mono text-[11.5px]', sub)}>
            {Object.entries(record).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt>{k}</dt>
                <dd className={clsx('truncate text-right', k === 'decision' && tampered ? 'font-semibold text-[#f97066]' : head)}>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
              </div>
            ))}
          </dl>
        </Step>
        <Step n={2} icon={Fingerprint} title="Fingerprint">
          <p className={clsx('text-[12.5px]', sub)}>Approved metadata is serialized consistently and hashed with SHA-256.</p>
          <AnimatePresence mode="wait">
            <motion.p key={current} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={clsx('mt-3 break-all rounded-md px-2 py-1.5 font-mono text-[11px]', dark ? 'bg-navy-950 text-teal-200' : 'bg-navy-50 text-navy-700')}>
              {current || '…'}
            </motion.p>
          </AnimatePresence>
        </Step>
        <Step n={3} icon={Boxes} title="Anchored on chain">
          <p className={clsx('text-[12.5px]', sub)}>Only the fingerprint is written to the ledger. No patient data ever goes on-chain.</p>
          <div className="mt-3 flex items-center gap-1.5" aria-hidden>
            {[1039, 1040, 1041, 1042].map((b) => (
              <div key={b} className={clsx('flex-1 rounded-md border px-1.5 py-1.5 text-center font-mono text-[10px]', b === 1042 ? (dark ? 'border-teal-500 bg-teal-950 text-teal-200' : 'border-teal-300 bg-teal-50 text-teal-800') : dark ? 'border-navy-700 text-navy-400' : 'border-line text-navy-400')}>
                #{b}
              </div>
            ))}
          </div>
          <p className={clsx('mt-2 font-mono text-[11px]', sub)}>stored {short(anchored)}</p>
        </Step>
        <Step n={4} icon={ok ? ShieldCheck : ShieldAlert} title="Verify integrity">
          <p className={clsx('text-[12.5px]', sub)}>Recompute the fingerprint from the stored record and compare it with the ledger.</p>
          <motion.div
            key={String(ok)}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={clsx('mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold', ok ? 'bg-[#ecfdf3] text-success' : 'bg-[#fef3f2] text-danger')}
          >
            {ok ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
            {ok ? 'Verified — record unchanged' : 'Mismatch — record was altered'}
          </motion.div>
        </Step>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setTampered((t) => !t)}
          className={clsx(
            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition',
            dark ? 'border-navy-700 text-navy-100 hover:bg-navy-800' : 'border-line bg-white text-navy-800 hover:bg-navy-50',
          )}
        >
          {tampered ? <RotateCcw className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
          {tampered ? 'Restore original record' : 'Try altering the record'}
        </button>
        <p className={clsx('text-[12.5px]', sub)}>This explainer computes real SHA-256 hashes in your browser.</p>
      </div>
    </div>
  )
}
