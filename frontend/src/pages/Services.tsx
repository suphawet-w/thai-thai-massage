import { Flower2 } from 'lucide-react'
import ServiceCard from '../components/ServiceCard'
import { Alert, EmptyState, LoadingBlock, SectionHeading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { publicApi } from '../lib/api'

export default function Services() {
  const { data, loading, error, reload } = useAsync(() => publicApi.services(), [])

  return (
    <div className="container-page py-12">
      <SectionHeading eyebrow="Our Treatments" title="บริการของเรา" center>
        เลือกบริการที่เหมาะกับคุณ ทุกบริการดูแลโดยหมอนวดผู้ชำนาญ ราคาต่อท่าน
      </SectionHeading>
      {loading && <LoadingBlock text="กำลังโหลดบริการ..." />}
      {error && <Alert tone="error" title="โหลดรายการบริการไม่สำเร็จ" onRetry={() => reload()}>{error}</Alert>}
      {data && data.length === 0 && <EmptyState icon={<Flower2 />} title="ยังไม่มีบริการที่เปิดให้จอง">กรุณากลับมาใหม่อีกครั้ง</EmptyState>}
      {data && data.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s, i) => <ServiceCard key={s.id} service={s} index={i} />)}
        </div>
      )}
    </div>
  )
}
