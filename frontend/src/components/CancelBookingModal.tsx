import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { publicApi } from '../lib/api'
import type { Booking } from '../lib/types'
import { Modal, Spinner } from './ui'

/** กล่องยืนยันการยกเลิกการจองฝั่งลูกค้า (ใช้ทั้งหน้าจองสำเร็จและหน้าตรวจสอบการจอง) */
export default function CancelBookingModal({ booking, phone, open, onClose, onCancelled }: {
  booking: Booking | null
  phone: string
  open: boolean
  onClose: () => void
  onCancelled: (b: Booking) => void
}) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const cancel = async () => {
    if (!booking) return
    setCancelling(true)
    try {
      const b = await publicApi.cancelBooking(booking.booking_id, phone, reason)
      setReason('')
      onCancelled(b)
      onClose()
      toast.success(`ยกเลิกการจอง ${b.booking_id} เรียบร้อยแล้ว`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ยืนยันการยกเลิกการจอง">
      <p className="text-sm text-forest-600">ต้องการยกเลิกการจอง <span className="font-mono font-semibold">{booking?.booking_id}</span> ใช่หรือไม่? เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้ด้วยตัวเอง</p>
      <label htmlFor="reason" className="label mt-5">เหตุผล (ไม่บังคับ)</label>
      <textarea id="reason" className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="เช่น ติดธุระกะทันหัน" />
      <div className="mt-6 flex justify-end gap-3">
        <button className="btn-outline" onClick={onClose} disabled={cancelling}>ไม่ยกเลิก</button>
        <button className="btn-danger" onClick={cancel} disabled={cancelling}>{cancelling && <Spinner className="size-4" />}ยืนยันยกเลิก</button>
      </div>
    </Modal>
  )
}
