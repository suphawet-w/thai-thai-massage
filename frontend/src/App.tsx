import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import { LoadingBlock } from './components/ui'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Booking from './pages/Booking'
import CheckBooking from './pages/CheckBooking'
import Contact from './pages/Contact'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Services from './pages/Services'

// หน้าหลังร้านโหลดแยก (ลูกค้าไม่ต้องดาวน์โหลดโค้ดส่วนนี้)
const AdminLogin = lazy(() => import('./pages/admin/Login'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Overview = lazy(() => import('./pages/admin/Overview'))
const Bookings = lazy(() => import('./pages/admin/Bookings'))
const Queue = lazy(() => import('./pages/admin/Queue'))
const ServicesAdmin = lazy(() => import('./pages/admin/ServicesAdmin'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'))

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingBlock />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="services" element={<Services />} />
                <Route path="booking" element={<Booking />} />
                <Route path="booking/check" element={<CheckBooking />} />
                <Route path="contact" element={<Contact />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="admin/login" element={<AdminLogin />} />
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Overview />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="queue" element={<Queue />} />
                <Route path="services" element={<ServicesAdmin />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
