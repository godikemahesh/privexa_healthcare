import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]',
  secondary: 'bg-white text-navy-900 border border-line hover:border-navy-200 hover:bg-navy-50',
  ghost: 'text-navy-700 hover:bg-navy-50',
  dark: 'bg-navy-900 text-white hover:bg-navy-800',
  danger: 'bg-white text-danger border border-[#fecdca] hover:bg-[#fef3f2]',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-[14px] gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return clsx(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
    variants[variant],
    sizes[size],
    className,
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  arrow,
  className,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  arrow?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, clsx('group', className))}>
      {children}
      {arrow && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </Link>
  )
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-teal-700 hover:text-teal-800">
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

export type Tone = 'neutral' | 'teal' | 'success' | 'warning' | 'danger' | 'info'
const tones: Record<Tone, string> = {
  neutral: 'bg-navy-50 text-navy-600 border-navy-100',
  teal: 'bg-teal-50 text-teal-800 border-teal-100',
  success: 'bg-[#ecfdf3] text-success border-[#d1fadf]',
  warning: 'bg-[#fffaeb] text-warning border-[#fef0c7]',
  danger: 'bg-[#fef3f2] text-danger border-[#fee4e2]',
  info: 'bg-[#eff8ff] text-[#175cd3] border-[#d1e9ff]',
}

export function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

/** Marks anything that runs on fictional systems or synthetic data. */
export function SimulatedTag({ label = 'Simulated' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-dashed border-navy-200 bg-white px-1.5 py-px font-mono text-[10.5px] font-medium uppercase tracking-wider text-navy-500">
      {label}
    </span>
  )
}

export function SectionHeading({
  index,
  eyebrow,
  title,
  lead,
  align = 'left',
  dark,
}: {
  index?: string
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  align?: 'left' | 'center'
  dark?: boolean
}) {
  return (
    <div className={clsx('max-w-[760px]', align === 'center' && 'mx-auto text-center')}>
      <p className={clsx('eyebrow', dark && 'text-teal-300')}>
        {index && <span className={dark ? 'text-navy-300' : 'text-navy-300'}>{index} — </span>}
        {eyebrow}
      </p>
      <h2 className={clsx('h-section mt-4', dark && '!text-white')}>{title}</h2>
      {lead && <p className={clsx('lead mt-5', dark && '!text-navy-200')}>{lead}</p>}
    </div>
  )
}
