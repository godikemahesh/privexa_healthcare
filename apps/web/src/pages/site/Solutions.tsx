import {
  Repeat,
  Plug,
  Eye,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
  Workflow,
  Search,
  FlaskConical,
  CheckCircle2,
  Bug,
  KeyRound,
  ListChecks,
  Rocket,
  Hospital,
  Brain,
} from 'lucide-react'
import { Seo } from '../../components/Seo'
import { Callout, FeatureGrid, Note, NumberedSteps, PageHero, Section } from '../../components/PageBlocks'
import { LinkButton, SectionHeading, SimulatedTag, TextLink } from '../../components/ui'
import { TrustVisual, StudioVisual } from '../../visuals/ProductVisuals'
import { HeroMap } from '../../visuals/HeroMap'

export function SolutionsOverview() {
  return (
    <>
      <Seo title="Solutions" description="Privexa serves healthcare providers and healthcare technology vendors with separate experiences on a shared, governed connectivity layer." />
      <PageHero
        eyebrow="Solutions"
        title="One connectivity layer. Two purpose-built experiences."
        lead="Providers keep control over their systems and who accesses them. Vendors get a consistent way to build, test and request access. Both work from the same trusted record of what happened."
        actions={<LinkButton to="/demo" size="lg" arrow>Explore the Demo</LinkButton>}
        aside={<HeroMap />}
      />
      <Section>
        <div className="grid gap-5 lg:grid-cols-2">
          {[
            { icon: Hospital, tag: 'For Providers', title: 'Hospitals, clinics and diagnostic providers', body: 'Connect existing systems, review which applications request access, set policies and see every access decision and integration issue in one place.', to: '/solutions/providers', cta: 'Explore Provider Solutions' },
            { icon: Brain, tag: 'For Vendors', title: 'HMS/EHR vendors, healthcare AI and SaaS teams', body: 'Explore supported integrations, test against synthetic data in a sandbox, validate requests and track access requests to provider systems.', to: '/solutions/vendors', cta: 'Explore Vendor Solutions' },
          ].map((c) => (
            <div key={c.tag} className="card flex flex-col p-8 sm:p-10">
              <c.icon className="size-7 text-teal-600" strokeWidth={1.5} />
              <p className="eyebrow mt-8">{c.tag}</p>
              <h2 className="mt-3 text-[26px] font-semibold leading-tight">{c.title}</h2>
              <p className="mt-4 flex-1 text-[15.5px] leading-relaxed text-muted">{c.body}</p>
              <div className="mt-8"><LinkButton to={c.to} variant="dark" arrow>{c.cta}</LinkButton></div>
            </div>
          ))}
        </div>
      </Section>
      <Callout title="Not sure where you fit?" body="Tell us about your systems or your product and we'll help you understand what a Privexa integration could look like." cta="Book a Conversation" to="/contact" />
    </>
  )
}

export function Providers() {
  return (
    <>
      <Seo title="Privexa for Providers" description="Connect existing healthcare systems with authorized applications while keeping control and visibility over every access decision." />
      <PageHero
        eyebrow="Privexa for Providers"
        title="Your healthcare systems stay yours. Your connectivity can go further."
        lead="Privexa is designed to work alongside your existing systems — helping you manage supported integrations, decide which applications can access what, and see exactly what happened."
        actions={
          <>
            <LinkButton to="/contact?type=provider" size="lg" arrow>Discuss a Provider Integration</LinkButton>
            <LinkButton to="/demo" size="lg" variant="secondary">See the provider demo</LinkButton>
          </>
        }
        aside={<TrustVisual />}
      />
      <Section tone="white">
        <SectionHeading eyebrow="Benefits" title="Control and visibility, without replacing what works." />
        <div className="mt-12">
          <FeatureGrid
            items={[
              { icon: Repeat, title: 'Less repetitive integration work', body: 'Connect a supported system once and make it available to approved applications through a consistent interface.' },
              { icon: Plug, title: 'Connect to supported applications', body: 'Review applications that want to work with your data, along with exactly what they request and why.' },
              { icon: Eye, title: 'Visibility over data access', body: 'Every allowed and denied request is recorded with the application, resources, purpose and reason.' },
              { icon: AlertTriangle, title: 'Integration status and failures', body: 'See connection health, latency, failed requests and retries — without exposing credentials or clinical content.' },
              { icon: SlidersHorizontal, title: 'Application access and policies', body: 'Approve, reject or revoke access. Define policies and test whether a request would be allowed before it happens.' },
              { icon: Layers, title: 'Consistent exchanges', body: 'Supported data is delivered in a standard structure with clear attribution to its source system.' },
              { icon: Workflow, title: 'Existing workflows preserved', body: 'Your clinical systems remain the source of truth. Privexa works alongside them where the integration allows.' },
            ]}
          />
        </div>
      </Section>
      <Section>
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading eyebrow="How we work with providers" title="A controlled path from first conversation to monitored exchange." />
          <NumberedSteps
            steps={[
              { title: 'Understand your systems', body: 'We discuss your existing systems, interfaces and requirements to identify a supported integration path.' },
              { title: 'Configure a supported connection', body: 'The connection is configured and tested. Privexa reads what the system can share.' },
              { title: 'Review the application', body: 'You see which application is requesting access, which information it needs and its stated purpose.' },
              { title: 'Set scopes and policies', body: 'You define the permitted resources, purposes and conditions for each application.' },
              { title: 'Test in a controlled environment', body: 'Exchanges are validated using test data before anything else proceeds.' },
              { title: 'Monitor activity and decisions', body: 'Integration health and every access decision remain visible in your workspace.' },
            ]}
          />
        </div>
      </Section>
      <Section tone="white">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionHeading eyebrow="Supported today" title="What the demonstration supports." />
            <p className="mt-5 text-[15.5px] leading-relaxed text-muted">
              The current demonstration connects to two independently running hospital simulations using HL7® FHIR® R4 with synthetic patient records. Privexa does not promise compatibility with every HMS or EHR — support for additional systems is evaluated case by case.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <SimulatedTag label="MetroCare Medical Center — fictional" />
              <SimulatedTag label="Sunrise General Hospital — fictional" />
            </div>
          </div>
          <Note>
            <strong className="text-navy-900">A note on approvals.</strong> In the demo, approvals are made by a demonstration administrator on behalf of fictional organizations. They are not real hospital approvals.
            <div className="mt-4"><TextLink to="/integrations">View the integration directory</TextLink></div>
          </Note>
        </div>
      </Section>
      <Callout title="Let's talk about your systems." body="Share what you run today and what you'd like to connect. We'll be candid about what's supported." cta="Discuss a Provider Integration" to="/contact?type=provider" />
    </>
  )
}

export function Vendors() {
  return (
    <>
      <Seo title="Privexa for Vendors" description="Explore supported integrations, test standardized healthcare data exchanges against synthetic data and work toward authorized provider connectivity." />
      <PageHero
        eyebrow="Privexa for Vendors"
        title="Build healthcare applications. Simplify the integration work."
        lead="Privexa is designed to help healthcare software and AI teams explore supported integrations, test standardized data exchanges and work toward authorized connectivity with provider systems."
        actions={
          <>
            <LinkButton to="/app/vendor" size="lg" arrow>Open the Vendor Workspace</LinkButton>
            <LinkButton to="/products/privexa-studio" size="lg" variant="secondary">Explore Studio</LinkButton>
          </>
        }
        aside={<StudioVisual />}
      />
      <Section tone="white">
        <SectionHeading eyebrow="Benefits" title="Everything you need to go from first request to approved access." />
        <div className="mt-12">
          <FeatureGrid
            cols={4}
            items={[
              { icon: Repeat, title: 'Less repeated development', body: 'Build against one consistent interface instead of a custom one per system.' },
              { icon: Search, title: 'Explore capabilities', body: 'See supported resource types and capabilities for each simulated system.' },
              { icon: FlaskConical, title: 'Synthetic test data', body: 'Test against realistic, entirely synthetic patient records.' },
              { icon: CheckCircle2, title: 'Validate requests', body: 'See validation results for each request and response.' },
              { icon: Bug, title: 'Debug with request IDs', body: 'Every call returns a request ID, duration and clear errors.' },
              { icon: KeyRound, title: 'Understand access', body: 'Know which scopes and approvals your application needs.' },
              { icon: ListChecks, title: 'Track access requests', body: 'Follow each request from draft to decision.' },
              { icon: Rocket, title: 'Prepare to connect', body: 'Be ready when a provider integration becomes available.' },
            ]}
          />
        </div>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeading eyebrow="What to expect" title="One integration is a starting point, not a guarantee." />
          <div className="space-y-5 text-[15.5px] leading-relaxed text-muted">
            <p>Integrating with Privexa gives you a consistent way to work with supported systems. It does not by itself grant access to any hospital's data.</p>
            <p>Actual connectivity depends on the systems a provider runs, the provider's authorization, commercial arrangements and the applicable access conditions. Every application's access is scoped, reviewed and recorded.</p>
            <Note>In the demonstration, MetroCare Medical Center and Sunrise General Hospital are fictional, simulated endpoints — not provider partners.</Note>
          </div>
        </div>
      </Section>
      <Callout title="Start building in the sandbox." body="Register a demo application, explore the API and run your first request against synthetic data." cta="Open the Vendor Workspace" to="/app/vendor" />
    </>
  )
}
