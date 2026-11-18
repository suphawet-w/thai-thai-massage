package app

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/thaithai/massage-booking/internal/db"
	"github.com/thaithai/massage-booking/internal/httpx"
)

type Service struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	DurationMinutes int    `json:"duration_minutes"`
	Price           int    `json:"price"`
	IsActive        bool   `json:"is_active"`
	IsPopular       bool   `json:"is_popular"`
	SortOrder       int    `json:"sort_order"`
}

const serviceCols = `id, name, description, duration_minutes, price, is_active, is_popular, sort_order`

func scanService(row pgx.Row) (Service, error) {
	var sv Service
	err := row.Scan(&sv.ID, &sv.Name, &sv.Description, &sv.DurationMinutes, &sv.Price, &sv.IsActive, &sv.IsPopular, &sv.SortOrder)
	return sv, err
}

func (s *Store) ListServices(ctx context.Context, includeInactive bool) ([]Service, error) {
	q := `SELECT ` + serviceCols + ` FROM services`
	if !includeInactive {
		q += ` WHERE is_active`
	}
	q += ` ORDER BY sort_order, id`
	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Service{}
	for rows.Next() {
		sv, err := scanService(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sv)
	}
	return out, rows.Err()
}

// resolveServices ดึงบริการตาม id (ต้อง active ทั้งหมด) รักษาลำดับที่ลูกค้าเลือก
func (s *Store) resolveServices(ctx context.Context, q db.DBTX, ids []int) ([]Service, error) {
	if len(ids) == 0 {
		return nil, httpx.Validation(map[string]string{"service_ids": "กรุณาเลือกบริการอย่างน้อย 1 รายการ"})
	}
	if len(ids) > 5 {
		return nil, httpx.Validation(map[string]string{"service_ids": "เลือกบริการได้สูงสุด 5 รายการต่อการจอง"})
	}
	out := make([]Service, 0, len(ids))
	for _, id := range ids {
		sv, err := scanService(q.QueryRow(ctx, `SELECT `+serviceCols+` FROM services WHERE id=$1`, id))
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, httpx.Validation(map[string]string{"service_ids": "ไม่พบบริการที่เลือก"})
		}
		if err != nil {
			return nil, err
		}
		if !sv.IsActive {
			return nil, httpx.Validation(map[string]string{"service_ids": "บริการ \"" + sv.Name + "\" ปิดให้บริการชั่วคราว"})
		}
		out = append(out, sv)
	}
	return out, nil
}

// FindServiceByName ค้นหาบริการจากชื่อ (สำหรับ Chatbot/Voice ที่ส่งชื่อมาแทน id)
func (s *Store) FindServiceByName(ctx context.Context, name string) (*Service, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, nil
	}
	sv, err := scanService(s.pool.QueryRow(ctx, `SELECT `+serviceCols+` FROM services
		WHERE is_active AND (name = $1 OR name ILIKE '%' || $1 || '%')
		ORDER BY (name = $1) DESC, length(name), sort_order LIMIT 1`, name))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, httpx.NotFound("ไม่พบบริการ \"" + name + "\"")
	}
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

type ServiceInput struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	DurationMinutes int    `json:"duration_minutes"`
	Price           int    `json:"price"`
	IsActive        *bool  `json:"is_active"`
	IsPopular       bool   `json:"is_popular"`
	SortOrder       int    `json:"sort_order"`
}

func (in *ServiceInput) validate() error {
	in.Name = strings.TrimSpace(in.Name)
	in.Description = strings.TrimSpace(in.Description)
	f := map[string]string{}
	if n := runeLen(in.Name); n < 2 || n > 120 {
		f["name"] = "ชื่อบริการต้องมี 2–120 ตัวอักษร"
	}
	if runeLen(in.Description) > 1000 {
		f["description"] = "รายละเอียดยาวเกิน 1000 ตัวอักษร"
	}
	if in.DurationMinutes < 15 || in.DurationMinutes > 480 || in.DurationMinutes%5 != 0 {
		f["duration_minutes"] = "ระยะเวลาต้องอยู่ระหว่าง 15–480 นาที และหารด้วย 5 ลงตัว"
	}
	if in.Price < 0 || in.Price > 100000 {
		f["price"] = "ราคาต้องอยู่ระหว่าง 0–100,000 บาท"
	}
	if len(f) > 0 {
		return httpx.Validation(f)
	}
	return nil
}

func (s *Store) CreateService(ctx context.Context, in ServiceInput) (*Service, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	active := in.IsActive == nil || *in.IsActive
	sv, err := scanService(s.pool.QueryRow(ctx, `INSERT INTO services (name, description, duration_minutes, price, is_active, is_popular, sort_order)
		VALUES ($1,$2,$3,$4,$5,$6, COALESCE(NULLIF($7,0), (SELECT COALESCE(MAX(sort_order),0)+1 FROM services)))
		RETURNING `+serviceCols, in.Name, in.Description, in.DurationMinutes, in.Price, active, in.IsPopular, in.SortOrder))
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

func (s *Store) UpdateService(ctx context.Context, id int, in ServiceInput) (*Service, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	sv, err := scanService(s.pool.QueryRow(ctx, `UPDATE services SET name=$2, description=$3, duration_minutes=$4, price=$5,
		is_active=COALESCE($6, is_active), is_popular=$7, sort_order=$8, updated_at=now()
		WHERE id=$1 RETURNING `+serviceCols, id, in.Name, in.Description, in.DurationMinutes, in.Price, in.IsActive, in.IsPopular, in.SortOrder))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, httpx.NotFound("ไม่พบบริการ")
	}
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

func (s *Store) SetServiceActive(ctx context.Context, id int, active bool) (*Service, error) {
	sv, err := scanService(s.pool.QueryRow(ctx, `UPDATE services SET is_active=$2, updated_at=now() WHERE id=$1 RETURNING `+serviceCols, id, active))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, httpx.NotFound("ไม่พบบริการ")
	}
	if err != nil {
		return nil, err
	}
	return &sv, nil
}
