import { CalendarDays, Clock, Hash, Phone, Receipt, Ticket, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { baht, durationText, formatPhone, thaiDateLong } from '../lib/format'
import type { Booking } from '../lib/types'
import { StatusBadge } from './ui'

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-gold-600">{icon}</span>
      <span className="w-28 shrink-0 text-sm text-forest-500">{label}</span>
      <span className="flex-1 text-sm font-medium text-forest-900">{children}</span>
    </div>
  )
}

/** แสดงรายละเอียดการจอง (ใช้ทั้งหน้าจองสำเร็จ และหน้าตรวจสอบการจอง) */
export default function BookingDetails({ booking }: { booking: Booking }) {
  return (
    <div className="divide-y divide-cream-200">
      <Row icon={<Hash className="size-4" />} label="หมายเลขการจอง"><span className="font-mono tracking-wider">{booking.booking_id}</span></Row>
      {booking.queue_code && <Row icon={<Ticket className="size-4" />} label="หมายเลขคิว">{booking.queue_code}</Row>}
      <Row icon={<Receipt className="size-4" />} label="สถานะ"><StatusBadge status={booking.status} /></Row>
      <Row icon={<User className="size-4" />} label="ชื่อผู้จอง">{booking.customer_name}</Row>
      <Row icon={<Phone className="size-4" />} label="เบอร์โทรศัพท์">{formatPhone(booking.customer_phone)}</Row>
      <Row icon={<Receipt className="size-4" />} label="บริการ">
        <ul className="space-y-0.5">{booking.services.map((s, i) => <li key={i}>{s.name}</li>)}</ul>
      </Row>
      <Row icon={<CalendarDays className="size-4" />} label="วันที่">{thaiDateLong(booking.service_date)}</Row>
      <Row icon={<Clock className="size-4" />} label="เวลา">{booking.start_time} – {booking.end_time} น. <span className="font-normal text-forest-500">({durationText(booking.total_duration)})</span></Row>
      <Row icon={<Users className="size-4" />} label="จำนวน">{booking.guests} ท่าน</Row>
      <Row icon={<Receipt className="size-4" />} label="ราคารวม"><span className="text-lg text-forest-800">{baht(booking.total_price)}</span></Row>
      {booking.note && <Row icon={<Receipt className="size-4" />} label="หมายเหตุ"><span className="font-normal">{booking.note}</span></Row>}
      {booking.status === 'cancelled' && booking.cancel_reason && <Row icon={<Receipt className="size-4" />} label="เหตุผลยกเลิก"><span className="font-normal">{booking.cancel_reason}</span></Row>}
    </div>
  )
}
