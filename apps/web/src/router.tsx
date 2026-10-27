import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  AppWindow,
  Inbox,
  ShieldCheck,
  ScrollText,
  Activity,
  Settings as SettingsIcon,
  Users,
  Network,
  Terminal,
  FlaskConical,
  BookOpen,
} from 'lucide-react'
import { SiteLayout } from './components/SiteLayout'
import { AppShell, RequireRole, type NavItem } from './components/app/AppShell'
import { LoadingRows } from './components/states'
import { RouteError } from './components/RouteError'
import Home from './pages/site/Home'
import { Providers, SolutionsOverview, Vendors } from './pages/site/Solutions'
import { Connect, ProductsOverview, Studio, Trust } from './pages/site/Products'
import Integrations from './pages/site/Integrations'
import { About, Privacy, Security, Terms } from './pages/site/Company'
import Contact from './pages/site/Contact'
import DemoLanding, { NotFound, SignIn } from './pages/site/Demo'

// Workspaces are split out of the marketing bundle.
const ProviderOverview = lazy(() => import('./pages/app/provider/Overview'))
const Systems = lazy(() => import('./pages/app/provider/Systems'))
const ProviderApplications = lazy(() => import('./pages/app/provider/Applications'))
const ProviderRequests = lazy(() => import('./pages/app/provider/Requests'))
const Policies = lazy(() => import('./pages/app/provider/Policies'))
const Patients = lazy(() => import('./pages/app/provider/Patients'))
const Health = lazy(() => import('./pages/app/provider/Health'))
const AuditTrail = lazy(() => import('./pages/app/shared/AuditTrail'))
const Settings = lazy(() => import('./pages/app/shared/Settings'))
const VendorOverview = lazy(() => import('./pages/app/vendor/Overview'))
const VendorApplications = lazy(() => import('./pages/app/vendor/Applications'))
const VendorDirectory = lazy(() => import('./pages/app/vendor/Directory'))
const Explorer = lazy(() => import('./pages/app/vendor/Explorer'))
const Sandbox = lazy(() => import('./pages/app/vendor/Sandbox'))
const VendorRequests = lazy(() => import('./pages/app/vendor/Requests'))
const Docs = lazy(() => import('./pages/app/vendor/Docs'))
const DemoWorkspace = lazy(() => import('./pages/app/DemoWorkspace'))

const lazyPage = (node: ReactNode) => <Suspense fallback={<LoadingRows rows={6} />}>{node}</Suspense>

const providerNav: NavItem[] = [
  { to: '/app/provider', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/provider/systems', label: 'Connected Systems', icon: Server },
  { to: '/app/provider/applications', label: 'Applications', icon: AppWindow },
  { to: '/app/provider/requests', label: 'Access Requests', icon: Inbox },
  { to: '/app/provider/policies', label: 'Policies', icon: ShieldCheck },
  { to: '/app/provider/patients', label: 'Patient Matching', icon: Users },
  { to: '/app/provider/audit', label: 'Audit Trail', icon: ScrollText },
  { to: '/app/provider/health', label: 'Integration Health', icon: Activity },
  { to: '/app/provider/settings', label: 'Settings', icon: SettingsIcon },
]

const vendorNav: NavItem[] = [
  { to: '/app/vendor', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/vendor/applications', label: 'My Applications', icon: AppWindow },
  { to: '/app/vendor/directory', label: 'Integration Directory', icon: Network },
  { to: '/app/vendor/explorer', label: 'API Explorer', icon: Terminal },
  { to: '/app/vendor/sandbox', label: 'Sandbox', icon: FlaskConical },
  { to: '/app/vendor/requests', label: 'Access Requests', icon: Inbox },
  { to: '/app/vendor/audit', label: 'Audit Activity', icon: ScrollText },
  { to: '/app/vendor/docs', label: 'Documentation', icon: BookOpen },
  { to: '/app/vendor/settings', label: 'Settings', icon: SettingsIcon },
]

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/solutions', element: <SolutionsOverview /> },
      { path: '/solutions/providers', element: <Providers /> },
      { path: '/solutions/vendors', element: <Vendors /> },
      { path: '/products', element: <ProductsOverview /> },
      { path: '/products/privexa-connect', element: <Connect /> },
      { path: '/products/privexa-trust', element: <Trust /> },
      { path: '/products/privexa-studio', element: <Studio /> },
      { path: '/integrations', element: <Integrations /> },
      { path: '/security', element: <Security /> },
      { path: '/about', element: <About /> },
      { path: '/contact', element: <Contact /> },
      { path: '/demo', element: <DemoLanding /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/terms', element: <Terms /> },
      { path: '/signin', element: <SignIn /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/demo/workspace',
    errorElement: <RouteError />,
    element: <RequireRole roles={['demo_admin']}>{lazyPage(<DemoWorkspace />)}</RequireRole>,
  },
  {
    path: '/app/provider',
    errorElement: <RouteError />,
    element: (
      <RequireRole roles={['provider_admin', 'demo_admin']}>
        <AppShell title="Privexa for Providers" nav={providerNav} switchTo={{ role: 'vendor_dev', label: 'Switch to vendor demo', to: '/app/vendor' }} />
      </RequireRole>
    ),
    children: [
      { index: true, element: lazyPage(<ProviderOverview />) },
      { path: 'systems', element: lazyPage(<Systems />) },
      { path: 'applications', element: lazyPage(<ProviderApplications />) },
      { path: 'requests', element: lazyPage(<ProviderRequests />) },
      { path: 'policies', element: lazyPage(<Policies />) },
      { path: 'patients', element: lazyPage(<Patients />) },
      { path: 'audit', element: lazyPage(<AuditTrail />) },
      { path: 'health', element: lazyPage(<Health />) },
      { path: 'settings', element: lazyPage(<Settings />) },
    ],
  },
  {
    path: '/app/vendor',
    errorElement: <RouteError />,
    element: (
      <RequireRole roles={['vendor_dev', 'demo_admin']}>
        <AppShell title="Privexa for Vendors" nav={vendorNav} switchTo={{ role: 'provider_admin', label: 'Switch to provider demo', to: '/app/provider' }} />
      </RequireRole>
    ),
    children: [
      { index: true, element: lazyPage(<VendorOverview />) },
      { path: 'applications', element: lazyPage(<VendorApplications />) },
      { path: 'directory', element: lazyPage(<VendorDirectory />) },
      { path: 'explorer', element: lazyPage(<Explorer />) },
      { path: 'sandbox', element: lazyPage(<Sandbox />) },
      { path: 'requests', element: lazyPage(<VendorRequests />) },
      { path: 'audit', element: lazyPage(<AuditTrail title="Audit activity" description="Audit events for your applications’ requests, with anchor status and integrity verification." />) },
      { path: 'docs', element: lazyPage(<Docs />) },
      { path: 'settings', element: lazyPage(<Settings />) },
    ],
  },
])
