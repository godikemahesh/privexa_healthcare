import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Copy, X } from 'lucide-react'
import { Badge, Button, type Tone } from '../ui'
import { useToast } from '../Toast'

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function StatCard({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'danger' | 'warning' | 'success'; icon?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className="text-navy-300">{icon}</span>}
      </div>
      <p className={clsx('mt-2 text-[28px] font-semibold tracking-tight', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-navy-900')}>{value}</p>
      {sub && <p className="mt-1 text-[12.5px] text-muted">{sub}</p>}
    </div>
  )
}

/* ---------- status badges ---------- */

const statusTone: Record<string, Tone> = {
  healthy: 'success', allow: 'success', approved: 'success', anchored: 'success', verified: 'success', success: 'success', active: 'success', confirmed: 'success',
  degraded: 'warning', partial: 'warning', pending: 'warning', submitted: 'info', under_review: 'warning', configured: 'neutral', draft: 'neutral', unknown: 'neutral', not_anchored: 'neutral', unverified: 'neutral',
  down: 'danger', deny: 'danger', rejected: 'danger', revoked: 'danger', failed: 'danger', failure: 'danger', mismatch: 'danger', error: 'danger', suspended: 'danger', withdrawn: 'danger',
}
const statusLabel: Record<string, string> = {
  allow: 'Allowed', deny: 'Denied', partial: 'Partially allowed', under_review: 'Under review', approved: 'Approved for demo', not_anchored: 'Not anchored',
  configured: 'Not yet tested', failure: 'Failed', success: 'Succeeded', error: 'Error',
}

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  const s = status ?? 'unknown'
  return (
    <Badge tone={statusTone[s] ?? 'neutral'} dot>
      {label ?? statusLabel[s] ?? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
    </Badge>
  )
}

/* ---------- table ---------- */

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string }

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode }) {
  if (!rows.length) return <>{empty}</>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-bg/60">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={clsx('px-5 py-2.5 text-[12px] font-medium uppercase tracking-wide text-navy-400', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={clsx('transition-colors', onRowClick && 'cursor-pointer hover:bg-teal-50/40 focus-within:bg-teal-50/40')}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-5 py-3 align-middle text-navy-800', c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-muted">
      <span>
        {total === 0 ? 'No results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 font-mono text-[12px]">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/* ---------- overlays ---------- */

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

export function Drawer({ open, onClose, title, children, width = 560 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEscape(open, onClose)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-navy-950/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl outline-none"
            style={{ maxWidth: width }}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[16px] font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-md p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-800" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEscape(open, onClose)
  const titleId = useId()
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div className="absolute inset-0 bg-navy-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="card relative max-h-[90vh] w-full overflow-y-auto shadow-2xl"
            style={{ maxWidth: width }}
            initial={{ y: 12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id={titleId} className="text-[16px] font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-md p-1 text-navy-400 hover:bg-navy-50" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line bg-bg/60 px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger, loading, children,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; children?: ReactNode }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-[14.5px] leading-relaxed text-navy-700">{body}</div>
      {children}
    </Modal>
  )
}

/* ---------- small pieces ---------- */

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx('font-mono text-[12px] text-navy-600', className)}>{children}</span>
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value).then(() => toast({ kind: 'success', title: 'Copied to clipboard' }), () => toast({ kind: 'error', title: 'Copy failed' }))}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-navy-500 hover:bg-navy-50 hover:text-navy-800"
      aria-label={label}
    >
      <Copy className="size-3.5" />
    </button>
  )
}

export function JsonView({ data, maxHeight = 360 }: { data: unknown; maxHeight?: number }) {
  return (
    <pre className="overflow-auto rounded-lg border border-navy-800 bg-navy-950 p-4 font-mono text-[12px] leading-[1.6] text-navy-100" style={{ maxHeight }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line rounded-lg border border-line">
      {items.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[150px_1fr] gap-3 px-3.5 py-2.5 text-[13.5px]">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-navy-900">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Chips<T extends string>({ options, value, onChange, disabled }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={clsx(
              'rounded-md border px-2.5 py-1 font-mono text-[12px] transition',
              on ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-line bg-white text-navy-600 hover:border-navy-200',
            )}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function Select({ label, value, onChange, options, id, className }: { label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; id?: string; className?: string }) {
  const gen = useId()
  const sid = id ?? gen
  return (
    <div className={className}>
      {label && <label htmlFor={sid} className="label">{label}</label>}
      <select id={sid} className="input pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export const fmtTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—')
export const shortHash = (h: string | null | undefined, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-6)}` : '—')
export const purposeLabel: Record<string, string> = { care_coordination: 'Care coordination', treatment: 'Treatment', research: 'Research', analytics: 'Analytics' }
export const PURPOSES = ['care_coordination', 'treatment', 'research', 'analytics'] as const
export const CLINICAL_TYPES = ['Encounter', 'Observation', 'Condition', 'MedicationRequest', 'AllergyIntolerance', 'Immunization', 'Procedure', 'DiagnosticReport'] as const

/** Fixed series colors per organization (validated pair: teal + indigo). */
export const ORG_COLORS: Record<string, string> = { metrocare: '#088D81', sunrise: '#5B5BD6' }
