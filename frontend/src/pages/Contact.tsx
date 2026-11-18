import { CalendarOff, Clock, ExternalLink, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, LoadingBlock, SectionHeading, cn } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { publicApi } from '../lib/api'
import { DAY_NAMES, formatPhone, parseDate, thaiDateLong } from '../lib/format'

export default function Contact() {
  const { data: shop, loading, error, reload } = useAsync(() => publicApi.shopInfo(), [])
  const todayDow = shop ? parseDate(shop.today).getDay() : -1
  // เรียงจันทร์ → อาทิตย์
  const hours = shop ? [...shop.business_hours].sort((a, b) => ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7)) : []

  return (
    <div className="container-page py-12">
      <SectionHeading eyebrow="Contact Us" title="ติดต่อเรา" center>สอบถามข้อมูลเพิ่มเติม หรือจองคิวผ่านช่องทางที่สะดวก</SectionHeading>
      {loading && <LoadingBlock />}
      {error && <Alert tone="error" title="โหลดข้อมูลร้านไม่สำเร็จ" onRetry={() => reload()}>{error}</Alert>}
      {shop && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="card space-y-5 p-7 lg:col-span-2">
            <h2 className="text-lg font-semibold">ร้านนวดไท๊ไทย (Thai Thai Massage)</h2>
            {shop.phone && (
              <a href={`tel:${shop.phone}`} className="flex items-center gap-4 rounded-xl p-2 -m-2 hover:bg-cream-100">
                <span className="grid size-11 place-items-center rounded-xl bg-forest-800 text-gold-300"><Phone className="size-5" /></span>
                <span><span className="block text-xs text-forest-500">โทรศัพท์</span><span className="font-medium">{formatPhone(shop.phone)}</span></span>
              </a>
            )}
            {shop.line_id && (
              <div className="flex items-center gap-4">
                <span className="grid size-11 place-items-center rounded-xl bg-forest-800 text-gold-300"><MessageCircle className="size-5" /></span>
                <span><span className="block text-xs text-forest-500">LINE</span><span className="font-medium">{shop.line_id}</span></span>
              </div>
            )}
            {shop.address && (
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-800 text-gold-300"><MapPin className="size-5" /></span>
                <span>
                  <span className="block text-xs text-forest-500">ที่อยู่</span>
                  <span className="font-medium">{shop.address}</span>
                  {shop.map_url && <a href={shop.map_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-sm text-gold-700 hover:underline">เปิดแผนที่<ExternalLink className="size-3.5" /></a>}
                </span>
              </div>
            )}
            {!shop.phone && !shop.line_id && !shop.address && (
              <p className="text-sm text-forest-500">ร้านยังไม่ได้เพิ่มช่องทางติดต่อ สามารถจองคิวออนไลน์ได้ตลอด 24 ชั่วโมง</p>
            )}
            <Link to="/booking" className="btn-primary w-full py-3">จองคิวออนไลน์</Link>
          </div>

          <div className="card p-7 lg:col-span-3">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Clock className="size-5 text-gold-600" />เวลาทำการ</h2>
            <ul className="divide-y divide-cream-200">
              {hours.map((h) => (
                <li key={h.day_of_week} className={cn('flex flex-wrap items-center justify-between gap-2 py-3', h.day_of_week === todayDow && 'font-medium')}>
                  <span className="flex items-center gap-2">
                    วัน{DAY_NAMES[h.day_of_week]}
                    {h.day_of_week === todayDow && <span className="rounded-full bg-gold-200 px-2 py-0.5 text-[11px] text-gold-700">วันนี้</span>}
                  </span>
                  {h.is_open
                    ? <span className="text-forest-700">{h.open_time}–{h.close_time} น.{h.break_start && <span className="ml-2 text-xs text-forest-500">(พัก {h.break_start}–{h.break_end})</span>}</span>
                    : <span className="text-red-600">ปิดทำการ</span>}
                </li>
              ))}
            </ul>
            {shop.holidays.length > 0 && (
              <div className="mt-6 rounded-xl bg-cream-100 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium"><CalendarOff className="size-4 text-red-500" />วันหยุดร้านที่กำลังจะถึง</p>
                <ul className="space-y-1 text-sm text-forest-600">
                  {shop.holidays.slice(0, 6).map((h) => <li key={h.id}>• {thaiDateLong(h.date)}{h.name && ` — ${h.name}`}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-6 text-xs text-forest-500">
              ยกเลิกการจองออนไลน์ได้ล่วงหน้าอย่างน้อย {shop.cancel_before_hours} ชั่วโมงก่อนเวลานัด • จองล่วงหน้าได้สูงสุด {shop.booking_advance_days} วัน
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
