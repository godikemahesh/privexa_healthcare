import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: Kind; title: string; body?: string }

const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(Ctx)

const icons = { success: CheckCircle2, error: AlertTriangle, info: Info }
const colors = { success: 'text-success', error: 'text-danger', info: 'text-teal-700' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.kind]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20 }}
                className="card pointer-events-auto flex gap-3 p-3.5 shadow-[var(--shadow-lift)]"
                role={t.kind === 'error' ? 'alert' : 'status'}
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${colors[t.kind]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-navy-900">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-[13px] text-muted">{t.body}</p>}
                </div>
                <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="text-navy-300 hover:text-navy-600">
                  <X className="size-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
