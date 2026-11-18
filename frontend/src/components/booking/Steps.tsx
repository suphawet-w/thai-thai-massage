import { ArrowLeft, Ban, Check, CheckCircle2, Clock, Copy, Home, Minus, Plus, Save, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { baht, durationText, formatPhone, thaiDateLong } from '../../lib/format'
import type { Booking, Service, ShopInfo, Slot } from '../../lib/types'
import BookingDetails from '../BookingDetails'
import CancelBookingModal from '../CancelBookingModal'
import { ServiceIcon } from '../Illustrations'
import { Alert, FieldError, Spinner, cn } from '../ui'
import Calendar from './Calendar'
import SlotPicker from './SlotPicker'

export const STEPS = ['เลือกบริการ', 'วันและเวลา', 'ข้อมูลลูกค้า', 'ตรวจสอบ', 'สำเร็จ']

export function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex items-center justify-between gap-1" aria-label="ขั้นตอนการจอง">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <li key={label} className="flex flex-1 items-center gap-1 last:flex-none" aria-current={active ? 'step' : undefined}>
            <div className="flex flex-col items-center gap-1.5">
              <span className={cn('grid size-9 place-items-center rounded-full text-sm font-semibold transition-all duration-300',
                done ? 'bg-gold-500 text-forest-950' : active ? 'bg-forest-800 text-cream-50 ring-4 ring-forest-800/15' : 'bg-cream-200 text-forest-400')}>
                {done ? <Check className="size-4" /> : n}
              </span>
              <span className={cn('hidden text-xs sm:block', active ? 'font-medium text-forest-900' : 'text-forest-500')}>{label}</span>
            </div>
            {n < STEPS.length && <span className={cn('mx-1 mb-0 h-0.5 flex-1 rounded-full transition-colors sm:mb-5', done ? 'bg-gold-500' : 'bg-cream-300')} />}
          </li>
        )
      })}
    </ol>
  )
}

// ---------------- Step 1 ----------------
export function StepService({ services, selected, onToggle }: { services: Service[]; selected: number[]; onToggle: (id: number) => void }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">เลือกบริการที่ต้องการ</h2>
      <p className="mt-1 text-sm text-forest-500">เลือกได้มากกว่า 1 บริการ (ให้บริการต่อเนื่องกัน) • ราคาต่อท่าน</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {services.map((s) => {
          const on = selected.includes(s.id)
          const order = selected.indexOf(s.id) + 1
          return (
            <button key={s.id} type="button" onClick={() => onToggle(s.id)} aria-pressed={on}
              className={cn('group flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all',
                on ? 'border-forest-700 bg-forest-50/70 shadow-sm' : 'border-cream-300 bg-white hover:border-gold-400')}>
              <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl transition-colors', on ? 'bg-forest-800 text-gold-300' : 'bg-cream-200 text-forest-600')}>
                <ServiceIcon name={s.name} className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-forest-900">{s.name}</span>
                <span className="mt-1 flex items-center gap-3 text-sm text-forest-500">
                  <span className="flex items-center gap-1"><Clock className="size-3.5" />{durationText(s.duration_minutes)}</span>
                  <span className="font-semibold text-forest-800">{baht(s.price)}</span>
                </span>
              </span>
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-all',
                on ? 'border-forest-800 bg-forest-800 text-cream-50 animate-pop' : 'border-cream-300')}>
                {on && (selected.length > 1 ? order : <Check className="size-3.5" />)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- Guest counter ----------------
export function GuestCounter({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className="grid size-9 place-items-center rounded-full border border-cream-300 bg-white hover:border-gold-500 disabled:opacity-40" aria-label="ลดจำนวน"><Minus className="size-4" /></button>
      <span className="min-w-14 text-center font-semibold" aria-live="polite">{value} ท่าน</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid size-9 place-items-center rounded-full border border-cream-300 bg-white hover:border-gold-500 disabled:opacity-40" aria-label="เพิ่มจำนวน"><Plus className="size-4" /></button>
    </div>
  )
}

// ---------------- Step 2 ----------------
export function StepDateTime(props: {
  shop: ShopInfo; date: string; onDate: (d: string) => void; guests: number; onGuests: (n: number) => void
  slots: Slot[] | null; loading: boolean; error: string | null; message?: string; onRetry: () => void
  time: string; onTime: (s: Slot) => void; duration: number
}) {
  const { shop, date, slots } = props
  return (
    <div>
      <h2 className="text-xl font-semibold">เลือกวันและเวลา</h2>
      <p className="mt-1 text-sm text-forest-500">ระยะเวลาบริการรวม {durationText(props.duration)} • แสดงเฉพาะช่วงเวลาที่ให้บริการได้ครบก่อนร้านปิด</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream-200/60 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium"><Users className="size-4 text-gold-600" />จำนวนผู้ใช้บริการ</span>
        <GuestCounter value={props.guests} max={shop.max_guests_per_booking} onChange={props.onGuests} />
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-cream-300 bg-white p-4">
          <Calendar shop={shop} value={date} onChange={props.onDate} />
        </div>
        <div>
          {!date && <p className="rounded-2xl border border-dashed border-cream-300 p-8 text-center text-sm text-forest-500">กรุณาเลือกวันที่จากปฏิทิน</p>}
          {date && (
            <>
              <p className="mb-4 font-medium">{thaiDateLong(date)}</p>
              {props.loading && <div className="flex items-center gap-2 py-10 text-sm text-forest-500"><Spinner className="size-4 text-gold-500" />กำลังตรวจสอบเวลาว่าง...</div>}
              {props.error && <Alert tone="error" title="ตรวจสอบเวลาว่างไม่สำเร็จ" onRetry={props.onRetry}>{props.error}</Alert>}
              {!props.loading && !props.error && slots && <SlotPicker slots={slots} value={props.time} onChange={props.onTime} message={props.message} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------- Step 3 ----------------
export interface CustomerForm { full_name: string; phone: string; note: string }

export function StepCustomer({ form, onChange, errors, guests, maxGuests, onGuests }: {
  form: CustomerForm; onChange: (f: CustomerForm) => void; errors: Record<string, string>
  guests: number; maxGuests: number; onGuests: (n: number) => void
}) {
  const set = (k: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...form, [k]: e.target.value })
  return (
    <div>
      <h2 className="text-xl font-semibold">กรอกข้อมูลผู้จอง</h2>
      <p className="mt-1 text-sm text-forest-500">ใช้เบอร์โทรศัพท์นี้สำหรับตรวจสอบหรือยกเลิกการจองภายหลัง</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="full_name">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
          <input id="full_name" className="input" value={form.full_name} onChange={set('full_name')} autoComplete="name" placeholder="เช่น สมชาย ใจดี" maxLength={100} aria-invalid={!!errors.full_name} />
          <FieldError msg={errors.full_name} />
        </div>
        <div>
          <label className="label" htmlFor="phone">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
          <input id="phone" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" placeholder="08X-XXX-XXXX" maxLength={16} aria-invalid={!!errors.phone} />
          <FieldError msg={errors.phone} />
        </div>
        <div>
          <span className="label">จำนวนผู้ใช้บริการ <span className="text-red-500">*</span></span>
          <div className="flex h-[46px] items-center"><GuestCounter value={guests} max={maxGuests} onChange={onGuests} /></div>
          <FieldError msg={errors.guests} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="note">หมายเหตุเพิ่มเติม <span className="font-normal text-forest-400">(ไม่บังคับ)</span></label>
          <textarea id="note" className="input min-h-24 resize-y" value={form.note} onChange={set('note')} maxLength={500} placeholder="เช่น ต้องการหมอนวดผู้หญิง, มีอาการปวดหลังส่วนล่าง, แพ้น้ำมันบางชนิด" />
          <p className="mt-1 text-right text-xs text-forest-400">{form.note.length}/500</p>
        </div>
      </div>
    </div>
  )
}

// ---------------- Step 4 ----------------
export function StepReview({ services, date, time, guests, form, duration, unitPrice, endTime }: {
  services: Service[]; date: string; time: string; guests: number; form: CustomerForm; duration: number; unitPrice: number; endTime: string
}) {
  const rows: [string, React.ReactNode][] = [
    ['ชื่อผู้จอง', form.full_name],
    ['เบอร์โทรศัพท์', formatPhone(form.phone.replace(/\D/g, '').replace(/^66/, '0'))],
    ['บริการที่เลือก', <ul key="s" className="space-y-0.5">{services.map((s) => <li key={s.id}>{s.name} <span className="text-forest-500">({baht(s.price)})</span></li>)}</ul>],
    ['วันที่', thaiDateLong(date)],
    ['เวลา', `${time} น.`],
    ['ระยะเวลาบริการ', durationText(duration)],
    ['เวลาสิ้นสุดโดยประมาณ', `${endTime} น.`],
    ['จำนวนผู้ใช้บริการ', `${guests} ท่าน`],
  ]
  if (form.note.trim()) rows.push(['หมายเหตุ', form.note])
  return (
    <div>
      <h2 className="text-xl font-semibold">ตรวจสอบข้อมูลการจอง</h2>
      <p className="mt-1 text-sm text-forest-500">กรุณาตรวจสอบความถูกต้องก่อนกดยืนยัน</p>
      <dl className="mt-6 divide-y divide-cream-200 rounded-2xl border border-cream-300 bg-white px-5">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-3">
            <dt className="text-sm text-forest-500">{k}</dt>
            <dd className="text-sm font-medium sm:col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-forest-800 px-5 py-4 text-cream-50">
        <span>ราคารวม{guests > 1 && <span className="ml-1 text-sm text-cream-200/70">({baht(unitPrice)} × {guests} ท่าน)</span>}</span>
        <span className="text-2xl font-semibold text-gold-300">{baht(unitPrice * guests)}</span>
      </div>
      <p className="mt-3 text-xs text-forest-500">ชำระเงินที่ร้านหลังใช้บริการ</p>
    </div>
  )
}

// ---------------- Step 5 ----------------
export function StepSuccess({ booking, cancelHours, onChange }: { booking: Booking; cancelHours: number; onChange: (b: Booking) => void }) {
  const [copied, setCopied] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const cancelled = booking.status === 'cancelled'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(booking.booking_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* เบราว์เซอร์ไม่อนุญาต */ }
  }
  return (
    <div className="text-center">
      {cancelled ? (
        <>
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-red-50 animate-pop">
            <Ban className="size-10 text-red-500" />
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-forest-900">ยกเลิกการจองแล้ว</h2>
          <p className="mt-2 text-forest-600">การจองนี้ถูกยกเลิกเรียบร้อย ช่วงเวลานี้เปิดให้ผู้อื่นจองได้แล้ว</p>
        </>
      ) : (
        <>
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-forest-100 animate-pop">
            <CheckCircle2 className="size-11 text-forest-600" />
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-forest-900">จองคิวสำเร็จ!</h2>
          <p className="mt-2 text-forest-600">
            {booking.status === 'pending' ? 'ร้านได้รับการจองของคุณแล้ว และจะยืนยันคิวโดยเร็วที่สุด' : 'การจองของคุณได้รับการยืนยันแล้ว แล้วพบกันนะคะ'}
          </p>
        </>
      )}
      <div className="mx-auto mt-6 max-w-sm rounded-2xl border-2 border-dashed border-gold-400 bg-gold-200/30 px-6 py-5">
        <p className="text-xs tracking-wider text-gold-700">หมายเลขการจอง (Booking ID)</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="font-mono text-3xl font-semibold tracking-[0.15em] text-forest-900">{booking.booking_id}</p>
          <button onClick={copy} className="rounded-full p-2 text-forest-600 hover:bg-white" aria-label="คัดลอกหมายเลขการจอง">
            {copied ? <Check className="size-4 text-forest-600" /> : <Copy className="size-4" />}
          </button>
        </div>
        {booking.queue_code && <p className="mt-1 text-sm text-forest-600">หมายเลขคิว <span className="font-semibold">{booking.queue_code}</span></p>}
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-forest-500"><Save className="size-3.5" />บันทึกหมายเลขการจองไว้ในเครื่องนี้แล้ว ดูย้อนหลังได้ที่หน้า "ตรวจสอบการจอง"</p>
      </div>
      <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-cream-300 bg-white px-5 text-left">
        <BookingDetails booking={booking} />
      </div>
      {!cancelled && (
        <p className="mx-auto mt-4 max-w-lg text-xs text-forest-500">
          หากต้องการยกเลิก สามารถทำได้ล่วงหน้าอย่างน้อย {cancelHours} ชั่วโมงก่อนเวลานัด ที่ปุ่มด้านล่างหรือหน้า "ตรวจสอบการจอง"
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary px-6 py-3"><Home className="size-4" />กลับหน้าหลัก</Link>
        <Link to={`/booking/check?id=${booking.booking_id}&phone=${booking.customer_phone}`} className="btn-outline px-6 py-3"><Search className="size-4" />ตรวจสอบการจอง</Link>
        {booking.can_cancel && (
          <button onClick={() => setCancelOpen(true)} className="btn border border-red-200 px-6 py-3 text-red-600 hover:bg-red-50"><Ban className="size-4" />ยกเลิกการจอง</button>
        )}
      </div>
      <CancelBookingModal booking={booking} phone={booking.customer_phone} open={cancelOpen} onClose={() => setCancelOpen(false)} onCancelled={onChange} />
    </div>
  )
}

export function BackButton({ onClick, label = 'ย้อนกลับ' }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className="btn-ghost"><ArrowLeft className="size-4" />{label}</button>
}
