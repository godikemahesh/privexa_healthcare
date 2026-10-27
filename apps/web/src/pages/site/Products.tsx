import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Cable,
  KeyRound,
  Code2,
  Store,
  FileCheck2,
  Shuffle,
  ShieldAlert,
  Gauge,
  TestTube2,
  Fingerprint,
  ScrollText,
  Scale,
  ToggleRight,
  Minimize2,
  BadgeCheck,
  BookOpen,
  Terminal,
  History,
  FileJson,
  Settings2,
  MessageSquareWarning,
} from 'lucide-react'
import { Seo } from '../../components/Seo'
import { Callout, FeatureGrid, PageHero, Section } from '../../components/PageBlocks'
import { Badge, LinkButton, SectionHeading } from '../../components/ui'
import { ConnectVisual, StudioVisual, TrustVisual } from '../../visuals/ProductVisuals'
import { ChainVisual } from '../../visuals/ChainVisual'

const rows = [
  { to: '/products/privexa-connect', icon: Cable, name: 'Privexa Connect', who: 'Shared capability', body: 'Connectors to supported systems, data retrieval, validation, standardized responses, error handling and monitoring.', status: 'In demo' },
  { to: '/products/privexa-trust', icon: KeyRound, name: 'Privexa Trust', who: 'Shared capability', body: 'Application identity, scopes, authorization decisions, policy checks, audit events and integrity verification.', status: 'In demo' },
  { to: '/products/privexa-studio', icon: Code2, name: 'Privexa Studio', who: 'For vendors', body: 'API documentation, sandbox, request/response viewer, validation results, test history and example code.', status: 'In demo' },
  { to: '/integrations', icon: Store, name: 'Privexa Marketplace', who: 'For providers & vendors', body: 'A curated directory of supported systems and applications, with a request-access workflow.', status: 'Curated preview' },
]

export function ProductsOverview() {
  return (
    <>
      <Seo title="Products" description="Privexa Connect, Privexa Trust, Privexa Studio and Privexa Marketplace — the capabilities behind trusted healthcare connectivity." />
      <PageHero eyebrow="Products" title="The capabilities behind trusted healthcare connectivity." lead="Connect and Trust run underneath every exchange. Studio and the Marketplace are where vendors and providers meet them." />
      <Section>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {rows.map((r) => (
            <Link key={r.name} to={r.to} className="group grid items-center gap-4 p-6 transition-colors hover:bg-teal-50/40 sm:p-8 md:grid-cols-[56px_1.1fr_2fr_auto]">
              <span className="flex size-12 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-700">
                <r.icon className="size-6" strokeWidth={1.5} />
              </span>
              <div>
                <h2 className="text-[20px] font-semibold">{r.name}</h2>
                <p className="mt-1 text-[13px] text-muted">{r.who}</p>
              </div>
              <p className="text-[15px] leading-relaxed text-muted">{r.body}</p>
              <div className="flex items-center gap-3">
                <Badge tone={r.status === 'In demo' ? 'teal' : 'neutral'}>{r.status}</Badge>
                <ArrowUpRight className="size-4 text-navy-300 transition group-hover:text-teal-700" />
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted">"In demo" means the capability works in the interactive demonstration with simulated systems. It does not indicate production availability.</p>
      </Section>
      <Callout title="See the products working together." body="The interactive demo runs Connect, Trust and Studio end to end with two simulated hospitals." cta="Explore the Demo" to="/demo" />
    </>
  )
}

export function Connect() {
  return (
    <>
      <Seo title="Privexa Connect" description="Connect supported healthcare systems and standardize data exchange with validation, monitoring and source attribution." />
      <PageHero
        eyebrow="Privexa Connect"
        title="Connect supported systems. Receive consistent data."
        lead="Privexa Connect retrieves information from supported healthcare systems, checks it, and delivers it in a standard structure — with the source of every record kept visible."
        actions={<LinkButton to="/demo" size="lg" arrow>See it in the demo</LinkButton>}
        aside={<ConnectVisual />}
      />
      <Section tone="white">
        <SectionHeading eyebrow="Capabilities" title="Reliable connectivity, made visible." />
        <div className="mt-12">
          <FeatureGrid
            items={[
              { icon: Cable, title: 'Supported system connectors', body: 'Standards-based connections to supported systems, starting with HL7® FHIR® R4.' },
              { icon: FileCheck2, title: 'Resource validation', body: 'Responses are checked for structure before they are passed on. Malformed data is rejected clearly.' },
              { icon: Shuffle, title: 'Standardized responses', body: 'Records from different systems are presented consistently, each labeled with its source.' },
              { icon: ShieldAlert, title: 'Error handling', body: 'Timeouts and failures are retried within limits and reported without exposing sensitive details.' },
              { icon: Gauge, title: 'Connection monitoring', body: 'Health checks, latency and success rates for each connection.' },
              { icon: TestTube2, title: 'Integration test support', body: 'Test connections and simulate failures to see how integrations behave and recover.' },
            ]}
          />
        </div>
      </Section>
      <Callout title="Discuss connecting your systems." body="Tell us what you run and we'll be clear about what's supported today." cta="Book a Conversation" to="/contact?type=provider" />
    </>
  )
}

export function Trust() {
  return (
    <>
      <Seo title="Privexa Trust" description="Application identity, access scopes, policy decisions and verifiable audit evidence for healthcare data access." />
      <PageHero
        eyebrow="Privexa Trust"
        title="Every request checked. Every decision recorded."
        lead="Privexa Trust decides whether an application may access the information it asks for — and keeps evidence of each decision that can be verified later."
        actions={<LinkButton to="/demo" size="lg" arrow>See a live decision</LinkButton>}
        aside={<TrustVisual />}
      />
      <Section tone="white">
        <SectionHeading eyebrow="Capabilities" title="Governance built into every exchange." />
        <div className="mt-12">
          <FeatureGrid
            cols={4}
            items={[
              { icon: Fingerprint, title: 'Application identity', body: 'Each application is registered and identified on every request.' },
              { icon: KeyRound, title: 'Access scopes', body: 'Applications receive only the resource types they were approved for.' },
              { icon: Scale, title: 'Authorization decisions', body: 'Each request is allowed or denied, with the reason recorded.' },
              { icon: ToggleRight, title: 'Policy checks', body: 'Versioned policies that providers can enable, disable and test.' },
              { icon: BadgeCheck, title: 'Consent-state handling', body: 'Demonstration consent states are evaluated as part of each decision.' },
              { icon: ScrollText, title: 'Audit events', body: 'Allowed and denied requests, and policy changes, are recorded.' },
              { icon: Minimize2, title: 'Data minimization', body: 'Only the permitted information is returned to the application.' },
              { icon: Fingerprint, title: 'Integrity verification', body: 'Audit fingerprints can be anchored and verified for tampering.' },
            ]}
          />
        </div>
      </Section>
      <Section>
        <SectionHeading eyebrow="Integrity evidence" title="Try it: alter a record and watch verification fail." lead="Blockchain is used here only as integrity evidence for audit records — never for storing health information, and never to make access decisions." />
        <div className="mt-10">
          <ChainVisual />
        </div>
      </Section>
      <Callout title="See Privexa Trust in action." body="Watch an allowed and a denied request, then verify the audit anchor yourself." cta="Launch Interactive Demo" to="/demo" />
    </>
  )
}

export function Studio() {
  return (
    <>
      <Seo title="Privexa Studio" description="API documentation, sandbox testing, validation results and example code for healthcare software developers." />
      <PageHero
        eyebrow="Privexa Studio"
        title="A focused workspace for healthcare integration development."
        lead="Studio is where vendor teams explore documentation, send sandbox requests, inspect responses and debug — against synthetic data, through the same access checks as production-style requests."
        actions={
          <>
            <LinkButton to="/app/vendor/explorer" size="lg" arrow>Open API Explorer</LinkButton>
            <LinkButton to="/app/vendor/docs" size="lg" variant="secondary">Read the docs</LinkButton>
          </>
        }
        aside={<StudioVisual />}
      />
      <Section tone="white">
        <SectionHeading eyebrow="Inside Studio" title="Everything you need in one place." />
        <div className="mt-12">
          <FeatureGrid
            items={[
              { icon: BookOpen, title: 'API documentation', body: 'Generated from the live API contract, so examples never drift from what actually runs.' },
              { icon: Terminal, title: 'Sandbox explorer', body: 'Choose a synthetic patient, a simulated hospital and resource types, then send the request.' },
              { icon: FileJson, title: 'Request & response viewer', body: 'Inspect payloads, FHIR resource examples, request IDs and durations.' },
              { icon: FileCheck2, title: 'Validation results', body: 'See whether responses passed structural validation and why not.' },
              { icon: History, title: 'Test history', body: 'Review previous sandbox requests and their outcomes.' },
              { icon: MessageSquareWarning, title: 'Error explanations', body: 'Clear, actionable explanations for denied and failed requests.' },
              { icon: Code2, title: 'Example client code', body: 'Copy-ready Python and JavaScript examples.' },
              { icon: Settings2, title: 'Application configuration', body: 'Manage your registered application and requested scopes.' },
            ]}
          />
        </div>
      </Section>
      <Callout title="Register a demo application." body="Get a development client ID and run your first sandbox request in minutes." cta="Open the Vendor Workspace" to="/app/vendor" />
    </>
  )
}
