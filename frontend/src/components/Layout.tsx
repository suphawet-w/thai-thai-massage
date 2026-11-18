import { CalendarCheck, Clock, MapPin, Menu, MessageCircle, Phone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAsync } from '../hooks/useAsync'
import { publicApi } from '../lib/api'
import { formatPhone } from '../lib/format'
import { Logo } from './Illustrations'
import { cn } from './ui'

const NAV = [
  { to: '/', label: 'หน้าแรก', end: true },
  { to: '/services', label: 'บริการของเรา' },
  { to: '/booking', label: 'จองคิว' },
  { to: '/contact', label: 'ติดต่อเรา' },
]

function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn('sticky top-0 z-40 transition-all duration-300', scrolled ? 'bg-cream-50/90 shadow-[0_1px_0_rgba(16,35,26,0.06)] backdrop-blur-md' : 'bg-transparent')}>
      <nav className="container-page flex h-18 items-center justify-between py-3" aria-label="เมนูหลัก">
        <Link to="/" aria-label="ร้านนวดไท๊ไทย หน้าแรก"><Logo /></Link>
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cn('relative rounded-full px-4 py-2 text-sm transition-colors', isActive ? 'text-forest-900 font-medium' : 'text-forest-600 hover:text-forest-900')}>
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-gold-500" />}
                </>
              )}
            </NavLink>
          ))}
          <Link to="/booking/check" className="ml-1 rounded-full px-4 py-2 text-sm text-forest-600 hover:text-forest-900">ตรวจสอบการจอง</Link>
          <Link to="/booking" className="btn-primary ml-2"><CalendarCheck className="size-4" />จองคิวเลย</Link>
        </div>
        <button className="rounded-full p-2 text-forest-800 hover:bg-cream-200 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={open}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-cream-300 bg-cream-50 px-4 pb-5 pt-2 shadow-lg animate-fade-in md:hidden">
          {[...NAV, { to: '/booking/check', label: 'ตรวจสอบการจอง', end: true }].map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cn('block rounded-xl px-4 py-3 text-base', isActive ? 'bg-forest-50 font-medium text-forest-900' : 'text-forest-700')}>
              {n.label}
            </NavLink>
          ))}
          <Link to="/booking" className="btn-primary mt-3 w-full py-3"><CalendarCheck className="size-4" />จองคิวเลย</Link>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const { data: shop } = useAsync(() => publicApi.shopInfo(), [])
  const openDays = shop?.business_hours.filter((h) => h.is_open) ?? []
  const sameHours = openDays.length > 0 && openDays.every((h) => h.open_time === openDays[0].open_time && h.close_time === openDays[0].close_time)

  return (
    <footer className="mt-24 bg-forest-900 text-cream-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-3">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream-300/80">
            ผ่อนคลายร่างกายและจิตใจด้วยศาสตร์การนวดแผนไทย โดยหมอนวดผู้ชำนาญ ในบรรยากาศสงบ อบอุ่น เป็นกันเอง
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-medium tracking-wider text-gold-300">เวลาทำการ</h3>
          <p className="flex items-start gap-2 text-sm">
            <Clock className="mt-1 size-4 shrink-0 text-gold-400" />
            {shop ? (sameHours ? `${openDays.length === 7 ? 'เปิดทุกวัน' : 'วันทำการ'} ${openDays[0].open_time}–${openDays[0].close_time} น.` : 'ดูเวลาทำการแต่ละวันได้ที่หน้าติดต่อเรา') : '...'}
          </p>
          <Link to="/booking/check" className="mt-3 inline-block text-sm text-gold-300 underline-offset-4 hover:underline">ตรวจสอบ / ยกเลิกการจอง</Link>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-medium tracking-wider text-gold-300">ติดต่อเรา</h3>
          <ul className="space-y-2.5 text-sm">
            {shop?.phone && <li className="flex items-center gap-2"><Phone className="size-4 text-gold-400" /><a href={`tel:${shop.phone}`} className="hover:text-white">{formatPhone(shop.phone)}</a></li>}
            {shop?.line_id && <li className="flex items-center gap-2"><MessageCircle className="size-4 text-gold-400" />LINE: {shop.line_id}</li>}
            {shop?.address && <li className="flex items-start gap-2"><MapPin className="mt-1 size-4 shrink-0 text-gold-400" />{shop.address}</li>}
            {shop && !shop.phone && !shop.address && !shop.line_id && <li className="text-cream-300/70">ดูช่องทางติดต่อได้ที่หน้า <Link to="/contact" className="underline">ติดต่อเรา</Link></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-cream-300/60 sm:flex-row">
          <p>© {new Date().getFullYear()} ร้านนวดไท๊ไทย (Thai Thai Massage)</p>
          <Link to="/admin" className="hover:text-cream-200">สำหรับพนักงาน</Link>
        </div>
      </div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">ข้ามไปยังเนื้อหา</a>
      <Navbar />
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}
