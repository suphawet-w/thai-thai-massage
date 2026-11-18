package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/thaithai/massage-booking/internal/db"
	"github.com/thaithai/massage-booking/internal/httpx"
)

type BookingService struct {
	ServiceID       int    `json:"service_id"`
	Name            string `json:"name"`
	DurationMinutes int    `json:"duration_minutes"`
	Price           int    `json:"price"`
}

type Booking struct {
	ID            string           `json:"id"`
	BookingID     string           `json:"booking_id"` // หมายเลขการจองที่แสดงให้ลูกค้า เช่น TT7K2QXM
	CustomerName  string           `json:"customer_name"`
	CustomerPhone string           `json:"customer_phone"`
	ServiceDate   string           `json:"service_date"`
	StartTime     string           `json:"start_time"`
	EndTime       string           `json:"end_time"`
	Guests        int              `json:"guests"`
	TotalDuration int              `json:"total_duration"`
	TotalPrice    int              `json:"total_price"`
	Status        string           `json:"status"`
	StatusLabel   string           `json:"status_label"`
	Note          string           `json:"note"`
	Source        string           `json:"source"`
	CancelReason  string           `json:"cancel_reason"`
	CancelledBy   string           `json:"cancelled_by"`
	TherapistID   *int             `json:"therapist_id"`
	TherapistName string           `json:"therapist_name"`
	QueueCode     string           `json:"queue_code"`
	QueueNumber   int              `json:"queue_number"`
	CalledAt      *time.Time       `json:"called_at"`
	CallCount     int              `json:"call_count"`
	Services      []BookingService `json:"services"`
	ServiceNames  string           `json:"service_names"`
	CreatedAt     time.Time        `json:"created_at"`
	ConfirmedAt   *time.Time       `json:"confirmed_at"`
	StartedAt     *time.Time       `json:"started_at"`
	CompletedAt   *time.Time       `json:"completed_at"`
	CancelledAt   *time.Time       `json:"cancelled_at"`
	CanCancel     bool             `json:"can_cancel"`
}

const bookingSelect = `SELECT b.id::text, b.booking_code, b.customer_name, b.customer_phone,
	to_char(b.service_date,'YYYY-MM-DD'), to_char(b.start_time,'HH24:MI'), to_char(b.end_time,'HH24:MI'),
	b.guests, b.total_duration, b.total_price, b.status, b.note, b.source, b.cancel_reason, b.cancelled_by,
	b.therapist_id, COALESCE(t.full_name,''), COALESCE(q.queue_code,''), COALESCE(q.queue_number,0), q.called_at, COALESCE(q.call_count,0),
	COALESCE((SELECT json_agg(json_build_object('service_id',bs.service_id,'name',bs.service_name,
		'duration_minutes',bs.duration_minutes,'price',bs.price) ORDER BY bs.position)
		FROM booking_services bs WHERE bs.booking_id=b.id), '[]'::json),
	b.created_at, b.confirmed_at, b.started_at, b.completed_at, b.cancelled_at
	FROM bookings b
	LEFT JOIN therapists t ON t.id=b.therapist_id
	LEFT JOIN queue q ON q.booking_id=b.id `

func (s *Store) scanBooking(row pgx.Row) (*Booking, error) {
	var b Booking
	err := row.Scan(&b.ID, &b.BookingID, &b.CustomerName, &b.CustomerPhone, &b.ServiceDate, &b.StartTime, &b.EndTime,
		&b.Guests, &b.TotalDuration, &b.TotalPrice, &b.Status, &b.Note, &b.Source, &b.CancelReason, &b.CancelledBy,
		&b.TherapistID, &b.TherapistName, &b.QueueCode, &b.QueueNumber, &b.CalledAt, &b.CallCount, &b.Services,
		&b.CreatedAt, &b.ConfirmedAt, &b.StartedAt, &b.CompletedAt, &b.CancelledAt)
	if err != nil {
		return nil, err
	}
	b.StatusLabel = StatusLabels[b.Status]
	names := make([]string, len(b.Services))
	for i, sv := range b.Services {
		names[i] = sv.Name
	}
	b.ServiceNames = strings.Join(names, " + ")
	return &b, nil
}

func (s *Store) getBooking(ctx context.Context, q db.DBTX, where string, arg any) (*Booking, error) {
	b, err := s.scanBooking(q.QueryRow(ctx, bookingSelect+where, arg))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, httpx.NotFound("ไม่พบข้อมูลการจอง")
	}
	return b, err
}

func (s *Store) GetBookingByID(ctx context.Context, id string) (*Booking, error) {
	return s.getBooking(ctx, s.pool, `WHERE b.id::text=$1`, id)
}

// GetBookingForCustomer ค้นหาด้วย Booking ID + เบอร์โทร (ต้องตรงกันทั้งคู่ เพื่อความเป็นส่วนตัว)
func (s *Store) GetBookingForCustomer(ctx context.Context, code, phone string) (*Booking, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	p, ok := NormalizePhone(phone)
	if code == "" || !ok {
		return nil, httpx.Validation(map[string]string{"phone": "กรุณาระบุหมายเลขการจองและเบอร์โทรศัพท์ที่ใช้จอง"})
	}
	b, err := s.getBooking(ctx, s.pool, `WHERE b.booking_code=$1`, code)
	if err != nil {
		return nil, err
	}
	if b.CustomerPhone != p {
		return nil, httpx.NotFound("ไม่พบข้อมูลการจอง กรุณาตรวจสอบหมายเลขการจองและเบอร์โทรศัพท์")
	}
	if err := s.decorateCancel(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

// cancelBlockReason คืนเหตุผลที่ลูกค้ายกเลิกเองไม่ได้ ("" = ยกเลิกได้)
func (s *Store) cancelBlockReason(b *Booking, st *Settings) string {
	if b.Status != StatusPending && b.Status != StatusConfirmed {
		return "การจองนี้อยู่ในสถานะ \"" + StatusLabels[b.Status] + "\" ไม่สามารถยกเลิกได้"
	}
	start, err := time.ParseInLocation("2006-01-02 15:04", b.ServiceDate+" "+b.StartTime, s.loc)
	if err != nil {
		return "ข้อมูลเวลาไม่ถูกต้อง"
	}
	if time.Until(start) < time.Duration(st.CancelBeforeHours)*time.Hour {
		if st.CancelBeforeHours == 0 {
			return "เลยเวลานัดหมายแล้ว ไม่สามารถยกเลิกออนไลน์ได้"
		}
		return fmt.Sprintf("ต้องยกเลิกล่วงหน้าอย่างน้อย %d ชั่วโมงก่อนเวลานัด กรุณาติดต่อร้านโดยตรง", st.CancelBeforeHours)
	}
	return ""
}

func (s *Store) decorateCancel(ctx context.Context, b *Booking) error {
	st, err := s.GetSettings(ctx, nil)
	if err != nil {
		return err
	}
	b.CanCancel = s.cancelBlockReason(b, st) == ""
	return nil
}

// ---------- สร้างการจอง ----------

type CreateBookingInput struct {
	ServiceIDs []int  `json:"service_ids"`
	ServiceID  int    `json:"service_id"` // รองรับการส่งบริการเดียว (สะดวกสำหรับ Chatbot)
	Service    string `json:"service"`    // หรือส่งชื่อบริการ
	Date       string `json:"date"`
	Time       string `json:"time"`
	Guests     int    `json:"guests"`
	FullName   string `json:"full_name"`
	Phone      string `json:"phone"`
	Note       string `json:"note"`
	Source     string `json:"source"`
}

func validationErr(field, msg string) error { return httpx.Validation(map[string]string{field: msg}) }

func (s *Store) CreateBooking(ctx context.Context, in CreateBookingInput, allowedSources []string) (*Booking, error) {
	// --- ตรวจสอบข้อมูลพื้นฐาน ---
	in.FullName = strings.Join(strings.Fields(in.FullName), " ")
	in.Note = strings.TrimSpace(in.Note)
	f := map[string]string{}
	if n := runeLen(in.FullName); n < 2 || n > 100 {
		f["full_name"] = "กรุณากรอกชื่อ-นามสกุล (2–100 ตัวอักษร)"
	}
	phone, ok := NormalizePhone(in.Phone)
	if !ok {
		f["phone"] = "เบอร์โทรศัพท์ไม่ถูกต้อง (ตัวอย่าง 0812345678)"
	}
	if runeLen(in.Note) > 500 {
		f["note"] = "หมายเหตุยาวเกิน 500 ตัวอักษร"
	}
	if in.Guests == 0 {
		in.Guests = 1
	}
	if _, ok := ParseHM(in.Time); !ok {
		f["time"] = "กรุณาเลือกเวลา (รูปแบบ HH:MM)"
	}
	if _, err := time.Parse(DateLayout, in.Date); err != nil {
		f["date"] = "กรุณาเลือกวันที่ (รูปแบบ YYYY-MM-DD)"
	}
	source := in.Source
	if source == "" {
		source = "web"
	}
	validSource := false
	for _, a := range allowedSources {
		if a == source {
			validSource = true
		}
	}
	if !validSource {
		f["source"] = "source ไม่ถูกต้อง"
	}
	ids := in.ServiceIDs
	if len(ids) == 0 && in.ServiceID > 0 {
		ids = []int{in.ServiceID}
	}
	if len(ids) == 0 && in.Service != "" {
		sv, err := s.FindServiceByName(ctx, in.Service)
		if err != nil {
			return nil, err
		}
		ids = []int{sv.ID}
	}
	if len(f) > 0 {
		return nil, httpx.Validation(f)
	}
	start, _ := ParseHM(in.Time)

	// --- Transaction + advisory lock รายวัน: ป้องกันการจองชนกันแม้ส่งพร้อมกัน ---
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := lockDates(ctx, tx, in.Date); err != nil {
		return nil, err
	}

	services, err := s.resolveServices(ctx, tx, ids)
	if err != nil {
		return nil, err
	}
	duration, unitPrice := 0, 0
	for _, sv := range services {
		duration += sv.DurationMinutes
		unitPrice += sv.Price
	}

	sch, err := s.loadSchedule(ctx, tx, in.Date)
	if err != nil {
		return nil, err
	}
	if in.Guests < 1 || in.Guests > sch.Settings.MaxGuestsPerBooking {
		return nil, validationErr("guests", fmt.Sprintf("จำนวนผู้ใช้บริการต้องอยู่ระหว่าง 1–%d ท่านต่อการจอง", sch.Settings.MaxGuestsPerBooking))
	}
	occ, err := loadOccupied(ctx, tx, sch.Date, "")
	if err != nil {
		return nil, err
	}
	slot := sch.evaluate(occ, start, duration, in.Guests)
	if !slot.Available {
		e := httpx.Conflict("SLOT_UNAVAILABLE", "ไม่สามารถจองเวลานี้ได้: "+slot.Reason)
		e.Extra = map[string]any{"available": false}
		return nil, e
	}

	// --- บันทึกลูกค้า (ระบุด้วยเบอร์โทร) ---
	var customerID string
	if err := tx.QueryRow(ctx, `INSERT INTO customers (full_name, phone) VALUES ($1,$2)
		ON CONFLICT (phone) DO UPDATE SET full_name=EXCLUDED.full_name, updated_at=now() RETURNING id::text`,
		in.FullName, phone).Scan(&customerID); err != nil {
		return nil, err
	}

	code, err := s.newBookingCode(ctx, tx)
	if err != nil {
		return nil, err
	}
	status := StatusPending
	if sch.Settings.AutoConfirm {
		status = StatusConfirmed
	}
	var bookingID string
	err = tx.QueryRow(ctx, `INSERT INTO bookings (booking_code, customer_id, customer_name, customer_phone, service_date,
		start_time, end_time, guests, total_duration, total_price, status, note, source, confirmed_at)
		VALUES ($1,$2::uuid,$3,$4,$5::text::date,$6::text::time,$7::text::time,$8,$9,$10,$11,$12,$13,
			CASE WHEN $11='confirmed' THEN now() END)
		RETURNING id::text`,
		code, customerID, in.FullName, phone, sch.Date, FormatHM(start), FormatHM(start+duration),
		in.Guests, duration, unitPrice*in.Guests, status, in.Note, source).Scan(&bookingID)
	if err != nil {
		return nil, err
	}
	for i, sv := range services {
		if _, err := tx.Exec(ctx, `INSERT INTO booking_services (booking_id, position, service_id, service_name, duration_minutes, price)
			VALUES ($1::uuid,$2,$3,$4,$5,$6)`, bookingID, i+1, sv.ID, sv.Name, sv.DurationMinutes, sv.Price); err != nil {
			return nil, err
		}
	}
	if err := assignQueueNumber(ctx, tx, bookingID, sch.Date); err != nil {
		return nil, err
	}
	b, err := s.getBooking(ctx, tx, `WHERE b.id::text=$1`, bookingID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	_ = s.decorateCancel(ctx, b)
	s.Events.Publish(Event{Type: "booking.created", BookingID: b.ID, Date: b.ServiceDate, Status: b.Status})
	return b, nil
}

// assignQueueNumber ออกหมายเลขคิวประจำวัน A001, A002, ... (ต้องเรียกภายใต้ lock ของวันนั้น)
func assignQueueNumber(ctx context.Context, tx pgx.Tx, bookingID, date string) error {
	_, err := tx.Exec(ctx, `INSERT INTO queue (booking_id, queue_date, queue_number, queue_code)
		SELECT $1::uuid, $2::text::date, n, 'A' || lpad(n::text, 3, '0')
		FROM (SELECT COALESCE(MAX(queue_number),0)+1 AS n FROM queue WHERE queue_date=$2::text::date) x
		ON CONFLICT (booking_id) DO UPDATE SET queue_date=EXCLUDED.queue_date, queue_number=EXCLUDED.queue_number,
			queue_code=EXCLUDED.queue_code, called_at=NULL, call_count=0`, bookingID, date)
	return err
}

// ---------- ยกเลิกโดยลูกค้า ----------

func (s *Store) CancelByCustomer(ctx context.Context, code, phone, reason string) (*Booking, error) {
	b, err := s.GetBookingForCustomer(ctx, code, phone)
	if err != nil {
		return nil, err
	}
	st, err := s.GetSettings(ctx, nil)
	if err != nil {
		return nil, err
	}
	if why := s.cancelBlockReason(b, st); why != "" {
		return nil, httpx.Conflict("CANNOT_CANCEL", why)
	}
	reason = strings.TrimSpace(reason)
	if runeLen(reason) > 300 {
		reason = string([]rune(reason)[:300])
	}
	if reason == "" {
		reason = "ลูกค้ายกเลิกเอง"
	}
	tag, err := s.pool.Exec(ctx, `UPDATE bookings SET status='cancelled', cancel_reason=$2, cancelled_by='customer',
		cancelled_at=now(), updated_at=now() WHERE id::text=$1 AND status IN ('pending','confirmed')`, b.ID, reason)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, httpx.Conflict("CANNOT_CANCEL", "สถานะการจองเปลี่ยนไปแล้ว กรุณาตรวจสอบอีกครั้ง")
	}
	s.Events.Publish(Event{Type: "booking.updated", BookingID: b.ID, Date: b.ServiceDate, Status: StatusCancelled})
	return s.GetBookingForCustomer(ctx, code, phone)
}

// ---------- จัดการโดย Admin ----------

type BookingFilter struct {
	Query    string
	Date     string
	DateFrom string
	DateTo   string
	Status   string
	Page     int
	PageSize int
}

type BookingPage struct {
	Items    []*Booking `json:"items"`
	Total    int        `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
}

func (s *Store) ListBookings(ctx context.Context, f BookingFilter) (*BookingPage, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 || f.PageSize > 100 {
		f.PageSize = 20
	}
	where := []string{"TRUE"}
	args := []any{}
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "?", fmt.Sprintf("$%d", len(args))))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		add(`(b.booking_code ILIKE '%' || ? || '%' OR b.customer_name ILIKE '%' || ? || '%' OR b.customer_phone LIKE '%' || ? || '%')`, q)
	}
	if f.Date != "" {
		add(`b.service_date = ?::text::date`, f.Date)
	}
	if f.DateFrom != "" {
		add(`b.service_date >= ?::text::date`, f.DateFrom)
	}
	if f.DateTo != "" {
		add(`b.service_date <= ?::text::date`, f.DateTo)
	}
	if f.Status != "" {
		if _, ok := StatusLabels[f.Status]; !ok {
			return nil, httpx.BadRequest("สถานะไม่ถูกต้อง")
		}
		add(`b.status = ?`, f.Status)
	}
	whereSQL := " WHERE " + strings.Join(where, " AND ")

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM bookings b`+whereSQL, args...).Scan(&total); err != nil {
		return nil, err
	}
	args = append(args, f.PageSize, (f.Page-1)*f.PageSize)
	rows, err := s.pool.Query(ctx, bookingSelect+whereSQL+fmt.Sprintf(
		` ORDER BY b.service_date DESC, b.start_time, q.queue_number LIMIT $%d OFFSET $%d`, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []*Booking{}
	for rows.Next() {
		b, err := s.scanBooking(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, b)
	}
	return &BookingPage{Items: items, Total: total, Page: f.Page, PageSize: f.PageSize}, rows.Err()
}

// UpdateStatus เปลี่ยนสถานะตามขั้นตอนที่อนุญาต
func (s *Store) UpdateStatus(ctx context.Context, id, newStatus, reason, by string) (*Booking, error) {
	if _, ok := StatusLabels[newStatus]; !ok {
		return nil, validationErr("status", "สถานะไม่ถูกต้อง")
	}
	cur, err := s.GetBookingByID(ctx, id)
	if err != nil {
		return nil, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := lockDates(ctx, tx, cur.ServiceDate); err != nil {
		return nil, err
	}
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM bookings WHERE id::text=$1 FOR UPDATE`, id).Scan(&status); err != nil {
		return nil, err
	}
	if status == newStatus {
		return cur, nil
	}
	if !canTransition(status, newStatus) {
		return nil, httpx.Conflict("INVALID_TRANSITION",
			fmt.Sprintf("ไม่สามารถเปลี่ยนสถานะจาก \"%s\" เป็น \"%s\" ได้", StatusLabels[status], StatusLabels[newStatus]))
	}
	// กู้คืนการจองที่ยกเลิกไปแล้ว ต้องตรวจเวลาว่างอีกครั้ง
	if status == StatusCancelled {
		sch, err := s.loadSchedule(ctx, tx, cur.ServiceDate)
		if err != nil {
			return nil, err
		}
		occ, err := loadOccupied(ctx, tx, cur.ServiceDate, id)
		if err != nil {
			return nil, err
		}
		start, _ := ParseHM(cur.StartTime)
		sch.IsToday = false // admin กู้คืนได้แม้เวลาผ่านไปแล้วในวันนี้
		if slot := sch.evaluate(occ, start, cur.TotalDuration, cur.Guests); !slot.Available {
			return nil, httpx.Conflict("SLOT_UNAVAILABLE", "ไม่สามารถกู้คืนการจองได้: "+slot.Reason)
		}
	}
	reason = strings.TrimSpace(reason)
	_, err = tx.Exec(ctx, `UPDATE bookings SET status=$2, updated_at=now(),
		confirmed_at = CASE WHEN $2='confirmed' AND confirmed_at IS NULL THEN now() ELSE confirmed_at END,
		started_at   = CASE WHEN $2='in_progress' THEN now() WHEN $2 IN ('pending','confirmed') THEN NULL ELSE started_at END,
		completed_at = CASE WHEN $2='completed' THEN now() WHEN $2 <> 'completed' THEN NULL ELSE completed_at END,
		cancelled_at = CASE WHEN $2='cancelled' THEN now() ELSE NULL END,
		cancel_reason= CASE WHEN $2='cancelled' THEN $3 ELSE '' END,
		cancelled_by = CASE WHEN $2='cancelled' THEN $4 ELSE '' END
		WHERE id::text=$1`, id, newStatus, reason, by)
	if err != nil {
		return nil, err
	}
	if newStatus == StatusInProgress {
		if _, err := tx.Exec(ctx, `UPDATE queue SET called_at=COALESCE(called_at, now()), call_count=GREATEST(call_count,1) WHERE booking_id::text=$1`, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "booking.updated", BookingID: id, Date: cur.ServiceDate, Status: newStatus})
	return s.GetBookingByID(ctx, id)
}

// Reschedule แก้ไขวัน/เวลาจอง (ตรวจเวลาว่างใหม่ทุกครั้ง)
func (s *Store) Reschedule(ctx context.Context, id, date, timeStr string) (*Booking, error) {
	start, ok := ParseHM(timeStr)
	if !ok {
		return nil, validationErr("time", "รูปแบบเวลาต้องเป็น HH:MM")
	}
	if _, err := s.parseDate(date); err != nil {
		return nil, err
	}
	cur, err := s.GetBookingByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if cur.Status == StatusCompleted || cur.Status == StatusCancelled || cur.Status == StatusInProgress {
		return nil, httpx.Conflict("CANNOT_RESCHEDULE", "แก้ไขเวลาได้เฉพาะการจองที่รอยืนยันหรือยืนยันแล้ว")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := lockDates(ctx, tx, cur.ServiceDate, date); err != nil {
		return nil, err
	}
	sch, err := s.loadSchedule(ctx, tx, date)
	if err != nil {
		return nil, err
	}
	occ, err := loadOccupied(ctx, tx, date, id)
	if err != nil {
		return nil, err
	}
	if slot := sch.evaluate(occ, start, cur.TotalDuration, cur.Guests); !slot.Available {
		return nil, httpx.Conflict("SLOT_UNAVAILABLE", "ไม่สามารถย้ายไปเวลานี้ได้: "+slot.Reason)
	}
	if _, err := tx.Exec(ctx, `UPDATE bookings SET service_date=$2::text::date, start_time=$3::text::time, end_time=$4::text::time,
		updated_at=now() WHERE id::text=$1`, id, date, FormatHM(start), FormatHM(start+cur.TotalDuration)); err != nil {
		return nil, err
	}
	if date != cur.ServiceDate {
		if err := assignQueueNumber(ctx, tx, id, date); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "booking.updated", BookingID: id, Date: date})
	return s.GetBookingByID(ctx, id)
}

func (s *Store) AssignTherapist(ctx context.Context, id string, therapistID *int) (*Booking, error) {
	if therapistID != nil {
		var active bool
		err := s.pool.QueryRow(ctx, `SELECT is_active FROM therapists WHERE id=$1`, *therapistID).Scan(&active)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
			return nil, validationErr("therapist_id", "ไม่พบหมอนวด หรือหมอนวดไม่พร้อมให้บริการ")
		} else if err != nil {
			return nil, err
		}
	}
	tag, err := s.pool.Exec(ctx, `UPDATE bookings SET therapist_id=$2, updated_at=now() WHERE id::text=$1`, id, therapistID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, httpx.NotFound("ไม่พบข้อมูลการจอง")
	}
	b, err := s.GetBookingByID(ctx, id)
	if err == nil {
		s.Events.Publish(Event{Type: "booking.updated", BookingID: id, Date: b.ServiceDate})
	}
	return b, err
}

// DurationForServices คำนวณระยะเวลาและราคารวมของบริการที่เลือก
func (s *Store) DurationForServices(ctx context.Context, ids []int) ([]Service, int, int, error) {
	svcs, err := s.resolveServices(ctx, s.pool, ids)
	if err != nil {
		return nil, 0, 0, err
	}
	d, p := 0, 0
	for _, sv := range svcs {
		d += sv.DurationMinutes
		p += sv.Price
	}
	return svcs, d, p, nil
}
