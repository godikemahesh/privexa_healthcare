import {
  ShieldCheck,
  Minimize2,
  ScrollText,
  Lock,
  Eye,
  Activity,
  UserCheck,
  FileWarning,
  Compass,
  Handshake,
  Layers,
  Target,
  Telescope,
} from 'lucide-react'
import { Seo } from '../../components/Seo'
import { Callout, FeatureGrid, Note, PageHero, Section } from '../../components/PageBlocks'
import { SectionHeading } from '../../components/ui'
import { ChainVisual } from '../../visuals/ChainVisual'
import { DeniedRow, TrustVisual } from '../../visuals/ProductVisuals'
import { site } from '../../lib/site'

export function Security() {
  return (
    <>
      <Seo title="Security & Trust" description="How Privexa approaches authorized access, least privilege, data minimization, auditability and integrity verification." />
      <PageHero
        eyebrow="Security & trust"
        title="Designed for controlled access from the first request."
        lead="Healthcare connectivity is only valuable if providers can trust it. These are the principles that shape every part of Privexa."
        aside={
          <div className="space-y-3">
            <TrustVisual />
            <DeniedRow />
          </div>
        }
      />
      <Section tone="white">
        <SectionHeading eyebrow="Principles" title="How Privexa approaches security." />
        <div className="mt-12">
          <FeatureGrid
            items={[
              { icon: UserCheck, title: 'Authorized applications only', body: 'Applications are registered and identified. Requests from unknown or unapproved applications are denied.' },
              { icon: Minimize2, title: 'Least privilege', body: 'Access is granted for specific resource types, organizations and purposes — nothing broader.' },
              { icon: ShieldCheck, title: 'Server-side enforcement', body: 'Every permission is checked by the platform on every request — not by hiding buttons in an interface.' },
              { icon: Layers, title: 'Organization isolation', body: "Users and applications only see the organizations they're permitted to see." },
              { icon: ScrollText, title: 'Recorded decisions', body: 'Allowed requests, denied requests and policy changes all produce audit events.' },
              { icon: Eye, title: 'Integrity evidence', body: 'Audit fingerprints can be anchored to a ledger and verified for tampering.' },
              { icon: Lock, title: 'Minimal retention', body: 'Clinical records stay in the source systems. Privexa avoids keeping a central clinical store.' },
              { icon: Activity, title: 'Careful operational logs', body: 'Logs and errors are designed to exclude credentials and clinical content.' },
              { icon: FileWarning, title: 'Honest status', body: "Pending or failed operations are shown as they are. Nothing is shown as verified unless it was verified." },
            ]}
          />
        </div>
      </Section>
      <Section>
        <SectionHeading eyebrow="Blockchain, used carefully" title="Integrity evidence — not storage, not authorization." lead="Only a cryptographic fingerprint of approved audit metadata is anchored. Names, identifiers, clinical records and tokens never leave Privexa's audit store. Access decisions are made by policy, not by the ledger." />
        <div className="mt-10">
          <ChainVisual />
        </div>
      </Section>
      <Section tone="white">
        <div className="grid gap-8 lg:grid-cols-2">
          <SectionHeading eyebrow="Current status" title="Where Privexa stands today." />
          <div className="space-y-4">
            <Note>
              Privexa is in active development and currently operates as a demonstration with fictional organizations and synthetic data. It has <strong className="text-navy-900">not</strong> been independently certified, and we make no claim of compliance with DPDP, ABDM, HIPAA or any other framework based on this demonstration.
            </Note>
            <Note>
              Before connecting to any real healthcare system, Privexa will require production identity management, independent security review, legal assessment of applicable requirements, and provider-specific agreements.
            </Note>
          </div>
        </div>
      </Section>
      <Callout title="Questions about our security approach?" body="We're happy to walk through how Privexa handles access, audit and data minimization." cta="Talk to Privexa" to="/contact" />
    </>
  )
}

export function About() {
  return (
    <>
      <Seo title="About" description="Privexa is building the connective layer for trusted healthcare innovation." />
      <PageHero
        eyebrow="About Privexa"
        title="Building the connective layer for trusted healthcare innovation."
        lead="Privexa — Private Next Gen AI — exists because healthcare systems need to work together, and the people responsible for patient data need to stay in control of how it is used."
      />
      <Section tone="white">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Why we exist</p>
            <div className="mt-6 space-y-5 text-[17px] leading-[1.7] text-navy-700">
              <p>Healthcare systems need to work together. Today, connecting them often means repeated, expensive integration work for each new application and each new system.</p>
              <p>Developers shouldn't have to solve the same integration problems over and over. Providers shouldn't have to give up control over their data to make innovation possible.</p>
              <p>We believe healthcare innovation needs two things at once: reliable connectivity, and appropriate governance. Privexa is our attempt to provide both — in one layer.</p>
            </div>
          </div>
          <div className="grid gap-4">
            {[
              { icon: Target, t: 'Mission', b: 'Help healthcare providers and technology companies connect existing systems with authorized applications through standardized integrations, controlled access and auditable workflows.' },
              { icon: Telescope, t: 'Vision', b: 'A healthcare ecosystem where approved applications can work with the information they need — and every access is transparent, limited and verifiable.' },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-line bg-bg p-6">
                <x.icon className="size-5 text-teal-600" strokeWidth={1.6} />
                <h2 className="mt-4 text-[19px] font-semibold">{x.t}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{x.b}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section>
        <SectionHeading eyebrow="Product principles" title="What guides how we build." />
        <div className="mt-12">
          <FeatureGrid
            cols={4}
            items={[
              { icon: ShieldCheck, title: 'Privacy first', body: 'Minimize what is accessed, moved and kept.' },
              { icon: Lock, title: 'Security by default', body: 'Deny unless explicitly permitted. Enforce on the server.' },
              { icon: Eye, title: 'Trust through evidence', body: 'Make every decision visible and verifiable.' },
              { icon: Compass, title: 'Responsible innovation', body: 'Be honest about what works today and what is planned.' },
            ]}
          />
        </div>
      </Section>
      <Section tone="white">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Current stage" title="Early, and building in the open." />
            <p className="mt-5 text-[15.5px] leading-relaxed text-muted">
              Privexa is at an early stage. Our working demonstration connects two simulated hospitals with synthetic data to show the full flow — connection, authorization, exchange and verification. We're looking for providers, vendors and partners to shape what comes next.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-bg p-8">
            <Handshake className="size-6 text-teal-600" strokeWidth={1.5} />
            <h3 className="mt-4 text-[20px] font-semibold">Collaborate with us</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">Hospitals, clinics, diagnostic providers, HMS/EHR vendors and healthcare AI teams — we'd like to hear what you need.</p>
            {site.contactEmail && <p className="mt-4 font-mono text-[14px] text-teal-800">{site.contactEmail}</p>}
          </div>
        </div>
      </Section>
      <Callout title="Let's build trusted healthcare connectivity together." body="Tell us about your organization and what you're working on." cta="Get in Touch" to="/contact" />
    </>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy" updated="27 October 2026">
      <p>This page describes how the Privexa website and demonstration handle information. It is a working draft and will be reviewed by qualified counsel before any production launch.</p>
      <h2>Demonstration data</h2>
      <p>The interactive demonstration uses only synthetic patient records generated by software and fictional organizations. No real patient information is used, requested or stored.</p>
      <h2>Contact submissions</h2>
      <p>If you submit the contact form, we store your name, work email, organization, role, inquiry type and message so we can respond. Please do not include patient records or any health information in your message.</p>
      <h2>Demo accounts</h2>
      <p>Demonstration sign-ins use shared demo accounts. Activity in the demonstration (such as audit events) is recorded so the demo can show it back to you, and may be reset at any time.</p>
      <h2>Cookies</h2>
      <p>We use a session cookie and a security token cookie to keep you signed in to the demonstration workspace and to protect against cross-site requests. We do not use advertising cookies.</p>
      <h2>Contact</h2>
      <p>Questions about privacy can be sent through the contact page.</p>
    </LegalPage>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms" updated="27 October 2026">
      <p>These working terms apply to the Privexa website and demonstration. They are a draft pending legal review.</p>
      <h2>Demonstration only</h2>
      <p>The Privexa demonstration is provided for evaluation. It connects to simulated systems with synthetic data and must not be used with real patient information or for clinical decisions.</p>
      <h2>No warranties</h2>
      <p>The demonstration is provided "as is" without warranties of any kind. Features may change or be removed.</p>
      <h2>Acceptable use</h2>
      <p>Do not attempt to bypass access controls, disrupt the service, or submit sensitive personal or health information.</p>
      <h2>No claims of certification</h2>
      <p>Nothing on this website constitutes a claim of regulatory approval, certification, or compliance with any legal framework.</p>
    </LegalPage>
  )
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <Seo title={title} description={`Privexa ${title.toLowerCase()} information.`} />
      <div className="container-x max-w-3xl py-16 lg:py-24">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-4 text-[44px] font-semibold">{title}</h1>
        <p className="mt-2 text-[14px] text-muted">Last updated {updated}</p>
        <div className="mt-10 space-y-4 text-[15.5px] leading-[1.75] text-navy-700 [&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-semibold">{children}</div>
      </div>
    </>
  )
}
