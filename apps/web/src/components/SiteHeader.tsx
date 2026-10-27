import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import clsx from 'clsx'
import { PrivexaLogo } from '../brand/Logo'
import { LinkButton } from './ui'
import { nav } from '../lib/site'

type MenuKey = 'solutions' | 'products'

function Dropdown({ id, label, items, open, setOpen }: {
  id: MenuKey
  label: string
  items: { to: string; title: string; desc: string }[]
  open: MenuKey | null
  setOpen: (k: MenuKey | null) => void
}) {
  const isOpen = open === id
  return (
    <div className="relative" onMouseEnter={() => setOpen(id)} onMouseLeave={() => setOpen(null)}>
      <button
        className={clsx('flex h-9 items-center gap-1 rounded-md px-3 text-[14px] font-medium transition-colors', isOpen ? 'text-navy-900' : 'text-navy-600 hover:text-navy-900')}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setOpen(isOpen ? null : id)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(null)}
      >
        {label}
        <ChevronDown className={clsx('size-3.5 transition-transform', isOpen && 'rotate-180')} aria-hidden />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full pt-2">
          <div className="card w-[380px] p-2 shadow-[var(--shadow-lift)]" role="menu">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                role="menuitem"
                className="group block rounded-lg px-3 py-2.5 transition-colors hover:bg-teal-50"
                onClick={() => setOpen(null)}
              >
                <span className="block text-[14px] font-medium text-navy-900 group-hover:text-teal-800">{it.title}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{it.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const plainLinks = [
  { to: '/integrations', label: 'Integrations' },
  { to: '/security', label: 'Security' },
  { to: '/about', label: 'About' },
]

export function SiteHeader() {
  const [open, setOpen] = useState<MenuKey | null>(null)
  const [mobile, setMobile] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    setOpen(null)
    setMobile(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      ref={ref}
      className={clsx(
        'sticky top-0 z-40 border-b transition-colors duration-200',
        scrolled || mobile ? 'border-line bg-white/90 backdrop-blur-md' : 'border-transparent bg-bg',
      )}
    >
      <div className="container-x flex h-16 items-center justify-between">
        <Link to="/" className="shrink-0" aria-label="Privexa home">
          <PrivexaLogo size={26} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          <Dropdown id="solutions" label="Solutions" items={nav.solutions} open={open} setOpen={setOpen} />
          <Dropdown id="products" label="Products" items={nav.products} open={open} setOpen={setOpen} />
          {plainLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                clsx('flex h-9 items-center rounded-md px-3 text-[14px] font-medium transition-colors', isActive ? 'text-teal-700' : 'text-navy-600 hover:text-navy-900')
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/signin" className="px-3 text-[14px] font-medium text-navy-600 hover:text-navy-900">
            Sign in
          </Link>
          <LinkButton to="/demo" size="md" arrow>
            Explore the Demo
          </LinkButton>
        </div>

        <button
          className="flex size-10 items-center justify-center rounded-lg text-navy-800 lg:hidden"
          aria-label={mobile ? 'Close menu' : 'Open menu'}
          aria-expanded={mobile}
          onClick={() => setMobile((m) => !m)}
        >
          {mobile ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobile && (
        <div className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-line bg-white lg:hidden">
          <div className="container-x space-y-6 py-6">
            {(['solutions', 'products'] as const).map((k) => (
              <div key={k}>
                <p className="eyebrow mb-2">{k}</p>
                {nav[k].map((it) => (
                  <Link key={it.to} to={it.to} className="block py-2 text-[16px] font-medium text-navy-900">
                    {it.title}
                  </Link>
                ))}
              </div>
            ))}
            <div className="hairline pt-4">
              {plainLinks.map((l) => (
                <Link key={l.to} to={l.to} className="block py-2 text-[16px] font-medium text-navy-900">
                  {l.label}
                </Link>
              ))}
              <Link to="/contact" className="block py-2 text-[16px] font-medium text-navy-900">Contact</Link>
            </div>
            <div className="flex flex-col gap-2">
              <LinkButton to="/demo" size="lg" arrow>Explore the Demo</LinkButton>
              <LinkButton to="/signin" size="lg" variant="secondary">Sign in</LinkButton>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
