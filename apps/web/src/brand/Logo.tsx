import { MARK_PATH, MARK_VIEWBOX } from './markPath'

type Tone = 'brand' | 'white' | 'navy'

const markColor: Record<Tone, string> = { brand: 'var(--teal-600)', white: '#ffffff', navy: 'var(--navy-900)' }
const wordColor: Record<Tone, string> = { brand: 'var(--navy-900)', white: '#ffffff', navy: 'var(--navy-900)' }

export function PrivexaMark({ size = 28, tone = 'brand', className }: { size?: number; tone?: Tone; className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} width={size} height={size} className={className} aria-hidden="true">
      <path d={MARK_PATH} fill={markColor[tone]} />
    </svg>
  )
}

export function PrivexaLogo({ tone = 'brand', size = 26 }: { tone?: Tone; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Privexa">
      <PrivexaMark size={size} tone={tone} />
      <span
        className="font-semibold"
        style={{ color: wordColor[tone], fontSize: size * 0.78, letterSpacing: '-0.035em', lineHeight: 1 }}
      >
        privexa
      </span>
    </span>
  )
}
