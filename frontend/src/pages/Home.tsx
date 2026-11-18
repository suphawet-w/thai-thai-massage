import { ArrowRight, Award, CalendarCheck, Clock, Leaf, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { HeroIllustration } from '../components/Illustrations'
import ServiceCard from '../components/ServiceCard'
import { Alert, LoadingBlock, SectionHeading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { publicApi } from '../lib/api'

const HERO_IMAGE = import.meta.env.VITE_HERO_IMAGE_URL as string | undefined

const HIGHLIGHTS = [
  { icon: Award, title: 'หมอนวดผู้ชำนาญ', text: 'ผ่านการฝึกอบรมศาสตร์การนวดแผนไทยอย่างถูกต้อง ดูแลด้วยความใส่ใจ' },
  { icon: Leaf, title: 'สมุนไพรไทยแท้', text: 'ลูกประคบและน้ำมันหอมระเหยจากสมุนไพรธรรมชาติ อ่อนโยนต่อผิว' },
  { icon: Sparkles, title: 'สะอาด สงบ ผ่อนคลาย', text: 'ห้องนวดสะอาด เปลี่ยนผ้าทุกครั้ง บรรยากาศอบอุ่นเป็นส่วนตัว' },
  { icon: CalendarCheck, title: 'จองคิวออนไลน์ 24 ชม.', text: 'เลือกบริการ วัน และเวลาได้เอง เห็นช่วงเวลาว่างแบบเรียลไทม์' },
]

export default function Home() {
  const { data: services, loading, error, reload } = useAsync(() => publicApi.services(), [])
  const popular = (services ?? []).filter((s) => s.is_popular).slice(0, 4)
  const featured = popular.length ? popular : (services ?? []).slice(0, 4)

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-thai-pattern opacity-60" aria-hidden />
        <div className="absolute -left-32 top-20 size-96 rounded-full bg-gold-200/40 blur-3xl" aria-hidden />
        <div className="container-page relative grid items-center gap-12 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
          <div className="animate-fade-up">
            <p className="eyebrow mb-4 flex items-center gap-2"><span className="h-px w-8 bg-gold-500" />Thai Wellness & Spa</p>
            <h1 className="text-4xl font-semibold leading-[1.3] text-forest-950 sm:text-5xl lg:text-[2.9rem] xl:text-[3.2rem]">
              ผ่อนคลายทุกสัมผัส<br />
              <span className="relative inline-block text-forest-700 sm:whitespace-nowrap">
                ด้วยศาสตร์นวดแผนไทย
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 9c60-6 120-7 296-3" stroke="#c6a35f" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-forest-600">
              ร้านนวดไท๊ไทย ดูแลคุณด้วยการนวดแผนไทย นวดน้ำมัน นวดเท้า และประคบสมุนไพร
              ช่วยคลายความเมื่อยล้า ฟื้นฟูร่างกาย ให้คุณกลับมาสดชื่นอีกครั้ง
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/booking" className="btn-primary px-7 py-3.5 text-base shadow-lg shadow-forest-900/15">
                <CalendarCheck className="size-5" />จองคิวเลย
              </Link>
              <Link to="/services" className="btn-outline px-7 py-3.5 text-base">ดูบริการทั้งหมด<ArrowRight className="size-4" /></Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-forest-600">
              <span className="flex items-center gap-2"><Clock className="size-4 text-gold-600" />เปิดบริการ 10:00–20:00 น.</span>
              <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-gold-600" />ยืนยันคิวทันที ไม่ต้องรอสาย</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-fade-up lg:max-w-none" style={{ animationDelay: '150ms' }}>
            <div className="absolute inset-6 -rotate-3 rounded-[3rem] bg-gold-300/40" aria-hidden />
            <div className="relative overflow-hidden rounded-[3rem] bg-cream-200 shadow-2xl shadow-forest-900/20 ring-1 ring-white/60">
              {HERO_IMAGE
                ? <img src={HERO_IMAGE} alt="บรรยากาศภายในร้านนวดไท๊ไทย" className="aspect-square w-full object-cover" />
                : <HeroIllustration className="aspect-square w-full" />}
            </div>
            <div className="absolute -bottom-5 -left-3 card flex items-center gap-3 px-5 py-3.5 animate-float sm:-left-8">
              <div className="rounded-full bg-forest-800 p-2.5 text-gold-300"><Leaf className="size-5" /></div>
              <div>
                <p className="text-sm font-semibold text-forest-900">สมุนไพรไทย 100%</p>
                <p className="text-xs text-forest-500">ลูกประคบทำสดใหม่ทุกวัน</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- จุดเด่น ---------- */}
      <section className="container-page py-16">
        <SectionHeading eyebrow="Why Thai Thai" title="ทำไมต้องร้านนวดไท๊ไทย" center>
          เราใส่ใจทุกรายละเอียด เพื่อให้ทุกการมาใช้บริการเป็นช่วงเวลาแห่งการพักผ่อนอย่างแท้จริง
        </SectionHeading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.title} className="card p-6 text-center animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gold-200/60 text-gold-700"><h.icon className="size-6" /></div>
              <h3 className="font-semibold text-forest-900">{h.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-forest-600">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- บริการยอดนิยม ---------- */}
      <section className="bg-cream-200/50 py-16">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Popular Treatments" title="บริการยอดนิยม" />
            <Link to="/services" className="btn-ghost mb-10">ดูบริการทั้งหมด<ArrowRight className="size-4" /></Link>
          </div>
          {loading && <LoadingBlock text="กำลังโหลดบริการ..." />}
          {error && <Alert tone="error" title="โหลดรายการบริการไม่สำเร็จ" onRetry={() => reload()}>{error}</Alert>}
          {!loading && !error && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((s, i) => <ServiceCard key={s.id} service={s} index={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* ---------- ขั้นตอนการจอง ---------- */}
      <section className="container-page py-16">
        <SectionHeading eyebrow="How to Book" title="จองคิวง่าย ๆ ใน 4 ขั้นตอน" center />
        <ol className="grid gap-5 md:grid-cols-4">
          {['เลือกบริการที่ต้องการ', 'เลือกวันและเวลาที่ว่าง', 'กรอกชื่อและเบอร์โทรศัพท์', 'รับหมายเลขการจองทันที'].map((t, i) => (
            <li key={t} className="relative flex items-center gap-4 rounded-2xl border border-cream-300 bg-white/60 p-5 md:flex-col md:text-center">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-800 text-lg font-semibold text-gold-300">{i + 1}</span>
              <span className="font-medium text-forest-800">{t}</span>
            </li>
          ))}
        </ol>
        <div className="mt-12 overflow-hidden rounded-[2rem] bg-forest-800 px-8 py-12 text-center text-cream-50 shadow-xl relative">
          <div className="absolute inset-0 bg-thai-pattern opacity-30" aria-hidden />
          <h2 className="relative text-2xl font-semibold sm:text-3xl">พร้อมผ่อนคลายแล้วหรือยัง?</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-cream-200/80">จองคิวล่วงหน้าออนไลน์ เลือกเวลาที่สะดวก ไม่ต้องรอคิวหน้าร้าน</p>
          <Link to="/booking" className="btn-gold relative mt-7 px-8 py-3.5 text-base"><CalendarCheck className="size-5" />จองคิวเลย</Link>
        </div>
      </section>
    </>
  )
}
