// Public site configuration. Contact details stay empty until verified — set them via env.
export const site = {
  name: 'Privexa',
  url: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:5173',
  contactEmail: (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ?? '',
  status: 'Early access · Demonstration environment',
}

export const nav = {
  solutions: [
    { to: '/solutions/providers', title: 'Privexa for Providers', desc: 'Connect existing systems and control application access.' },
    { to: '/solutions/vendors', title: 'Privexa for Vendors', desc: 'Discover integrations, test and request access.' },
    { to: '/solutions', title: 'All solutions', desc: 'How Privexa serves each healthcare stakeholder.' },
  ],
  products: [
    { to: '/products/privexa-connect', title: 'Privexa Connect', desc: 'Standardized connectivity to supported systems.' },
    { to: '/products/privexa-trust', title: 'Privexa Trust', desc: 'Identity, access decisions and audit evidence.' },
    { to: '/products/privexa-studio', title: 'Privexa Studio', desc: 'Docs, sandbox and debugging for developers.' },
    { to: '/integrations', title: 'Privexa Marketplace', desc: 'Curated directory of systems and applications.' },
  ],
}
