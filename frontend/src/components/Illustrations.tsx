// ภาพประกอบ SVG สไตล์ Thai Wellness (วาดเอง ไม่ต้องโหลดไฟล์ภาพจากภายนอก)
import { Flower2, Footprints, Hand, HeartHandshake, Leaf, Sparkles } from 'lucide-react'

export function LotusMark({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#1f3a2c" />
      <g fill="none" stroke="#d9bf86" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M32 13c6.5 7.5 6.5 19 0 27-6.5-8-6.5-19.5 0-27z" />
        <path d="M32 40c-3-9.5-11.5-15.5-20.5-15.5 1 10.5 9.5 16.5 20.5 15.5z" />
        <path d="M32 40c3-9.5 11.5-15.5 20.5-15.5-1 10.5-9.5 16.5-20.5 15.5z" />
        <path d="M17 47h30M22 51.5h20" />
      </g>
    </svg>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <LotusMark className="size-10 shrink-0" />
      <span className="leading-tight">
        <span className={`block text-lg font-semibold ${light ? 'text-cream-50' : 'text-forest-900'}`}>ร้านนวดไท๊ไทย</span>
        <span className={`block text-[11px] tracking-[0.25em] ${light ? 'text-gold-300' : 'text-gold-600'}`}>THAI THAI MASSAGE</span>
      </span>
    </span>
  )
}

/** ภาพ Hero: ห้องสปาโทนอบอุ่น — ลูกประคบ หินร้อน ใบไม้ เทียน และดอกบัว */
export function HeroIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 520" className={className} role="img" aria-label="ภาพประกอบบรรยากาศร้านนวดแผนไทย">
      <defs>
        <linearGradient id="arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a4d3a" />
          <stop offset="1" stopColor="#10231a" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#e8d6aa" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e8d6aa" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="towel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdfbf6" />
          <stop offset="1" stopColor="#e9dfc9" />
        </linearGradient>
        <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a5a52" />
          <stop offset="1" stopColor="#24302a" />
        </linearGradient>
        <radialGradient id="ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f2e7cc" />
          <stop offset="1" stopColor="#c6a35f" />
        </radialGradient>
      </defs>

      {/* ซุ้มประตูทรงไทย */}
      <path d="M70 500V210c0-105 85-180 190-180s190 75 190 180v290z" fill="url(#arch)" />
      <path d="M70 500V210c0-105 85-180 190-180s190 75 190 180v290" fill="none" stroke="#c6a35f" strokeWidth="3" opacity="0.7" />
      <path d="M95 500V215c0-92 74-158 165-158s165 66 165 158v285" fill="none" stroke="#c6a35f" strokeWidth="1.2" opacity="0.35" />
      <circle cx="260" cy="190" r="190" fill="url(#glow)" />

      {/* ใบไม้ที่ห้อยลงมา */}
      <g className="origin-top animate-float" style={{ animationDuration: '7s' }}>
        <path d="M150 60c10 60 5 110-20 150" stroke="#6f977c" strokeWidth="3" fill="none" />
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={i} cx={148 - i * 5} cy={85 + i * 26} rx="9" ry="18" fill={i % 2 ? '#4f7d66' : '#6f977c'} transform={`rotate(${i % 2 ? 35 : -35} ${148 - i * 5} ${85 + i * 26})`} />
        ))}
      </g>

      {/* ดอกบัวกลางซุ้ม */}
      <g transform="translate(260 175)" opacity="0.95">
        <path d="M0-55c16 18 16 45 0 65-16-20-16-47 0-65z" fill="#e8d6aa" />
        <path d="M0 10c-7-23-28-38-50-38 2 26 23 41 50 38z" fill="#d9bf86" />
        <path d="M0 10c7-23 28-38 50-38-2 26-23 41-50 38z" fill="#d9bf86" />
        <path d="M0 10c-14-14-34-18-52-10 10 16 30 20 52 10zM0 10c14-14 34-18 52-10-10 16-30 20-52 10z" fill="#c6a35f" opacity="0.8" />
      </g>

      {/* โต๊ะไม้ */}
      <rect x="40" y="380" width="440" height="22" rx="6" fill="#85683a" />
      <rect x="40" y="398" width="440" height="10" rx="4" fill="#5e4a2a" opacity="0.6" />

      {/* ผ้าขนหนูม้วน */}
      <g>
        <rect x="70" y="330" width="130" height="50" rx="25" fill="url(#towel)" />
        <circle cx="95" cy="355" r="22" fill="#fdfbf6" stroke="#e9dfc9" strokeWidth="2" />
        <path d="M95 341a14 14 0 1 1 -1 0" fill="none" stroke="#e9dfc9" strokeWidth="2" />
        <rect x="80" y="300" width="110" height="34" rx="17" fill="#f3ecdd" />
        <circle cx="100" cy="317" r="15" fill="#fdfbf6" stroke="#e9dfc9" strokeWidth="2" />
      </g>

      {/* ลูกประคบสมุนไพร */}
      <g>
        <path d="M262 300c-8-20-2-34 10-40M290 300c6-20 0-34-12-40" stroke="#a8854a" strokeWidth="3" fill="none" />
        <path d="M268 262c4-6 10-6 14 0" stroke="#85683a" strokeWidth="5" strokeLinecap="round" />
        <circle cx="276" cy="335" r="45" fill="url(#ball)" />
        <path d="M245 320c20 8 42 8 62 0M240 340c24 9 50 9 72 0" stroke="#a8854a" strokeWidth="1.5" fill="none" opacity="0.5" />
      </g>

      {/* หินร้อน */}
      <g>
        <ellipse cx="400" cy="368" rx="52" ry="14" fill="url(#stone)" />
        <ellipse cx="402" cy="346" rx="42" ry="12" fill="url(#stone)" />
        <ellipse cx="398" cy="327" rx="32" ry="10" fill="url(#stone)" />
        <ellipse cx="398" cy="324" rx="18" ry="3" fill="#ffffff" opacity="0.12" />
      </g>

      {/* เทียนหอม */}
      <g>
        <rect x="205" y="345" width="34" height="36" rx="5" fill="#fdfbf6" />
        <rect x="205" y="345" width="34" height="8" rx="4" fill="#f2e7cc" />
        <path d="M222 345v-8" stroke="#24302a" strokeWidth="2" />
        <path d="M222 336c-6-8-2-16 0-20 2 4 6 12 0 20z" fill="#e8b85a">
          <animate attributeName="opacity" values="1;0.75;1" dur="2.2s" repeatCount="indefinite" />
        </path>
      </g>

      {/* กลีบดอกไม้โปรย */}
      {[[330, 392], [350, 386], [180, 390], [440, 392]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill={i % 2 ? '#e8d6aa' : '#f2e7cc'} />
      ))}
    </svg>
  )
}

/** ไอคอนตามประเภทบริการ */
export function ServiceIcon({ name, className = 'size-6' }: { name: string; className?: string }) {
  if (name.includes('เท้า')) return <Footprints className={className} />
  if (name.includes('น้ำมัน')) return <Sparkles className={className} />
  if (name.includes('ประคบ')) return <Leaf className={className} />
  if (name.includes('คอ') || name.includes('บ่า')) return <Hand className={className} />
  if (name.includes('แผนไทย')) return <HeartHandshake className={className} />
  return <Flower2 className={className} />
}
