import { AlertTriangle, ArrowRight, CalendarCheck, CheckCheck, Clock, Hourglass, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { LiveDot, PageHeader } from '../../components/admin/AdminUI'
import BookingDetailModal from '../../components/admin/BookingDetailModal'
import { Alert, EmptyState, LoadingBlock, StatusBadge, cn } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useLiveEvents } from '../../hooks/useLiveEvents'
import { adminApi } from '../../lib/api'
import { baht, thaiDateLong } from '../../lib/format'

export default function Overview() {
  const [date, setDate] = useState('')
  const { data, loading, error, reload } = useAsync(() => adminApi.dashboard(date || undefined), [date])
  const live = useLiveEvents(() => reload(true))
  const [openId, setOpenId] = useState<string | null>(null)

  const cards = data ? [
    { label: 'คิวทั้งหมดวันนี้', value: data.total_today, icon: CalendarCheck, tone: 'bg-forest-800 text-gold-300' },
    { label: 'รอยืนยัน', value: data.pending, icon: Hourglass, tone: 'bg-amber-100 text-amber-700' },
    { label: 'ยืนยันแล้ว', value: data.confirmed, icon: Clock, tone: 'bg-sky-100 text-sky-700' },
    { label: 'กำลังรับบริการ', value: data.in_progress_guests, suffix: 'ท่าน', icon: Users, tone: 'bg-violet-100 text-violet-700' },
    { label: 'เสร็จสิ้น', value: data.completed, icon: CheckCheck, tone: 'bg-forest-100 text-forest-700' },
    { label: 'รายได้รวมประจำวัน', value: baht(data.revenue), icon: Wallet, tone: 'bg-gold-200 text-gold-700', sub: `คาดการณ์ทั้งวัน ${baht(data.expected_revenue)}` },
  ] : []

  return (
    <>
      <PageHeader title="ภาพรวม" subtitle={data ? thaiDateLong(data.date) : undefined}>
        <LiveDot connected={live} />
        <input type="date" className="input w-auto py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} aria-label="เลือกวันที่" />
      </PageHeader>

      {loading && !data && <LoadingBlock />}
      {error && <Alert tone="error" title="โหลดข้อมูลไม่สำเร็จ" onRetry={() => reload()}>{error}</Alert>}

      {data && (
        <div className="space-y-6">
          {data.pending_all_upcoming > 0 && (
            <Link to="/admin/bookings?status=pending" className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 hover:bg-amber-100">
              <span className="flex items-center gap-2"><AlertTriangle className="size-4" />มีการจองรอยืนยันทั้งหมด {data.pending_all_upcoming} รายการ</span>
              <ArrowRight className="size-4" />
            </Link>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c, i) => (
              <div key={c.label} className="card flex items-center gap-4 p-5 animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', c.tone)}><c.icon className="size-5" /></span>
                <div className="min-w-0">
                  <p className="text-sm text-forest-500">{c.label}</p>
                  <p className="truncate text-2xl font-semibold text-forest-900">{c.value}{c.suffix && <span className="ml-1 text-sm font-normal text-forest-500">{c.suffix}</span>}</p>
                  {c.sub && <p className="text-xs text-forest-400">{c.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">คิวถัดไป</h2>
              <Link to="/admin/queue" className="btn-ghost btn-sm">จัดการคิว<ArrowRight className="size-3.5" /></Link>
            </div>
            {data.upcoming.length === 0 ? <EmptyState title="ไม่มีคิวที่รอให้บริการ" /> : (
              <ul className="divide-y divide-cream-200">
                {data.upcoming.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => setOpenId(b.id)} className="flex w-full flex-wrap items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-cream-100">
                      <span className="w-14 font-mono text-sm font-semibold text-gold-700">{b.queue_code}</span>
                      <span className="w-24 text-sm">{b.start_time}–{b.end_time}</span>
                      <span className="min-w-32 flex-1"><span className="block text-sm font-medium">{b.customer_name}{b.guests > 1 && <span className="text-forest-500"> ({b.guests} ท่าน)</span>}</span><span className="block text-xs text-forest-500">{b.service_names}</span></span>
                      <StatusBadge status={b.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-forest-400">รับลูกค้าได้พร้อมกันสูงสุด {data.capacity_per_slot} ท่านต่อช่วงเวลา (หมอนวดพร้อมให้บริการ {data.active_therapists} คน) • ยกเลิกวันนี้ {data.cancelled} รายการ</p>
        </div>
      )}
      <BookingDetailModal bookingId={openId} onClose={() => setOpenId(null)} onChanged={() => reload(true)} />
    </>
  )
}
