import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addDays, parseDate, toISODate } from '../../lib/format'
import type { ShopInfo } from '../../lib/types'
import { cn } from '../ui'

const WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

/** Date Picker แบบปฏิทิน: ปิดวันที่ผ่านมาแล้ว วันหยุดร้าน วันที่ร้านปิด และวันที่เกินกำหนดจองล่วงหน้า */
export default function Calendar({ shop, value, onChange }: { shop: ShopInfo; value: string; onChange: (d: string) => void }) {
  const today = shop.today
  const maxDate = addDays(today, shop.booking_advance_days)
  const [month, setMonth] = useState(() => {
    const d = parseDate(value || today)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const holidays = useMemo(() => new Map(shop.holidays.map((h) => [h.date, h.name])), [shop.holidays])
  const closedDows = useMemo(() => new Set(shop.business_hours.filter((h) => !h.is_open).map((h) => h.day_of_week)), [shop.business_hours])

  const cells = useMemo(() => {
    const first = new Date(month)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [month])

  const minMonth = parseDate(today)
  const maxMonth = parseDate(maxDate)
  const canPrev = month > new Date(minMonth.getFullYear(), minMonth.getMonth(), 1)
  const canNext = month < new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1)
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <div className="select-none">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} className="rounded-full p-2 hover:bg-cream-200 disabled:opacity-30" aria-label="เดือนก่อนหน้า"><ChevronLeft className="size-5" /></button>
        <p className="font-semibold text-forest-900">{new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(month)}</p>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} className="rounded-full p-2 hover:bg-cream-200 disabled:opacity-30" aria-label="เดือนถัดไป"><ChevronRight className="size-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-forest-500">
        {WEEK.map((w, i) => <div key={w} className={cn('py-1.5', i === 0 && 'text-red-400')}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {cells.map((d) => {
          const iso = toISODate(d)
          const inMonth = d.getMonth() === month.getMonth()
          const holiday = holidays.get(iso)
          const closed = closedDows.has(d.getDay())
          const disabled = iso < today || iso > maxDate || holiday !== undefined || closed
          const selected = iso === value
          const title = holiday !== undefined ? `วันหยุดร้าน${holiday ? `: ${holiday}` : ''}` : closed ? 'ร้านปิดทำการ' : undefined
          return (
            <button key={iso} type="button" disabled={disabled} onClick={() => onChange(iso)} title={title}
              aria-pressed={selected} aria-label={new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' }).format(d) + (title ? ` (${title})` : '')}
              className={cn(
                'relative aspect-square rounded-xl text-sm transition-all',
                !inMonth && 'opacity-35',
                disabled ? 'cursor-not-allowed text-forest-300' : selected ? 'bg-forest-800 font-semibold text-cream-50 shadow-md' : 'text-forest-800 hover:bg-gold-200/60',
                iso === today && !selected && 'ring-1 ring-inset ring-gold-500',
              )}>
              {d.getDate()}
              {holiday !== undefined && inMonth && <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-red-400" />}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-forest-500">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded ring-1 ring-gold-500" />วันนี้</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-red-400" />วันหยุดร้าน</span>
      </div>
    </div>
  )
}
