import type { ReactNode } from 'react'
import { cn } from '../ui'

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-forest-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-forest-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', connected ? 'bg-forest-100 text-forest-700' : 'bg-cream-200 text-forest-500')} title={connected ? 'อัปเดตอัตโนมัติแบบ Real-time' : 'กำลังเชื่อมต่อ...'}>
      <span className={cn('size-2 rounded-full', connected ? 'animate-pulse bg-forest-500' : 'bg-forest-300')} />
      {connected ? 'Live' : 'Offline'}
    </span>
  )
}
