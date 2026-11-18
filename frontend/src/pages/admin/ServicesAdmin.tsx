import { Pencil, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/admin/AdminUI'
import { ServiceIcon } from '../../components/Illustrations'
import { Alert, FieldError, LoadingBlock, Modal, Spinner, Toggle, cn } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { ApiError, adminApi } from '../../lib/api'
import { baht, durationText } from '../../lib/format'
import type { Service } from '../../lib/types'

type Form = { name: string; description: string; duration_minutes: number; price: number; is_popular: boolean; is_active: boolean; sort_order: number }
const EMPTY: Form = { name: '', description: '', duration_minutes: 60, price: 0, is_popular: false, is_active: true, sort_order: 0 }

export default function ServicesAdmin() {
  const toast = useToast()
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.services(), [])
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const openEdit = (s: Service | 'new') => {
    setEditing(s)
    setErrors({})
    setForm(s === 'new' ? EMPTY : { name: s.name, description: s.description, duration_minutes: s.duration_minutes, price: s.price, is_popular: s.is_popular, is_active: s.is_active, sort_order: s.sort_order })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      if (editing === 'new') await adminApi.createService(form)
      else if (editing) await adminApi.updateService(editing.id, form)
      toast.success(editing === 'new' ? 'เพิ่มบริการเรียบร้อยแล้ว' : 'บันทึกบริการเรียบร้อยแล้ว')
      setEditing(null)
      reload(true)
    } catch (err) {
      const ae = err as ApiError
      if (ae.fields) setErrors(ae.fields)
      else toast.error(ae.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (s: Service, v: boolean) => {
    setToggling(s.id)
    try {
      const ns = await adminApi.setServiceActive(s.id, v)
      setData((list) => list?.map((x) => (x.id === ns.id ? ns : x)) ?? null)
      toast.success(v ? `เปิดบริการ "${s.name}" แล้ว` : `ปิดบริการ "${s.name}" ชั่วคราวแล้ว`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setToggling(null)
    }
  }

  return (
    <>
      <PageHeader title="จัดการบริการ" subtitle="เพิ่ม แก้ไขราคา ระยะเวลา และเปิด/ปิดบริการชั่วคราว">
        <button className="btn-primary" onClick={() => openEdit('new')}><Plus className="size-4" />เพิ่มบริการใหม่</button>
      </PageHeader>
      {loading && <LoadingBlock />}
      {error && <Alert tone="error" onRetry={() => reload()}>{error}</Alert>}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((s) => (
            <div key={s.id} className={cn('card flex gap-4 p-5 transition-opacity', !s.is_active && 'opacity-60')}>
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-forest-800 text-gold-300"><ServiceIcon name={s.name} className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{s.name}{s.is_popular && <Star className="ml-1.5 inline size-3.5 fill-gold-500 text-gold-500" aria-label="ยอดนิยม" />}</h3>
                  <Toggle checked={s.is_active} disabled={toggling === s.id} onChange={(v) => toggle(s, v)} label={`เปิด/ปิดบริการ ${s.name}`} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-forest-500">{s.description || '—'}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm"><span className="font-semibold">{baht(s.price)}</span> <span className="text-forest-500">• {durationText(s.duration_minutes)}</span>
                    {!s.is_active && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">ปิดชั่วคราว</span>}</p>
                  <button className="btn-ghost btn-sm" onClick={() => openEdit(s)}><Pencil className="size-3.5" />แก้ไข</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'เพิ่มบริการใหม่' : 'แก้ไขบริการ'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="sv-name">ชื่อบริการ</label>
            <input id="sv-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
            <FieldError msg={errors.name} />
          </div>
          <div>
            <label className="label" htmlFor="sv-desc">รายละเอียด</label>
            <textarea id="sv-desc" className="input min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
            <FieldError msg={errors.description} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="sv-dur">ระยะเวลา (นาที)</label>
              <input id="sv-dur" type="number" className="input" min={15} max={480} step={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} required />
              <FieldError msg={errors.duration_minutes} />
            </div>
            <div>
              <label className="label" htmlFor="sv-price">ราคา (บาท)</label>
              <input id="sv-price" type="number" className="input" min={0} max={100000} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
              <FieldError msg={errors.price} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="sv-order">ลำดับการแสดง</label>
              <input id="sv-order" type="number" className="input" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
            <div className="space-y-3 pt-7">
              <label className="flex items-center gap-3 text-sm"><Toggle checked={form.is_popular} onChange={(v) => setForm({ ...form, is_popular: v })} label="ยอดนิยม" />แสดงเป็นบริการยอดนิยม</label>
              <label className="flex items-center gap-3 text-sm"><Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="เปิดให้บริการ" />เปิดให้จอง</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-cream-200 pt-4">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>ยกเลิก</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner className="size-4" />}บันทึก</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
