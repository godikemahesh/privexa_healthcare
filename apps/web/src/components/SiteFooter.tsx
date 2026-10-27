import { Link } from 'react-router-dom'
import { PrivexaLogo } from '../brand/Logo'
import { site } from '../lib/site'

const columns = [
  {
    title: 'Products',
    links: [
      { to: '/products/privexa-connect', label: 'Privexa Connect' },
      { to: '/products/privexa-trust', label: 'Privexa Trust' },
      { to: '/products/privexa-studio', label: 'Privexa Studio' },
      { to: '/integrations', label: 'Marketplace' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { to: '/solutions/providers', label: 'For Providers' },
      { to: '/solutions/vendors', label: 'For Vendors' },
      { to: '/integrations', label: 'Integrations' },
      { to: '/demo', label: 'Interactive demo' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/security', label: 'Security & trust' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 text-navy-200">
      <div className="container-x grid gap-12 py-16 lg:grid-cols-[1.3fr_2fr]">
        <div className="max-w-sm">
          <PrivexaLogo tone="white" size={28} />
          <p className="mt-5 text-[14px] leading-relaxed text-navy-300">
            Healthcare connectivity for a more trusted, connected future. Privexa — Private Next Gen AI.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-navy-700 px-3 py-1 text-[12px] text-navy-300">
            <span className="size-1.5 rounded-full bg-teal-400" aria-hidden />
            {site.status}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((c) => (
            <div key={c.title}>
              <p className="text-[13px] font-medium text-white">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-[14px] text-navy-300 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-navy-800">
        <div className="container-x flex flex-col gap-2 py-6 text-[12.5px] text-navy-400 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Privexa. All rights reserved.</p>
          <p>Demonstrations use fictional organizations and synthetic data only.</p>
        </div>
      </div>
    </footer>
  )
}
