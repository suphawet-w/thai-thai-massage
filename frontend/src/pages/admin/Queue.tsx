import { CheckCircle2, ListOrdered, Megaphone, Play, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { LiveDot, PageHeader } from '../../components/admin/AdminUI'
import BookingDetailModal from '../../components/admin/BookingDetailModal'
import { Alert, EmptyState, LoadingBlock, Spinner, StatusBadge, cn } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { useLiveEvents } from '../../hooks/useLiveEvents'
import { adminApi } from '../../lib/api'
import { thaiDateLong } from '../../lib/format'
import type { Booking } from '../../lib/types'

export default function Queue() {
  const toast = useToast()
  const [date, setDate] = useState('')
  const { data, loading, error, reload } = useAsync(() => adminApi.queue(date || undefined), [date])
  const live = useLiveEvents(() => reload(true))
  const [busy, setBusy] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const act = async (key: string, fn: () => Promise<Booking>, msg: (b: Booking) => string) => {
    setBusy(key)
    try {
      const b = await fn()
      toast.success(msg(b))
      await reload(true)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const st = data?.status
  const items = data?.items ?? []

  return (
    <>
      <PageHeader title="จัดการคิว" subtitle={data ? thaiDateLong(data.date) : undefined}>
        <LiveDot connected={live} />
        <input type="date" className="input w-auto py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} aria-label="เลือกวันที่" />
        <button className="btn-outline btn-sm" onClick={() => reload(true)}><RefreshCw className="size-3.5" />รีเฟรช</button>
      </PageHeader>

      {error && <Alert tone="error" title="โหลดคิวไม่สำเร็จ" onRetry={() => reload()}>{error}</Alert>}
      {loading && !data && <LoadingBlock />}

      {data && st && (
        <>
          {/* แผงเรียกคิว */}
          <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="relative overflow-hidden rounded-3xl bg-forest-800 p-6 text-cream-50 shadow-lg">
              <div className="absolute inset-0 bg-thai-pattern opacity-20" aria-hidden />
              <div className="relative flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-cream-200/70">กำลังเรียกคิว</p>
                  <p key={st.now_calling} className="mt-1 font-mono text-6xl font-semibold tracking-wider text-gold-300 animate-pop">{st.now_calling || '—'}</p>
                  <p className="mt-2 text-sm text-cream-200/80">คิวถัดไป: <span className="font-semibold text-cream-50">{st.next_queue || 'ไม่มี'}</span> • รอเรียก {st.waiting_count} คิว</p>
                </div>
                <button className="btn-gold px-7 py-4 text-base" disabled={busy === 'next' || !st.waiting_count}
                  onClick={() => act('next', () => adminApi.callNext(data.date), (b) => `เรียกคิว ${b.queue_code} คุณ${b.customer_name}`)}>
                  {busy === 'next' ? <Spinner className="size-5" /> : <Megaphone className="size-5" />}เรียกคิวถัดไป
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[['คิววันนี้', st.total_today], ['กำลังบริการ', st.serving.length], ['เสร็จแล้ว', st.completed]].map(([l, v]) => (
                <div key={l} className="card flex flex-col items-center justify-center p-4 text-center">
                  <p className="text-3xl font-semibold">{v}</p>
                  <p className="text-xs text-forest-500">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* รายการคิวเรียงตามเวลา */}
          <div className="card overflow-hidden">
            {items.length === 0 ? <EmptyState icon={<ListOrdered className="size-6" />} title="ยังไม่มีคิวในวันนี้" /> : (
              <ul className="divide-y divide-cream-200">
                {items.map((b) => {
                  const calling = b.queue_code === st.now_calling && b.status === 'confirmed'
                  return (
                    <li key={b.id} className={cn('flex flex-wrap items-center gap-4 px-4 py-4 transition-colors sm:px-5',
                      b.status === 'in_progress' && 'bg-violet-50/50', calling && 'bg-gold-200/40', b.status === 'completed' && 'opacity-60')}>
                      <button onClick={() => setOpenId(b.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                        <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl font-mono text-lg font-semibold',
                          calling ? 'bg-gold-500 text-forest-950 animate-pulse' : b.status === 'in_progress' ? 'bg-violet-600 text-white' : 'bg-cream-200 text-forest-800')}>
                          {b.queue_code}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{b.customer_name}{b.guests > 1 && <span className="text-sm text-forest-500"> • {b.guests} ท่าน</span>}</span>
                          <span className="block truncate text-sm text-forest-500">{b.service_names}{b.therapist_name && ` • หมอ${b.therapist_name}`}</span>
                          <span className="block text-sm font-medium text-forest-700">{b.start_time} – {b.end_time} น.</span>
                        </span>
                      </button>
                      <StatusBadge status={b.status} />
                      <div className="flex w-full gap-2 sm:w-auto">
                        {b.status === 'pending' && <button className="btn-outline btn-sm flex-1" disabled={!!busy} onClick={() => act(b.id, () => adminApi.updateStatus(b.id, 'confirmed'), (x) => `ยืนยัน ${x.queue_code} แล้ว`)}>{busy === b.id ? <Spinner className="size-3" /> : <CheckCircle2 className="size-3.5" />}ยืนยัน</button>}
                        {b.status === 'confirmed' && (
                          <>
                            <button className="btn-outline btn-sm flex-1" disabled={!!busy} onClick={() => act('c' + b.id, () => adminApi.callBooking(b.id), (x) => `เรียกคิว ${x.queue_code}`)}>{busy === 'c' + b.id ? <Spinner className="size-3" /> : <Megaphone className="size-3.5" />}เรียก</button>
                            <button className="btn-primary btn-sm flex-1" disabled={!!busy} onClick={() => act(b.id, () => adminApi.updateStatus(b.id, 'in_progress'), (x) => `เริ่มให้บริการ ${x.queue_code}`)}>{busy === b.id ? <Spinner className="size-3" /> : <Play className="size-3.5" />}เริ่มให้บริการ</button>
                          </>
                        )}
                        {b.status === 'in_progress' && <button className="btn-primary btn-sm flex-1" disabled={!!busy} onClick={() => act(b.id, () => adminApi.updateStatus(b.id, 'completed'), (x) => `${x.queue_code} ให้บริการเสร็จแล้ว`)}>{busy === b.id ? <Spinner className="size-3" /> : <CheckCircle2 className="size-3.5" />}เสร็จสิ้น</button>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
      <BookingDetailModal bookingId={openId} onClose={() => setOpenId(null)} onChanged={() => reload(true)} />
    </>
  )
}
