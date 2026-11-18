import { CalendarSearch, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { LiveDot, PageHeader } from '../../components/admin/AdminUI'
import BookingDetailModal from '../../components/admin/BookingDetailModal'
import { Alert, EmptyState, LoadingBlock, STATUS_LABEL, StatusBadge } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useLiveEvents } from '../../hooks/useLiveEvents'
import { adminApi } from '../../lib/api'
import { baht, formatPhone, thaiDateShort } from '../../lib/format'
import type { BookingStatus } from '../../lib/types'

export default function Bookings() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const date = params.get('date') ?? ''
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 1)
  const query = params.get('q') ?? ''

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v); else p.delete(k)
    if (k !== 'page') p.delete('page')
    setParams(p, { replace: true })
  }

  // ค้นหาแบบหน่วงเวลา (debounce) ขณะพิมพ์
  useEffect(() => {
    const t = setTimeout(() => { if (q !== query) set('q', q.trim()) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const { data, loading, error, reload } = useAsync(() => adminApi.bookings({ q: query, date, status, page, page_size: 15 }), [query, date, status, page])
  const { data: settings } = useAsync(() => adminApi.settings(), [])
  const live = useLiveEvents(() => reload(true))
  const [openId, setOpenId] = useState<string | null>(null)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const hasFilter = !!(query || date || status)

  return (
    <>
      <PageHeader title="รายการจอง" subtitle={data ? `ทั้งหมด ${data.total.toLocaleString('th-TH')} รายการ` : undefined}>
        <LiveDot connected={live} />
      </PageHeader>

      <div className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-forest-400" />
          <input className="input pl-10" placeholder="ค้นหาชื่อลูกค้า, Booking ID หรือเบอร์โทร" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        </div>
        <input type="date" className="input" value={date} onChange={(e) => set('date', e.target.value)} aria-label="กรองตามวันที่" />
        <select className="input" value={status} onChange={(e) => set('status', e.target.value)} aria-label="กรองตามสถานะ">
          <option value="">ทุกสถานะ</option>
          {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {hasFilter && <button className="btn-ghost" onClick={() => { setQ(''); setParams({}, { replace: true }) }}><X className="size-4" />ล้างตัวกรอง</button>}
      </div>

      {error && <Alert tone="error" title="โหลดรายการจองไม่สำเร็จ" onRetry={() => reload()}>{error}</Alert>}
      {loading && !data && <LoadingBlock />}

      {data && (
        <div className="card overflow-hidden">
          {data.items.length === 0 ? (
            <EmptyState icon={<CalendarSearch className="size-6" />} title="ไม่พบรายการจอง">{hasFilter ? 'ลองเปลี่ยนเงื่อนไขการค้นหา' : 'ยังไม่มีลูกค้าจองคิว'}</EmptyState>
          ) : (
            <>
              {/* ตาราง (จอใหญ่) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-cream-100 text-left text-xs text-forest-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Booking ID</th>
                      <th className="px-4 py-3 font-medium">ลูกค้า</th>
                      <th className="px-4 py-3 font-medium">บริการ</th>
                      <th className="px-4 py-3 font-medium">วัน / เวลา</th>
                      <th className="px-4 py-3 font-medium text-right">ราคา</th>
                      <th className="px-4 py-3 font-medium">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-cream-200 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                    {data.items.map((b) => (
                      <tr key={b.id} onClick={() => setOpenId(b.id)} className="cursor-pointer hover:bg-cream-50" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(b.id)}>
                        <td className="px-4 py-3"><span className="font-mono font-medium">{b.booking_id}</span><span className="block text-xs text-gold-700">{b.queue_code}</span></td>
                        <td className="px-4 py-3"><span className="font-medium">{b.customer_name}</span><span className="block text-xs text-forest-500">{formatPhone(b.customer_phone)}{b.guests > 1 && ` • ${b.guests} ท่าน`}</span></td>
                        <td className="max-w-56 px-4 py-3 text-forest-700">{b.service_names}</td>
                        <td className="whitespace-nowrap px-4 py-3">{thaiDateShort(b.service_date)}<span className="block text-xs text-forest-500">{b.start_time}–{b.end_time} น.</span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{baht(b.total_price)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* การ์ด (มือถือ) */}
              <ul className="divide-y divide-cream-200 md:hidden">
                {data.items.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => setOpenId(b.id)} className="w-full px-4 py-3 text-left">
                      <div className="flex items-center justify-between"><span className="font-mono text-sm font-medium">{b.booking_id}</span><StatusBadge status={b.status} /></div>
                      <p className="mt-1 font-medium">{b.customer_name}</p>
                      <p className="text-xs text-forest-500">{thaiDateShort(b.service_date)} • {b.start_time}–{b.end_time} • {b.service_names}</p>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3 text-sm">
                <span className="text-forest-500">หน้า {page} / {pages}</span>
                <div className="flex gap-2">
                  <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))}><ChevronLeft className="size-4" />ก่อนหน้า</button>
                  <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => set('page', String(page + 1))}>ถัดไป<ChevronRight className="size-4" /></button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <BookingDetailModal bookingId={openId} onClose={() => setOpenId(null)} onChanged={() => reload(true)} therapists={settings?.therapists} />
    </>
  )
}
