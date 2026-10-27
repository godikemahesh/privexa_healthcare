import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, Hospital, Code2, Handshake, MessageSquare } from 'lucide-react'
import clsx from 'clsx'
import { Seo } from '../../components/Seo'
import { Button } from '../../components/ui'
import { post, errorMessage, ApiError } from '../../lib/api'

const types = [
  { id: 'provider', icon: Hospital, label: 'Provider integration', hint: 'Hospitals, clinics, diagnostic providers' },
  { id: 'vendor', icon: Code2, label: 'Vendor / developer', hint: 'HMS/EHR, healthcare AI and SaaS teams' },
  { id: 'partnership', icon: Handshake, label: 'Partnership', hint: 'Technology and ecosystem partners' },
  { id: 'general', icon: MessageSquare, label: 'General', hint: 'Anything else' },
] as const
type InquiryType = (typeof types)[number]['id']

type Result = { id: string; stored: boolean; delivered: boolean; delivery: 'none' | 'smtp' | 'webhook'; message: string }

export default function Contact() {
  const [params] = useSearchParams()
  const initial = (types.find((t) => t.id === params.get('type'))?.id ?? 'provider') as InquiryType
  const [type, setType] = useState<InquiryType>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const m = useMutation({
    mutationFn: (body: Record<string, string>) => post<Result>('/contact', body),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422 && Array.isArray(e.details)) {
        const fe: Record<string, string> = {}
        for (const d of e.details as { field: string; message: string }[]) fe[d.field] = d.message
        setFieldErrors(fe)
      }
    },
  })

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]))
    const fe: Record<string, string> = {}
    if (!body.name) fe.name = 'Please enter your name'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email ?? '')) fe.email = 'Please enter a valid work email'
    if (!body.organization) fe.organization = 'Please enter your organization'
    if ((body.message ?? '').length < 10) fe.message = 'Please write at least a short message (10+ characters)'
    setFieldErrors(fe)
    if (Object.keys(fe).length) return
    m.mutate({ ...body, inquiry_type: type })
  }

  const systemsLabel = type === 'provider' ? 'Current systems (e.g. HMS/EHR in use)' : type === 'vendor' ? 'Your product' : 'Systems or product (optional)'

  return (
    <>
      <Seo title="Contact" description="Talk to Privexa about provider integrations, vendor development, partnerships or general questions." />
      <div className="container-x grid gap-14 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.08] sm:text-[48px]" style={{ letterSpacing: '-0.035em' }}>
            Let's talk about healthcare connectivity.
          </h1>
          <p className="lead mt-6">Tell us a little about your organization and what you'd like to achieve. We'll be straightforward about what Privexa supports today.</p>
          <div className="mt-10 rounded-xl border border-[#fef0c7] bg-[#fffaeb] p-5 text-[14px] leading-relaxed text-[#93370d]">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" /> Please don't share health information
            </p>
            <p className="mt-1.5">Never include patient records, identifiers or other sensitive health information in this form.</p>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          {m.isSuccess ? (
            <div className="py-10 text-center" role="status">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#ecfdf3] text-success">
                <CheckCircle2 className="size-6" />
              </span>
              <h2 className="mt-5 text-[22px] font-semibold">{m.data.delivered ? 'Message sent' : 'Message received'}</h2>
              <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">{m.data.message}</p>
              <p className="mt-3 font-mono text-[12px] text-navy-400">reference {m.data.id.slice(0, 8)}</p>
              <Button variant="secondary" className="mt-6" onClick={() => m.reset()}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <fieldset>
                <legend className="label">What's your inquiry about?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {types.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setType(t.id)}
                      aria-pressed={type === t.id}
                      className={clsx('flex items-start gap-3 rounded-lg border p-3 text-left transition', type === t.id ? 'border-teal-600 bg-teal-50/60 ring-4 ring-teal-100' : 'border-line hover:border-navy-200')}
                    >
                      <t.icon className={clsx('mt-0.5 size-4', type === t.id ? 'text-teal-700' : 'text-navy-400')} />
                      <span>
                        <span className="block text-[14px] font-medium text-navy-900">{t.label}</span>
                        <span className="block text-[12.5px] text-muted">{t.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field name="name" label="Name" error={fieldErrors.name} autoComplete="name" />
                <Field name="email" label="Work email" type="email" error={fieldErrors.email} autoComplete="email" />
                <Field name="organization" label="Organization" error={fieldErrors.organization} autoComplete="organization" />
                <Field name="role" label="Role" error={fieldErrors.role} autoComplete="organization-title" optional />
                <div className="sm:col-span-2">
                  <Field name="systems" label={systemsLabel} error={fieldErrors.systems} optional />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="message">Message</label>
                  <textarea id="message" name="message" rows={5} maxLength={4000} className="input resize-y" aria-invalid={!!fieldErrors.message} />
                  {fieldErrors.message && <p className="mt-1 text-[12.5px] text-danger">{fieldErrors.message}</p>}
                </div>
              </div>
              {/* Honeypot: hidden from people, tempting to bots. */}
              <div className="absolute left-[-9999px]" aria-hidden>
                <label>
                  Website <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {m.isError && !Object.keys(fieldErrors).length && (
                <p className="mt-5 rounded-lg bg-[#fef3f2] px-3 py-2.5 text-[13.5px] text-danger" role="alert">
                  Your message was not sent. {errorMessage(m.error)}
                </p>
              )}
              <div className="mt-6 flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-[12.5px] text-muted">By submitting, you agree to our handling of your details as described in the Privacy page.</p>
                <Button type="submit" size="lg" loading={m.isPending}>Send message</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

function Field({ name, label, error, type = 'text', optional, autoComplete }: { name: string; label: string; error?: string; type?: string; optional?: boolean; autoComplete?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label} {optional && <span className="font-normal text-navy-400">(optional)</span>}
      </label>
      <input id={name} name={name} type={type} className="input" maxLength={200} autoComplete={autoComplete} aria-invalid={!!error} />
      {error && <p className="mt-1 text-[12.5px] text-danger">{error}</p>}
    </div>
  )
}
