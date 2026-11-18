import type {
  AdminUser, AvailabilityResponse, Booking, BookingPage, BusinessHour, DashboardStats, DayAvailability,
  Holiday, QueueStatus, Service, Settings, ShopInfo, Therapist,
} from './types'

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'ttm_admin_token'

export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>
  constructor(message: string, status: number, code: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

interface Envelope<T> { success: boolean; message: string; data: T }

async function request<T = unknown>(method: string, path: string, body?: unknown, opts: { auth?: boolean; raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.auth) {
    const t = tokenStore.get()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  let res: Response
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 0, 'NETWORK_ERROR')
  }
  let json: any = null
  try { json = await res.json() } catch { /* ไม่ใช่ JSON */ }
  if (!res.ok || json?.success === false) {
    if (res.status === 401 && opts.auth) onUnauthorized?.()
    throw new ApiError(json?.message ?? `เกิดข้อผิดพลาด (${res.status})`, res.status, json?.error?.code ?? 'UNKNOWN', json?.error?.fields)
  }
  return (opts.raw ? json : (json as Envelope<T>).data) as T
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ---------- Public ----------
export const publicApi = {
  services: () => request<Service[]>('GET', '/api/services'),
  shopInfo: () => request<ShopInfo>('GET', '/api/shop-info'),
  availability: (date: string, serviceIds: number[], guests: number, time?: string) =>
    request<AvailabilityResponse>('GET', `/api/availability${qs({ date, service_ids: serviceIds.join(','), guests, time })}`, undefined, { raw: true }),
  createBooking: (input: { service_ids: number[]; date: string; time: string; guests: number; full_name: string; phone: string; note: string }) =>
    request<Booking>('POST', '/api/bookings', { ...input, source: 'web' }),
  getBooking: (code: string, phone: string) => request<Booking>('GET', `/api/bookings/${encodeURIComponent(code)}${qs({ phone })}`),
  cancelBooking: (code: string, phone: string, reason: string) =>
    request<Booking>('PATCH', `/api/bookings/${encodeURIComponent(code)}/cancel`, { phone, reason }),
  queueStatus: (code?: string, phone?: string) => request<QueueStatus>('GET', `/api/queue/status${qs({ booking_id: code, phone })}`),
}

// ---------- Admin ----------
const A = { auth: true }
export const adminApi = {
  login: (email: string, password: string) => request<{ token: string; user: AdminUser }>('POST', '/api/admin/login', { email, password }),
  me: () => request<AdminUser>('GET', '/api/admin/me', undefined, A),
  changePassword: (current_password: string, new_password: string) =>
    request('POST', '/api/admin/me/password', { current_password, new_password }, A),
  users: () => request<AdminUser[]>('GET', '/api/admin/users', undefined, A),
  createUser: (u: { email: string; password: string; full_name: string; role: string }) => request<AdminUser>('POST', '/api/admin/users', u, A),
  setUserActive: (id: string, is_active: boolean) => request('PATCH', `/api/admin/users/${id}`, { is_active }, A),

  dashboard: (date?: string) => request<DashboardStats>('GET', `/api/admin/dashboard${qs({ date })}`, undefined, A),
  bookings: (f: { q?: string; date?: string; status?: string; page?: number; page_size?: number }) =>
    request<BookingPage>('GET', `/api/admin/bookings${qs(f)}`, undefined, A),
  booking: (id: string) => request<Booking>('GET', `/api/admin/bookings/${id}`, undefined, A),
  updateStatus: (id: string, status: string, reason = '') => request<Booking>('PATCH', `/api/admin/bookings/${id}/status`, { status, reason }, A),
  reschedule: (id: string, date: string, time: string) => request<Booking>('PATCH', `/api/admin/bookings/${id}/reschedule`, { date, time }, A),
  assignTherapist: (id: string, therapist_id: number | null) => request<Booking>('PATCH', `/api/admin/bookings/${id}/therapist`, { therapist_id }, A),
  bookingAvailability: (id: string, date: string) => request<DayAvailability>('GET', `/api/admin/bookings/${id}/availability${qs({ date })}`, undefined, A),

  queue: (date?: string) => request<{ date: string; items: Booking[]; status: QueueStatus }>('GET', `/api/admin/queue${qs({ date })}`, undefined, A),
  callNext: (date: string) => request<Booking>('POST', '/api/admin/queue/call-next', { date }, A),
  callBooking: (id: string) => request<Booking>('POST', `/api/admin/queue/${id}/call`, {}, A),

  services: () => request<Service[]>('GET', '/api/admin/services', undefined, A),
  createService: (s: Partial<Service>) => request<Service>('POST', '/api/admin/services', s, A),
  updateService: (id: number, s: Partial<Service>) => request<Service>('PUT', `/api/admin/services/${id}`, s, A),
  setServiceActive: (id: number, is_active: boolean) => request<Service>('PATCH', `/api/admin/services/${id}/active`, { is_active }, A),

  settings: () => request<{ settings: Settings; business_hours: BusinessHour[]; holidays: Holiday[]; therapists: Therapist[] }>('GET', '/api/admin/settings', undefined, A),
  updateSettings: (s: Settings) => request<Settings>('PUT', '/api/admin/settings', s, A),
  updateHours: (h: BusinessHour[]) => request<BusinessHour[]>('PUT', '/api/admin/business-hours', h, A),
  addHoliday: (date: string, name: string) => request<Holiday>('POST', '/api/admin/holidays', { date, name }, A),
  deleteHoliday: (id: number) => request('DELETE', `/api/admin/holidays/${id}`, undefined, A),
  createTherapist: (t: Partial<Therapist>) => request<Therapist>('POST', '/api/admin/therapists', t, A),
  updateTherapist: (id: number, t: Partial<Therapist>) => request<Therapist>('PUT', `/api/admin/therapists/${id}`, t, A),

  eventsUrl: () => `${API_BASE}/api/admin/events?access_token=${encodeURIComponent(tokenStore.get() ?? '')}`,
}
