import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Renders children on a fixed-size design canvas, scaled to fit the available width. */
export function Stage({ width, height, children, className }: { width: number; height: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1.25, entry.contentRect.width / width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  return (
    <div ref={outer} className={className} style={{ height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative">
        {children}
      </div>
    </div>
  )
}
