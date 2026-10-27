import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'
import { PrivexaMark } from '../brand/Logo'
import { Stage } from './Stage'

const W = 560
const H = 380
const systems = ['EHR', 'HMS', 'Lab', 'Imaging', 'Pharmacy']
const apps = ['AI triage', 'Analytics', 'Care app', 'Billing AI', 'Research']
const ys = [50, 120, 190, 260, 330]
const L = 96
const R = W - 96
const HUB = { x: W / 2, y: H / 2 }

export function ProblemVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-120px' })
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<'without' | 'with'>('without')

  useEffect(() => {
    if (!inView || reduce) return
    const t = setTimeout(() => setMode('with'), 2600)
    return () => clearTimeout(t)
  }, [inView, reduce])

  return (
    <div ref={ref} className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex rounded-lg bg-navy-50 p-1" role="tablist" aria-label="Integration model">
          {(['without', 'with'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={clsx('rounded-md px-3 py-1.5 text-[13px] font-medium transition', mode === m ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-800')}
            >
              {m === 'without' ? 'Point-to-point' : 'With Privexa'}
            </button>
          ))}
        </div>
        <p className="font-mono text-[12px] text-navy-500">
          <span className={clsx('font-semibold', mode === 'without' ? 'text-danger' : 'text-teal-700')}>{mode === 'without' ? '25' : '10'}</span> integrations to build &amp; maintain
        </p>
      </div>
      <div className="grid-bg p-5">
        <Stage width={W} height={H}>
          <svg width={W} height={H} className="absolute inset-0" aria-hidden>
            <AnimatePresence>
              {mode === 'without'
                ? ys.flatMap((y1, i) =>
                    ys.map((y2, j) => (
                      <motion.path
                        key={`w${i}${j}`}
                        d={`M${L} ${y1} C ${W / 2} ${y1}, ${W / 2} ${y2}, ${R} ${y2}`}
                        fill="none"
                        stroke="var(--navy-300)"
                        strokeWidth={1.25}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.7 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, delay: (i * 5 + j) * 0.01 }}
                      />
                    )),
                  )
                : [...ys.map((y) => `M${L} ${y} C ${L + 90} ${y}, ${HUB.x - 90} ${HUB.y}, ${HUB.x - 34} ${HUB.y}`), ...ys.map((y) => `M${HUB.x + 34} ${HUB.y} C ${HUB.x + 90} ${HUB.y}, ${R - 90} ${y}, ${R} ${y}`)].map((d, k) => (
                    <motion.path
                      key={`h${k}`}
                      d={d}
                      fill="none"
                      stroke="var(--teal-600)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeOpacity={0.55}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, delay: k * 0.04 }}
                    />
                  ))}
            </AnimatePresence>
          </svg>
          {ys.map((y, i) => (
            <div key={systems[i]} className="absolute flex h-8 w-[92px] -translate-y-1/2 items-center rounded-lg border border-line bg-white px-2.5 text-[12px] font-medium text-navy-800 shadow-sm" style={{ left: 0, top: y }}>
              {systems[i]}
            </div>
          ))}
          {ys.map((y, i) => (
            <div key={apps[i]} className="absolute flex h-8 w-[92px] -translate-y-1/2 items-center justify-end rounded-lg border border-line bg-white px-2.5 text-[12px] font-medium text-navy-800 shadow-sm" style={{ right: 0, top: y }}>
              {apps[i]}
            </div>
          ))}
          <AnimatePresence>
            {mode === 'with' && (
              <motion.div
                className="absolute flex size-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-teal-100 bg-white shadow-[0_14px_30px_-12px_rgb(8_141_129/0.5)]"
                style={{ left: HUB.x, top: HUB.y }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <PrivexaMark size={34} />
              </motion.div>
            )}
          </AnimatePresence>
        </Stage>
      </div>
    </div>
  )
}
