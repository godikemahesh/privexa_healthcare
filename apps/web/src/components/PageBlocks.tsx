import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Reveal } from './Reveal'
import { LinkButton } from './ui'

export function PageHero({
  eyebrow,
  title,
  lead,
  actions,
  aside,
}: {
  eyebrow: string
  title: ReactNode
  lead: ReactNode
  actions?: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="grid-bg absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" aria-hidden />
      <div className={`container-x relative grid gap-12 py-16 lg:py-24 ${aside ? 'lg:grid-cols-[1fr_1fr] lg:items-center' : ''}`}>
        <div className="max-w-[720px]">
          <Reveal>
            <p className="eyebrow">{eyebrow}</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 text-[38px] font-semibold leading-[1.06] sm:text-[50px]" style={{ letterSpacing: '-0.035em' }}>
              {title}
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="lead mt-6">{lead}</p>
          </Reveal>
          {actions && (
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap gap-3">{actions}</div>
            </Reveal>
          )}
        </div>
        {aside && <Reveal delay={0.1}>{aside}</Reveal>}
      </div>
    </section>
  )
}

export function Section({ children, tone = 'bg', className = '' }: { children: ReactNode; tone?: 'bg' | 'white'; className?: string }) {
  return (
    <section className={`py-20 lg:py-28 ${tone === 'white' ? 'border-b border-line bg-white' : ''} ${className}`}>
      <div className="container-x">{children}</div>
    </section>
  )
}

export function FeatureGrid({ items, cols = 3 }: { items: { icon: LucideIcon; title: string; body: string }[]; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border border-line bg-line ${c}`}>
      {items.map((f) => (
        <div key={f.title} className="bg-white p-7">
          <span className="flex size-10 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-700">
            <f.icon className="size-5" strokeWidth={1.6} />
          </span>
          <h3 className="mt-6 text-[16.5px] font-semibold">{f.title}</h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.body}</p>
        </div>
      ))}
    </div>
  )
}

export function NumberedSteps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="relative space-y-0 border-l border-line">
      {steps.map((s, i) => (
        <Reveal key={s.title} delay={i * 0.04}>
          <li className="relative pb-9 pl-10 last:pb-0">
            <span className="absolute -left-[15px] top-0 flex size-[30px] items-center justify-center rounded-full border border-teal-200 bg-white font-mono text-[12px] font-medium text-teal-700">
              {i + 1}
            </span>
            <h3 className="pt-1 text-[17px] font-semibold">{s.title}</h3>
            <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-muted">{s.body}</p>
          </li>
        </Reveal>
      ))}
    </ol>
  )
}

export function Callout({ title, body, cta, to }: { title: string; body: string; cta: string; to: string }) {
  return (
    <section className="bg-navy-950">
      <div className="container-x flex flex-col items-start justify-between gap-8 py-16 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <h2 className="text-[30px] font-semibold !text-white sm:text-[36px]">{title}</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-navy-300">{body}</p>
        </div>
        <LinkButton to={to} size="lg" arrow>{cta}</LinkButton>
      </div>
    </section>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-200 bg-white p-5 text-[14px] leading-relaxed text-navy-600">
      {children}
    </div>
  )
}
