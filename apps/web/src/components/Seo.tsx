import { useLocation } from 'react-router-dom'
import { site } from '../lib/site'

/** React 19 hoists these tags into <head>. */
export function Seo({ title, description }: { title: string; description: string }) {
  const { pathname } = useLocation()
  const full = title === 'Privexa' ? 'Privexa | Healthcare Interoperability Platform' : `${title} | Privexa`
  const url = `${site.url}${pathname}`
  return (
    <>
      <title>{full}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
    </>
  )
}
