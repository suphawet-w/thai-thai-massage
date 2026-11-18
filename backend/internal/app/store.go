// Package app รวม business logic ของระบบจองคิว (บริการ, เวลาว่าง, การจอง, คิว)
package app

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thaithai/massage-booking/internal/db"
	"github.com/thaithai/massage-booking/internal/httpx"
)

type Store struct {
	pool   *pgxpool.Pool
	loc    *time.Location
	Events *Hub
}

func NewStore(pool *pgxpool.Pool, loc *time.Location) *Store {
	return &Store{pool: pool, loc: loc, Events: NewHub()}
}

func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// Now คืนเวลาปัจจุบันตาม timezone ของร้าน
func (s *Store) Now() time.Time { return time.Now().In(s.loc) }

func (s *Store) Today() string { return s.Now().Format(DateLayout) }

const DateLayout = "2006-01-02"

// ---------- สถานะ ----------

const (
	StatusPending    = "pending"
	StatusConfirmed  = "confirmed"
	StatusInProgress = "in_progress"
	StatusCompleted  = "completed"
	StatusCancelled  = "cancelled"
)

var StatusLabels = map[string]string{
	StatusPending:    "รอยืนยัน",
	StatusConfirmed:  "ยืนยันแล้ว",
	StatusInProgress: "กำลังให้บริการ",
	StatusCompleted:  "ให้บริการเสร็จแล้ว",
	StatusCancelled:  "ยกเลิก",
}

// activeStatuses คือสถานะที่ยังกินที่ (ใช้คำนวณเวลาว่าง)
var activeStatuses = []string{StatusPending, StatusConfirmed, StatusInProgress}

// transitions กำหนดการเปลี่ยนสถานะที่อนุญาตสำหรับ Admin
var transitions = map[string][]string{
	StatusPending:    {StatusConfirmed, StatusCancelled},
	StatusConfirmed:  {StatusPending, StatusInProgress, StatusCancelled},
	StatusInProgress: {StatusConfirmed, StatusCompleted},
	StatusCompleted:  {StatusInProgress},
	StatusCancelled:  {StatusPending, StatusConfirmed},
}

func canTransition(from, to string) bool {
	for _, s := range transitions[from] {
		if s == to {
			return true
		}
	}
	return false
}

// ---------- ตัวช่วยเรื่องเวลา ----------

// ParseHM แปลง "14:30" เป็นจำนวนนาทีนับจากเที่ยงคืน
func ParseHM(s string) (int, bool) {
	t, err := time.Parse("15:04", strings.TrimSpace(s))
	if err != nil {
		return 0, false
	}
	return t.Hour()*60 + t.Minute(), true
}

func FormatHM(m int) string { return fmt.Sprintf("%02d:%02d", m/60, m%60) }

func (s *Store) parseDate(v string) (time.Time, error) {
	d, err := time.ParseInLocation(DateLayout, strings.TrimSpace(v), s.loc)
	if err != nil {
		return time.Time{}, httpx.Validation(map[string]string{"date": "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"})
	}
	return d, nil
}

// ---------- ตัวช่วยตรวจสอบข้อมูล ----------

var phoneRe = regexp.MustCompile(`^0[0-9]{8,9}$`)

// NormalizePhone รับได้ทั้ง 081-234-5678, +66812345678 → 0812345678
func NormalizePhone(raw string) (string, bool) {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	d := b.String()
	if strings.HasPrefix(d, "66") && (len(d) == 11 || len(d) == 10) {
		d = "0" + d[2:]
	}
	return d, phoneRe.MatchString(d)
}

func runeLen(s string) int { return utf8.RuneCountInString(s) }

// ---------- Booking code ----------

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // ตัด I O 0 1 ออกเพื่อลดการอ่านผิด

func randomCode(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = codeAlphabet[int(b[i])%len(codeAlphabet)]
	}
	return string(b)
}

func (s *Store) newBookingCode(ctx context.Context, q db.DBTX) (string, error) {
	for i := 0; i < 10; i++ {
		code := "TT" + randomCode(6)
		var exists bool
		if err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM bookings WHERE booking_code=$1)`, code).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", errors.New("ไม่สามารถสร้าง booking code ที่ไม่ซ้ำได้")
}

// lockDates ล็อกการจองของวันที่ระบุภายใน transaction (ป้องกันการจองชนกันเมื่อมีคำขอพร้อมกัน)
// ล็อกตามลำดับวันที่เสมอเพื่อป้องกัน deadlock
func lockDates(ctx context.Context, tx pgx.Tx, dates ...string) error {
	seen := map[string]bool{}
	uniq := []string{}
	for _, d := range dates {
		if !seen[d] {
			seen[d] = true
			uniq = append(uniq, d)
		}
	}
	if len(uniq) == 2 && uniq[0] > uniq[1] {
		uniq[0], uniq[1] = uniq[1], uniq[0]
	}
	for _, d := range uniq {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('thaithai:booking:' || $1::text))`, d); err != nil {
			return err
		}
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
