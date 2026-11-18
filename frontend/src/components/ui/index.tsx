import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { BookingStatus } from '../../lib/types'

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} aria-hidden />
}

export function LoadingBlock({ text = 'กำลังโหลดข้อมูล...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-forest-500" role="status">
      <Spinner className="size-7 text-gold-500" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

type AlertTone = 'error' | 'success' | 'info' | 'warning'
const alertStyles: Record<AlertTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-forest-200 bg-forest-50 text-forest-800',
  info: 'border-cream-300 bg-cream-50 text-forest-700',
  warning: 'border-gold-300 bg-gold-200/40 text-gold-700',
}

export function Alert({ tone = 'info', title, children, onRetry }: { tone?: AlertTone; title?: string; children?: ReactNode; onRetry?: () => void }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in', alertStyles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
        {onRetry && (
          <button onClick={onRetry} className="mt-2 text-sm font-medium underline underline-offset-4">ลองอีกครั้ง</button>
        )}
      </div>
    </div>
  )
}

const statusStyles: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed: 'bg-sky-50 text-sky-700 ring-sky-200',
  in_progress: 'bg-violet-50 text-violet-700 ring-violet-200',
  completed: 'bg-forest-50 text-forest-700 ring-forest-200',
  cancelled: 'bg-red-50 text-red-600 ring-red-200',
}
export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  in_progress: 'กำลังให้บริการ',
  completed: 'ให้บริการเสร็จแล้ว',
  cancelled: 'ยกเลิก',
}

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', statusStyles[status], className)}>
      <span className={cn('size-1.5 rounded-full bg-current', status === 'in_progress' && 'animate-pulse')} />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-forest-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={cn('relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-cream-50 shadow-2xl animate-fade-up sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-300/70 bg-cream-50/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-forest-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-forest-500 hover:bg-cream-200" aria-label="ปิด"><X className="size-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      {icon && <div className="mb-2 rounded-full bg-cream-200 p-4 text-gold-600">{icon}</div>}
      <p className="font-medium text-forest-800">{title}</p>
      {children && <div className="max-w-sm text-sm text-forest-500">{children}</div>}
    </div>
  )
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1.5 text-xs text-red-600">{msg}</p>
}

export function SectionHeading({ eyebrow, title, children, center }: { eyebrow?: string; title: string; children?: ReactNode; center?: boolean }) {
  return (
    <div className={cn('mb-10', center && 'text-center')}>
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold text-forest-900 sm:text-3xl">{title}</h2>
      {children && <p className={cn('mt-3 text-forest-600', center && 'mx-auto max-w-2xl')}>{children}</p>}
      <div className={cn('mt-5 flex items-center gap-2', center && 'justify-center')}>
        <span className="h-px w-10 bg-gold-400" />
        <span className="size-1.5 rotate-45 bg-gold-500" />
        <span className="h-px w-10 bg-gold-400" />
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-forest-600' : 'bg-cream-300')}>
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-5.5' : 'left-0.5')} />
    </button>
  )
}
