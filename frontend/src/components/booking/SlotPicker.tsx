import { CalendarX2, Clock } from 'lucide-react'
import type { Slot } from '../../lib/types'
import { EmptyState, cn } from '../ui'

/** แสดงช่วงเวลา: ว่าง = เลือกได้, เต็ม/ช่วงพัก = ปิดการเลือก */
export default function SlotPicker({ slots, value, onChange, message }: { slots: Slot[]; value: string; onChange: (s: Slot) => void; message?: string }) {
  const groups = [
    { label: 'ช่วงเช้า', items: slots.filter((s) => s.time < '12:00') },
    { label: 'ช่วงบ่าย', items: slots.filter((s) => s.time >= '12:00' && s.time < '17:00') },
    { label: 'ช่วงเย็น', items: slots.filter((s) => s.time >= '17:00') },
  ].filter((g) => g.items.length)

  if (!slots.length) {
    return <EmptyState icon={<CalendarX2 className="size-6" />} title="ไม่มีช่วงเวลาให้จองในวันนี้">{message ?? 'กรุณาเลือกวันอื่น'}</EmptyState>
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-xs font-medium tracking-wide text-forest-500">{g.label}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.items.map((s) => {
              const selected = s.time === value
              const full = !s.available
              return (
                <button key={s.time} type="button" disabled={full} onClick={() => onChange(s)} title={s.reason}
                  aria-pressed={selected} aria-label={`${s.time} น.${full ? ` — ${s.reason ?? 'ไม่ว่าง'}` : ''}`}
                  className={cn(
                    'flex flex-col items-center rounded-xl border px-2 py-2.5 text-sm transition-all',
                    full ? 'cursor-not-allowed border-cream-200 bg-cream-100 text-forest-300 line-through decoration-forest-300/60'
                      : selected ? 'border-forest-800 bg-forest-800 text-cream-50 shadow-md'
                        : 'border-cream-300 bg-white text-forest-800 hover:border-gold-500 hover:bg-gold-200/30',
                  )}>
                  <span className="flex items-center gap-1 font-medium"><Clock className={cn('size-3.5', full && 'opacity-40')} />{s.time}</span>
                  <span className={cn('mt-0.5 text-[10px] no-underline', selected ? 'text-gold-300' : full ? 'text-forest-400' : 'text-forest-500')}>
                    {full ? (s.reason?.includes('พัก') ? 'ช่วงพัก' : 'เต็ม') : s.remaining <= 1 ? 'เหลือ 1 ที่' : `ว่าง ${s.remaining} ที่`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
