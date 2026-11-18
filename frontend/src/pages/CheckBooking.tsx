import { Ban, History, RefreshCw, Search, Ticket, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import BookingDetails from '../components/BookingDetails'
import CancelBookingModal from '../components/CancelBookingModal'
import { Alert, FieldError, SectionHeading, Spinner } from '../components/ui'
import { publicApi } from '../lib/api'
import { formatPhone, isValidPhone, thaiDateShort } from '../lib/format'
import { getSavedBookings, removeSavedBooking } from '../lib/savedBookings'
import type { Booking, QueueStatus } from '../lib/types'

export default function CheckBooking() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('id') ?? '')
  const [phone, setPhone] = useState(params.get('phone') ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [queue, setQueue] = useState<QueueStatus | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [saved, setSaved] = useState(getSavedBookings)

  const search = async (c = code, p = phone) => {
    const e: Record<string, string> = {}
    if (c.trim().length < 4) e.code = 'กรุณากรอกหมายเลขการจอง'
    if (!isValidPhone(p)) e.phone = 'กรุณากรอกเบอร์โทรศัพท์ที่ใช้จอง'
    setErrors(e)
    if (Object.keys(e).length) return
    setLoading(true)
    setError(null)
    try {
      const b = await publicApi.getBooking(c.trim(), p)
      setBooking(b)
      publicApi.queueStatus(b.booking_id, p).then(setQueue).catch(() => setQueue(null))
    } catch (err) {
      setBooking(null)
      setQueue(null)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.get('id') && params.get('phone')) search(params.get('id')!, params.get('phone')!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = (id: string, p: string) => {
    setCode(id)
    setPhone(p)
    search(id, p)
  }

  const forget = (id: string) => {
    removeSavedBooking(id)
    setSaved(getSavedBookings())
  }

  const today = queue?.date === booking?.service_date

  return (
    <div className="container-page max-w-3xl py-12">
      <SectionHeading eyebrow="My Booking" title="ตรวจสอบการจอง" center>ค้นหาด้วยหมายเลขการจอง (Booking ID) และเบอร์โทรศัพท์ที่ใช้จอง</SectionHeading>

      <form className="card grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-start" onSubmit={(e) => { e.preventDefault(); search() }}>
        <div>
          <label htmlFor="code" className="label">หมายเลขการจอง</label>
          <input id="code" className="input font-mono uppercase tracking-wider" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TTXXXXXX" maxLength={12} />
          <FieldError msg={errors.code} />
        </div>
        <div>
          <label htmlFor="phone" className="label">เบอร์โทรศัพท์</label>
          <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08X-XXX-XXXX" maxLength={16} />
          <FieldError msg={errors.phone} />
        </div>
        <button type="submit" className="btn-primary h-[46px] sm:mt-[30px]" disabled={loading}>
          {loading ? <Spinner className="size-4" /> : <Search className="size-4" />}ค้นหา
        </button>
      </form>

      {saved.length > 0 && (
        <div className="mt-4 rounded-2xl border border-cream-300 bg-white p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-forest-700"><History className="size-4" />การจองที่บันทึกไว้ในเครื่องนี้</p>
          <ul className="flex flex-wrap gap-2">
            {saved.map((x) => (
              <li key={x.booking_id} className="flex items-center rounded-full border border-cream-300 bg-cream-50 text-sm">
                <button type="button" onClick={() => pick(x.booking_id, x.phone)} className="flex items-center gap-2 rounded-l-full py-1.5 pl-3 pr-2 hover:bg-cream-100" title={`เบอร์ ${formatPhone(x.phone)}`}>
                  <span className="font-mono font-semibold text-forest-900">{x.booking_id}</span>
                  <span className="text-xs text-forest-500">{thaiDateShort(x.service_date)} {x.start_time} น.</span>
                </button>
                <button type="button" onClick={() => forget(x.booking_id)} className="rounded-r-full py-1.5 pl-1 pr-2.5 text-forest-400 hover:bg-cream-100 hover:text-red-500" aria-label={`ลบ ${x.booking_id} ออกจากรายการ`}><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="mt-6"><Alert tone="error" title="ไม่พบการจอง">{error}</Alert></div>}

      {booking && (
        <div className="mt-8 space-y-5 animate-fade-up">
          {queue?.my_booking && today && booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-forest-800 p-5 text-cream-50">
              <div className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-xl bg-gold-500 text-forest-950"><Ticket className="size-6" /></span>
                <div>
                  <p className="text-sm text-cream-200/80">คิวของคุณ {queue.my_booking.queue_code}</p>
                  <p className="text-lg font-semibold">{queue.my_booking.message}</p>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="text-cream-200/70">กำลังเรียกคิว</p>
                <p className="text-2xl font-semibold text-gold-300">{queue.now_calling || '—'}</p>
              </div>
            </div>
          )}
          <div className="card p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">รายละเอียดการจอง</h2>
              <button onClick={() => search()} className="btn-ghost btn-sm" disabled={loading}><RefreshCw className="size-3.5" />รีเฟรช</button>
            </div>
            <BookingDetails booking={booking} />
            {booking.can_cancel ? (
              <button onClick={() => setCancelOpen(true)} className="btn mt-6 w-full border border-red-200 text-red-600 hover:bg-red-50"><Ban className="size-4" />ยกเลิกการจอง</button>
            ) : booking.status !== 'cancelled' && booking.status !== 'completed' && (
              <p className="mt-6 rounded-xl bg-cream-100 p-3 text-center text-xs text-forest-500">ไม่สามารถยกเลิกออนไลน์ได้แล้ว (เลยกำหนดเวลายกเลิกตามเงื่อนไขของร้าน) หากต้องการเปลี่ยนแปลงกรุณาติดต่อร้าน</p>
            )}
          </div>
        </div>
      )}

      <CancelBookingModal booking={booking} phone={phone} open={cancelOpen} onClose={() => setCancelOpen(false)} onCancelled={setBooking} />
    </div>
  )
}
