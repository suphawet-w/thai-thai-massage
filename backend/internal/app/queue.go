package app

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/thaithai/massage-booking/internal/httpx"
)

// DayQueue คืนคิวทั้งหมดของวัน (ไม่รวมที่ยกเลิก) เรียงตามเวลาเริ่ม
func (s *Store) DayQueue(ctx context.Context, date string) ([]*Booking, error) {
	if _, err := s.parseDate(date); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, bookingSelect+` WHERE b.service_date=$1::text::date AND b.status <> 'cancelled'
		ORDER BY b.start_time, q.queue_number`, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Booking{}
	for rows.Next() {
		b, err := s.scanBooking(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// CallNext เรียกคิวถัดไป: คิวที่ยืนยันแล้วและยังไม่ถูกเรียก ที่เวลาเริ่มเร็วที่สุด
func (s *Store) CallNext(ctx context.Context, date string) (*Booking, error) {
	if _, err := s.parseDate(date); err != nil {
		return nil, err
	}
	var id string
	err := s.pool.QueryRow(ctx, `UPDATE queue SET called_at=now(), call_count=call_count+1
		WHERE id = (
			SELECT q.id FROM queue q JOIN bookings b ON b.id=q.booking_id
			WHERE b.service_date=$1::text::date AND b.status='confirmed' AND q.called_at IS NULL
			ORDER BY b.start_time, q.queue_number LIMIT 1
			FOR UPDATE OF q SKIP LOCKED
		) RETURNING booking_id::text`, date).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, httpx.NotFound("ไม่มีคิวที่ยืนยันแล้วรอเรียกในวันนี้")
	}
	if err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "queue.called", BookingID: id, Date: date})
	return s.GetBookingByID(ctx, id)
}

// CallBooking เรียกคิว (หรือเรียกซ้ำ) แบบระบุการจอง
func (s *Store) CallBooking(ctx context.Context, id string) (*Booking, error) {
	b, err := s.GetBookingByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if b.Status != StatusConfirmed && b.Status != StatusInProgress {
		return nil, httpx.Conflict("CANNOT_CALL", "เรียกคิวได้เฉพาะการจองที่ยืนยันแล้ว")
	}
	if _, err := s.pool.Exec(ctx, `UPDATE queue SET called_at=now(), call_count=call_count+1 WHERE booking_id::text=$1`, id); err != nil {
		return nil, err
	}
	s.Events.Publish(Event{Type: "queue.called", BookingID: id, Date: b.ServiceDate})
	return s.GetBookingByID(ctx, id)
}

type QueueStatus struct {
	Date         string        `json:"date"`
	NowCalling   string        `json:"now_calling"`
	Serving      []string      `json:"serving"`
	WaitingCount int           `json:"waiting_count"`
	NextQueue    string        `json:"next_queue"`
	TotalToday   int           `json:"total_today"`
	Completed    int           `json:"completed"`
	Message      string        `json:"message"`
	MyBooking    *MyQueueState `json:"my_booking,omitempty"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type MyQueueState struct {
	BookingID   string `json:"booking_id"`
	QueueCode   string `json:"queue_code"`
	Status      string `json:"status"`
	StatusLabel string `json:"status_label"`
	StartTime   string `json:"start_time"`
	QueuesAhead int    `json:"queues_ahead"`
	Message     string `json:"message"`
}

// PublicQueueStatus สรุปสถานะคิวสำหรับลูกค้า/Chatbot
func (s *Store) PublicQueueStatus(ctx context.Context, date string, mine *Booking) (*QueueStatus, error) {
	list, err := s.DayQueue(ctx, date)
	if err != nil {
		return nil, err
	}
	qs := &QueueStatus{Date: date, Serving: []string{}, UpdatedAt: s.Now()}
	var lastCalled *time.Time
	var waiting []*Booking
	for _, b := range list {
		qs.TotalToday++
		switch b.Status {
		case StatusInProgress:
			qs.Serving = append(qs.Serving, b.QueueCode)
		case StatusCompleted:
			qs.Completed++
		case StatusConfirmed:
			if b.CalledAt == nil {
				waiting = append(waiting, b)
			}
		}
		if b.CalledAt != nil && (b.Status == StatusConfirmed || b.Status == StatusInProgress) &&
			(lastCalled == nil || b.CalledAt.After(*lastCalled)) {
			lastCalled = b.CalledAt
			qs.NowCalling = b.QueueCode
		}
	}
	qs.WaitingCount = len(waiting)
	if len(waiting) > 0 {
		qs.NextQueue = waiting[0].QueueCode
	}
	switch {
	case qs.NowCalling != "":
		qs.Message = "ขณะนี้กำลังเรียกคิว " + qs.NowCalling
	case qs.TotalToday == 0:
		qs.Message = "ยังไม่มีคิวในวันนี้"
	default:
		qs.Message = "ยังไม่มีการเรียกคิว"
	}

	if mine != nil {
		st := &MyQueueState{BookingID: mine.BookingID, QueueCode: mine.QueueCode, Status: mine.Status,
			StatusLabel: StatusLabels[mine.Status], StartTime: mine.StartTime}
		for _, w := range waiting {
			if w.ID == mine.ID {
				break
			}
			st.QueuesAhead++
		}
		switch mine.Status {
		case StatusPending:
			st.Message = "การจองของคุณรอร้านยืนยัน"
		case StatusConfirmed:
			if mine.CalledAt != nil {
				st.Message = "ถึงคิวของคุณแล้ว กรุณาติดต่อเคาน์เตอร์"
			} else if st.QueuesAhead == 0 {
				st.Message = "คิวของคุณคือคิวถัดไป"
			} else {
				st.Message = "รออีก " + itoa(st.QueuesAhead) + " คิว"
			}
		case StatusInProgress:
			st.Message = "กำลังให้บริการ"
		case StatusCompleted:
			st.Message = "ให้บริการเสร็จแล้ว ขอบคุณที่ใช้บริการ"
		case StatusCancelled:
			st.Message = "การจองนี้ถูกยกเลิกแล้ว"
		}
		qs.MyBooking = st
	}
	return qs, nil
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}

// ---------- Dashboard ----------

type DashboardStats struct {
	Date               string     `json:"date"`
	TotalToday         int        `json:"total_today"`
	Pending            int        `json:"pending"`
	Confirmed          int        `json:"confirmed"`
	InProgress         int        `json:"in_progress"`
	InProgressGuests   int        `json:"in_progress_guests"`
	Completed          int        `json:"completed"`
	Cancelled          int        `json:"cancelled"`
	Revenue            int        `json:"revenue"`
	ExpectedRevenue    int        `json:"expected_revenue"`
	ActiveTherapists   int        `json:"active_therapists"`
	CapacityPerSlot    int        `json:"capacity_per_slot"`
	Upcoming           []*Booking `json:"upcoming"`
	PendingAllUpcoming int        `json:"pending_all_upcoming"`
}

func (s *Store) Dashboard(ctx context.Context, date string) (*DashboardStats, error) {
	if _, err := s.parseDate(date); err != nil {
		return nil, err
	}
	d := &DashboardStats{Date: date}
	err := s.pool.QueryRow(ctx, `SELECT
		count(*) FILTER (WHERE status <> 'cancelled'),
		count(*) FILTER (WHERE status='pending'),
		count(*) FILTER (WHERE status='confirmed'),
		count(*) FILTER (WHERE status='in_progress'),
		COALESCE(sum(guests) FILTER (WHERE status='in_progress'),0),
		count(*) FILTER (WHERE status='completed'),
		count(*) FILTER (WHERE status='cancelled'),
		COALESCE(sum(total_price) FILTER (WHERE status='completed'),0),
		COALESCE(sum(total_price) FILTER (WHERE status <> 'cancelled'),0)
		FROM bookings WHERE service_date=$1::text::date`, date).
		Scan(&d.TotalToday, &d.Pending, &d.Confirmed, &d.InProgress, &d.InProgressGuests, &d.Completed, &d.Cancelled, &d.Revenue, &d.ExpectedRevenue)
	if err != nil {
		return nil, err
	}
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM therapists WHERE is_active`).Scan(&d.ActiveTherapists); err != nil {
		return nil, err
	}
	st, err := s.GetSettings(ctx, nil)
	if err != nil {
		return nil, err
	}
	d.CapacityPerSlot = st.MaxCustomersPerSlot
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM bookings WHERE status='pending' AND service_date >= $1::text::date`, s.Today()).Scan(&d.PendingAllUpcoming); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, bookingSelect+` WHERE b.service_date=$1::text::date AND b.status IN ('pending','confirmed','in_progress')
		ORDER BY b.start_time, q.queue_number LIMIT 6`, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	d.Upcoming = []*Booking{}
	for rows.Next() {
		b, err := s.scanBooking(rows)
		if err != nil {
			return nil, err
		}
		d.Upcoming = append(d.Upcoming, b)
	}
	return d, rows.Err()
}
