package app

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/thaithai/massage-booking/internal/db"
	"github.com/thaithai/massage-booking/internal/httpx"
)

type Settings struct {
	MaxCustomersPerSlot int    `json:"max_customers_per_slot"`
	SlotIntervalMinutes int    `json:"slot_interval_minutes"`
	CancelBeforeHours   int    `json:"cancel_before_hours"`
	BookingAdvanceDays  int    `json:"booking_advance_days"`
	MaxGuestsPerBooking int    `json:"max_guests_per_booking"`
	AutoConfirm         bool   `json:"auto_confirm"`
	ShopPhone           string `json:"shop_phone"`
	ShopAddress         string `json:"shop_address"`
	ShopLineID          string `json:"shop_line_id"`
	ShopMapURL          string `json:"shop_map_url"`
}

type BusinessHour struct {
	DayOfWeek  int    `json:"day_of_week"`
	IsOpen     bool   `json:"is_open"`
	OpenTime   string `json:"open_time"`
	CloseTime  string `json:"close_time"`
	BreakStart string `json:"break_start"` // "" = ไม่มีช่วงพัก
	BreakEnd   string `json:"break_end"`
}

type Holiday struct {
	ID   int    `json:"id"`
	Date string `json:"date"`
	Name string `json:"name"`
}

type Therapist struct {
	ID       int    `json:"id"`
	FullName string `json:"full_name"`
	Nickname string `json:"nickname"`
	Phone    string `json:"phone"`
	IsActive bool   `json:"is_active"`
}

func (s *Store) GetSettings(ctx context.Context, q db.DBTX) (*Settings, error) {
	if q == nil {
		q = s.pool
	}
	var st Settings
	err := q.QueryRow(ctx, `SELECT max_customers_per_slot, slot_interval_minutes, cancel_before_hours, booking_advance_days,
		max_guests_per_booking, auto_confirm, shop_phone, shop_address, shop_line_id, shop_map_url FROM settings WHERE id=1`).
		Scan(&st.MaxCustomersPerSlot, &st.SlotIntervalMinutes, &st.CancelBeforeHours, &st.BookingAdvanceDays,
			&st.MaxGuestsPerBooking, &st.AutoConfirm, &st.ShopPhone, &st.ShopAddress, &st.ShopLineID, &st.ShopMapURL)
	return &st, err
}

func (s *Store) UpdateSettings(ctx context.Context, in Settings) (*Settings, error) {
	f := map[string]string{}
	if in.MaxCustomersPerSlot < 1 || in.MaxCustomersPerSlot > 100 {
		f["max_customers_per_slot"] = "ต้องอยู่ระหว่าง 1–100"
	}
	if in.SlotIntervalMinutes != 15 && in.SlotIntervalMinutes != 30 && in.SlotIntervalMinutes != 60 {
		f["slot_interval_minutes"] = "เลือกได้ 15, 30 หรือ 60 นาที"
	}
	if in.CancelBeforeHours < 0 || in.CancelBeforeHours > 72 {
		f["cancel_before_hours"] = "ต้องอยู่ระหว่าง 0–72 ชั่วโมง"
	}
	if in.BookingAdvanceDays < 1 || in.BookingAdvanceDays > 365 {
		f["booking_advance_days"] = "ต้องอยู่ระหว่าง 1–365 วัน"
	}
	if in.MaxGuestsPerBooking < 1 || in.MaxGuestsPerBooking > 20 {
		f["max_guests_per_booking"] = "ต้องอยู่ระหว่าง 1–20 ท่าน"
	}
	if len(f) > 0 {
		return nil, httpx.Validation(f)
	}
	_, err := s.pool.Exec(ctx, `UPDATE settings SET max_customers_per_slot=$1, slot_interval_minutes=$2, cancel_before_hours=$3,
		booking_advance_days=$4, max_guests_per_booking=$5, auto_confirm=$6, shop_phone=$7, shop_address=$8,
		shop_line_id=$9, shop_map_url=$10, updated_at=now() WHERE id=1`,
		in.MaxCustomersPerSlot, in.SlotIntervalMinutes, in.CancelBeforeHours, in.BookingAdvanceDays, in.MaxGuestsPerBooking,
		in.AutoConfirm, strings.TrimSpace(in.ShopPhone), strings.TrimSpace(in.ShopAddress), strings.TrimSpace(in.ShopLineID), strings.TrimSpace(in.ShopMapURL))
	if err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "settings.changed"})
	return s.GetSettings(ctx, nil)
}

// ---------- เวลาทำการ ----------

func (s *Store) ListBusinessHours(ctx context.Context) ([]BusinessHour, error) {
	rows, err := s.pool.Query(ctx, `SELECT day_of_week, is_open, to_char(open_time,'HH24:MI'), to_char(close_time,'HH24:MI'),
		COALESCE(to_char(break_start,'HH24:MI'),''), COALESCE(to_char(break_end,'HH24:MI'),'')
		FROM business_hours ORDER BY day_of_week`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []BusinessHour{}
	for rows.Next() {
		var h BusinessHour
		if err := rows.Scan(&h.DayOfWeek, &h.IsOpen, &h.OpenTime, &h.CloseTime, &h.BreakStart, &h.BreakEnd); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (s *Store) UpdateBusinessHours(ctx context.Context, hours []BusinessHour) ([]BusinessHour, error) {
	f := map[string]string{}
	for _, h := range hours {
		key := "day_" + string(rune('0'+h.DayOfWeek))
		if h.DayOfWeek < 0 || h.DayOfWeek > 6 {
			return nil, httpx.BadRequest("day_of_week ต้องอยู่ระหว่าง 0–6")
		}
		o, ok1 := ParseHM(h.OpenTime)
		c, ok2 := ParseHM(h.CloseTime)
		if !ok1 || !ok2 || c <= o {
			f[key] = "เวลาปิดต้องหลังเวลาเปิด"
			continue
		}
		if (h.BreakStart == "") != (h.BreakEnd == "") {
			f[key] = "กรุณาระบุเวลาเริ่มและสิ้นสุดช่วงพักให้ครบ"
			continue
		}
		if h.BreakStart != "" {
			bs, ok3 := ParseHM(h.BreakStart)
			be, ok4 := ParseHM(h.BreakEnd)
			if !ok3 || !ok4 || be <= bs || bs < o || be > c {
				f[key] = "ช่วงพักต้องอยู่ภายในเวลาทำการ และเวลาสิ้นสุดต้องหลังเวลาเริ่ม"
			}
		}
	}
	if len(f) > 0 {
		return nil, httpx.Validation(f)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for _, h := range hours {
		_, err := tx.Exec(ctx, `INSERT INTO business_hours (day_of_week, is_open, open_time, close_time, break_start, break_end)
			VALUES ($1,$2,$3::text::time,$4::text::time,NULLIF($5,'')::time,NULLIF($6,'')::time)
			ON CONFLICT (day_of_week) DO UPDATE SET is_open=EXCLUDED.is_open, open_time=EXCLUDED.open_time,
			close_time=EXCLUDED.close_time, break_start=EXCLUDED.break_start, break_end=EXCLUDED.break_end`,
			h.DayOfWeek, h.IsOpen, h.OpenTime, h.CloseTime, h.BreakStart, h.BreakEnd)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "settings.changed"})
	return s.ListBusinessHours(ctx)
}

// ---------- วันหยุด ----------

func (s *Store) ListHolidays(ctx context.Context, fromDate string) ([]Holiday, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, to_char(holiday_date,'YYYY-MM-DD'), name FROM holidays
		WHERE ($1 = '' OR holiday_date >= $1::text::date) ORDER BY holiday_date`, fromDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Holiday{}
	for rows.Next() {
		var h Holiday
		if err := rows.Scan(&h.ID, &h.Date, &h.Name); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (s *Store) AddHoliday(ctx context.Context, date, name string) (*Holiday, error) {
	if _, err := s.parseDate(date); err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if runeLen(name) > 120 {
		return nil, httpx.Validation(map[string]string{"name": "ชื่อวันหยุดยาวเกินไป"})
	}
	var h Holiday
	err := s.pool.QueryRow(ctx, `INSERT INTO holidays (holiday_date, name) VALUES ($1::text::date, $2)
		RETURNING id, to_char(holiday_date,'YYYY-MM-DD'), name`, date, name).Scan(&h.ID, &h.Date, &h.Name)
	if isUniqueViolation(err) {
		return nil, httpx.Conflict("DUPLICATE_HOLIDAY", "วันที่นี้ถูกตั้งเป็นวันหยุดอยู่แล้ว")
	}
	if err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "settings.changed"})
	return &h, nil
}

func (s *Store) DeleteHoliday(ctx context.Context, id int) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM holidays WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("ไม่พบวันหยุด")
	}
	s.Events.Publish(Event{Type: "settings.changed"})
	return nil
}

// ---------- หมอนวด ----------

func (s *Store) ListTherapists(ctx context.Context) ([]Therapist, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, full_name, nickname, phone, is_active FROM therapists ORDER BY is_active DESC, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Therapist{}
	for rows.Next() {
		var t Therapist
		if err := rows.Scan(&t.ID, &t.FullName, &t.Nickname, &t.Phone, &t.IsActive); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func validateTherapist(t *Therapist) error {
	t.FullName = strings.TrimSpace(t.FullName)
	t.Nickname = strings.TrimSpace(t.Nickname)
	t.Phone = strings.TrimSpace(t.Phone)
	f := map[string]string{}
	if n := runeLen(t.FullName); n < 2 || n > 100 {
		f["full_name"] = "ชื่อต้องมี 2–100 ตัวอักษร"
	}
	if runeLen(t.Nickname) > 50 {
		f["nickname"] = "ชื่อเล่นยาวเกินไป"
	}
	if t.Phone != "" {
		p, ok := NormalizePhone(t.Phone)
		if !ok {
			f["phone"] = "เบอร์โทรศัพท์ไม่ถูกต้อง"
		}
		t.Phone = p
	}
	if len(f) > 0 {
		return httpx.Validation(f)
	}
	return nil
}

func (s *Store) CreateTherapist(ctx context.Context, t Therapist) (*Therapist, error) {
	if err := validateTherapist(&t); err != nil {
		return nil, err
	}
	err := s.pool.QueryRow(ctx, `INSERT INTO therapists (full_name, nickname, phone, is_active) VALUES ($1,$2,$3,TRUE)
		RETURNING id, is_active`, t.FullName, t.Nickname, t.Phone).Scan(&t.ID, &t.IsActive)
	if err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "settings.changed"})
	return &t, nil
}

func (s *Store) UpdateTherapist(ctx context.Context, id int, t Therapist) (*Therapist, error) {
	if err := validateTherapist(&t); err != nil {
		return nil, err
	}
	err := s.pool.QueryRow(ctx, `UPDATE therapists SET full_name=$2, nickname=$3, phone=$4, is_active=$5, updated_at=now()
		WHERE id=$1 RETURNING id`, id, t.FullName, t.Nickname, t.Phone, t.IsActive).Scan(&t.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, httpx.NotFound("ไม่พบหมอนวด")
	}
	if err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "settings.changed"})
	return &t, nil
}
