import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ORG_COLORS } from './kit'
import type { Organization } from '../../lib/types'

type Point = { bucket: string; organization_id: string; [k: string]: number | string | null }

/** Per-organization series over time: grouped bars for counts, lines for latency. Fixed colors per org; legend always shown. */
export function OrgSeriesChart({ series, orgs, metric, unit, height = 220 }: { series: Point[]; orgs: Pick<Organization, 'id' | 'slug' | 'name'>[]; metric: string; unit?: string; height?: number }) {
  const buckets = [...new Set(series.map((s) => s.bucket))].sort()
  const rows = buckets.map((b) => {
    const row: Record<string, string | number | null> = { bucket: b }
    for (const o of orgs) {
      const p = series.find((s) => s.bucket === b && s.organization_id === o.id)
      row[o.slug] = p ? (p[metric] as number | null) : metric === 'avg_latency_ms' ? null : 0
    }
    return row
  })
  const label = (b: string) => new Date(b).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const isCount = metric === 'requests' || metric === 'failures'
  const grid = <CartesianGrid stroke="var(--line)" vertical={false} />
  const xAxis = <XAxis dataKey="bucket" tickFormatter={label} tick={{ fontSize: 11, fill: 'var(--navy-400)' }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} minTickGap={24} />
  const yAxis = <YAxis tick={{ fontSize: 11, fill: 'var(--navy-400)' }} axisLine={false} tickLine={false} allowDecimals={!isCount} width={44} />
  const tooltip = {
    contentStyle: { borderRadius: 10, border: '1px solid var(--line)', fontSize: 12.5, boxShadow: '0 8px 24px -12px rgb(16 42 67 / 0.25)' },
    labelFormatter: (b: unknown) => new Date(String(b)).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    formatter: (v: unknown, name: unknown) => [v == null ? '—' : `${v}${unit ? ` ${unit}` : ''}`, orgs.find((o) => o.slug === name)?.name ?? String(name)] as [string, string],
  }

  if (!rows.length) return <p className="py-10 text-center text-[13.5px] text-muted">No connector activity in this window yet.</p>

  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-4" aria-label="Legend">
        {orgs.map((o) => (
          <span key={o.id} className="flex items-center gap-2 text-[12.5px] text-navy-700">
            <span className={isCount ? 'size-2.5 rounded-sm' : 'h-[2px] w-4 rounded'} style={{ background: ORG_COLORS[o.slug] ?? '#486581' }} />
            {o.name}
          </span>
        ))}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {isCount ? (
            <BarChart data={rows} margin={{ top: 6, right: 12, bottom: 0, left: -12 }} barGap={2} barCategoryGap="28%">
              {grid}
              {xAxis}
              {yAxis}
              <Tooltip cursor={{ fill: 'var(--navy-50)' }} {...tooltip} />
              {orgs.map((o) => (
                <Bar key={o.id} dataKey={o.slug} fill={ORG_COLORS[o.slug] ?? '#486581'} radius={[4, 4, 0, 0]} maxBarSize={28} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={rows} margin={{ top: 6, right: 12, bottom: 0, left: -12 }}>
              {grid}
              {xAxis}
              {yAxis}
              <Tooltip cursor={{ stroke: 'var(--navy-200)', strokeWidth: 1 }} {...tooltip} />
              {orgs.map((o) => (
                <Line key={o.id} type="monotone" dataKey={o.slug} stroke={ORG_COLORS[o.slug] ?? '#486581'} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 5, stroke: 'white', strokeWidth: 2 }} connectNulls />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {metric} per organization over time.{' '}
        {rows.map((r) => `${label(String(r.bucket))}: ${orgs.map((o) => `${o.name} ${r[o.slug] ?? 'none'}`).join(', ')}`).join('; ')}
      </figcaption>
    </figure>
  )
}
