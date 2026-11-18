# ร้านนวดไท๊ไทย (Thai Thai Massage) — ระบบจองคิวออนไลน์

Web Application สำหรับจองคิวร้านนวดแผนไทย ครอบคลุมทั้งฝั่งลูกค้า (เลือกบริการ → เลือกวันเวลา → กรอกข้อมูล → ยืนยัน) และหลังร้าน (Dashboard, จัดการการจอง, เรียกคิวแบบ Real-time, จัดการบริการ, ตั้งค่าร้าน) พร้อม REST API สำหรับเชื่อมต่อ **Botnoi Voice / AI Chatbot**

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS v4, Lucide React, React Router |
| Backend | Go 1.24 (net/http), pgx v5, JWT (HS256), bcrypt |
| Database | Supabase (PostgreSQL) |
| Real-time | Server-Sent Events (SSE) |

---

## 1. เริ่มต้นใช้งาน (Development)

### 1.1 เตรียม Supabase
1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (แนะนำ Region: Southeast Asia (Singapore))
2. ไปที่ **Project Settings → Database → Connection string** แล้วคัดลอก **Session pooler** URI
3. ไม่ต้องสร้างตารางเอง — Backend จะรัน migration (`backend/internal/db/migrations/*.sql`) ให้อัตโนมัติตอนเริ่มทำงาน
   - หรือจะคัดลอก SQL ไปรันใน **SQL Editor** ของ Supabase เองก็ได้

> ทุกตารางเปิด **Row Level Security** ไว้โดยไม่มี policy ⇒ `anon key` / `authenticated key` ของ Supabase อ่าน-เขียนข้อมูลตรง ๆ ไม่ได้ ทุกอย่างต้องผ่าน Go backend ซึ่งตรวจสอบความถูกต้องและป้องกันการจองซ้อนก่อนเสมอ

### 1.2 รัน Backend
```bash
cd backend
cp .env.example .env          # แล้วแก้ DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
go mod tidy                   # ครั้งแรก: ดาวน์โหลด dependencies และสร้าง go.sum
go run ./cmd/server           # → http://localhost:8080
```
ครั้งแรกระบบจะสร้างตาราง ใส่เมนูบริการ 8 รายการ ตั้งเวลาทำการ 10:00–20:00 ทุกวัน และสร้างบัญชีเจ้าของร้านจาก `ADMIN_EMAIL` / `ADMIN_PASSWORD`

### 1.3 รัน Frontend
```bash
cd frontend
npm install
npm run dev                   # → http://localhost:5173 (proxy /api ไปที่ :8080 ให้อัตโนมัติ)
```

### 1.4 ตั้งค่าร้านครั้งแรก (สำคัญ)
1. เข้า `http://localhost:5173/admin` แล้วเข้าสู่ระบบด้วยบัญชีเจ้าของร้าน
2. ไปที่ **ตั้งค่าร้าน → หมอนวด** แล้วเพิ่มหมอนวดอย่างน้อย 1 คน
   *(ระบบรับลูกค้าพร้อมกันได้ = min(จำนวนหมอนวดที่เปิดอยู่, "ลูกค้าสูงสุดต่อช่วงเวลา") ถ้ายังไม่มีหมอนวด ลูกค้าจะยังจองไม่ได้)*
3. ใส่เบอร์โทร / LINE / ที่อยู่ร้าน ตั้งวันหยุด ช่วงพัก และเปลี่ยนรหัสผ่าน

---

## 2. Deploy (Production)

**ทางเลือก A — Docker ตัวเดียว (Go เสิร์ฟทั้ง API และหน้าเว็บ)** เหมาะกับ Render / Fly.io / Railway / Cloud Run
```bash
docker build -t thaithai .
docker run -p 8080:8080 --env-file backend/.env thaithai
```
ตั้ง Environment Variables บนแพลตฟอร์ม (อย่า commit ไฟล์ `.env`) และตั้ง `ALLOWED_ORIGINS` เป็นโดเมนจริง

**ทางเลือก B — แยกส่วน**: Frontend ขึ้น Vercel/Netlify (ตั้ง `VITE_API_URL=https://api.your-domain.com` และ rewrite ทุก path ไป `index.html`) ส่วน Backend ขึ้นที่ใดก็ได้ที่รัน Go ได้

ทดสอบในเครื่องแบบไม่ใช้ Supabase: `docker compose up --build` แล้วเปิด http://localhost:8080 (ล็อกอิน `owner@thaithai.local` / `owner12345`)

---

## 3. โครงสร้างโปรเจกต์
```
backend/
  cmd/server/main.go            จุดเริ่มต้น: โหลด config → เชื่อม DB → migrate → สร้างบัญชีเจ้าของร้าน → เปิด HTTP
  internal/config/              อ่าน Environment Variables (+ .env)
  internal/db/                  connection pool + migrations (embed ในไบนารี)
  internal/httpx/               รูปแบบ JSON response / error มาตรฐาน
  internal/auth/                bcrypt, JWT, middleware, จัดการผู้ใช้
  internal/app/                 Business logic
    availability.go             คำนวณเวลาว่าง (เวลาทำการ, ช่วงพัก, วันหยุด, ความจุ)
    bookings.go                 สร้าง/ยกเลิก/เปลี่ยนสถานะ/เลื่อนนัด (transaction + advisory lock)
    queue.go                    หมายเลขคิว, เรียกคิว, สถานะคิว, dashboard
    services.go, settings.go    บริการ, ตั้งค่าร้าน, เวลาทำการ, วันหยุด, หมอนวด
    events.go                   ตัวกระจาย event แบบ real-time (SSE)
  internal/api/                 HTTP handlers, routes, middleware (CORS, rate-limit, security headers)
frontend/src/
  lib/                          api client, types, ตัวจัดรูปแบบวันที่/ราคาไทย
  context/                      Auth, Toast
  hooks/                        useAsync, useLiveEvents (SSE)
  components/                   Layout, ภาพประกอบ SVG, ServiceCard, ui/*, booking/*, admin/*
  pages/                        Home, Services, Booking (5 ขั้นตอน), CheckBooking, Contact
  pages/admin/                  Login, Overview, Bookings, Queue, ServicesAdmin, SettingsPage
```

## 4. ฐานข้อมูล
| ตาราง | หน้าที่ | ความสัมพันธ์ |
|---|---|---|
| `users` | ผู้ใช้หลังร้าน (owner / staff) | |
| `customers` | ลูกค้า (unique ตามเบอร์โทร) | |
| `services` | บริการ ราคา ระยะเวลา เปิด/ปิด | |
| `therapists` | หมอนวด (active = พร้อมให้บริการ) | |
| `bookings` | การจอง สถานะ เวลา ราคารวม | → customers, therapists |
| `booking_services` | บริการในแต่ละการจอง (snapshot ราคา) — รองรับหลายบริการต่อการจอง | → bookings (cascade), services |
| `queue` | หมายเลขคิวประจำวัน A001… และเวลาเรียกคิว | → bookings (1:1, cascade) |
| `business_hours` | เวลาเปิด-ปิดและช่วงพักรายวัน | |
| `holidays` | วันหยุดร้าน | |
| `settings` | ความจุต่อช่วงเวลา เงื่อนไขการยกเลิก ข้อมูลติดต่อ | |

## 5. การป้องกันการจองซ้อน
ทุกการสร้าง/เลื่อน/กู้คืนการจองทำใน **transaction เดียว** และเริ่มด้วย `pg_advisory_xact_lock(hashtext(วันที่))` คำขอของวันเดียวกันจึงต้องรอคิวกันทีละรายการ ระบบจะคำนวณจำนวนลูกค้าที่ใช้บริการพร้อมกันสูงสุดตลอดช่วงเวลาที่ขอใหม่จากฐานข้อมูล (ไม่ใช้ค่าจากหน้าเว็บ) แล้วจึงบันทึก

ทดสอบแล้ว: ยิงคำขอจองช่วงเวลาเดียวกันพร้อมกัน 20 คำขอ ในขณะที่ร้านรับได้ 2 ท่าน ⇒ สำเร็จ 2 คำขอ อีก 18 คำขอได้ `409 SLOT_UNAVAILABLE`

## 6. สถานะการจอง
`pending` (รอยืนยัน) → `confirmed` (ยืนยันแล้ว) → `in_progress` (กำลังให้บริการ) → `completed` (เสร็จแล้ว) • `cancelled` (ยกเลิก)
- ลูกค้ายกเลิกเองได้เมื่อสถานะเป็น pending/confirmed และเหลือเวลาก่อนนัด ≥ `cancel_before_hours` (ค่าเริ่มต้น 2 ชม.)
- ตั้ง "ยืนยันการจองอัตโนมัติ" ได้ในหน้าตั้งค่า

## 7. API สำหรับ Botnoi
ดูรายละเอียดและตัวอย่างใน [`docs/API.md`](docs/API.md)
