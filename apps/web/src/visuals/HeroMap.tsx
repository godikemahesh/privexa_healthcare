import { motion, useReducedMotion } from 'framer-motion'
import { Activity, Brain, Building2, Check, Clock, FlaskConical, Hospital, ScanLine, ShieldCheck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PrivexaMark } from '../brand/Logo'
import { Stage } from './Stage'

const W = 640
const H = 540
const CORE = { x: 320, y: 250, r: 50 }

const sources: { y: number; icon: LucideIcon; title: string; sub: string }[] = [
  { y: 82, icon: Hospital, title: 'Hospital EHR', sub: 'Encounters · Conditions' },
  { y: 190, icon: Building2, title: 'Hospital HMS', sub: 'Patients · Medications' },
  { y: 298, icon: FlaskConical, title: 'Lab system', sub: 'Lab results' },
  { y: 406, icon: ScanLine, title: 'Imaging', sub: 'Imaging reports' },
]

const apps: { y: number; icon: LucideIcon; title: string; scope: string; state: 'allowed' | 'pending' }[] = [
  { y: 120, icon: Brain, title: 'Clinical AI', scope: 'Observations · read', state: 'allowed' },
  { y: 250, icon: Users, title: 'Care coordination', scope: 'Encounters · read', state: 'allowed' },
  { y: 380, icon: Activity, title: 'Research analytics', scope: 'Requested access', state: 'pending' },
]

const SRC_X = 182
const APP_X = 458
const GATE_X = 408

const inPath = (y: number) => `M${SRC_X} ${y} C ${SRC_X + 70} ${y}, ${CORE.x - CORE.r - 70} ${CORE.y}, ${CORE.x - CORE.r} ${CORE.y}`
const outPath = (y: number) => `M${CORE.x + CORE.r} ${CORE.y} C ${CORE.x + CORE.r + 50} ${CORE.y}, ${APP_X - 60} ${y}, ${APP_X} ${y}`
const routes = [
  { d: `${inPath(sources[0].y)} L ${CORE.x + CORE.r} ${CORE.y} ${outPath(apps[0].y).replace(/^M[^C]+/, '')}`, dur: 4.2, delay: 0 },
  { d: `${inPath(sources[2].y)} L ${CORE.x + CORE.r} ${CORE.y} ${outPath(apps[1].y).replace(/^M[^C]+/, '')}`, dur: 4.2, delay: 1.4 },
  { d: `${inPath(sources[1].y)} L ${CORE.x + CORE.r} ${CORE.y} ${outPath(apps[0].y).replace(/^M[^C]+/, '')}`, dur: 4.2, delay: 2.8 },
  { d: `${inPath(sources[3].y)} L ${CORE.x + CORE.r} ${CORE.y} ${outPath(apps[1].y).replace(/^M[^C]+/, '')}`, dur: 4.2, delay: 3.6 },
]

/** y on the outgoing cubic at the gate's x, approximated by sampling. */
function gateY(y: number) {
  const p0 = { x: CORE.x + CORE.r, y: CORE.y }
  const p1 = { x: CORE.x + CORE.r + 50, y: CORE.y }
  const p2 = { x: APP_X - 60, y }
  const p3 = { x: APP_X, y }
  let best = p0
  for (let t = 0; t <= 1; t += 0.005) {
    const u = 1 - t
    const pt = {
      x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x,
      y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y,
    }
    if (Math.abs(pt.x - GATE_X) < Math.abs(best.x - GATE_X)) best = pt
  }
  return best.y
}

function NodeCard({ x, y, w, children }: { x: number; y: number; w: number; children: React.ReactNode }) {
  return (
    <div className="absolute flex -translate-y-1/2 items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 shadow-[var(--shadow-lift)]" style={{ left: x, top: y, width: w }}>
      {children}
    </div>
  )
}

export function HeroMap() {
  const reduce = useReducedMotion()

  return (
    <Stage width={W} height={H} className="w-full">
      <svg width={W} height={H} className="absolute inset-0" aria-hidden>
        <defs>
          <radialGradient id="coreGlow">
            <stop offset="0%" stopColor="var(--teal-200)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--teal-200)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* column labels */}
        <text x={14} y={22} className="fill-navy-400 font-mono text-[10.5px] tracking-[0.14em]">EXISTING SYSTEMS</text>
        <text x={CORE.x} y={22} textAnchor="middle" className="fill-teal-700 font-mono text-[10.5px] tracking-[0.14em]">PRIVEXA</text>
        <text x={W - 14} y={22} textAnchor="end" className="fill-navy-400 font-mono text-[10.5px] tracking-[0.14em]">AUTHORIZED APPS</text>

        <circle cx={CORE.x} cy={CORE.y} r={130} fill="url(#coreGlow)" />

        {sources.map((s, i) => (
          <motion.path
            key={s.title}
            d={inPath(s.y)}
            fill="none"
            stroke="var(--teal-600)"
            strokeOpacity={0.35}
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
          />
        ))}
        {apps.map((a, i) => (
          <motion.path
            key={a.title}
            d={outPath(a.y)}
            fill="none"
            stroke={a.state === 'allowed' ? 'var(--teal-600)' : 'var(--navy-200)'}
            strokeOpacity={a.state === 'allowed' ? 0.35 : 1}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={a.state === 'pending' ? '2 7' : undefined}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.9 + i * 0.1, ease: 'easeOut' }}
          />
        ))}

        {/* audit link from core down to ledger */}
        <line x1={CORE.x} y1={CORE.y + CORE.r} x2={CORE.x} y2={418} stroke="var(--navy-200)" strokeWidth={1.5} className={reduce ? '' : 'flow-dash'} />

        {/* moving data pulses */}
        {!reduce &&
          routes.map((r, i) => (
            <circle key={i} r={4.5} fill="var(--teal-600)" stroke="white" strokeWidth={2} opacity={0}>
              <set attributeName="opacity" to="1" begin={`${r.delay}s`} />
              <animateMotion dur={`${r.dur}s`} begin={`${r.delay}s`} repeatCount="indefinite" path={r.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            </circle>
          ))}
        {!reduce && (
          <circle r={4.5} fill="var(--navy-300)" stroke="white" strokeWidth={2} opacity={0}>
            <set attributeName="opacity" to="1" begin="1s" />
            <animateMotion dur="3s" begin="1s" repeatCount="indefinite" path={`${inPath(sources[2].y)} L ${CORE.x + CORE.r} ${CORE.y} ${outPath(apps[2].y).replace(/^M[^C]+/, '')}`} keyPoints="0;0.78;0.78" keyTimes="0;0.7;1" calcMode="linear" />
          </circle>
        )}
      </svg>

      {/* policy gates on outgoing ribbons */}
      {apps.map((a) => (
        <div
          key={a.title}
          className={`absolute flex size-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-sm ${a.state === 'allowed' ? 'bg-teal-600 text-white' : 'bg-[#fef0c7] text-warning'}`}
          style={{ left: GATE_X, top: gateY(a.y) }}
          title={a.state === 'allowed' ? 'Policy check passed' : 'Awaiting provider approval'}
        >
          {a.state === 'allowed' ? <Check className="size-3" strokeWidth={3} /> : <Clock className="size-3" strokeWidth={2.5} />}
        </div>
      ))}

      {sources.map((s, i) => (
        <motion.div key={s.title} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
          <NodeCard x={0} y={s.y} w={SRC_X}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
              <s.icon className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-navy-900">{s.title}</span>
              <span className="block truncate text-[11px] text-muted">{s.sub}</span>
            </span>
          </NodeCard>
        </motion.div>
      ))}

      {/* core */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: CORE.x, top: CORE.y }}>
        {!reduce && (
          <motion.div
            className="absolute inset-[-14px] rounded-full border border-dashed border-teal-300"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <div className="flex size-[100px] items-center justify-center rounded-full border border-teal-100 bg-white shadow-[0_18px_40px_-14px_rgb(8_141_129/0.45)]">
          <PrivexaMark size={52} />
        </div>
        <div className="absolute left-1/2 top-full mt-5 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-navy-600 shadow-sm">
          Connect · Authorize · Verify
        </div>
      </div>

      {apps.map((a, i) => (
        <motion.div key={a.title} initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.08 }}>
          <NodeCard x={APP_X} y={a.y} w={W - APP_X}>
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${a.state === 'allowed' ? 'bg-teal-50 text-teal-700' : 'bg-navy-50 text-navy-400'}`}>
              <a.icon className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-navy-900">{a.title}</span>
              <span className={`block truncate text-[11px] ${a.state === 'allowed' ? 'text-teal-700' : 'text-warning'}`}>
                {a.state === 'allowed' ? a.scope : 'Pending approval'}
              </span>
            </span>
          </NodeCard>
        </motion.div>
      ))}

      {/* audit ledger */}
      <motion.div
        className="absolute left-1/2 w-[300px] -translate-x-1/2 rounded-xl border border-line bg-white p-3 shadow-[var(--shadow-lift)]"
        style={{ top: 418 }}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3 }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-navy-900">
            <ShieldCheck className="size-3.5 text-teal-600" /> Access recorded
          </span>
          <span className="rounded-full bg-teal-50 px-1.5 py-px text-[10px] font-medium text-teal-800">Anchored</span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((b) => (
            <motion.span
              key={b}
              className="h-5 flex-1 rounded-[4px] border border-teal-200 bg-teal-50"
              initial={reduce ? false : { opacity: 0.3 }}
              animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 3, delay: b * 0.5, repeat: Infinity }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-navy-400">fingerprint 0x7a3f…c9e2 · integrity verified</p>
      </motion.div>
    </Stage>
  )
}
