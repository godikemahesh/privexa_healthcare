import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Building2,
  Hospital,
  Microscope,
  Network,
  Brain,
  ShieldCheck,
  Eye,
  Minimize2,
  Lock,
  ScrollText,
  Activity,
  Workflow,
  KeyRound,
  Layers,
  Code2,
  Store,
  Cable,
} from 'lucide-react'
import { Seo } from '../../components/Seo'
import { Badge, LinkButton, SectionHeading, SimulatedTag, TextLink } from '../../components/ui'
import { Reveal } from '../../components/Reveal'
import { HeroMap } from '../../visuals/HeroMap'
import { ProblemVisual } from '../../visuals/ProblemVisual'
import { HowItWorks } from '../../visuals/HowItWorks'
import { ChainVisual } from '../../visuals/ChainVisual'

const problems = [
  { title: 'Different systems, different formats', body: 'Records live across hospital, laboratory, imaging and pharmacy systems — each with its own structure and interface.' },
  { title: 'Integration work repeats', body: 'Every new application–system pair can mean another custom interface to build, test, secure and maintain.' },
  { title: 'Applications need the right context', body: 'Clinical and AI applications are only as useful as the information they can appropriately access.' },
  { title: 'Control must stay with providers', body: 'Organizations need to see and decide who accesses their data, for which purpose, and when.' },
]

const products = [
  { to: '/products/privexa-connect', icon: Cable, name: 'Privexa Connect', body: 'Connect supported healthcare systems and standardize data exchange.', status: 'In demo' },
  { to: '/products/privexa-trust', icon: KeyRound, name: 'Privexa Trust', body: 'Application identity, access decisions, policy enforcement and auditability.', status: 'In demo' },
  { to: '/products/privexa-studio', icon: Code2, name: 'Privexa Studio', body: 'Documentation, sandbox testing and request debugging for healthcare developers.', status: 'In demo' },
  { to: '/integrations', icon: Store, name: 'Privexa Marketplace', body: 'Discover supported applications, integration capabilities and connection opportunities.', status: 'Curated preview' },
]

const stakeholders = [
  { icon: Hospital, name: 'Hospitals & groups', body: 'Offer clinicians new tools without replacing core systems, while keeping a clear record of who accessed what.' },
  { icon: Building2, name: 'Clinics', body: 'Participate in connected care with a manageable footprint instead of a dedicated integration team.' },
  { icon: Microscope, name: 'Diagnostic providers', body: 'Make results available to authorized applications through consistent, monitored exchanges.' },
  { icon: Network, name: 'HMS & EHR vendors', body: 'Give customers a governed path to approved applications instead of one-off interface projects.' },
  { icon: Brain, name: 'Healthcare AI companies', body: 'Build and test against a consistent interface, then request access through a clear, auditable process.' },
]

const governance = [
  { icon: ShieldCheck, title: 'Authorized access', body: 'Only registered, approved applications can request data.' },
  { icon: Minimize2, title: 'Least privilege', body: 'Access is limited to the specific resources and purpose approved.' },
  { icon: ScrollText, title: 'Traceable decisions', body: 'Every allow and deny is recorded with its reason.' },
  { icon: Layers, title: 'Data minimization', body: 'Only permitted information is returned; nothing extra is retained.' },
  { icon: Lock, title: 'Secure transport', body: 'Exchanges are designed to run over encrypted connections.' },
  { icon: Eye, title: 'Auditability', body: 'Audit evidence can be independently checked for integrity.' },
  { icon: Activity, title: 'Integration monitoring', body: 'Connection health, latency and failures are visible.' },
  { icon: Workflow, title: 'Standards-oriented', body: 'Built around HL7® FHIR® R4 for supported exchanges.' },
]

export default function Home() {
  return (
    <>
      <Seo title="Privexa"description="Privexa is a healthcare interoperability platform that connects existing hospital systems with authorized healthcare applications through standards-based FHIR integrations and controlled access." />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />
        <div className="container-x relative grid items-center gap-12 pb-20 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:pb-28 lg:pt-20">
          <div>
            <Reveal>
              <Link to="/demo" className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-[13px] text-navy-700 shadow-sm transition hover:border-teal-200">
                <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-medium text-white">New</span>
                Interactive demo with two simulated hospitals
                <ArrowUpRight className="size-3.5 text-navy-400" />
              </Link>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-7 font-mono text-[12.5px] font-medium uppercase tracking-[0.14em] text-teal-700">Healthcare interoperability platform</p>
              <h1 className="display mt-3">
                Connect healthcare systems.{' '}
                <span className="text-teal-600">Enable trusted innovation.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="lead mt-6 max-w-[560px]">
                Privexa brings interoperability to healthcare. Hospital systems, labs and imaging exchange records with authorized applications through standards-based FHIR integrations, with controlled access and transparent oversight.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap gap-3">
                <LinkButton to="/demo" size="lg" arrow>Explore the Demo</LinkButton>
                <LinkButton to="/solutions" size="lg" variant="secondary">Discover Our Solutions</LinkButton>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <dl className="mt-12 grid max-w-[520px] grid-cols-3 gap-6 border-t border-line pt-6">
                {[
                  ['HL7® FHIR® R4', 'Standards-based exchange'],
                  ['Per-request', 'Access decisions'],
                  ['Verifiable', 'Audit evidence'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[15px] font-semibold text-navy-900">{k}</dt>
                    <dd className="mt-1 text-[13px] text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="lg:pl-4">
            <HeroMap />
          </Reveal>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-line bg-white py-24 lg:py-32">
        <div className="container-x grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <SectionHeading index="01" eyebrow="The challenge" title="Healthcare data exists. Connecting it is the challenge." />
            <dl className="mt-10 space-y-7">
              {problems.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.05}>
                  <div className="grid grid-cols-[28px_1fr] gap-3">
                    <span className="mt-0.5 font-mono text-[12px] text-teal-700">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <dt className="text-[16px] font-semibold text-navy-900">{p.title}</dt>
                      <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.body}</dd>
                    </div>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
          <Reveal className="lg:pt-16">
            <ProblemVisual />
            <p className="mt-3 text-[13px] text-muted">Illustrative: five systems and five applications. Point-to-point needs an interface for every pair; a shared layer needs one per participant.</p>
          </Reveal>
        </div>
      </section>

      {/* Approach */}
      <section className="py-24 lg:py-32">
        <div className="container-x">
          <SectionHeading index="02" eyebrow="The Privexa approach" title="A shared connectivity layer. Different experiences for each stakeholder." />
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {[
              {
                tag: 'Privexa for Providers',
                title: 'Stay in control of every connection.',
                body: 'Connect existing systems, manage application access and gain visibility into integration activity.',
                to: '/solutions/providers',
                cta: 'Explore Provider Solutions',
                points: ['Approve or reject application access', 'See every allowed and denied request', 'Monitor connection health'],
                dark: true,
              },
              {
                tag: 'Privexa for Vendors',
                title: 'Build once against a consistent interface.',
                body: 'Discover supported integrations, test your application and work toward connecting with authorized healthcare systems.',
                to: '/solutions/vendors',
                cta: 'Explore Vendor Solutions',
                points: ['Sandbox with synthetic patients', 'API explorer and validation', 'Track access requests'],
                dark: false,
              },
            ].map((c, i) => (
              <Reveal key={c.tag} delay={i * 0.08}>
                <div className={`group relative h-full overflow-hidden rounded-2xl border p-8 sm:p-10 ${c.dark ? 'border-navy-900 bg-navy-900' : 'border-line bg-white'}`}>
                  <svg className="pointer-events-none absolute -right-10 -top-10 opacity-[0.07]" width="260" height="260" viewBox="0 0 260 260" aria-hidden>
                    <path d="M20 240 C 20 120, 120 20, 240 20" stroke={c.dark ? 'white' : 'var(--teal-600)'} strokeWidth="36" fill="none" strokeLinecap="round" />
                  </svg>
                  <p className={`eyebrow ${c.dark ? '!text-teal-300' : ''}`}>{c.tag}</p>
                  <h3 className={`mt-4 text-[28px] font-semibold leading-tight ${c.dark ? '!text-white' : ''}`}>{c.title}</h3>
                  <p className={`mt-4 max-w-md text-[16px] leading-relaxed ${c.dark ? 'text-navy-200' : 'text-muted'}`}>{c.body}</p>
                  <ul className="mt-7 space-y-2.5">
                    {c.points.map((p) => (
                      <li key={p} className={`flex items-center gap-2.5 text-[14.5px] ${c.dark ? 'text-navy-100' : 'text-navy-700'}`}>
                        <span className={`size-1.5 rounded-full ${c.dark ? 'bg-teal-300' : 'bg-teal-600'}`} />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-9">
                    <LinkButton to={c.to} variant={c.dark ? 'primary' : 'dark'} arrow>{c.cta}</LinkButton>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="border-y border-line bg-white py-24 lg:py-32">
        <div className="container-x">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading index="03" eyebrow="Products" title="Four capabilities. One trusted platform." />
            <TextLink to="/products">Compare products</TextLink>
          </div>
          <div className="mt-14 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.05} className="border-b border-r border-line">
                <Link to={p.to} className="group flex h-full flex-col p-7 transition-colors hover:bg-teal-50/40">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-700">
                      <p.icon className="size-5" strokeWidth={1.6} />
                    </span>
                    <Badge tone={p.status === 'In demo' ? 'teal' : 'neutral'}>{p.status}</Badge>
                  </div>
                  <h3 className="mt-8 text-[19px] font-semibold">{p.name}</h3>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-muted">{p.body}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-[13.5px] font-medium text-teal-700">
                    Learn more <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 lg:py-32">
        <div className="container-x">
          <SectionHeading index="04" eyebrow="How it works" title="From connection to verified evidence in four steps." />
          <div className="mt-16">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Stakeholders */}
      <section className="border-t border-line bg-white py-24 lg:py-32">
        <div className="container-x grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading index="05" eyebrow="Who it's for" title="Built for healthcare stakeholders." lead="Each participant gets the experience they need — on a shared foundation of controlled access and transparent records." />
          <div className="divide-y divide-line border-y border-line">
            {stakeholders.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.04}>
                <div className="grid gap-3 py-6 sm:grid-cols-[220px_1fr] sm:gap-8">
                  <p className="flex items-center gap-3 text-[16px] font-semibold text-navy-900">
                    <s.icon className="size-5 text-teal-600" strokeWidth={1.6} />
                    {s.name}
                  </p>
                  <p className="text-[15px] leading-relaxed text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & governance */}
      <section className="relative overflow-hidden bg-navy-950 py-24 lg:py-32">
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px]" aria-hidden />
        <div className="container-x relative">
          <SectionHeading dark index="06" eyebrow="Trust & governance" title="Connectivity must come with control." lead="Every exchange through Privexa is authorized, limited to what was approved, and recorded in a way that can be checked later." />
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-navy-800 bg-navy-800 sm:grid-cols-2 lg:grid-cols-4">
            {governance.map((g) => (
              <div key={g.title} className="bg-navy-950 p-6">
                <g.icon className="size-5 text-teal-300" strokeWidth={1.6} />
                <h3 className="mt-5 text-[15.5px] font-semibold !text-white">{g.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-navy-300">{g.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-20">
            <p className="eyebrow !text-teal-300">Audit integrity, explained</p>
            <h3 className="mt-3 max-w-2xl text-[24px] font-semibold !text-white">How Privexa proves an audit record hasn't been changed.</h3>
            <div className="mt-8">
              <ChainVisual dark />
            </div>
          </div>
          <p className="mt-10 max-w-3xl text-[13px] leading-relaxed text-navy-400">
            Privexa is in active development. These principles guide the product design; they are not a claim of certification or regulatory approval.{' '}
            <Link to="/security" className="text-teal-300 underline-offset-2 hover:underline">Read our security approach</Link>
          </p>
        </div>
      </section>

      {/* Demo */}
      <section className="py-24 lg:py-32">
        <div className="container-x">
          <div className="grid overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[1fr_1fr]">
            <div className="p-8 sm:p-12">
              <SectionHeading index="07" eyebrow="Product demo" title="See connected healthcare systems in action." />
              <p className="mt-5 text-[16px] leading-relaxed text-muted">
                A guided walkthrough across two independently running hospital simulations. Search a patient, request data as an application, watch the policy decision, then verify the audit evidence on a local blockchain.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <SimulatedTag label="Fictional hospitals" />
                <SimulatedTag label="Synthetic records" />
                <SimulatedTag label="Local demo chain" />
              </div>
              <div className="mt-9">
                <LinkButton to="/demo" size="lg" arrow>Launch Interactive Demo</LinkButton>
              </div>
            </div>
            <div className="grid-bg border-t border-line bg-bg p-8 lg:border-l lg:border-t-0">
              <ol className="space-y-2.5">
                {['Test both hospital connections', 'Find a patient across hospitals', 'Review the suggested match', 'Request data as an application', 'See the policy decision', 'View the combined timeline', 'Verify the audit anchor', 'Watch a denied request', 'Recover from an outage'].map((s, i) => (
                  <li key={s} className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-[14px] text-navy-800 shadow-sm">
                    <span className="font-mono text-[11px] text-teal-700">{String(i + 1).padStart(2, '0')}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line bg-white">
        <div className="container-x flex flex-col items-start justify-between gap-8 py-20 lg:flex-row lg:items-center">
          <h2 className="h-section max-w-xl">Let's make healthcare connectivity easier.</h2>
          <div className="flex flex-wrap gap-3">
            <LinkButton to="/contact" size="lg" variant="dark" arrow>Talk to Privexa</LinkButton>
            <LinkButton to="/demo" size="lg" variant="secondary">Explore the Sandbox</LinkButton>
          </div>
        </div>
      </section>
    </>
  )
}
