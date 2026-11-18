-- =============================================================
-- ร้านนวดไท๊ไทย (Thai Thai Massage) — โครงสร้างฐานข้อมูลหลัก
-- ใช้ได้ทั้ง Supabase และ PostgreSQL 13+ (gen_random_uuid เป็น built-in)
-- =============================================================

-- ผู้ใช้งานระบบหลังร้าน (เจ้าของร้าน / พนักงาน)
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ลูกค้า (ระบุตัวตนด้วยเบอร์โทรศัพท์)
CREATE TABLE customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name  TEXT NOT NULL,
    phone      TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- บริการและราคา
CREATE TABLE services (
    id               SERIAL PRIMARY KEY,
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
    price            INTEGER NOT NULL CHECK (price >= 0),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    is_popular       BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- หมอนวด (จำนวนหมอนวดที่ active = จำนวนลูกค้าสูงสุดที่รับพร้อมกันได้)
CREATE TABLE therapists (
    id         SERIAL PRIMARY KEY,
    full_name  TEXT NOT NULL,
    nickname   TEXT NOT NULL DEFAULT '',
    phone      TEXT NOT NULL DEFAULT '',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ค่าตั้งค่าร้าน (มีแถวเดียว)
CREATE TABLE settings (
    id                     SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    max_customers_per_slot INTEGER NOT NULL DEFAULT 4 CHECK (max_customers_per_slot >= 1),
    slot_interval_minutes  INTEGER NOT NULL DEFAULT 30 CHECK (slot_interval_minutes IN (15, 30, 60)),
    cancel_before_hours    INTEGER NOT NULL DEFAULT 2 CHECK (cancel_before_hours BETWEEN 0 AND 72),
    booking_advance_days   INTEGER NOT NULL DEFAULT 30 CHECK (booking_advance_days BETWEEN 1 AND 365),
    max_guests_per_booking INTEGER NOT NULL DEFAULT 4 CHECK (max_guests_per_booking BETWEEN 1 AND 20),
    auto_confirm           BOOLEAN NOT NULL DEFAULT FALSE,
    shop_phone             TEXT NOT NULL DEFAULT '',
    shop_address           TEXT NOT NULL DEFAULT '',
    shop_line_id           TEXT NOT NULL DEFAULT '',
    shop_map_url           TEXT NOT NULL DEFAULT '',
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- เวลาทำการรายวัน (0 = อาทิตย์ ... 6 = เสาร์) พร้อมช่วงเวลาพัก
CREATE TABLE business_hours (
    day_of_week SMALLINT PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
    is_open     BOOLEAN NOT NULL DEFAULT TRUE,
    open_time   TIME NOT NULL DEFAULT '10:00',
    close_time  TIME NOT NULL DEFAULT '20:00',
    break_start TIME,
    break_end   TIME,
    CHECK (close_time > open_time),
    CHECK ((break_start IS NULL) = (break_end IS NULL)),
    CHECK (break_start IS NULL OR break_end > break_start)
);

-- วันหยุดร้าน
CREATE TABLE holidays (
    id           SERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    name         TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- การจอง
CREATE TABLE bookings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code   TEXT NOT NULL UNIQUE,
    customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    therapist_id   INTEGER REFERENCES therapists(id) ON DELETE SET NULL,
    customer_name  TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    service_date   DATE NOT NULL,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    guests         INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 20),
    total_duration INTEGER NOT NULL CHECK (total_duration > 0),
    total_price    INTEGER NOT NULL CHECK (total_price >= 0),
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    note           TEXT NOT NULL DEFAULT '',
    source         TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'botnoi', 'admin', 'phone')),
    cancel_reason  TEXT NOT NULL DEFAULT '',
    cancelled_by   TEXT NOT NULL DEFAULT '',
    confirmed_at   TIMESTAMPTZ,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    cancelled_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX bookings_date_status_idx ON bookings (service_date, status);
CREATE INDEX bookings_customer_idx ON bookings (customer_id);
CREATE INDEX bookings_phone_idx ON bookings (customer_phone);

-- รายการบริการในแต่ละการจอง (รองรับหลายบริการต่อการจอง, เก็บ snapshot ราคา/เวลา ณ ตอนจอง)
CREATE TABLE booking_services (
    booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    position         SMALLINT NOT NULL,
    service_id       INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    service_name     TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price            INTEGER NOT NULL,
    PRIMARY KEY (booking_id, position)
);

-- หมายเลขคิวประจำวัน (A001, A002, ...)
CREATE TABLE queue (
    id           SERIAL PRIMARY KEY,
    booking_id   UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    queue_date   DATE NOT NULL,
    queue_number INTEGER NOT NULL,
    queue_code   TEXT NOT NULL,
    called_at    TIMESTAMPTZ,
    call_count   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (queue_date, queue_number)
);

-- ปิดการเข้าถึงผ่าน Supabase REST (anon/authenticated key) ทุกตาราง
-- Backend เชื่อมต่อด้วย role เจ้าของตาราง จึงไม่ถูก RLS บล็อก
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours   ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue            ENABLE ROW LEVEL SECURITY;
