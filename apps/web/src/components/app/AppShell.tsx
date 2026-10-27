import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { LogOut, Menu, X, FlaskConical, ArrowLeftRight } from 'lucide-react'
import clsx from 'clsx'
import { PrivexaLogo } from '../../brand/Logo'
import { roleLabel, useAuthActions, useMe } from '../../lib/auth'
import type { Role } from '../../lib/types'
import { ErrorState, Skeleton } from '../states'
import { ScrollToTop } from '../SiteLayout'

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data: me, isLoading, error, refetch } = useMe()
  const loc = useLocation()
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-40" />
      </div>
    )
  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  if (!me) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (!roles.includes(me.role))
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <p className="font-mono text-[13px] text-teal-700">403</p>
        <h1 className="mt-2 text-[26px] font-semibold">This workspace isn't available to your role</h1>
        <p className="mt-2 text-[14.5px] text-muted">You're signed in as a {roleLabel[me.role].toLowerCase()}.</p>
        <Link to={me.role === 'vendor_dev' ? '/app/vendor' : '/app/provider'} className="mt-6 text-[14.5px] font-medium text-teal-700 hover:underline">
          Go to your workspace
        </Link>
      </div>
    )
  return <>{children}</>
}

export function AppShell({ title, nav, switchTo }: { title: string; nav: NavItem[]; switchTo?: { role: Role; label: string; to: string } }) {
  const { data: me } = useMe()
  const { logout, demoLogin } = useAuthActions()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link to="/" aria-label="Privexa home">
          <PrivexaLogo size={24} />
        </Link>
      </div>
      <div className="px-5 pb-3">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-navy-400">{title}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label={title}>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors',
                isActive ? 'bg-teal-50 text-teal-800' : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900',
              )
            }
          >
            <n.icon className="size-[17px]" strokeWidth={1.75} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 border-t border-line p-4">
        <div className="rounded-lg border border-dashed border-navy-200 bg-bg px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-navy-700">
            <FlaskConical className="size-3.5 text-teal-600" /> Demonstration environment
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted">Fictional hospitals · synthetic data</p>
        </div>
        {me && (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[13px] font-semibold text-white">
              {me.name.replace(/^Dr\.\s*/, '').charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-navy-900">{me.name}</p>
              <p className="truncate text-[12px] text-muted">{roleLabel[me.role]}</p>
            </div>
            <button onClick={logout} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-800" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        )}
        {switchTo && (
          <button
            onClick={() => demoLogin(switchTo.role, switchTo.to)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-[12.5px] font-medium text-navy-600 hover:bg-navy-50"
          >
            <ArrowLeftRight className="size-3.5" /> {switchTo.label}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      <ScrollToTop />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-white lg:block">{sidebar}</aside>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <PrivexaLogo size={22} />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-navy-700" aria-label="Open navigation">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[272px] bg-white shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-md p-1 text-navy-400" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
