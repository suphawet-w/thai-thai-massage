import { CalendarDays, ExternalLink, LayoutDashboard, ListOrdered, LogOut, Menu, Settings, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from '../../components/Illustrations'
import { LoadingBlock, cn } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/admin', label: 'ภาพรวม', icon: LayoutDashboard, end: true },
  { to: '/admin/queue', label: 'จัดการคิววันนี้', icon: ListOrdered },
  { to: '/admin/bookings', label: 'รายการจอง', icon: CalendarDays },
  { to: '/admin/services', label: 'บริการ', icon: Sparkles },
  { to: '/admin/settings', label: 'ตั้งค่าร้าน', icon: Settings },
]

export default function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [loc.pathname])

  if (loading) return <LoadingBlock text="กำลังตรวจสอบสิทธิ์..." />
  if (!user) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6"><Logo light /></div>
      <nav className="flex-1 space-y-1 px-3" aria-label="เมนูหลังร้าน">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors',
              isActive ? 'bg-white/10 font-medium text-gold-300' : 'text-cream-200/80 hover:bg-white/5 hover:text-cream-50')}>
            <n.icon className="size-4.5" />{n.label}
          </NavLink>
        ))}
        <Link to="/" target="_blank" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-cream-200/60 hover:text-cream-50">
          <ExternalLink className="size-4.5" />ดูหน้าเว็บไซต์
        </Link>
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-cream-50">{user.full_name}</p>
        <p className="truncate text-xs text-cream-200/60">{user.role === 'owner' ? 'เจ้าของร้าน' : 'พนักงาน'} • {user.email}</p>
        <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-2 text-sm text-cream-200 hover:bg-white/5">
          <LogOut className="size-4" />ออกจากระบบ
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-forest-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 bg-forest-900 animate-fade-in">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-full p-2 text-cream-200" aria-label="ปิดเมนู"><X className="size-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-cream-300/70 bg-cream-50/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-cream-200" aria-label="เปิดเมนู"><Menu className="size-5" /></button>
          <span className="font-semibold">ร้านนวดไท๊ไทย • หลังร้าน</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
