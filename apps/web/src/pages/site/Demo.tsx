import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Hospital, Code2, ShieldCheck, PlayCircle } from 'lucide-react'
import { Seo } from '../../components/Seo'
import { PageHero, Section, Note } from '../../components/PageBlocks'
import { Button, LinkButton, SectionHeading, SimulatedTag } from '../../components/ui'
import { PrivexaMark } from '../../brand/Logo'
import { useAuthActions } from '../../lib/auth'
import { errorMessage } from '../../lib/api'
import type { Role } from '../../lib/types'

const journeys = [
  { n: '01', t: 'Two hospitals, two systems', b: 'MetroCare Medical Center and Sunrise General Hospital each run their own independent FHIR server with their own synthetic records.' },
  { n: '02', t: 'One patient, two records', b: 'A fictional patient has visited both hospitals and has a different local ID at each. Privexa suggests a match and explains why.' },
  { n: '03', t: 'An application asks for data', b: 'A registered demo application requests specific information for a stated purpose. Privexa checks its identity, scopes and the provider\'s policies.' },
  { n: '04', t: 'Only permitted data is returned', b: 'You see a combined timeline — each entry labeled with the hospital it came from — and exactly what was denied and why.' },
  { n: '05', t: 'Evidence you can verify', b: 'Each access decision is recorded and its fingerprint is anchored on a local demonstration blockchain. Verify it yourself.' },
  { n: '06', t: 'When things go wrong', b: 'Watch a denied request, then simulate a hospital outage and see the error, retry and recovery.' },
]

export default function DemoLanding() {
  const { demoLogin } = useAuthActions()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function go(role: Role, to?: string) {
    setBusy(to ?? role)
    setErr(null)
    try {
      await demoLogin(role, to)
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Seo title="Interactive Demo" description="A guided, working demonstration of Privexa with two simulated hospitals, synthetic patient data, policy-enforced access and verifiable audit evidence." />
      <PageHero
        eyebrow="Interactive demo"
        title="See connected healthcare systems in action."
        lead="A guided walkthrough running on real services: two independent hospital simulations, live access decisions, and audit evidence anchored on a local blockchain. Everything uses fictional organizations and synthetic data."
        actions={
          <>
            <Button size="lg" onClick={() => go('demo_admin', '/demo/workspace')} loading={busy === '/demo/workspace'}>
              <PlayCircle className="size-4" /> Launch Interactive Demo
            </Button>
          </>
        }
        aside={
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <PrivexaMark size={30} />
              <div>
                <p className="text-[15px] font-semibold text-navy-900">Demo environment</p>
                <p className="text-[13px] text-muted">Shared sandbox · resets periodically</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <SimulatedTag label="Fictional hospitals" />
              <SimulatedTag label="Synthetic records (Synthea)" />
              <SimulatedTag label="Local demo chain" />
            </div>
            <p className="mt-5 text-[14px] leading-relaxed text-muted">Or explore a workspace directly as one of the demo roles:</p>
            <div className="mt-3 grid gap-2">
              {[
                { role: 'provider_admin' as Role, icon: Hospital, label: 'Provider workspace', sub: 'Manage connections, approvals and audit' },
                { role: 'vendor_dev' as Role, icon: Code2, label: 'Vendor workspace', sub: 'Register apps, use the sandbox and API' },
                { role: 'demo_admin' as Role, icon: ShieldCheck, label: 'Demo administrator', sub: 'Review requests and run scenarios' },
              ].map((r) => (
                <button
                  key={r.role}
                  onClick={() => go(r.role)}
                  disabled={!!busy}
                  className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40 disabled:opacity-60"
                >
                  <r.icon className="size-4 text-teal-700" />
                  <span className="flex-1">
                    <span className="block text-[14px] font-medium text-navy-900">{r.label}</span>
                    <span className="block text-[12.5px] text-muted">{r.sub}</span>
                  </span>
                  {busy === r.role && <span className="text-[12px] text-muted">Signing in…</span>}
                </button>
              ))}
            </div>
            {err && <p className="mt-3 rounded-lg bg-[#fef3f2] px-3 py-2 text-[13px] text-danger" role="alert">{err}</p>}
          </div>
        }
      />
      <Section tone="white">
        <SectionHeading eyebrow="What you'll see" title="Six moments that show how Privexa works." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {journeys.map((j) => (
            <div key={j.n} className="bg-white p-7">
              <p className="font-mono text-[12px] text-teal-700">{j.n}</p>
              <h3 className="mt-3 text-[17px] font-semibold">{j.t}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{j.b}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <Note>
          <strong className="text-navy-900">About this demonstration.</strong> MetroCare Medical Center and Sunrise General Hospital are fictional. All patient records are synthetic, generated with Synthea. Approvals are made by a demo administrator and are not real hospital approvals. The blockchain is a local development network used to demonstrate integrity evidence — not a production or multi-party network.
        </Note>
        <div className="mt-6">
          <LinkButton to="/contact" variant="secondary" arrow>Talk to Privexa about a real integration</LinkButton>
        </div>
      </Section>
    </>
  )
}

export function SignIn() {
  const { login, demoLogin } = useAuthActions()
  const [params] = useSearchParams()
  const next = params.get('next') ?? undefined
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    setErr(null)
    try {
      await login(String(fd.get('email')), String(fd.get('password')), next)
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Seo title="Sign in" description="Sign in to the Privexa workspace." />
      <div className="container-x flex justify-center py-16 lg:py-24">
        <div className="w-full max-w-[420px]">
          <div className="text-center">
            <PrivexaMark size={40} className="mx-auto" />
            <h1 className="mt-5 text-[28px] font-semibold">Sign in to Privexa</h1>
            <p className="mt-2 text-[14.5px] text-muted">Demonstration workspace</p>
          </div>
          <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" autoComplete="username" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
            </div>
            {err && <p className="rounded-lg bg-[#fef3f2] px-3 py-2 text-[13px] text-danger" role="alert">{err}</p>}
            <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
          </form>
          <div className="mt-6 rounded-xl border border-dashed border-navy-200 bg-white p-4">
            <p className="text-[13px] font-medium text-navy-800">Exploring the demo?</p>
            <p className="mt-1 text-[12.5px] text-muted">Continue with a shared demo account. No real data is involved.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ['provider_admin', 'Provider'],
                ['vendor_dev', 'Vendor'],
                ['demo_admin', 'Admin'],
              ] as [Role, string][]).map(([r, l]) => (
                <Button key={r} variant="secondary" size="sm" onClick={() => demoLogin(r, next).catch((e) => setErr(errorMessage(e)))}>
                  {l}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function NotFound() {
  return (
    <>
      <Seo title="Page not found" description="The page you were looking for doesn't exist." />
      <div className="container-x flex flex-col items-center py-28 text-center">
        <p className="font-mono text-[13px] text-teal-700">404</p>
        <h1 className="mt-3 text-[36px] font-semibold">This page isn't connected.</h1>
        <p className="mt-3 text-[15.5px] text-muted">The page you were looking for doesn't exist or has moved.</p>
        <Link to="/" className="mt-8 text-[14.5px] font-medium text-teal-700 hover:underline">Back to home</Link>
      </div>
    </>
  )
}
