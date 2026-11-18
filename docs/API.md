# API Documentation — ร้านนวดไท๊ไทย (Thai Thai Massage)

REST API สำหรับเว็บไซต์ลูกค้า, หน้าหลังร้าน (Admin) และ Botnoi Voice / AI Chatbot

- **Base URL:** `https://<your-domain>/api` (ตอนพัฒนา: `http://localhost:8080/api`)
- ทุก Request/Response เป็น JSON (UTF-8) — คำขอที่มี body ต้องส่ง `Content-Type: application/json`
- วันที่ `YYYY-MM-DD` • เวลา `HH:MM` (เวลาไทย `Asia/Bangkok`) • ราคาเป็นบาท (จำนวนเต็ม)

## สารบัญ
1. [รูปแบบ Response และ Error](#1-รูปแบบ-response-และ-error)
2. [การยืนยันตัวตนและ Rate limit](#2-การยืนยันตัวตนและ-rate-limit)
3. [Public API](#3-public-api) — ไม่ต้องล็อกอิน
4. [Admin API](#4-admin-api) — ต้องใช้ token
5. [Data Models](#5-data-models)
6. [ตัวอย่างลำดับการสนทนาของ Botnoi](#6-ตัวอย่างลำดับการสนทนาของ-botnoi)

---

## 1. รูปแบบ Response และ Error

```jsonc
// สำเร็จ
{ "success": true, "message": "ข้อความภาษาไทยพร้อมใช้ตอบลูกค้า", "data": { ... } }
// ผิดพลาด
{ "success": false, "message": "ข้อความอธิบายภาษาไทย", "error": { "code": "SLOT_UNAVAILABLE", "fields": { "phone": "..." } } }
```
ช่อง `message` เป็นภาษาไทยที่ Chatbot นำไปพูด/ตอบลูกค้าได้ทันที • `error.fields` มีเฉพาะเมื่อ `VALIDATION_ERROR` (key = ชื่อช่อง, value = ข้อความ)

> ข้อยกเว้น: `GET /api/availability` ตอบแบบ "แบน" (ไม่ห่อใน `data`) เพื่อให้ Chatbot อ่านง่าย — ดูรายละเอียดในหัวข้อนั้น

| HTTP | `error.code` | ความหมาย |
|---|---|---|
| 400 | `BAD_REQUEST` | รูปแบบคำขอผิด (เช่น JSON เสีย, รหัสไม่ถูกต้อง, สถานะไม่ถูกต้อง) |
| 401 | `UNAUTHORIZED` | ไม่ได้ส่ง token / token หมดอายุ / บัญชีถูกปิด |
| 401 | `INVALID_CREDENTIALS` | อีเมลหรือรหัสผ่านไม่ถูกต้อง |
| 401 | `INVALID_API_KEY` | ส่ง `X-API-Key` มาแต่ไม่ตรงกับ `BOT_API_KEY` |
| 403 | `FORBIDDEN` | ต้องเป็นเจ้าของร้าน (`owner`) |
| 404 | `NOT_FOUND` | ไม่พบข้อมูล (หรือ Booking ID กับเบอร์โทรไม่ตรงกัน) |
| 409 | `SLOT_UNAVAILABLE` | เวลานี้ไม่ว่าง / เต็ม / นอกเวลาทำการ |
| 409 | `CANNOT_CANCEL` | ยกเลิกไม่ได้ (สถานะ หรือเลยกำหนดเวลายกเลิก) |
| 409 | `CANNOT_RESCHEDULE` | ย้ายนัดไม่ได้ในสถานะปัจจุบัน |
| 409 | `INVALID_TRANSITION` | เปลี่ยนสถานะข้ามขั้นไม่ได้ (ดู [สถานะการจอง](#สถานะการจอง)) |
| 409 | `CANNOT_CALL` | เรียกคิวนี้ไม่ได้ |
| 409 | `DUPLICATE_EMAIL` / `DUPLICATE_HOLIDAY` | ข้อมูลซ้ำ |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | ไม่ได้ส่งเป็น JSON |
| 422 | `VALIDATION_ERROR` | ข้อมูลไม่ถูกต้อง (ดู `error.fields`) |
| 429 | `RATE_LIMITED` | ส่งคำขอถี่เกินไป |
| 500 | `INTERNAL_ERROR` | ข้อผิดพลาดภายในระบบ |
| 503 | `DB_UNAVAILABLE` | ฐานข้อมูลไม่พร้อม (จาก `/api/health`) |

---

## 2. การยืนยันตัวตนและ Rate limit

**Admin:** ล็อกอินที่ `POST /api/admin/login` จะได้ `token` (JWT อายุตาม `JWT_TTL` ค่าเริ่มต้น 12 ชั่วโมง) แล้วส่งทุกคำขอ `/api/admin/*` ด้วย
```
Authorization: Bearer <token>
```
(เฉพาะ SSE `/api/admin/events` ส่งเป็น query `?access_token=<token>` ได้ เพราะ `EventSource` ตั้ง header ไม่ได้)

บทบาท: `owner` (เจ้าของร้าน — ทำได้ทุกอย่าง) และ `staff` (พนักงาน — endpoint ที่ระบุ **owner** จะได้ 403)

**Botnoi:** ถ้าตั้ง `BOT_API_KEY` ไว้ที่ server ให้ส่ง header `X-API-Key: <key>` ตอนสร้างการจอง

**Rate limit (ต่อ IP):**

| Endpoint | จำกัด |
|---|---|
| `POST /api/bookings` | 30 ครั้ง / นาที |
| `PATCH /api/bookings/:id/cancel` | 20 ครั้ง / นาที |
| `GET /api/bookings/:id`, `GET /api/queue/status` | 60 ครั้ง / นาที |
| `POST /api/admin/login` | 10 ครั้ง / 5 นาที |

---

## 3. Public API

### GET `/api/health` — ตรวจสุขภาพระบบ
ใช้กับ health check ของแพลตฟอร์ม deploy
```json
{ "success": true, "message": "", "data": { "status": "ok", "time": "2026-11-18T14:00:00+07:00" } }
```
ฐานข้อมูลใช้ไม่ได้ → `503 DB_UNAVAILABLE`

### GET `/api/services` — รายการบริการที่เปิดอยู่
```json
{ "success": true, "message": "พบบริการ 8 รายการ",
  "data": [ { "id": 3, "name": "นวดน้ำมัน 1 ชั่วโมง", "description": "...", "duration_minutes": 60, "price": 500,
              "is_active": true, "is_popular": true, "sort_order": 3 } ] }
```

### GET `/api/shop-info` — ข้อมูลร้าน
```json
{ "success": true, "data": {
    "name": "ร้านนวดไท๊ไทย (Thai Thai Massage)", "today": "2026-11-18",
    "business_hours": [ { "day_of_week": 0, "is_open": true, "open_time": "10:00", "close_time": "20:00", "break_start": "", "break_end": "" } ],
    "holidays": [ { "id": 1, "date": "2026-12-31", "name": "วันสิ้นปี" } ],
    "booking_advance_days": 30, "cancel_before_hours": 2, "max_guests_per_booking": 4,
    "phone": "081-234-5678", "address": "...", "line_id": "@thaithai", "map_url": "https://maps.google.com/..." } }
```
`day_of_week`: 0 = อาทิตย์ … 6 = เสาร์ • `holidays` เฉพาะวันหยุดตั้งแต่วันนี้เป็นต้นไป

### GET `/api/availability` — ตรวจสอบเวลาว่าง
| Query | จำเป็น | คำอธิบาย |
|---|---|---|
| `date` | – | วันที่ (ค่าเริ่มต้น = วันนี้) |
| `service_ids` / `service_id` / `service` | ✔ (อย่างใดอย่างหนึ่ง) | id บริการ, หลาย id คั่นด้วย `,` หรือ **ชื่อบริการ** เช่น `service=นวดน้ำมัน` (เหมาะกับ Voice) |
| `guests` | – | จำนวนผู้ใช้บริการ 1–20 (ค่าเริ่มต้น 1) |
| `time` | – | ถ้าระบุ ⇒ ตอบว่าเวลานี้ว่างหรือไม่ |

**ระบุเวลา:** `GET /api/availability?date=2026-11-18&service_id=3&time=14:00`
```json
{ "success": true, "available": true, "date": "2026-11-18", "time": "14:00", "end_time": "15:00",
  "service": "นวดน้ำมัน 1 ชั่วโมง", "service_ids": [3], "duration_minutes": 60, "guests": 1,
  "price": 500, "remaining": 2, "message": "มีเวลาว่าง" }
```
ถ้าไม่ว่าง ได้ `"available": false`, `message` บอกเหตุผล และ `suggested_times` = เวลาว่าง 3 ช่วงที่ใกล้เวลาที่ต้องการที่สุด
```json
{ "success": true, "available": false, "time": "14:00", "message": "ช่วงเวลานี้มีลูกค้าจองเต็มแล้ว", "suggested_times": ["12:00", "15:00", "15:30"] }
```
**ไม่ระบุเวลา:** `GET /api/availability?date=2026-11-19&service_ids=1&guests=1`
```json
{ "success": true, "available": true, "date": "2026-11-19", "is_open": true, "message": "มีเวลาว่าง 19 ช่วงเวลา",
  "open_time": "10:00", "close_time": "20:00", "break_start": "", "break_end": "",
  "service": "นวดแผนไทย 1 ชั่วโมง", "service_ids": [1], "duration_minutes": 60, "guests": 1, "price": 300,
  "available_times": ["10:00", "10:30", "..."],
  "slots": [ { "time": "10:00", "end_time": "11:00", "available": true, "remaining": 4 },
             { "time": "12:00", "end_time": "13:00", "available": false, "remaining": 0, "reason": "ช่วงเวลานี้มีลูกค้าจองเต็มแล้ว" } ] }
```
วันที่ร้านปิด/วันหยุด/เลยช่วงจองล่วงหน้า → `is_open: false` และ `message` บอกเหตุผล

**กติกาความจุ:** แต่ละช่วงเวลารับลูกค้าพร้อมกันได้ไม่เกิน `max_customers_per_slot` (ตั้งค่าที่หน้าแอดมิน) โดย**ไม่ขึ้นกับจำนวนหมอนวด**

### POST `/api/bookings` — สร้างการจอง
```json
{ "service_id": 3, "date": "2026-11-18", "time": "14:00", "guests": 1,
  "full_name": "สมชาย ใจดี", "phone": "0812345678", "note": "", "source": "botnoi" }
```
| ช่อง | จำเป็น | กติกา |
|---|---|---|
| `service_ids` / `service_id` / `service` | ✔ | สูงสุด 5 บริการ ต้องเป็นบริการที่เปิดอยู่ |
| `date`, `time` | ✔ | `YYYY-MM-DD`, `HH:MM` |
| `guests` | – | 1 ถึง `max_guests_per_booking` (ค่าเริ่มต้น 1) |
| `full_name` | ✔ | 2–100 ตัวอักษร |
| `phone` | ✔ | เบอร์ไทย รับได้ทั้ง `081-234-5678` และ `+66812345678` |
| `note` | – | ไม่เกิน 500 ตัวอักษร |
| `source` | – | `web` (ค่าเริ่มต้น) หรือ `botnoi` |

Backend ตรวจเวลาว่างซ้ำภายใต้ lock ก่อนบันทึกทุกครั้ง (กันจองซ้อน) • ถ้าตั้ง `auto_confirm` สถานะจะเป็น `confirmed` ทันที ไม่งั้นเป็น `pending`

`201 Created`
```json
{ "success": true, "message": "จองคิวสำเร็จ! หมายเลขการจองของคุณคือ TT6PUBYW (รอร้านยืนยัน)",
  "data": { "booking_id": "TT6PUBYW", "queue_code": "A003", "status": "pending", "status_label": "รอยืนยัน",
            "service_date": "2026-11-18", "start_time": "14:00", "end_time": "15:00", "total_price": 500, "can_cancel": true, "...": "..." } }
```
เวลาไม่ว่าง → `409 SLOT_UNAVAILABLE` • ข้อมูลผิด → `422 VALIDATION_ERROR`

### GET `/api/bookings/:id?phone=` — ตรวจสอบข้อมูลการจอง
`:id` = Booking ID (เช่น `TT6PUBYW`) • `phone` ต้องตรงกับเบอร์ที่ใช้จอง (เพื่อความเป็นส่วนตัว — ไม่ตรงจะได้ 404)
ตอบเป็น [Booking](#booking) พร้อม `can_cancel` บอกว่าลูกค้ายกเลิกเองได้หรือไม่

### PATCH `/api/bookings/:id/cancel` — ลูกค้ายกเลิกการจอง
```json
{ "phone": "0812345678", "reason": "ติดธุระ" }
```
`reason` ไม่บังคับ (ไม่เกิน 300 ตัวอักษร) → `{ "success": true, "message": "ยกเลิกการจอง TT6PUBYW เรียบร้อยแล้ว", "data": { ..., "status": "cancelled" } }`

ยกเลิกได้เมื่อ: สถานะ `pending`/`confirmed` **และ** เหลือเวลาก่อนนัดอย่างน้อย `cancel_before_hours` ชั่วโมง — ไม่งั้นได้ `409 CANNOT_CANCEL`

### GET `/api/queue/status` — สถานะคิว
`?date=` (ค่าเริ่มต้น วันนี้) หรือ `?booking_id=TT6PUBYW&phone=0812345678` เพื่อดูคิวของลูกค้า
```json
{ "success": true, "message": "รออีก 2 คิว",
  "data": { "date": "2026-11-18", "now_calling": "A001", "serving": ["A001"], "waiting_count": 3, "next_queue": "A002",
            "my_booking": { "booking_id": "TT6PUBYW", "queue_code": "A003", "status": "confirmed", "queues_ahead": 2, "message": "รออีก 2 คิว" } } }
```

---

## 4. Admin API

ทุก endpoint ต้องส่ง `Authorization: Bearer <token>` • 🔒 = เฉพาะ `owner` • `:uuid` = `id` ภายในของการจอง (ไม่ใช่ `booking_id`)

### บัญชีผู้ใช้

| Method | Path | Body / Query | ผลลัพธ์ |
|---|---|---|---|
| POST | `/api/admin/login` *(ไม่ต้องใช้ token)* | `{ "email", "password" }` | `{ "token", "user": User }` |
| GET | `/api/admin/me` | – | User ที่ล็อกอินอยู่ |
| POST | `/api/admin/me/password` | `{ "current_password", "new_password" }` (ใหม่ ≥ 8 ตัว) | – |
| GET | `/api/admin/users` 🔒 | – | `User[]` (มี `is_active`) |
| POST | `/api/admin/users` 🔒 | `{ "email", "password", "full_name", "role": "owner"\|"staff" }` | User (`201`) • อีเมลซ้ำ → `409 DUPLICATE_EMAIL` |
| PATCH | `/api/admin/users/:id` 🔒 | `{ "is_active": false }` | เปิด/ปิดบัญชี (ปิดบัญชีตัวเองไม่ได้) |

ตัวอย่างล็อกอิน:
```bash
curl -X POST https://<your-domain>/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@thaithai.local","password":"owner12345"}'
```

### แดชบอร์ด
**GET** `/api/admin/dashboard?date=` (ค่าเริ่มต้น วันนี้)
```json
{ "date": "2026-11-18", "total_today": 12, "pending": 2, "confirmed": 6, "in_progress": 1, "in_progress_guests": 2,
  "completed": 2, "cancelled": 1, "revenue": 1500, "expected_revenue": 5200,
  "active_therapists": 0, "capacity_per_slot": 4, "pending_all_upcoming": 3, "upcoming": [ /* Booking[] */ ] }
```

### การจอง

| Method | Path | Body / Query | หมายเหตุ |
|---|---|---|---|
| GET | `/api/admin/bookings` | `q`, `date`, `date_from`, `date_to`, `status`, `page` (1), `page_size` (20, สูงสุด 100) | `q` ค้นจาก Booking ID / ชื่อ / เบอร์ → `{ items: Booking[], total, page, page_size }` |
| POST | `/api/admin/bookings` | เหมือน `POST /api/bookings` | `source`: `admin` (ค่าเริ่มต้น), `phone`, `web` — ใช้ลงจองแทนลูกค้าที่โทรมา |
| GET | `/api/admin/bookings/:uuid` | – | Booking |
| GET | `/api/admin/bookings/:uuid/availability` | `date` | เวลาว่างสำหรับย้ายนัด (ไม่นับการจองนี้เอง) — รูปแบบเหมือน `slots` ด้านบน |
| PATCH | `/api/admin/bookings/:uuid/status` | `{ "status", "reason" }` | `reason` ใช้ตอนยกเลิก • ข้ามขั้นไม่ได้ → `409 INVALID_TRANSITION` |
| PATCH | `/api/admin/bookings/:uuid/reschedule` | `{ "date", "time" }` | ตรวจเวลาว่างใหม่ → อาจได้ `409 SLOT_UNAVAILABLE` / `CANNOT_RESCHEDULE` |
| PATCH | `/api/admin/bookings/:uuid/therapist` | `{ "therapist_id": 2 }` หรือ `null` เพื่อเอาออก | หมอนวดต้องเปิดใช้งานอยู่ |

#### สถานะการจอง
| `status` | `status_label` | เปลี่ยนไปเป็นได้ (Admin) |
|---|---|---|
| `pending` | รอยืนยัน | `confirmed`, `cancelled` |
| `confirmed` | ยืนยันแล้ว | `in_progress`, `pending`, `cancelled` |
| `in_progress` | กำลังให้บริการ | `completed`, `confirmed` |
| `completed` | ให้บริการเสร็จแล้ว | `in_progress` |
| `cancelled` | ยกเลิก | `pending`, `confirmed` (กู้คืน) |

สถานะที่ "กินที่" ในการคำนวณเวลาว่าง: `pending`, `confirmed`, `in_progress`

### คิว

| Method | Path | Body / Query | ผลลัพธ์ |
|---|---|---|---|
| GET | `/api/admin/queue` | `date` | `{ date, items: Booking[], status: QueueStatus }` |
| POST | `/api/admin/queue/call-next` | `{ "date" }` (ไม่บังคับ) | เรียกคิวถัดไปที่ยืนยันแล้ว → Booking • ไม่มีคิวรอ → 404 |
| POST | `/api/admin/queue/:uuid/call` | – | เรียกคิวนี้ซ้ำ (`call_count` +1) |

### บริการ

| Method | Path | Body | หมายเหตุ |
|---|---|---|---|
| GET | `/api/admin/services` | – | รวมบริการที่ปิดอยู่ |
| POST | `/api/admin/services` | ServiceInput | `201` |
| PUT | `/api/admin/services/:id` | ServiceInput | |
| PATCH | `/api/admin/services/:id/active` | `{ "is_active": false }` | เปิด/ปิดบริการชั่วคราว |

**ServiceInput**
```json
{ "name": "นวดเท้า 1 ชั่วโมง", "description": "...", "duration_minutes": 60, "price": 350,
  "is_active": true, "is_popular": false, "sort_order": 5 }
```
`name` 2–120 ตัว • `description` ≤ 1000 ตัว • `duration_minutes` 15–480 และหาร 5 ลงตัว • `price` 0–100,000

### ตั้งค่าร้าน

| Method | Path | Body | หมายเหตุ |
|---|---|---|---|
| GET | `/api/admin/settings` | – | `{ settings, business_hours, holidays, therapists }` (วันหยุดย้อนหลัง 1 เดือนขึ้นไป) |
| PUT | `/api/admin/settings` 🔒 | Settings | |
| PUT | `/api/admin/business-hours` 🔒 | `BusinessHour[]` (7 วัน) | |
| POST | `/api/admin/holidays` 🔒 | `{ "date": "2026-12-31", "name": "วันสิ้นปี" }` | `201` • วันซ้ำ → `409 DUPLICATE_HOLIDAY` |
| DELETE | `/api/admin/holidays/:id` 🔒 | – | |
| POST | `/api/admin/therapists` 🔒 | `{ "full_name", "nickname", "phone", "is_active" }` | `201` |
| PUT | `/api/admin/therapists/:id` 🔒 | เหมือนด้านบน | |

**Settings**
```json
{ "max_customers_per_slot": 4, "slot_interval_minutes": 30, "cancel_before_hours": 2,
  "booking_advance_days": 30, "max_guests_per_booking": 4, "auto_confirm": false,
  "shop_phone": "081-234-5678", "shop_address": "...", "shop_line_id": "@thaithai", "shop_map_url": "https://..." }
```
| ช่อง | ช่วงที่รับ |
|---|---|
| `max_customers_per_slot` | 1–100 |
| `slot_interval_minutes` | 15, 30 หรือ 60 |
| `cancel_before_hours` | 0–72 |
| `booking_advance_days` | 1–365 |
| `max_guests_per_booking` | 1–20 |

**BusinessHour**
```json
{ "day_of_week": 1, "is_open": true, "open_time": "10:00", "close_time": "20:00", "break_start": "", "break_end": "" }
```
`break_start`/`break_end` เว้นว่าง = ไม่มีช่วงพัก

### Real-time (Server-Sent Events)
**GET** `/api/admin/events?access_token=<token>` — `Content-Type: text/event-stream`
```
event: ready
data: {}

event: change
data: {"type":"booking.created","booking_id":"<uuid>","date":"2026-11-18","status":"pending"}
```
| `type` | เกิดเมื่อ |
|---|---|
| `booking.created` | มีการจองใหม่ |
| `booking.updated` | เปลี่ยนสถานะ / ยกเลิก / ย้ายนัด / เปลี่ยนหมอนวด |
| `queue.called` | เรียกคิว |
| `settings.changed` | แก้ตั้งค่า / เวลาทำการ / วันหยุด |

ส่ง `: ping` ทุก 25 วินาทีเพื่อกันการเชื่อมต่อหลุด • `retry: 3000` ให้ browser เชื่อมต่อใหม่อัตโนมัติ

---

## 5. Data Models

### Booking
| ช่อง | ชนิด | คำอธิบาย |
|---|---|---|
| `id` | string (uuid) | รหัสภายใน — ใช้กับ Admin API |
| `booking_id` | string | หมายเลขการจองที่แสดงลูกค้า เช่น `TT7K2QXM` |
| `customer_name`, `customer_phone` | string | เบอร์เก็บเป็นตัวเลข 10 หลัก |
| `service_date`, `start_time`, `end_time` | string | `YYYY-MM-DD`, `HH:MM` |
| `guests`, `total_duration`, `total_price` | int | นาที / บาท |
| `status`, `status_label` | string | ดู [สถานะการจอง](#สถานะการจอง) |
| `note`, `source` | string | `source`: `web`, `botnoi`, `admin`, `phone` |
| `services` | array | `[{ "service_id", "name", "duration_minutes", "price" }]` |
| `service_names` | string | ชื่อบริการรวมเป็นข้อความเดียว |
| `queue_code`, `queue_number` | string, int | เช่น `A003`, `3` |
| `called_at`, `call_count` | datetime\|null, int | การเรียกคิว |
| `therapist_id`, `therapist_name` | int\|null, string | หมอนวดที่มอบหมาย |
| `cancel_reason`, `cancelled_by` | string | `cancelled_by`: `customer` หรือ `admin:<ชื่อ>` |
| `created_at`, `confirmed_at`, `started_at`, `completed_at`, `cancelled_at` | datetime\|null | ISO 8601 |
| `can_cancel` | bool | ลูกค้ายกเลิกเองได้ตอนนี้หรือไม่ |

### User
`{ "id": "<uuid>", "email": "...", "full_name": "...", "role": "owner" | "staff", "is_active": true }`

### Therapist
`{ "id": 1, "full_name": "...", "nickname": "...", "phone": "...", "is_active": true }`

### Holiday
`{ "id": 1, "date": "2026-12-31", "name": "วันสิ้นปี" }`

---

## 6. ตัวอย่างลำดับการสนทนาของ Botnoi
1. ลูกค้า: "อยากนวดน้ำมันพรุ่งนี้บ่ายสอง" → `GET /api/availability?date=<พรุ่งนี้>&service=นวดน้ำมัน&time=14:00`
2. ถ้า `available=false` → อ่าน `message` + เสนอ `suggested_times`
3. ขอชื่อและเบอร์โทร → `POST /api/bookings` (`source: "botnoi"`, header `X-API-Key`) → ตอบ `message` ซึ่งมีหมายเลขการจอง
4. "คิวถึงหรือยัง" → `GET /api/queue/status?booking_id=...&phone=...` → ตอบ `message`
5. "ขอยกเลิก" → `PATCH /api/bookings/:id/cancel` พร้อม `phone`
