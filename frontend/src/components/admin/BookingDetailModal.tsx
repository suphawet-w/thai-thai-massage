import { Ban, CalendarClock, CheckCircle2, Megaphone, Play, RotateCcw, Save, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { adminApi } from '../../lib/api'
import { thaiDateTime } from '../../lib/format'
import type { Booking, BookingStatus, Slot, Therapist } from '../../lib/types'
import BookingDetails from '../BookingDetails'
import Calendar from '../booking/Calendar'
import SlotPicker from '../booking/SlotPicker'
import { Alert, Modal, STATUS_LABEL, Spinner } from '../ui'
import { useAsync } from '../../hooks/useAsync'
import { publicApi } from '../../lib/api'

// การเปลี่ยนสถานะที่อนุญาต (ตรงกับฝั่ง Backend)
export const NEXT_STATUS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'pending', 'cancelled'],
  in_progress: ['completed', 'confirmed'],
  completed: ['in_progress'],
  cancelled: ['pending', 'confirmed'],
}

type Props = { bookingId: string | null; onClose: () => void; onChanged: (b: Booking) => void; therapists?: Therapist[] }

export default function BookingDetailModal({ bookingId, onClose, onChanged, therapists = [] }: Props) {
  const toast = useToast()
  const [b, setB] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelMode, setCancelMode] = useState(false)
  const [reason, setReason] = useState('')
  const [resched, setResched] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    setB(null); setCancelMode(false); setResched(false); setReason(''); setLoadError(null)
    setLoading(true)
    adminApi.booking(bookingId).then(setB).catch((e) => setLoadError(e.message)).finally(() => setLoading(false))
  }, [bookingId])

  const run = async (key: string, fn: () => Promise<Booking>, ok?: string) => {
    setBusy(key)
    try {
      const nb = await fn()
      setB(nb)
      onChanged(nb)
      toast.success(ok ?? `เปลี่ยนสถานะเป็น "${nb.status_label}" แล้ว`)
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const setStatus = (s: BookingStatus, r = '') => b && run(s, () => adminApi.updateStatus(b.id, s, r))

  return (
    <Modal open={!!bookingId} onClose={onClose} title={b ? `การจอง ${b.booking_id}` : 'รายละเอียดการจอง'} wide>
      {loading && <div className="flex justify-center py-10"><Spinner className="size-6 text-gold-500" /></div>}
      {loadError && <Alert tone="error">{loadError}</Alert>}
      {b && !resched && (
        <div className="grid gap-6 md:grid-cols-[1fr_240px]">
          <div>
            <BookingDetails booking={b} />
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-cream-100 p-3 text-xs text-forest-500">
              <span>สร้างเมื่อ: {thaiDateTime(b.created_at)}</span>
              <span>ช่องทาง: {b.source === 'botnoi' ? 'Botnoi AI' : b.source === 'admin' ? 'หลังร้าน' : b.source === 'phone' ? 'โทรศัพท์' : 'เว็บไซต์'}</span>
              {b.confirmed_at && <span>ยืนยัน: {thaiDateTime(b.confirmed_at)}</span>}
              {b.started_at && <span>เริ่มบริการ: {thaiDateTime(b.started_at)}</span>}
              {b.completed_at && <span>เสร็จสิ้น: {thaiDateTime(b.completed_at)}</span>}
              {b.cancelled_at && <span>ยกเลิก: {thaiDateTime(b.cancelled_at)} ({b.cancelled_by === 'customer' ? 'ลูกค้า' : b.cancelled_by.replace('admin:', '')})</span>}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-forest-500">การดำเนินการ</p>
            {b.status === 'pending' && <ActionBtn icon={<CheckCircle2 />} label="ยืนยันการจอง" busy={busy === 'confirmed'} onClick={() => setStatus('confirmed')} primary />}
            {b.status === 'confirmed' && <ActionBtn icon={<Megaphone />} label={b.called_at ? 'เรียกคิวอีกครั้ง' : 'เรียกคิว'} busy={busy === 'call'} onClick={() => run('call', () => adminApi.callBooking(b.id), `เรียกคิว ${b.queue_code}`)} />}
            {b.status === 'confirmed' && <ActionBtn icon={<Play />} label="เริ่มให้บริการ" busy={busy === 'in_progress'} onClick={() => setStatus('in_progress')} primary />}
            {b.status === 'in_progress' && <ActionBtn icon={<CheckCircle2 />} label="เสร็จสิ้นการให้บริการ" busy={busy === 'completed'} onClick={() => setStatus('completed')} primary />}
            {(b.status === 'pending' || b.status === 'confirmed') && <ActionBtn icon={<CalendarClock />} label="แก้ไขวัน/เวลา" onClick={() => setResched(true)} />}
            {b.status === 'cancelled' && <ActionBtn icon={<RotateCcw />} label="กู้คืนการจอง" busy={busy === 'pending'} onClick={() => setStatus('pending')} />}

            <div>
              <label className="label text-xs" htmlFor="status-select">เปลี่ยนสถานะ</label>
              <select id="status-select" className="input py-2 text-sm" value="" disabled={!!busy}
                onChange={(e) => {
                  const s = e.target.value as BookingStatus
                  if (s === 'cancelled') setCancelMode(true)
                  else if (s) setStatus(s)
                }}>
                <option value="">— {STATUS_LABEL[b.status]} —</option>
                {NEXT_STATUS[b.status].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {therapists.length > 0 && b.status !== 'cancelled' && (
              <div>
                <label className="label text-xs" htmlFor="therapist-select"><UserCheck className="mr-1 inline size-3.5" />หมอนวด</label>
                <select id="therapist-select" className="input py-2 text-sm" value={b.therapist_id ?? ''} disabled={!!busy}
                  onChange={(e) => run('therapist', () => adminApi.assignTherapist(b.id, e.target.value ? Number(e.target.value) : null), 'บันทึกหมอนวดแล้ว')}>
                  <option value="">ยังไม่ระบุ</option>
                  {therapists.filter((t) => t.is_active || t.id === b.therapist_id).map((t) => <option key={t.id} value={t.id}>{t.full_name}{t.nickname && ` (${t.nickname})`}</option>)}
                </select>
              </div>
            )}

            {(b.status === 'pending' || b.status === 'confirmed') && !cancelMode && (
              <button className="btn w-full border border-red-200 text-red-600 hover:bg-red-50" onClick={() => setCancelMode(true)}><Ban className="size-4" />ยกเลิกการจอง</button>
            )}
            {cancelMode && (
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 animate-fade-in">
                <label className="label text-xs" htmlFor="cancel-reason">เหตุผลการยกเลิก</label>
                <textarea id="cancel-reason" className="input min-h-16 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ลูกค้าโทรแจ้งยกเลิก" />
                <div className="mt-2 flex gap-2">
                  <button className="btn-outline btn-sm flex-1" onClick={() => setCancelMode(false)}>ไม่ยกเลิก</button>
                  <button className="btn-danger btn-sm flex-1" disabled={!!busy} onClick={async () => { if (await setStatus('cancelled', reason || 'ยกเลิกโดยร้าน')) setCancelMode(false) }}>
                    {busy === 'cancelled' && <Spinner className="size-3" />}ยืนยันยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {b && resched && <Reschedule booking={b} onCancel={() => setResched(false)} onDone={(nb) => { setB(nb); onChanged(nb); setResched(false) }} />}
    </Modal>
  )
}

function ActionBtn({ icon, label, onClick, busy, primary }: { icon: React.ReactElement; label: string; onClick: () => void; busy?: boolean; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className={`${primary ? 'btn-primary' : 'btn-outline'} w-full justify-start [&_svg]:size-4`}>
      {busy ? <Spinner className="size-4" /> : icon}{label}
    </button>
  )
}

function Reschedule({ booking, onCancel, onDone }: { booking: Booking; onCancel: () => void; onDone: (b: Booking) => void }) {
  const toast = useToast()
  const { data: shop } = useAsync(() => publicApi.shopInfo(), [])
  const [date, setDate] = useState(booking.service_date)
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: day, loading, error, reload } = useAsync(() => adminApi.bookingAvailability(booking.id, date), [date])

  const save = async () => {
    setSaving(true)
    try {
      const nb = await adminApi.reschedule(booking.id, date, time)
      toast.success('แก้ไขวันและเวลาเรียบร้อยแล้ว')
      onDone(nb)
    } catch (e) {
      toast.error((e as Error).message)
      reload(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-forest-600">เวลาเดิม: {booking.service_date} {booking.start_time}–{booking.end_time} น. • {booking.service_names} • {booking.guests} ท่าน</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-cream-300 bg-white p-4">
          {shop ? <Calendar shop={shop} value={date} onChange={(d) => { setDate(d); setTime('') }} /> : <Spinner />}
        </div>
        <div>
          {loading && <Spinner className="size-5 text-gold-500" />}
          {error && <Alert tone="error">{error}</Alert>}
          {day && !loading && <SlotPicker slots={day.slots} value={time} onChange={(s: Slot) => setTime(s.time)} message={day.message} />}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-cream-200 pt-4">
        <button className="btn-outline" onClick={onCancel}>ย้อนกลับ</button>
        <button className="btn-primary" disabled={!time || saving} onClick={save}>{saving ? <Spinner className="size-4" /> : <Save className="size-4" />}บันทึกเวลาใหม่</button>
      </div>
    </div>
  )
}
