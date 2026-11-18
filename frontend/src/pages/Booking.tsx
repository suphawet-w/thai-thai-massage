import { ArrowRight, CalendarCheck, CalendarClock, Clock, Receipt } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { BackButton, StepCustomer, StepDateTime, StepReview, StepService, StepSuccess, Stepper, type CustomerForm } from '../components/booking/Steps'
import { Alert, LoadingBlock, Spinner } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { ApiError, publicApi } from '../lib/api'
import { addMinutes, baht, durationText, isValidPhone, thaiDateShort } from '../lib/format'
import { saveBooking } from '../lib/savedBookings'
import type { Booking as BookingT, Slot } from '../lib/types'

export default function Booking() {
  const toast = useToast()
  const [params] = useSearchParams()
  const { data: init, loading, error, reload } = useAsync(() => Promise.all([publicApi.services(), publicApi.shopInfo()]), [])
  const services = init?.[0] ?? []
  const shop = init?.[1]

  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState<number[]>([])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [guests, setGuests] = useState(1)
  const [form, setForm] = useState<CustomerForm>({ full_name: '', phone: '', note: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [booking, setBooking] = useState<BookingT | null>(null)

  // เลือกบริการล่วงหน้าจาก ?service=ID (มาจากปุ่ม "จองคิว" ในหน้าบริการ)
  useEffect(() => {
    const id = Number(params.get('service'))
    if (id && services.some((s) => s.id === id)) setSelected([id])
  }, [params, services])

  const chosen = useMemo(() => selected.map((id) => services.find((s) => s.id === id)!).filter(Boolean), [selected, services])
  const duration = chosen.reduce((a, s) => a + s.duration_minutes, 0)
  const unitPrice = chosen.reduce((a, s) => a + s.price, 0)

  // ---------- โหลดเวลาว่างจาก Backend ----------
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotMsg, setSlotMsg] = useState<string>()
  const [slotLoading, setSlotLoading] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)

  const loadSlots = useCallback(async () => {
    if (!date || !selected.length) return
    setSlotLoading(true)
    setSlotError(null)
    try {
      const res = await publicApi.availability(date, selected, guests)
      setSlots(res.slots ?? [])
      setSlotMsg(res.message)
      // ถ้าเวลาที่เลือกไว้ไม่ว่างแล้ว ให้ยกเลิกการเลือก
      if (time && !res.slots?.some((s) => s.time === time && s.available)) setTime('')
    } catch (e) {
      setSlotError((e as Error).message)
    } finally {
      setSlotLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selected, guests])

  useEffect(() => { if (step === 2) loadSlots() }, [step, loadSlots])

  const toggleService = (id: number) => {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id])
    setTime('')
  }

  const go = (n: number) => {
    setStepError(null)
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---------- ตรวจข้อมูลลูกค้า + ยืนยันว่าเวลายังว่างก่อนไปหน้าสรุป ----------
  const submitCustomer = async () => {
    const e: Record<string, string> = {}
    const name = form.full_name.trim()
    if (name.length < 2) e.full_name = 'กรุณากรอกชื่อ-นามสกุล'
    if (!isValidPhone(form.phone)) e.phone = 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง เช่น 0812345678'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    setStepError(null)
    try {
      const res = await publicApi.availability(date, selected, guests, time)
      if (!res.available) {
        setStepError(`${res.message}${res.suggested_times?.length ? ` (เวลาที่ยังว่าง: ${res.suggested_times.join(', ')} น.)` : ''}`)
        return
      }
      go(4)
    } catch (err) {
      setStepError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ---------- ยืนยันการจอง ----------
  const confirm = async () => {
    setBusy(true)
    setStepError(null)
    try {
      const b = await publicApi.createBooking({ service_ids: selected, date, time, guests, full_name: form.full_name.trim(), phone: form.phone, note: form.note.trim() })
      setBooking(b)
      saveBooking(b)
      toast.success('จองคิวสำเร็จ!')
      go(5)
    } catch (err) {
      const e = err as ApiError
      if (e.fields) setErrors(e.fields)
      setStepError(e.message)
      if (e.code === 'SLOT_UNAVAILABLE') setTime('')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="container-page py-16"><LoadingBlock /></div>
  if (error || !shop) return <div className="container-page py-16"><Alert tone="error" title="ไม่สามารถโหลดข้อมูลการจองได้" onRetry={() => reload()}>{error}</Alert></div>

  const endTime = time ? addMinutes(time, duration) : ''
  const canNext = step === 1 ? selected.length > 0 : step === 2 ? !!date && !!time : true

  return (
    <div className="container-page py-10">
      <div className="mb-8 text-center">
        <p className="eyebrow">Online Booking</p>
        <h1 className="mt-2 text-3xl font-semibold">จองคิวนวด</h1>
      </div>
      <div className="mx-auto max-w-5xl">
        <Stepper step={step} />
        <div className={step < 5 ? 'grid gap-6 lg:grid-cols-[1fr_300px]' : ''}>
          <section className="card p-5 sm:p-8 animate-fade-in" key={step}>
            {step === 1 && <StepService services={services} selected={selected} onToggle={toggleService} />}
            {step === 2 && (
              <StepDateTime shop={shop} date={date} onDate={(d) => { setDate(d); setTime('') }} guests={guests} onGuests={setGuests}
                slots={slots} loading={slotLoading} error={slotError} message={slotMsg} onRetry={loadSlots}
                time={time} onTime={(s) => setTime(s.time)} duration={duration} />
            )}
            {step === 3 && <StepCustomer form={form} onChange={(f) => { setForm(f); setErrors({}) }} errors={errors} guests={guests} maxGuests={shop.max_guests_per_booking} onGuests={(n) => { setGuests(n); setStepError(null) }} />}
            {step === 4 && <StepReview services={chosen} date={date} time={time} guests={guests} form={form} duration={duration} unitPrice={unitPrice} endTime={endTime} />}
            {step === 5 && booking && <StepSuccess booking={booking} cancelHours={shop.cancel_before_hours} onChange={setBooking} />}

            {stepError && (
              <div className="mt-6">
                <Alert tone="error" title="ไม่สามารถดำเนินการได้">
                  {stepError}
                  {(step === 3 || step === 4) && <button onClick={() => go(2)} className="mt-2 block font-medium underline underline-offset-4">เลือกวันหรือเวลาใหม่</button>}
                </Alert>
              </div>
            )}

            {step < 5 && (
              <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-cream-200 pt-6 sm:flex-row sm:items-center">
                {step > 1 ? <BackButton onClick={() => go(step - 1)} label={step === 4 ? 'ย้อนกลับไปแก้ไข' : 'ย้อนกลับ'} /> : <span />}
                {step < 3 && <button className="btn-primary px-7 py-3" disabled={!canNext} onClick={() => go(step + 1)}>ถัดไป<ArrowRight className="size-4" /></button>}
                {step === 3 && <button className="btn-primary px-7 py-3" disabled={busy} onClick={submitCustomer}>{busy ? <><Spinner className="size-4" />กำลังตรวจสอบ...</> : <>ตรวจสอบข้อมูล<ArrowRight className="size-4" /></>}</button>}
                {step === 4 && <button className="btn-gold px-8 py-3 text-base" disabled={busy} onClick={confirm}>{busy ? <><Spinner className="size-4" />กำลังบันทึกการจอง...</> : <><CalendarCheck className="size-5" />ยืนยันการจอง</>}</button>}
              </div>
            )}
          </section>

          {/* สรุปการจอง (ด้านข้าง) */}
          {step < 5 && (
            <aside className="h-fit lg:sticky lg:top-24">
              <div className="card p-5">
                <p className="mb-3 flex items-center gap-2 font-semibold"><Receipt className="size-4 text-gold-600" />สรุปการจอง</p>
                {chosen.length === 0 ? <p className="text-sm text-forest-500">ยังไม่ได้เลือกบริการ</p> : (
                  <ul className="space-y-2 text-sm">
                    {chosen.map((s) => <li key={s.id} className="flex justify-between gap-2"><span>{s.name}</span><span className="shrink-0 text-forest-600">{s.price.toLocaleString('th-TH')}</span></li>)}
                  </ul>
                )}
                {chosen.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-dashed border-cream-300 pt-4 text-sm">
                    <p className="flex items-center gap-2 text-forest-600"><Clock className="size-4" />{durationText(duration)}</p>
                    {date && <p className="flex items-center gap-2 text-forest-600"><CalendarClock className="size-4" />{thaiDateShort(date)}{time && ` • ${time}–${endTime} น.`}</p>}
                    <p className="flex justify-between pt-2 text-base font-semibold"><span>รวม ({guests} ท่าน)</span><span className="text-forest-800">{baht(unitPrice * guests)}</span></p>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
