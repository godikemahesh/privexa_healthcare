import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { PrivexaMark } from '../brand/Logo'

/** Shown instead of a blank screen if a page fails to render. */
export function RouteError() {
  const err = useRouteError()
  const notFound = isRouteErrorResponse(err) && err.status === 404
  if (import.meta.env.DEV) console.error(err)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-center">
      <PrivexaMark size={40} />
      <h1 className="mt-6 text-[28px] font-semibold">{notFound ? "This page isn't connected." : 'Something went wrong on this page.'}</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted">
        {notFound ? "The page you were looking for doesn't exist." : 'Please reload the page. If it keeps happening, return home and try again.'}
      </p>
      <div className="mt-8 flex gap-3">
        <button onClick={() => window.location.reload()} className="rounded-lg bg-teal-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-teal-700">Reload</button>
        <Link to="/" reloadDocument className="rounded-lg border border-line bg-white px-4 py-2 text-[14px] font-medium text-navy-800 hover:bg-navy-50">Back to home</Link>
      </div>
    </div>
  )
}
