export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export interface Service {
  id: number
  name: string
  description: string
  duration_minutes: number
  price: number
  is_active: boolean
  is_popular: boolean
  sort_order: number
}

export interface BusinessHour {
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
  break_start: string
  break_end: string
}

export interface Holiday {
  id: number
  date: string
  name: string
}

export interface ShopInfo {
  name: string
  today: string
  business_hours: BusinessHour[]
  holidays: Holiday[]
  booking_advance_days: number
  cancel_before_hours: number
  max_guests_per_booking: number
  phone: string
  address: string
  line_id: string
  map_url: string
}

export interface Slot {
  time: string
  end_time: string
  available: boolean
  remaining: number
  reason?: string
}

export interface AvailabilityResponse {
  success: boolean
  date: string
  available: boolean
  is_open?: boolean
  service: string
  duration_minutes: number
  guests: number
  price: number
  slots?: Slot[]
  available_times?: string[]
  open_time?: string
  close_time?: string
  break_start?: string
  break_end?: string
  time?: string
  end_time?: string
  remaining?: number
  suggested_times?: string[]
  message: string
}

export interface DayAvailability {
  date: string
  is_open: boolean
  message: string
  capacity: number
  slots: Slot[]
}

export interface BookingServiceItem {
  service_id: number
  name: string
  duration_minutes: number
  price: number
}

export interface Booking {
  id: string
  booking_id: string
  customer_name: string
  customer_phone: string
  service_date: string
  start_time: string
  end_time: string
  guests: number
  total_duration: number
  total_price: number
  status: BookingStatus
  status_label: string
  note: string
  source: string
  cancel_reason: string
  cancelled_by: string
  therapist_id: number | null
  therapist_name: string
  queue_code: string
  queue_number: number
  called_at: string | null
  call_count: number
  services: BookingServiceItem[]
  service_names: string
  created_at: string
  confirmed_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  can_cancel: boolean
}

export interface QueueStatus {
  date: string
  now_calling: string
  serving: string[]
  waiting_count: number
  next_queue: string
  total_today: number
  completed: number
  message: string
  my_booking?: {
    booking_id: string
    queue_code: string
    status: BookingStatus
    status_label: string
    start_time: string
    queues_ahead: number
    message: string
  }
}

export interface DashboardStats {
  date: string
  total_today: number
  pending: number
  confirmed: number
  in_progress: number
  in_progress_guests: number
  completed: number
  cancelled: number
  revenue: number
  expected_revenue: number
  active_therapists: number
  capacity_per_slot: number
  pending_all_upcoming: number
  upcoming: Booking[]
}

export interface BookingPage {
  items: Booking[]
  total: number
  page: number
  page_size: number
}

export interface Settings {
  max_customers_per_slot: number
  slot_interval_minutes: number
  cancel_before_hours: number
  booking_advance_days: number
  max_guests_per_booking: number
  auto_confirm: boolean
  shop_phone: string
  shop_address: string
  shop_line_id: string
  shop_map_url: string
}

export interface Therapist {
  id: number
  full_name: string
  nickname: string
  phone: string
  is_active: boolean
}

export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'staff'
  is_active?: boolean
}
