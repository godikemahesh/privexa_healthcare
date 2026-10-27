import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Hospital } from 'lucide-react'
import { api, type Page } from '../../../lib/api'
import type { AccessRequest, Organization } from '../../../lib/types'
import { Badge, LinkButton, SimulatedTag } from '../../../components/ui'
import { ErrorState, LoadingRows } from '../../../components/states'
import { PageHeader, StatusBadge } from '../../../components/app/kit'

export default function VendorDirectory() {
  const orgs = useQuery({ queryKey: ['organizations'], queryFn: () => api<Organization[]>('/organizations') })
  const reqs = useQuery({ queryKey: ['access-requests', 'mine-all'], queryFn: () => api<Page<AccessRequest>>('/access-requests?page_size=100') })
  return (
    <div className="space-y-6">
      <PageHeader title="Integration directory" description="Simulated hospital systems available in the demonstration, what they support, and where your applications stand." />
      {orgs.isLoading && <LoadingRows />}
      {orgs.error && <ErrorState error={orgs.error} onRetry={() => orgs.refetch()} />}
      <div className="grid gap-5 xl:grid-cols-2">
        {orgs.data?.map((o) => {
          const mine = (reqs.data?.items ?? []).filter((r) => r.organization_id === o.id)
          return (
            <article key={o.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-navy-50 text-navy-600"><Hospital className="size-5" strokeWidth={1.6} /></span>
                  <div>
                    <h2 className="text-[17px] font-semibold">{o.name}</h2>
                    <p className="text-[13px] text-muted">{o.system_type}</p>
                  </div>
                </div>
                <SimulatedTag label="Simulated endpoint" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                <Badge tone="teal">HL7® FHIR® {o.fhir_version}</Badge>
                {o.sandbox_available ? <Badge tone="success" dot>Sandbox available</Badge> : <Badge>Sandbox unavailable</Badge>}
              </div>
              <p className="mt-4 text-[13px] font-medium text-navy-700">Available resource types</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {o.resource_types.map((r) => (
                  <span key={r} className="rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[11.5px] text-navy-700">{r}</span>
                ))}
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[13px] font-medium text-navy-700">Your connection requests</p>
                {mine.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {mine.map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-[13px]">
                        <span>{r.application_name}</span>
                        <StatusBadge status={r.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[13px] text-muted">None yet.</p>
                )}
                <div className="mt-3">
                  <LinkButton to={`/app/vendor/requests?org=${o.id}`} size="sm" variant="secondary" arrow>Request access</LinkButton>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <p className="text-[12.5px] text-muted">
        These are fictional organizations, not provider partners. Approved access in the demo is granted by a demo administrator. <Link to="/solutions/vendors" className="text-teal-700 hover:underline">What real connectivity involves</Link>
      </p>
    </div>
  )
}
