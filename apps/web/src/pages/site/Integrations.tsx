import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Brain, Hospital, Search } from 'lucide-react'
import { Seo } from '../../components/Seo'
import { PageHero, Section, Note } from '../../components/PageBlocks'
import { Badge, LinkButton, SimulatedTag } from '../../components/ui'
import { ErrorState, Skeleton } from '../../components/states'
import { api } from '../../lib/api'

type Directory = {
  systems: { id: string; name: string; system_type: string; fhir_version: string; resource_types: string[]; sandbox_available: boolean; simulated: boolean }[]
  applications: { id: string; name: string; vendor_name: string; use_case: string; description: string; requested_resource_types: string[]; simulated: boolean }[]
}

export default function Integrations() {
  const [tab, setTab] = useState<'systems' | 'applications'>('systems')
  const [q, setQ] = useState('')
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['directory'], queryFn: () => api<Directory>('/public/directory') })
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase())

  return (
    <>
      <Seo title="Integrations & Marketplace" description="A curated directory of supported simulated healthcare systems and example applications available in the Privexa demonstration." />
      <PageHero
        eyebrow="Integrations · Privexa Marketplace"
        title="A curated directory of systems and applications."
        lead="Discover the systems Privexa supports in the demonstration, what they can share, and example applications working with them. Every entry below is fictional and labeled as such."
        actions={
          <>
            <LinkButton to="/app/vendor/requests" size="lg" arrow>Request Access</LinkButton>
            <LinkButton to="/app/vendor/applications" size="lg" variant="secondary">Register an application</LinkButton>
          </>
        }
      />
      <Section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex rounded-lg border border-line bg-white p-1" role="tablist">
            {(['systems', 'applications'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-[14px] font-medium transition ${tab === t ? 'bg-navy-900 text-white' : 'text-navy-600 hover:text-navy-900'}`}
              >
                {t === 'systems' ? 'Provider systems' : 'Applications'}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search directory</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-300" />
            <input className="input pl-9" placeholder="Search by name or resource" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>

        <div className="mt-8">
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
            </div>
          )}
          {error && (
            <div className="card">
              <ErrorState error={error} onRetry={() => refetch()} />
            </div>
          )}
          {data && tab === 'systems' && (
            <div className="grid gap-4 md:grid-cols-2">
              {data.systems
                .filter((s) => !q || match(s.name) || s.resource_types.some(match))
                .map((s) => (
                  <article key={s.id} className="card p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
                          <Hospital className="size-5" strokeWidth={1.6} />
                        </span>
                        <div>
                          <h2 className="text-[18px] font-semibold">{s.name}</h2>
                          <p className="text-[13px] text-muted">{s.system_type}</p>
                        </div>
                      </div>
                      {s.simulated && <SimulatedTag label="Fictional · Simulated" />}
                    </div>
                    <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-[13.5px]">
                      <div>
                        <dt className="text-muted">Standard</dt>
                        <dd className="mt-0.5 font-medium text-navy-900">HL7® FHIR® {s.fhir_version}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Sandbox</dt>
                        <dd className="mt-0.5">{s.sandbox_available ? <Badge tone="success" dot>Available</Badge> : <Badge>Unavailable</Badge>}</dd>
                      </div>
                    </dl>
                    <p className="mt-5 text-[13px] text-muted">Available resource types</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.resource_types.map((r) => (
                        <span key={r} className="rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[11.5px] text-navy-700">{r}</span>
                      ))}
                    </div>
                  </article>
                ))}
            </div>
          )}
          {data && tab === 'applications' && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.applications
                .filter((a) => !q || match(a.name) || match(a.vendor_name) || a.requested_resource_types.some(match))
                .map((a) => (
                  <article key={a.id} className="card flex flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                        <Brain className="size-5" strokeWidth={1.6} />
                      </span>
                      {a.simulated && <SimulatedTag label="Example" />}
                    </div>
                    <h2 className="mt-5 text-[17px] font-semibold">{a.name}</h2>
                    <p className="flex items-center gap-1.5 text-[13px] text-muted">
                      <Building2 className="size-3.5" /> {a.vendor_name}
                    </p>
                    <p className="mt-3 flex-1 text-[14px] leading-relaxed text-muted">{a.description}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {a.requested_resource_types.map((r) => (
                        <span key={r} className="rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[11.5px] text-navy-700">{r}</span>
                      ))}
                    </div>
                  </article>
                ))}
            </div>
          )}
        </div>
        <div className="mt-10">
          <Note>
            <strong className="text-navy-900">About this directory.</strong> This is a curated preview. Listings are fictional demonstration entries — not real hospitals, vendors or partnerships. A future Marketplace is planned to include verified listings, compatibility information and provider discovery.
          </Note>
        </div>
      </Section>
    </>
  )
}
