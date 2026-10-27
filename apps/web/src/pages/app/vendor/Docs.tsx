import { useState } from 'react'
import clsx from 'clsx'
import { useStudioEndpoints, schemaFields, pythonExample, jsExample } from '../../../lib/openapi'
import { ErrorState, LoadingRows } from '../../../components/states'
import { CopyButton, Mono, PageHeader, Panel } from '../../../components/app/kit'
import { MethodTag } from './Explorer'
import { LinkButton } from '../../../components/ui'

const ERRORS = [
  ['401 unauthenticated / invalid_client', 'No session, or the client ID and secret do not match. Check the X-Client-Id and X-Client-Secret headers.'],
  ['403 forbidden', 'Your account or application is not allowed to perform this action (for example, sending requests for another vendor’s application).'],
  ['409 link_not_confirmed', 'The cross-hospital patient link has not been confirmed by an authorized reviewer.'],
  ['422 validation_error', 'The request body or parameters are invalid. The details array lists each field and message.'],
  ['429 rate_limited', 'Too many requests in a short period. Wait and retry with backoff.'],
  ['Decision: deny', 'Not an HTTP error. The response explains why: no approved access, purpose mismatch, out-of-scope resource, or a provider policy (e.g. consent).'],
  ['errors[].code = timeout / upstream_unavailable', 'A hospital system did not respond after retries. Other hospitals’ results are still returned.'],
  ['validation[].invalid > 0', 'The hospital returned resources that failed FHIR structural validation. They are excluded from the timeline.'],
]

const FHIR_EXAMPLE = {
  resourceType: 'Observation',
  id: 'example-heart-rate',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }], text: 'Heart rate' },
  subject: { reference: 'Patient/<synthetic id>' },
  effectiveDateTime: '2026-09-02T10:00:00Z',
  valueQuantity: { value: 72, unit: '/min', system: 'http://unitsofmeasure.org', code: '/min' },
}

export default function Docs() {
  const eps = useStudioEndpoints()
  const [lang, setLang] = useState<'python' | 'js'>('python')
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Privexa Studio" title="Documentation" description="Generated from the live API contract, so these examples always match what the backend accepts." actions={<LinkButton to="/app/vendor/explorer" variant="secondary">Open API Explorer</LinkButton>} />
      <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
        <nav className="hidden h-fit space-y-1 xl:sticky xl:top-6 xl:block" aria-label="On this page">
          {['getting-started', 'authentication', ...(eps.data?.endpoints.map((e) => e.id) ?? []), 'fhir', 'errors'].map((s) => (
            <a key={s} href={`#${encodeURIComponent(s)}`} className="block truncate rounded px-2 py-1 text-[13px] text-navy-600 hover:bg-navy-50 hover:text-navy-900">
              {eps.data?.endpoints.find((e) => e.id === s)?.title ?? { 'getting-started': 'Getting started', authentication: 'Authentication', fhir: 'FHIR resources', errors: 'Errors' }[s]}
            </a>
          ))}
        </nav>
        <div className="space-y-6">
          <Panel title="Getting started">
            <div id="getting-started" className="space-y-3 text-[14.5px] leading-relaxed text-navy-700">
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>Register an application in <strong>My applications</strong> and store the development client secret securely.</li>
                <li>Find a synthetic patient with <Mono>GET /api/v1/sandbox/patients</Mono>.</li>
                <li>Request access to a simulated organization. A demo administrator reviews it.</li>
                <li>Send <Mono>POST /api/v1/data-requests</Mono>. Inspect the decision, validation results and timeline.</li>
                <li>Use the returned request ID to find the audit event and verify its anchor.</li>
              </ol>
              <p className="text-[13px] text-muted">All endpoints and data in this environment are simulated. Base URL for local development: <Mono>http://127.0.0.1:8000</Mono></p>
            </div>
          </Panel>
          <Panel title="Authentication">
            <div id="authentication" className="space-y-3 text-[14.5px] leading-relaxed text-navy-700">
              <p>Applications authenticate with development credentials sent as headers on each request:</p>
              <pre className="rounded-lg bg-bg p-3 font-mono text-[12.5px]">X-Client-Id: pvx_dev_…{'\n'}X-Client-Secret: pvx_sk_dev_…</pre>
              <p>Send these only from server-side code. Workspace pages (Sandbox, Explorer) use your signed-in session instead. Privexa stores only a hash of each secret; rotate it from <strong>My applications</strong> if exposed.</p>
            </div>
          </Panel>

          {eps.isLoading && <LoadingRows />}
          {eps.error && <ErrorState error={eps.error} />}
          {eps.data?.endpoints.map((e) => (
            <Panel
              key={e.id}
              title={<span id={e.id} className="flex flex-wrap items-center gap-2"><MethodTag m={e.method} /> <span>{e.title}</span></span>}
              description={<Mono>{e.path}</Mono>}
            >
              <p className="text-[14px] leading-relaxed text-navy-700">{e.description}</p>
              {e.params.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[13px] font-medium text-navy-700">Parameters</p>
                  <ul className="space-y-1 text-[13px]">
                    {e.params.map((p) => <li key={p.name}><Mono>{p.name}</Mono> <span className="text-muted">({p.in}{p.required ? ', required' : ''}) {p.schema?.type ?? ''}</span></li>)}
                  </ul>
                </div>
              )}
              {e.body && eps.data && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[13px] font-medium text-navy-700">Body</p>
                  <ul className="space-y-1 text-[13px]">
                    {schemaFields(eps.data.spec, e.body).map((f) => <li key={f.name}><Mono>{f.name}</Mono> <span className="text-muted">{f.type}{f.required ? ' · required' : ''}</span></li>)}
                  </ul>
                </div>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-navy-800 bg-navy-900 px-3 py-1.5">
                  <div className="flex gap-1">
                    {(['python', 'js'] as const).map((l) => (
                      <button key={l} onClick={() => setLang(l)} className={clsx('rounded px-2 py-0.5 text-[12px]', lang === l ? 'bg-navy-700 text-white' : 'text-navy-300')}>{l === 'python' ? 'Python' : 'JavaScript'}</button>
                    ))}
                  </div>
                  <CopyButton value={lang === 'python' ? pythonExample(e) : jsExample(e)} />
                </div>
                <pre className="overflow-x-auto rounded-b-lg border border-navy-800 bg-navy-950 p-4 font-mono text-[12px] leading-[1.6] text-navy-100">{lang === 'python' ? pythonExample(e) : jsExample(e)}</pre>
              </div>
            </Panel>
          ))}

          <Panel title="FHIR resource example">
            <div id="fhir">
              <p className="mb-3 text-[14px] text-navy-700">Simulated hospitals serve HL7® FHIR® R4 resources: Patient, Encounter, Observation, Condition, MedicationRequest, AllergyIntolerance, Immunization, Procedure and DiagnosticReport. Privexa validates their structure and returns a normalized timeline with the source of each item.</p>
              <pre className="overflow-x-auto rounded-lg border border-navy-800 bg-navy-950 p-4 font-mono text-[12px] leading-[1.6] text-navy-100">{JSON.stringify(FHIR_EXAMPLE, null, 2)}</pre>
            </div>
          </Panel>
          <Panel title="Errors and how to resolve them" padded={false}>
            <dl id="errors" className="divide-y divide-line">
              {ERRORS.map(([k, v]) => (
                <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[280px_1fr]">
                  <dt><Mono>{k}</Mono></dt>
                  <dd className="text-[13.5px] text-navy-700">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}
