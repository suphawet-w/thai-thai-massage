import { Home } from 'lucide-react'
import { Link } from 'react-router'
import { LotusMark } from '../components/Illustrations'

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <LotusMark className="size-16 animate-float" />
      <h1 className="mt-6 text-3xl font-semibold">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="mt-2 text-forest-600">หน้านี้อาจถูกย้ายหรือไม่มีอยู่แล้ว</p>
      <Link to="/" className="btn-primary mt-8"><Home className="size-4" />กลับหน้าหลัก</Link>
    </div>
  )
}
