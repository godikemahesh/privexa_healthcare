import { AlertTriangle, Inbox, RotateCw } from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { ApiError, errorMessage } from '../lib/api'
import { Button } from './ui'

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-navy-100/70', className)} aria-hidden />
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const reqId = error instanceof ApiError ? error.requestId : undefined
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', compact ? 'p-5' : 'p-10')} role="alert">
      <span className="flex size-10 items-center justify-center rounded-full bg-[#fef3f2] text-danger">
        <AlertTriangle className="size-5" />
      </span>
      <p className="mt-3 text-[14.5px] font-medium text-navy-900">Couldn't load this</p>
      <p className="mt-1 max-w-md text-[13.5px] text-muted">{errorMessage(error)}</p>
      {reqId && <p className="mt-1 font-mono text-[11.5px] text-navy-400">request {reqId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-navy-50 text-navy-400">{icon ?? <Inbox className="size-5" />}</span>
      <p className="mt-3 text-[14.5px] font-medium text-navy-900">{title}</p>
      {body && <p className="mt-1 max-w-md text-[13.5px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
