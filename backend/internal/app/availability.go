package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/thaithai/massage-booking/internal/db"
)

// DaySchedule คือข้อมูลการเปิดร้านและความจุของวันหนึ่ง ๆ
type DaySchedule struct {
	Date       string
	IsOpen     bool
	Reason     string // เหตุผลที่ปิด (ถ้าปิด)
	Open       int    // นาทีนับจากเที่ยงคืน
	Close      int
	BreakStart int // -1 = ไม่มีช่วงพัก
	BreakEnd   int
	Capacity   int // จำนวนลูกค้าที่รับพร้อมกันได้สูงสุด
	Interval   int
	Settings   *Settings
	IsToday    bool
	NowMinute  int
}

type occupied struct {
	ID     string
	Start  int
	End    int
	Guests int
}

type Slot struct {
	Time      string `json:"time"`
	EndTime   string `json:"end_time"`
	Available bool   `json:"available"`
	Remaining int    `json:"remaining"`
	Reason    string `json:"reason,omitempty"`
}

type DayAvailability struct {
	Date            string `json:"date"`
	IsOpen          bool   `json:"is_open"`
	Message         string `json:"message"`
	OpenTime        string `json:"open_time,omitempty"`
	CloseTime       string `json:"close_time,omitempty"`
	BreakStart      string `json:"break_start,omitempty"`
	BreakEnd        string `json:"break_end,omitempty"`
	Capacity        int    `json:"capacity"`
	DurationMinutes int    `json:"duration_minutes"`
	Guests          int    `json:"guests"`
	Slots           []Slot `json:"slots"`
}

// loadSchedule โหลดเวลาทำการ วันหยุด และความจุ สำหรับวันที่ระบุ
func (s *Store) loadSchedule(ctx context.Context, q db.DBTX, dateStr string) (*DaySchedule, error) {
	date, err := s.parseDate(dateStr)
	if err != nil {
		return nil, err
	}
	st, err := s.GetSettings(ctx, q)
	if err != nil {
		return nil, err
	}
	now := s.Now()
	today, _ := time.ParseInLocation(DateLayout, now.Format(DateLayout), s.loc)
	sch := &DaySchedule{Date: date.Format(DateLayout), BreakStart: -1, BreakEnd: -1, Interval: st.SlotIntervalMinutes, Settings: st}
	sch.IsToday = date.Equal(today)
	sch.NowMinute = now.Hour()*60 + now.Minute()

	if date.Before(today) {
		sch.Reason = "ไม่สามารถจองวันที่ผ่านมาแล้วได้"
		return sch, nil
	}
	if date.After(today.AddDate(0, 0, st.BookingAdvanceDays)) {
		sch.Reason = fmt.Sprintf("เปิดให้จองล่วงหน้าได้ไม่เกิน %d วัน", st.BookingAdvanceDays)
		return sch, nil
	}

	var holidayName string
	err = q.QueryRow(ctx, `SELECT name FROM holidays WHERE holiday_date=$1::text::date`, sch.Date).Scan(&holidayName)
	if err == nil {
		sch.Reason = "ร้านปิดทำการ (วันหยุดร้าน)"
		if holidayName != "" {
			sch.Reason = "ร้านปิดทำการ: " + holidayName
		}
		return sch, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	var isOpen bool
	var open, close, bs, be string
	err = q.QueryRow(ctx, `SELECT is_open, to_char(open_time,'HH24:MI'), to_char(close_time,'HH24:MI'),
		COALESCE(to_char(break_start,'HH24:MI'),''), COALESCE(to_char(break_end,'HH24:MI'),'')
		FROM business_hours WHERE day_of_week=$1`, int(date.Weekday())).Scan(&isOpen, &open, &close, &bs, &be)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !isOpen) {
		sch.Reason = "ร้านปิดทำการในวันนี้"
		return sch, nil
	} else if err != nil {
		return nil, err
	}
	sch.Open, _ = ParseHM(open)
	sch.Close, _ = ParseHM(close)
	if bs != "" {
		sch.BreakStart, _ = ParseHM(bs)
		sch.BreakEnd, _ = ParseHM(be)
	}

	// ความจุต่อช่วงเวลาใช้ค่า "รับลูกค้าพร้อมกันสูงสุด" ในตั้งค่าร้าน โดยไม่ขึ้นกับจำนวนหมอนวด
	sch.Capacity = st.MaxCustomersPerSlot
	if sch.Capacity <= 0 {
		sch.Reason = "ขณะนี้ร้านยังไม่เปิดรับจองออนไลน์"
		return sch, nil
	}
	sch.IsOpen = true
	return sch, nil
}

// loadOccupied ดึงการจองที่ยังใช้ทรัพยากร (รอยืนยัน/ยืนยันแล้ว/กำลังบริการ) ของวันนั้น
func loadOccupied(ctx context.Context, q db.DBTX, date, excludeID string) ([]occupied, error) {
	rows, err := q.Query(ctx, `SELECT id::text,
		(EXTRACT(HOUR FROM start_time)*60 + EXTRACT(MINUTE FROM start_time))::int,
		(EXTRACT(HOUR FROM end_time)*60 + EXTRACT(MINUTE FROM end_time))::int,
		guests
		FROM bookings WHERE service_date=$1::text::date AND status = ANY($2) AND ($3 = '' OR id::text <> $3)`,
		date, activeStatuses, excludeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []occupied
	for rows.Next() {
		var o occupied
		if err := rows.Scan(&o.ID, &o.Start, &o.End, &o.Guests); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// peakLoad หาจำนวนลูกค้าสูงสุดที่ใช้บริการพร้อมกันในช่วง [start, end)
// โหลดเปลี่ยนเฉพาะตอนมีการจองเริ่ม จึงตรวจแค่จุด start และจุดเริ่มของการจองที่อยู่ในช่วง
func peakLoad(bookings []occupied, start, end int) int {
	points := []int{start}
	for _, b := range bookings {
		if b.Start > start && b.Start < end {
			points = append(points, b.Start)
		}
	}
	peak := 0
	for _, p := range points {
		load := 0
		for _, b := range bookings {
			if b.Start <= p && b.End > p {
				load += b.Guests
			}
		}
		peak = max(peak, load)
	}
	return peak
}

// evaluate ตรวจว่าเวลาเริ่ม start ระยะเวลา dur สำหรับ guests ท่าน จองได้หรือไม่
func (sch *DaySchedule) evaluate(bookings []occupied, start, dur, guests int) Slot {
	end := start + dur
	slot := Slot{Time: FormatHM(start), EndTime: FormatHM(end)}
	switch {
	case !sch.IsOpen:
		slot.Reason = sch.Reason
	case start < sch.Open || end > sch.Close:
		slot.Reason = fmt.Sprintf("อยู่นอกเวลาทำการ (%s–%s น.) โดยต้องให้บริการเสร็จก่อนร้านปิด", FormatHM(sch.Open), FormatHM(sch.Close))
	case sch.IsToday && start <= sch.NowMinute:
		slot.Reason = "เวลานี้ผ่านไปแล้ว"
	case sch.BreakStart >= 0 && start < sch.BreakEnd && end > sch.BreakStart:
		slot.Reason = fmt.Sprintf("คาบเกี่ยวช่วงเวลาพักของร้าน (%s–%s น.)", FormatHM(sch.BreakStart), FormatHM(sch.BreakEnd))
	default:
		slot.Remaining = max(0, sch.Capacity-peakLoad(bookings, start, end))
		slot.Available = slot.Remaining >= guests
		if !slot.Available {
			if slot.Remaining == 0 {
				slot.Reason = "ช่วงเวลานี้มีลูกค้าจองเต็มแล้ว"
			} else {
				slot.Reason = fmt.Sprintf("ช่วงเวลานี้รับได้อีกเพียง %d ท่าน", slot.Remaining)
			}
		}
	}
	return slot
}

// DayAvailability คำนวณช่วงเวลาทั้งหมดของวัน (ไม่รวมเวลาที่ผ่านไปแล้ว)
func (s *Store) DayAvailability(ctx context.Context, date string, duration, guests int, excludeID string) (*DayAvailability, error) {
	sch, err := s.loadSchedule(ctx, s.pool, date)
	if err != nil {
		return nil, err
	}
	res := &DayAvailability{Date: sch.Date, IsOpen: sch.IsOpen, Capacity: sch.Capacity, DurationMinutes: duration, Guests: guests, Slots: []Slot{}}
	if !sch.IsOpen {
		res.Message = sch.Reason
		return res, nil
	}
	res.OpenTime, res.CloseTime = FormatHM(sch.Open), FormatHM(sch.Close)
	if sch.BreakStart >= 0 {
		res.BreakStart, res.BreakEnd = FormatHM(sch.BreakStart), FormatHM(sch.BreakEnd)
	}
	bookings, err := loadOccupied(ctx, s.pool, sch.Date, excludeID)
	if err != nil {
		return nil, err
	}
	free := 0
	for t := sch.Open; t+duration <= sch.Close; t += sch.Interval {
		if sch.IsToday && t <= sch.NowMinute {
			continue
		}
		slot := sch.evaluate(bookings, t, duration, guests)
		if slot.Available {
			free++
		}
		res.Slots = append(res.Slots, slot)
	}
	switch {
	case len(res.Slots) == 0:
		res.Message = "วันนี้ไม่มีช่วงเวลาที่เปิดให้จองแล้ว"
	case free == 0:
		res.Message = "ช่วงเวลาของวันนี้ถูกจองเต็มแล้ว"
	default:
		res.Message = fmt.Sprintf("มีเวลาว่าง %d ช่วงเวลา", free)
	}
	return res, nil
}

// CheckSlot ตรวจสอบเวลาเดียว (ใช้กับ API ของ Botnoi)
func (s *Store) CheckSlot(ctx context.Context, date, timeStr string, duration, guests int) (*Slot, error) {
	start, ok := ParseHM(timeStr)
	if !ok {
		return nil, validationErr("time", "รูปแบบเวลาต้องเป็น HH:MM เช่น 14:00")
	}
	sch, err := s.loadSchedule(ctx, s.pool, date)
	if err != nil {
		return nil, err
	}
	bookings, err := loadOccupied(ctx, s.pool, sch.Date, "")
	if err != nil {
		return nil, err
	}
	slot := sch.evaluate(bookings, start, duration, guests)
	return &slot, nil
}
