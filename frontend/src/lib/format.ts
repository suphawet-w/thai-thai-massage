// ตัวช่วยจัดรูปแบบวันที่/เวลา/ราคาเป็นภาษาไทย

/** แปลง "YYYY-MM-DD" เป็น Date ตามปฏิทินท้องถิ่น (ไม่ให้เลื่อนวันเพราะ timezone) */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** เช่น "วันพฤหัสบดีที่ 20 พฤศจิกายน 2569" */
export function thaiDateLong(iso: string): string {
  return new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(iso))
}

/** เช่น "20 พ.ย. 69" */
export function thaiDateShort(iso: string): string {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(parseDate(iso))
}

export function thaiDateTime(ts: string | null): string {
  if (!ts) return '-'
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
}

export const baht = (n: number) => `${n.toLocaleString('th-TH')} บาท`

export function durationText(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} ชั่วโมง ${m} นาที`
  if (h) return `${h} ชั่วโมง`
  return `${m} นาที`
}

export function addMinutes(hm: string, min: number): string {
  const [h, m] = hm.split(':').map(Number)
  const t = h * 60 + m + min
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

/** แสดงเบอร์โทรแบบ 081-234-5678 */
export function formatPhone(p: string): string {
  if (/^0\d{9}$/.test(p)) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`
  if (/^0\d{8}$/.test(p)) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`
  return p
}

export function isValidPhone(raw: string): boolean {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('66') && (d.length === 11 || d.length === 10)) d = '0' + d.slice(2)
  return /^0\d{8,9}$/.test(d)
}
