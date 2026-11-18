import { CalendarOff, Clock, KeyRound, Plus, Save, Store, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PageHeader } from '../../components/admin/AdminUI'
import { Alert, FieldError, LoadingBlock, Spinner, Toggle, cn } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { ApiError, adminApi } from '../../lib/api'
import { DAY_NAMES, formatPhone, thaiDateLong } from '../../lib/format'
import type { AdminUser, BusinessHour, Settings, Therapist } from '../../lib/types'

function Section({ icon, title, desc, children }: { icon: ReactNode; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-200/60 text-gold-700">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {desc && <p className="text-sm text-forest-500">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const { data, loading, error, reload } = useAsync(() => adminApi.settings(), [])

  if (loading) return <LoadingBlock />
  if (error || !data) return <Alert tone="error" onRetry={() => reload()}>{error}</Alert>

  return (
    <>
      <PageHeader title="ตั้งค่าร้าน" subtitle="เวลาทำการ วันหยุด หมอนวด และเงื่อนไขการจอง" />
      {!isOwner && <div className="mb-5"><Alert tone="info">บัญชีพนักงานดูการตั้งค่าได้อย่างเดียว เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขได้</Alert></div>}
      <div className="space-y-6">
        <GeneralSettings initial={data.settings} activeTherapists={data.therapists.filter((t) => t.is_active).length} readOnly={!isOwner} onSaved={() => reload(true)} />
        <TherapistsSection initial={data.therapists} readOnly={!isOwner} onSaved={() => reload(true)} />
        <HoursSection initial={data.business_hours} readOnly={!isOwner} />
        <HolidaySection initial={data.holidays} readOnly={!isOwner} />
        {isOwner && <UsersSection />}
        <PasswordSection />
      </div>
    </>
  )
}

// ---------- ตั้งค่าทั่วไป ----------
function GeneralSettings({ initial, activeTherapists, readOnly, onSaved }: { initial: Settings; activeTherapists: number; readOnly: boolean; onSaved: () => void }) {
  const toast = useToast()
  const [s, setS] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => { setS(initial) }, [initial])
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS({ ...s, [k]: Number(e.target.value) })
  const txt = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value })

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      await adminApi.updateSettings(s)
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว')
      onSaved()
    } catch (e) {
      const ae = e as ApiError
      if (ae.fields) setErrors(ae.fields)
      toast.error(ae.message)
    } finally {
      setSaving(false)
    }
  }

  const capacity = Math.min(activeTherapists, s.max_customers_per_slot)
  return (
    <Section icon={<Store className="size-5" />} title="การรับจองและข้อมูลร้าน" desc="ความจุต่อช่วงเวลา เงื่อนไขการยกเลิก และช่องทางติดต่อ">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="max_slot">ลูกค้าสูงสุดต่อช่วงเวลา (ท่าน)</label>
          <input id="max_slot" type="number" min={1} max={100} className="input" value={s.max_customers_per_slot} onChange={num('max_customers_per_slot')} />
          <p className="mt-1 text-xs text-forest-500">ใช้จริง {capacity} ท่าน (ไม่เกินจำนวนหมอนวดที่พร้อม {activeTherapists} คน)</p>
          <FieldError msg={errors.max_customers_per_slot} />
        </div>
        <div>
          <label className="label" htmlFor="interval">ช่วงห่างของเวลาเริ่ม</label>
          <select id="interval" className="input" value={s.slot_interval_minutes} onChange={num('slot_interval_minutes')}>
            {[15, 30, 60].map((m) => <option key={m} value={m}>ทุก {m} นาที</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="max_guests">จำนวนผู้ใช้บริการสูงสุดต่อการจอง</label>
          <input id="max_guests" type="number" min={1} max={20} className="input" value={s.max_guests_per_booking} onChange={num('max_guests_per_booking')} />
          <FieldError msg={errors.max_guests_per_booking} />
        </div>
        <div>
          <label className="label" htmlFor="cancel_h">ลูกค้ายกเลิกได้ล่วงหน้า (ชั่วโมง)</label>
          <input id="cancel_h" type="number" min={0} max={72} className="input" value={s.cancel_before_hours} onChange={num('cancel_before_hours')} />
          <FieldError msg={errors.cancel_before_hours} />
        </div>
        <div>
          <label className="label" htmlFor="adv">เปิดให้จองล่วงหน้า (วัน)</label>
          <input id="adv" type="number" min={1} max={365} className="input" value={s.booking_advance_days} onChange={num('booking_advance_days')} />
          <FieldError msg={errors.booking_advance_days} />
        </div>
        <div className="flex items-center gap-3 pt-7">
          <Toggle checked={s.auto_confirm} onChange={(v) => setS({ ...s, auto_confirm: v })} disabled={readOnly} label="ยืนยันการจองอัตโนมัติ" />
          <span className="text-sm">ยืนยันการจองอัตโนมัติ<span className="block text-xs text-forest-500">ปิดไว้ = ร้านต้องกดยืนยันเอง</span></span>
        </div>
        <div>
          <label className="label" htmlFor="phone">เบอร์โทรร้าน</label>
          <input id="phone" className="input" value={s.shop_phone} onChange={txt('shop_phone')} placeholder="0X-XXX-XXXX" />
        </div>
        <div>
          <label className="label" htmlFor="line">LINE ID</label>
          <input id="line" className="input" value={s.shop_line_id} onChange={txt('shop_line_id')} placeholder="@thaithai" />
        </div>
        <div>
          <label className="label" htmlFor="map">ลิงก์แผนที่ (Google Maps)</label>
          <input id="map" className="input" value={s.shop_map_url} onChange={txt('shop_map_url')} placeholder="https://maps.app.goo.gl/..." />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="addr">ที่อยู่ร้าน</label>
          <input id="addr" className="input" value={s.shop_address} onChange={txt('shop_address')} />
        </div>
      </fieldset>
      {!readOnly && <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner className="size-4" /> : <Save className="size-4" />}บันทึก</button></div>}
    </Section>
  )
}

// ---------- หมอนวด ----------
function TherapistsSection({ initial, readOnly, onSaved }: { initial: Therapist[]; readOnly: boolean; onSaved: () => void }) {
  const toast = useToast()
  const [list, setList] = useState(initial)
  const [form, setForm] = useState({ full_name: '', nickname: '', phone: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { setList(initial) }, [initial])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('add')
    setErrors({})
    try {
      const t = await adminApi.createTherapist(form)
      setList((l) => [...l, t])
      setForm({ full_name: '', nickname: '', phone: '' })
      toast.success(`เพิ่มหมอนวด ${t.full_name} แล้ว`)
      onSaved()
    } catch (err) {
      const ae = err as ApiError
      if (ae.fields) setErrors(ae.fields)
      else toast.error(ae.message)
    } finally {
      setBusy(null)
    }
  }

  const toggle = async (t: Therapist, v: boolean) => {
    setBusy(String(t.id))
    try {
      const nt = await adminApi.updateTherapist(t.id, { ...t, is_active: v })
      setList((l) => l.map((x) => (x.id === t.id ? nt : x)))
      toast.success(`${t.full_name}: ${v ? 'พร้อมให้บริการ' : 'ไม่พร้อมให้บริการ'}`)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const active = list.filter((t) => t.is_active).length
  return (
    <Section icon={<Users className="size-5" />} title={`หมอนวด (พร้อมให้บริการ ${active} คน)`} desc="จำนวนหมอนวดที่เปิดอยู่ = จำนวนลูกค้าที่รับพร้อมกันได้ ปิดสวิตช์เมื่อหมอนวดลาหรือหยุด">
      {list.length === 0 && <Alert tone="warning">ยังไม่มีหมอนวด ลูกค้าจะยังจองคิวไม่ได้จนกว่าจะเพิ่มอย่างน้อย 1 คน</Alert>}
      <ul className="divide-y divide-cream-200">
        {list.map((t) => (
          <li key={t.id} className={cn('flex items-center gap-3 py-3', !t.is_active && 'opacity-60')}>
            <span className="grid size-9 place-items-center rounded-full bg-forest-100 text-sm font-semibold text-forest-700">{t.full_name.slice(0, 1)}</span>
            <span className="flex-1 text-sm"><span className="font-medium">{t.full_name}</span>{t.nickname && ` (${t.nickname})`}{t.phone && <span className="block text-xs text-forest-500">{formatPhone(t.phone)}</span>}</span>
            <Toggle checked={t.is_active} disabled={readOnly || busy === String(t.id)} onChange={(v) => toggle(t, v)} label={`สถานะ ${t.full_name}`} />
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form onSubmit={add} className="mt-4 grid gap-3 rounded-2xl bg-cream-100 p-4 sm:grid-cols-[1fr_140px_160px_auto] sm:items-start">
          <div><input className="input" placeholder="ชื่อ-นามสกุล" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required aria-label="ชื่อหมอนวด" /><FieldError msg={errors.full_name} /></div>
          <input className="input" placeholder="ชื่อเล่น" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} aria-label="ชื่อเล่น" />
          <div><input className="input" placeholder="เบอร์โทร (ไม่บังคับ)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="เบอร์โทร" /><FieldError msg={errors.phone} /></div>
          <button className="btn-primary h-[46px]" disabled={busy === 'add'}>{busy === 'add' ? <Spinner className="size-4" /> : <Plus className="size-4" />}เพิ่ม</button>
        </form>
      )}
    </Section>
  )
}

// ---------- เวลาทำการ ----------
function HoursSection({ initial, readOnly }: { initial: BusinessHour[]; readOnly: boolean }) {
  const toast = useToast()
  const [hours, setHours] = useState(() => [...initial].sort((a, b) => ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7)))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const upd = (dow: number, patch: Partial<BusinessHour>) => setHours((h) => h.map((x) => (x.day_of_week === dow ? { ...x, ...patch } : x)))

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      await adminApi.updateHours(hours)
      toast.success('บันทึกเวลาทำการเรียบร้อยแล้ว')
    } catch (e) {
      const ae = e as ApiError
      if (ae.fields) setErrors(ae.fields)
      toast.error(ae.message)
    } finally {
      setSaving(false)
    }
  }

  const applyAll = () => {
    const src = hours[0]
    setHours((h) => h.map((x) => ({ ...x, open_time: src.open_time, close_time: src.close_time, break_start: src.break_start, break_end: src.break_end })))
  }

  return (
    <Section icon={<Clock className="size-5" />} title="เวลาทำการและช่วงเวลาพัก" desc="ช่วงพัก: ร้านจะไม่รับจองที่คาบเกี่ยวช่วงเวลานี้ (เว้นว่างถ้าไม่มี)">
      <fieldset disabled={readOnly} className="space-y-2">
        {hours.map((h) => (
          <div key={h.day_of_week} className="grid items-center gap-2 rounded-xl px-2 py-2 hover:bg-cream-50 sm:grid-cols-[150px_1fr]">
            <label className="flex items-center gap-3 text-sm font-medium">
              <Toggle checked={h.is_open} onChange={(v) => upd(h.day_of_week, { is_open: v })} disabled={readOnly} label={`เปิดวัน${DAY_NAMES[h.day_of_week]}`} />
              {DAY_NAMES[h.day_of_week]}
            </label>
            {h.is_open ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input type="time" className="input w-[8.5rem] py-1.5" value={h.open_time} onChange={(e) => upd(h.day_of_week, { open_time: e.target.value })} aria-label="เวลาเปิด" />
                <span>–</span>
                <input type="time" className="input w-[8.5rem] py-1.5" value={h.close_time} onChange={(e) => upd(h.day_of_week, { close_time: e.target.value })} aria-label="เวลาปิด" />
                <span className="ml-2 text-forest-500">พัก</span>
                <input type="time" className="input w-[8.5rem] py-1.5" value={h.break_start} onChange={(e) => upd(h.day_of_week, { break_start: e.target.value })} aria-label="เริ่มพัก" />
                <span>–</span>
                <input type="time" className="input w-[8.5rem] py-1.5" value={h.break_end} onChange={(e) => upd(h.day_of_week, { break_end: e.target.value })} aria-label="สิ้นสุดพัก" />
                {h.break_start && <button type="button" className="text-xs text-forest-500 underline" onClick={() => upd(h.day_of_week, { break_start: '', break_end: '' })}>ไม่มีพัก</button>}
              </div>
            ) : <span className="text-sm text-red-600">ปิดทำการ</span>}
            {errors[`day_${h.day_of_week}`] && <p className="text-xs text-red-600 sm:col-start-2">{errors[`day_${h.day_of_week}`]}</p>}
          </div>
        ))}
      </fieldset>
      {!readOnly && (
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button className="btn-outline" onClick={applyAll}>ใช้เวลาของวันจันทร์กับทุกวัน</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner className="size-4" /> : <Save className="size-4" />}บันทึกเวลาทำการ</button>
        </div>
      )}
    </Section>
  )
}

// ---------- วันหยุด ----------
function HolidaySection({ initial, readOnly }: { initial: { id: number; date: string; name: string }[]; readOnly: boolean }) {
  const toast = useToast()
  const [list, setList] = useState(initial)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('add')
    try {
      const h = await adminApi.addHoliday(date, name)
      setList((l) => [...l, h].sort((a, b) => a.date.localeCompare(b.date)))
      setDate(''); setName('')
      toast.success('เพิ่มวันหยุดเรียบร้อยแล้ว')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const remove = async (id: number) => {
    setBusy(String(id))
    try {
      await adminApi.deleteHoliday(id)
      setList((l) => l.filter((x) => x.id !== id))
      toast.success('ลบวันหยุดเรียบร้อยแล้ว')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section icon={<CalendarOff className="size-5" />} title="วันหยุดร้าน" desc="ลูกค้าจะไม่สามารถเลือกวันที่ตั้งเป็นวันหยุดได้ (การจองเดิมในวันนั้นไม่ถูกยกเลิกอัตโนมัติ)">
      {list.length === 0 ? <p className="text-sm text-forest-500">ยังไม่มีวันหยุดที่กำหนดไว้</p> : (
        <ul className="divide-y divide-cream-200">
          {list.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2.5 text-sm">
              <span><span className="font-medium">{thaiDateLong(h.date)}</span>{h.name && <span className="text-forest-500"> — {h.name}</span>}</span>
              {!readOnly && <button className="rounded-full p-2 text-red-500 hover:bg-red-50" onClick={() => remove(h.id)} disabled={busy === String(h.id)} aria-label="ลบวันหยุด">{busy === String(h.id) ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}</button>}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <form onSubmit={add} className="mt-4 grid gap-3 rounded-2xl bg-cream-100 p-4 sm:grid-cols-[180px_1fr_auto]">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="วันที่หยุด" />
          <input className="input" placeholder="ชื่อวันหยุด เช่น วันสงกรานต์" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="ชื่อวันหยุด" />
          <button className="btn-primary" disabled={busy === 'add'}>{busy === 'add' ? <Spinner className="size-4" /> : <Plus className="size-4" />}เพิ่มวันหยุด</button>
        </form>
      )}
    </Section>
  )
}

// ---------- ผู้ใช้งาน (เจ้าของร้าน) ----------
function UsersSection() {
  const toast = useToast()
  const { user } = useAuth()
  const { data, reload } = useAsync(() => adminApi.users(), [])
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'staff' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await adminApi.createUser(form)
      toast.success('เพิ่มผู้ใช้งานเรียบร้อยแล้ว')
      setForm({ email: '', password: '', full_name: '', role: 'staff' })
      reload(true)
    } catch (err) {
      const ae = err as ApiError
      if (ae.fields) setErrors(ae.fields)
      else toast.error(ae.message)
    } finally {
      setBusy(false)
    }
  }
  const toggle = async (u: AdminUser, v: boolean) => {
    try {
      await adminApi.setUserActive(u.id, v)
      toast.success(`${u.full_name}: ${v ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`)
      reload(true)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Section icon={<UserPlus className="size-5" />} title="บัญชีผู้ใช้งานหลังร้าน" desc="เพิ่มบัญชีพนักงานสำหรับจัดการคิวและการจอง">
      <ul className="divide-y divide-cream-200">
        {data?.map((u) => (
          <li key={u.id} className={cn('flex items-center gap-3 py-3 text-sm', !u.is_active && 'opacity-60')}>
            <span className="flex-1"><span className="font-medium">{u.full_name}</span> <span className="text-xs text-forest-500">({u.role === 'owner' ? 'เจ้าของร้าน' : 'พนักงาน'})</span><span className="block text-xs text-forest-500">{u.email}</span></span>
            <Toggle checked={!!u.is_active} onChange={(v) => toggle(u, v)} disabled={u.id === user?.id} label={`เปิดใช้งาน ${u.full_name}`} />
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 grid gap-3 rounded-2xl bg-cream-100 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_130px_auto] lg:items-start">
        <div><input className="input" placeholder="ชื่อ" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required aria-label="ชื่อผู้ใช้" /><FieldError msg={errors.full_name} /></div>
        <div><input className="input" type="email" placeholder="อีเมล" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required aria-label="อีเมล" /><FieldError msg={errors.email} /></div>
        <div><input className="input" type="password" placeholder="รหัสผ่าน (8 ตัวขึ้นไป)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} aria-label="รหัสผ่าน" autoComplete="new-password" /><FieldError msg={errors.password} /></div>
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="บทบาท"><option value="staff">พนักงาน</option><option value="owner">เจ้าของร้าน</option></select>
        <button className="btn-primary h-[46px]" disabled={busy}>{busy ? <Spinner className="size-4" /> : <Plus className="size-4" />}เพิ่ม</button>
      </form>
    </Section>
  )
}

// ---------- เปลี่ยนรหัสผ่าน ----------
function PasswordSection() {
  const toast = useToast()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await adminApi.changePassword(cur, next)
      toast.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')
      setCur(''); setNext('')
    } catch (err) {
      const ae = err as ApiError
      if (ae.fields) setErrors(ae.fields)
      else toast.error(ae.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section icon={<KeyRound className="size-5" />} title="เปลี่ยนรหัสผ่านของฉัน">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <div><input type="password" className="input" placeholder="รหัสผ่านปัจจุบัน" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" aria-label="รหัสผ่านปัจจุบัน" /><FieldError msg={errors.current_password} /></div>
        <div><input type="password" className="input" placeholder="รหัสผ่านใหม่ (8 ตัวขึ้นไป)" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" aria-label="รหัสผ่านใหม่" /><FieldError msg={errors.new_password} /></div>
        <button className="btn-primary h-[46px]" disabled={busy}>{busy && <Spinner className="size-4" />}เปลี่ยนรหัสผ่าน</button>
      </form>
    </Section>
  )
}
