import type { Booking } from './types'

/** การจองที่บันทึกไว้ในเครื่องของลูกค้า (กันลืมหมายเลขการจอง) */
export interface SavedBooking {
  booking_id: string
  phone: string
  service_date: string
  start_time: string
  saved_at: string
}

const KEY = 'tt_saved_bookings'
const MAX = 10

export function getSavedBookings(): SavedBooking[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x) => x && typeof x.booking_id === 'string' && typeof x.phone === 'string') : []
  } catch {
    return []
  }
}

export function saveBooking(b: Booking) {
  try {
    const item: SavedBooking = {
      booking_id: b.booking_id,
      phone: b.customer_phone,
      service_date: b.service_date,
      start_time: b.start_time,
      saved_at: new Date().toISOString(),
    }
    const rest = getSavedBookings().filter((x) => x.booking_id !== b.booking_id)
    localStorage.setItem(KEY, JSON.stringify([item, ...rest].slice(0, MAX)))
  } catch { /* เบราว์เซอร์ไม่อนุญาตให้บันทึก (เช่น โหมดไม่ระบุตัวตน) */ }
}

export function removeSavedBooking(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getSavedBookings().filter((x) => x.booking_id !== id)))
  } catch { /* ignore */ }
}
