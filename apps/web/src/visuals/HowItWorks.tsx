import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { Link2, KeyRound, ArrowLeftRight, BadgeCheck } from 'lucide-react'
import clsx from 'clsx'

const steps = [
  {
    icon: Link2,
    title: 'Connect',
    body: 'Configure a supported healthcare system. Privexa tests the connection and reads what the system can share.',
    detail: ['Connection tested', 'Capabilities discovered', 'Health monitored continuously'],
  },
  {
    icon: KeyRound,
    title: 'Authorize',
    body: 'The provider decides which application may access which information, for what purpose and under which conditions.',
    detail: ['Application identity verified', 'Scopes limited to what is needed', 'Policies versioned and logged'],
  },
  {
    icon: ArrowLeftRight,
    title: 'Exchange',
    body: 'Applications request data through Privexa. Only the permitted information is retrieved and delivered.',
    detail: ['Every request checked', 'Only permitted resources returned', 'Source of each record shown'],
  },
  {
    icon: BadgeCheck,
    title: 'Verify',
    body: 'Every decision is recorded. Audit evidence can be checked for integrity at any time.',
    detail: ['Allowed & denied requests recorded', 'Audit fingerprints anchored', 'Integrity verifiable on demand'],
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-100px' })
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!inView || paused || reduce) return
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 3200)
    return () => clearInterval(t)
  }, [inView, paused, reduce])

  return (
    <div ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <ol className="relative grid gap-4 lg:grid-cols-4 lg:gap-6">
        {/* rail */}
        <div className="absolute left-[22px] top-0 h-full w-px bg-line lg:left-0 lg:top-[22px] lg:h-px lg:w-full" aria-hidden>
          <motion.div
            className="absolute left-0 top-0 bg-teal-600 max-lg:w-px lg:h-px"
            animate={{ [typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'width' : 'height']: `${((active + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        </div>
        {steps.map((s, i) => {
          const on = i <= active
          return (
            <li key={s.title} className="relative pl-16 lg:pl-0 lg:pt-16">
              <button
                onClick={() => setActive(i)}
                className={clsx(
                  'absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 transition-colors duration-300',
                  on ? 'border-teal-600 bg-teal-600 text-white' : 'border-line bg-white text-navy-400',
                )}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === active ? 'step' : undefined}
              >
                <s.icon className="size-[18px]" strokeWidth={1.75} />
              </button>
              <p className="font-mono text-[12px] text-navy-400">0{i + 1}</p>
              <h3 className="mt-1 text-[20px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              <motion.ul
                className={clsx('mt-4 space-y-1.5 rounded-lg border p-3 transition-colors', i === active ? 'border-teal-200 bg-teal-50/60' : 'border-transparent')}
                animate={{ opacity: i === active ? 1 : 0.55 }}
              >
                {s.detail.map((d) => (
                  <li key={d} className="flex items-center gap-2 text-[13px] text-navy-700">
                    <span className={clsx('size-1.5 rounded-full', i === active ? 'bg-teal-600' : 'bg-navy-200')} />
                    {d}
                  </li>
                ))}
              </motion.ul>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
